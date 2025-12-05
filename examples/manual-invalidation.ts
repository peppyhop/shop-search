import { ShopClient } from 'shop-client';

const shop = new ShopClient('https://anuki.in', { cacheTTL: 60_000 });

async function demoManualInvalidation() {
  console.log('--- Manual Invalidation Demo ---');
  const info1 = await shop.getInfo();
  console.log('Initial info:', info1?.name);

  // Cached within TTL
  const info2 = await shop.getInfo();
  console.log('Cached info:', info2?.name);

  // Manually invalidate cache (e.g., after a known content update)
  shop.clearInfoCache();
  const info3 = await shop.getInfo();
  console.log('Refetched info (after manual invalidation):', info3?.name);
}

demoManualInvalidation().catch((err) => {
  console.error('Manual invalidation demo failed:', err);
});

