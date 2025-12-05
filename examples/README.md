# Examples

These small scripts demonstrate practical caching patterns with `ShopClient`, designed to be copy‑pasteable into your app.

How to run:
- Ensure Bun is installed (`curl -fsSL https://bun.sh/install | bash`).
- Replace `https://anuki.in` with your store domain if needed.
- Run any example: `bun examples/<file>.ts`

## Short TTL for Development
- File: `examples/caching-dev-ttl.ts`
- What it shows: Set a short `cacheTTL` (5s) for fast iteration; second call is cached; a call after TTL triggers a refetch.
- Run: `bun examples/caching-dev-ttl.ts`

## Manual Invalidation
- File: `examples/manual-invalidation.ts`
- What it shows: Call `clearInfoCache()` to bypass TTL when you know content has changed; the next `getInfo()` refetches.
- Run: `bun examples/manual-invalidation.ts`

## Stale‑While‑Revalidate (SWR)
- File: `examples/swr-get-info.ts`
- What it shows: A minimal SWR wrapper that returns cached data fast and triggers a background refresh with `getInfo({ force: true })` on a soft TTL.
- Run: `bun examples/swr-get-info.ts`

## Caching + Rate Limiting Interplay
- File: `examples/rate-limit-interplay.ts`
- What it shows: Configure rate limiting, observe cache avoiding unnecessary calls, and demonstrate concurrent `force` calls deduping into a single network request.
- Run: `bun examples/rate-limit-interplay.ts`

Notes:
- These examples import from `shop-client` to reflect real usage. If running inside this repository without publishing, you can adjust imports to point at local build outputs.
- All examples are safe to run multiple times; they only print to stdout.

