export interface RateLimitOptions {
  maxRequestsPerInterval: number; // tokens refilled every interval
  intervalMs: number; // refill period
  maxConcurrency: number; // simultaneous in-flight requests
}

type Task<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
};

class RateLimiter {
  private options: RateLimitOptions;
  private queue: Task<any>[] = [];
  private tokens: number;
  private inFlight = 0;
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.tokens = options.maxRequestsPerInterval;
  }

  private startRefill() {
    if (this.refillTimer) return;
    this.refillTimer = setInterval(() => {
      this.tokens = this.options.maxRequestsPerInterval;
      this.tryRun();
    }, this.options.intervalMs);
    // In some runtimes, timers keep process alive; make it best-effort
    if (
      this.refillTimer &&
      typeof (this.refillTimer as any).unref === "function"
    ) {
      (this.refillTimer as any).unref();
    }
  }

  private stopRefill() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  private ensureRefillStarted() {
    if (!this.refillTimer) {
      this.startRefill();
    }
  }

  configure(next: Partial<RateLimitOptions>) {
    this.options = { ...this.options, ...next };
    // Clamp to sensible minimums
    this.options.maxRequestsPerInterval = Math.max(
      1,
      this.options.maxRequestsPerInterval
    );
    this.options.intervalMs = Math.max(10, this.options.intervalMs);
    this.options.maxConcurrency = Math.max(1, this.options.maxConcurrency);
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Start the timer lazily on first schedule/use
      this.ensureRefillStarted();
      this.queue.push({ fn, resolve, reject });
      this.tryRun();
    });
  }

  private tryRun() {
    while (
      this.queue.length > 0 &&
      this.inFlight < this.options.maxConcurrency &&
      this.tokens > 0
    ) {
      const task = this.queue.shift()!;
      this.tokens -= 1;
      this.inFlight += 1;

      // Execute task and release slot when done
      Promise.resolve()
        .then(task.fn)
        .then((result) => task.resolve(result))
        .catch((err) => task.reject(err))
        .finally(() => {
          this.inFlight -= 1;
          // Yield to event loop, then continue draining
          setTimeout(() => this.tryRun(), 0);
        });
    }
  }
}

let enabled = false;
const defaultOptions: RateLimitOptions = {
  maxRequestsPerInterval: 5, // 5 requests
  intervalMs: 1000, // per second
  maxConcurrency: 5, // up to 5 in parallel
};

const limiter = new RateLimiter(defaultOptions);
const hostLimiters = new Map<string, RateLimiter>();
const classLimiters = new Map<string, RateLimiter>();

export type RateLimitedRequestInit = RequestInit & { rateLimitClass?: string };

function getHost(input: RequestInfo | URL): string | undefined {
  try {
    if (typeof input === "string") {
      return new URL(input).host;
    }
    if (input instanceof URL) {
      return input.host;
    }
    // Request object or similar
    const url = (input as any).url as string | undefined;
    if (url) {
      return new URL(url).host;
    }
  } catch {
    // ignore parsing errors
  }
  return undefined;
}

function getHostLimiter(host?: string): RateLimiter | undefined {
  if (!host) return undefined;
  // Exact match first
  const exact = hostLimiters.get(host);
  if (exact) return exact;
  // Wildcard suffix match: keys of the form '*.example.com'
  for (const [key, lim] of hostLimiters.entries()) {
    if (key.startsWith("*.") && host.endsWith(key.slice(2))) {
      return lim;
    }
  }
  return undefined;
}

export function configureRateLimit(
  options: Partial<RateLimitOptions & { enabled: boolean }> & {
    perHost?: Record<string, Partial<RateLimitOptions>>; // key: host (supports '*.example.com')
    perClass?: Record<string, Partial<RateLimitOptions>>; // key: arbitrary class name
  }
) {
  if (typeof options.enabled === "boolean") {
    enabled = options.enabled;
  }
  const { perHost, perClass } = options;
  const globalOpts: Partial<RateLimitOptions> = {};
  if (typeof options.maxRequestsPerInterval === "number") {
    globalOpts.maxRequestsPerInterval = options.maxRequestsPerInterval;
  }
  if (typeof options.intervalMs === "number") {
    globalOpts.intervalMs = options.intervalMs;
  }
  if (typeof options.maxConcurrency === "number") {
    globalOpts.maxConcurrency = options.maxConcurrency;
  }
  if (Object.keys(globalOpts).length) {
    limiter.configure(globalOpts);
  }
  if (perHost) {
    for (const host of Object.keys(perHost)) {
      const opts = perHost[host]!;
      const existing = hostLimiters.get(host);
      if (existing) {
        existing.configure(opts);
      } else {
        hostLimiters.set(
          host,
          new RateLimiter({
            maxRequestsPerInterval:
              opts.maxRequestsPerInterval ??
              defaultOptions.maxRequestsPerInterval,
            intervalMs: opts.intervalMs ?? defaultOptions.intervalMs,
            maxConcurrency:
              opts.maxConcurrency ?? defaultOptions.maxConcurrency,
          })
        );
      }
    }
  }
  if (perClass) {
    for (const klass of Object.keys(perClass)) {
      const opts = perClass[klass]!;
      const existing = classLimiters.get(klass);
      if (existing) {
        existing.configure(opts);
      } else {
        classLimiters.set(
          klass,
          new RateLimiter({
            maxRequestsPerInterval:
              opts.maxRequestsPerInterval ??
              defaultOptions.maxRequestsPerInterval,
            intervalMs: opts.intervalMs ?? defaultOptions.intervalMs,
            maxConcurrency:
              opts.maxConcurrency ?? defaultOptions.maxConcurrency,
          })
        );
      }
    }
  }
}

export async function rateLimitedFetch(
  input: RequestInfo | URL,
  init?: RateLimitedRequestInit
): Promise<Response> {
  if (!enabled) {
    return fetch(input as any, init);
  }
  const klass = init?.rateLimitClass;
  const byClass = klass ? classLimiters.get(klass) : undefined;
  const byHost = getHostLimiter(getHost(input));
  const eff = byClass ?? byHost ?? limiter;
  return eff.schedule(() => fetch(input as any, init));
}

export function getRateLimitStatus() {
  return {
    enabled,
    options: { ...defaultOptions },
  };
}
