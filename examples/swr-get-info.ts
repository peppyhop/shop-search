import { ShopClient } from "shop-client";

// Derive the instance type from the value export for safer typing
type ShopClientInstance = InstanceType<typeof ShopClient>;

// Simple stale-while-revalidate pattern built on top of ShopClient.
// Returns quickly with the current cached value, then triggers a background refresh
// when data is considered stale according to a soft TTL you control.

function createSWRGetInfo(shop: ShopClientInstance, staleAfterMs = 60_000) {
  let lastRefreshTs = 0;
  let refreshing = false;

  return async function swrGetInfo() {
    const now = Date.now();
    // Always return the fastest path first (cached if fresh)
    const current = await shop.getInfo();

    // Trigger a background refresh if our soft TTL has passed
    if (!refreshing && now - lastRefreshTs > staleAfterMs) {
      refreshing = true;
      void shop
        .getInfo({ force: true })
        .then(() => {
          lastRefreshTs = Date.now();
        })
        .catch((err: unknown) => {
          console.warn("SWR background refresh failed:", err);
        })
        .finally(() => {
          refreshing = false;
        });
    }

    return current;
  };
}

async function demoSWR() {
  console.log("--- SWR getInfo Demo ---");
  const shop = new ShopClient("https://anuki.in", { cacheTTL: 5 * 60_000 });
  const swrGetInfo = createSWRGetInfo(shop, 30_000); // soft TTL: 30s

  // First call: fetch + cache, schedules background refresh if soft TTL passed
  console.log("Initial:", (await swrGetInfo())?.name);

  // Rapid repeat calls: return cached quickly; background refresh runs at most once per soft TTL
  console.log("Repeat:", (await swrGetInfo())?.name);
}

demoSWR().catch((err: unknown) => {
  console.error("SWR demo failed:", err);
});
