import { Store } from './index'; // Assuming your Store class is exported from index.ts

describe('Store Class Integration Tests', () => {
  let store: Store;
  const storeDomain = 'rimorestore.com';

  beforeAll(() => {
    store = new Store(`https://${storeDomain}/`);
  });

  test('should fetch first product with paginated and then find it by handle, and results should be consistent', async () => {
    console.log(`Testing with store: ${storeDomain}`);

    const paginatedResult = await store.products.paginated({ page: 1, limit: 1 });

    expect(paginatedResult).not.toBeNull();
    // It's possible a store has 0 products, or the first page with limit 1 has 0 products.
    // If you expect at least one product for rimorestore.com, you can be more strict.
    if (!paginatedResult || paginatedResult.length === 0) {
      console.warn(`No products found on page 1 with limit 1 for ${storeDomain}. Skipping find() part of the test.`);
      // Depending on expectations, this could be a fail or just a skip for the find part.
      // For this example, we'll assume it's okay if no product is returned and not proceed to find.
      expect(paginatedResult).toEqual([]); // or expect(paginatedResult.length).toBe(0);
      return; 
    }

    expect(paginatedResult.length).toBe(1);
    const productFromPaginated = paginatedResult[0];
    expect(productFromPaginated).toBeDefined();
    expect(productFromPaginated.handle).toBeDefined();
    expect(typeof productFromPaginated.handle).toBe('string');
    expect(productFromPaginated.handle.length).toBeGreaterThan(0);

    console.log(`Product from paginated: ${productFromPaginated.title} (Handle: ${productFromPaginated.handle})`);

    const productHandle = productFromPaginated.handle;
    const productFromFind = await store.products.find(productHandle);

    expect(productFromFind).not.toBeNull();
    if (!productFromFind) return; // Type guard for TypeScript
    
    console.log(`Product from find: ${productFromFind.title} (Handle: ${productFromFind.handle})`);

    // --- Assertions for consistency --- 
    // Direct deep equal might fail due to subtle differences from different Shopify API endpoints
    // expect(productFromFind).toEqual(productFromPaginated);

    expect(productFromFind.handle).toEqual(productFromPaginated.handle);
    expect(productFromFind.platformId).toEqual(productFromPaginated.platformId);
    expect(productFromFind.title).toEqual(productFromPaginated.title);
    expect(productFromFind.storeDomain).toEqual(productFromPaginated.storeDomain);
    expect(productFromFind.storeSlug).toEqual(productFromPaginated.storeSlug);

    // Price checks (ensure _parsePrice works consistently)
    expect(productFromFind.price).toEqual(productFromPaginated.price);
    expect(productFromFind.priceMin).toEqual(productFromPaginated.priceMin);
    expect(productFromFind.priceMax).toEqual(productFromPaginated.priceMax);
    expect(productFromFind.compareAtPrice).toEqual(productFromPaginated.compareAtPrice);

    // Body HTML might differ (description vs body_html)
    // expect(productFromFind.bodyHtml).toEqual(productFromPaginated.bodyHtml);
    // Product Type might differ (type vs product_type)
    // expect(productFromFind.productType).toEqual(productFromPaginated.productType);

    expect(productFromFind.vendor).toEqual(productFromPaginated.vendor);
    expect(productFromFind.tags.sort()).toEqual(productFromPaginated.tags.sort()); // Sort tags for comparison

    // Variants comparison (can be more detailed)
    expect(productFromFind.variants?.length).toEqual(productFromPaginated.variants?.length);
    if (productFromFind.variants && productFromPaginated.variants) {
        for (let i = 0; i < productFromFind.variants.length; i++) {
            expect(productFromFind.variants[i].platformId).toEqual(productFromPaginated.variants[i].platformId);
            expect(productFromFind.variants[i].title).toEqual(productFromPaginated.variants[i].title);
            expect(productFromFind.variants[i].price).toEqual(productFromPaginated.variants[i].price);
        }
    }

    // Images comparison (can be more detailed, e.g., check first image src if stable)
    // Note: product.images from /products.json vs product.media from /products/{handle}.js can lead to differences
    // expect(productFromFind.images.length).toEqual(productFromPaginated.images.length);
    if (productFromFind.images.length > 0 && productFromPaginated.images.length > 0) {
      expect(productFromFind.images[0].src).toEqual(productFromPaginated.images[0].src);
    }

    // Featured Image (can be tricky due to different sources)
    expect(productFromFind.featuredImage).toEqual(productFromPaginated.featuredImage);

    expect(productFromFind.available).toEqual(productFromPaginated.available);

  }, 30000); // Increase timeout if API calls are slow
});