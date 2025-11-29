import { parse } from "tldts";
import type { CurrencyCode } from "../types";

export function extractDomainWithoutSuffix(domain: string) {
  const parsedDomain = parse(domain);
  return parsedDomain.domainWithoutSuffix;
}

export function generateStoreSlug(domain: string): string {
  const input = new URL(domain);
  const parsedDomain = parse(input.href);
  const domainName =
    parsedDomain.domainWithoutSuffix ?? input.hostname.split(".")[0];

  return (domainName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const genProductSlug = ({
  handle,
  storeDomain,
}: {
  handle: string;
  storeDomain: string;
}) => {
  const storeSlug = generateStoreSlug(storeDomain);
  return `${handle}-by-${storeSlug}`;
};

export const calculateDiscount = (
  price: number,
  compareAtPrice?: number
): number =>
  !compareAtPrice || compareAtPrice === 0
    ? 0
    : Math.max(
        0,
        Math.round(100 - (price / compareAtPrice) * 100) // Removed the decimal precision
      );

/**
 * Normalize and sanitize a domain string.
 *
 * Accepts inputs like full URLs, protocol-relative URLs, bare hostnames,
 * or strings with paths/query/fragment, and returns a normalized domain.
 *
 * Examples:
 *  - "https://WWW.Example.com/path" -> "example.com"
 *  - "//sub.example.co.uk" -> "example.co.uk"
 *  - "www.example.com:8080" -> "example.com"
 *  - "example" -> "example"
 */
export function sanitizeDomain(
  input: string,
  opts?: { stripWWW?: boolean }
): string {
  if (typeof input !== "string") {
    throw new Error("sanitizeDomain: input must be a string");
  }
  const raw = input.trim();
  if (!raw) {
    throw new Error("sanitizeDomain: input cannot be empty");
  }

  const stripWWW = opts?.stripWWW ?? true;

  try {
    let url: URL;
    if (raw.startsWith("//")) {
      url = new URL(`https:${raw}`);
    } else if (raw.includes("://")) {
      url = new URL(raw);
    } else {
      url = new URL(`https://${raw}`);
    }
    let hostname = url.hostname.toLowerCase();
    if (stripWWW) hostname = hostname.replace(/^www\./, "");
    const parsed = parse(hostname);
    // If the caller explicitly wants to keep www, preserve it
    if (!stripWWW && /^www\./.test(url.hostname)) {
      return hostname;
    }
    return (parsed.domain ?? hostname) || hostname;
  } catch {
    // Fallback: attempt to sanitize without URL parsing
    let hostname = raw.toLowerCase();
    hostname = hostname.replace(/^[a-z]+:\/\//, ""); // remove protocol if present
    hostname = hostname.replace(/^\/\//, ""); // remove protocol-relative
    hostname = hostname.replace(/[/:#?].*$/, ""); // remove path/query/fragment/port
    if (stripWWW) hostname = hostname.replace(/^www\./, "");
    const parsed = parse(hostname);
    return (parsed.domain ?? hostname) || hostname;
  }
}

/**
 * Safely parse a date string into a Date object.
 *
 * Returns `undefined` when input is falsy or cannot be parsed into a valid date.
 * Use `|| null` at call sites that expect `null` instead of `undefined`.
 */
export function safeParseDate(input?: string | null): Date | undefined {
  if (!input || typeof input !== "string") return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Normalize an option name or value to a lowercase, underscore-separated key.
 */
export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Build a map from normalized option combination → variant id strings.
 * Example key: `size#xl##color#blue`.
 */
export function buildVariantOptionsMap(
  optionNames: string[],
  variants: Array<{
    id: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>
): Record<string, string> {
  const keys = optionNames.map(normalizeKey);
  const map: Record<string, string> = {};

  for (const v of variants) {
    const parts: string[] = [];
    if (keys[0] && v.option1)
      parts.push(`${keys[0]}#${normalizeKey(v.option1)}`);
    if (keys[1] && v.option2)
      parts.push(`${keys[1]}#${normalizeKey(v.option2)}`);
    if (keys[2] && v.option3)
      parts.push(`${keys[2]}#${normalizeKey(v.option3)}`);

    if (parts.length > 0) {
      // Ensure deterministic alphabetical ordering of parts
      if (parts.length > 1) parts.sort();
      const key = parts.join("##");
      const id = v.id.toString();
      // First-write wins: do not override if key already exists
      if (map[key] === undefined) {
        map[key] = id;
      }
    }
  }

  return map;
}

/**
 * Build a normalized variant key string from an object of option name → value.
 * - Normalizes both names and values using `normalizeKey`
 * - Sorts parts alphabetically for deterministic output
 * - Joins parts using `##` and uses `name#value` for each part
 *
 * Example output: `color#blue##size#xl`
 */
export function buildVariantKey(
  obj: Record<string, string | null | undefined>
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(obj)) {
    if (value) {
      parts.push(`${normalizeKey(name)}#${normalizeKey(value)}`);
    }
  }
  if (parts.length === 0) return "";
  parts.sort((a, b) => a.localeCompare(b));
  return parts.join("##");
}

/**
 * Format a price amount (in cents) using a given ISO 4217 currency code.
 * Falls back to a simple string when Intl formatting fails.
 */
export function formatPrice(
  amountInCents: number,
  currency: CurrencyCode
): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format((amountInCents || 0) / 100);
  } catch {
    const val = (amountInCents || 0) / 100;
    return `${val} ${currency}`;
  }
}
