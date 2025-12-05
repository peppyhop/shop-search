import { ShopClient } from 'shop-client';

// Short TTL for fast iteration during development (e.g., 5 seconds)
const shop = new ShopClient('https://anuki.in', { cacheTTL: 5_000 });

async function demoDevTTL() {
  console.log('--- Dev TTL Demo ---');
  const info1 = await shop.getInfo();
  console.log('First call (fetch + cache):', info1?.name);

  // Within TTL: returns cached, no network
  const info2 = await shop.getInfo();
  console.log('Second call (cached):', info2?.name);

  // Wait past TTL: triggers refetch
  await new Promise((r) => setTimeout(r, 5200));
  const info3 = await shop.getInfo();
  console.log('Third call (post-TTL refetch):', info3?.name);
}

demoDevTTL().catch((err) => {
  console.error('Dev TTL demo failed:', err);
});

