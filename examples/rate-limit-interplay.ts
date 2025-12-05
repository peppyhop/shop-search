import { ShopClient, configureRateLimit } from 'shop-client';

// Demonstrates interplay of caching and rate limiting:
// - Configure modest rate limit to show retries/backoff
// - Use cache to avoid unnecessary calls
// - Force refetch to show dedupe + single network hit under contention

configureRateLimit({
  maxRequestsPerWindow: 5,
  windowMs: 1_000,
  maxRetries: 2,
  baseDelayMs: 200,
});

const shop = new ShopClient('https://anuki.in', { cacheTTL: 30_000 });

async function demoRateLimitInterplay() {
  console.log('--- Rate Limit + Cache Interplay Demo ---');

  // 1) First call fetches; subsequent calls use cache, avoiding rate limiter
  const info1 = await shop.getInfo();
  console.log('First fetch:', info1?.name);

  const info2 = await shop.getInfo();
  console.log('Cached fetch:', info2?.name);

  // 2) Concurrent forced calls dedupe into a single network request
  const [a, b, c] = await Promise.all([
    shop.getInfo({ force: true }),
    shop.getInfo({ force: true }),
    shop.getInfo({ force: true }),
  ]);

  console.log('Concurrent forced result A:', a?.name);
  console.log('Concurrent forced result B:', b?.name);
  console.log('Concurrent forced result C:', c?.name);

  // 3) After force refresh, subsequent calls are cached again
  const info3 = await shop.getInfo();
  console.log('Post-refresh cached fetch:', info3?.name);
}

demoRateLimitInterplay().catch((err) => {
  console.error('Rate limit interplay demo failed:', err);
});

