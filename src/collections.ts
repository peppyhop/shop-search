import { filter, isNonNullish } from "remeda";
import { Collection, Product, ShopifyCollection } from "./types";

/**
 * Interface for collection operations
 */
export interface CollectionOperations {
  /**
   * Fetches all collections from the store across all pages.
   */
  all(): Promise<Collection[]>;
  
  /**
   * Finds a specific collection by its handle.
   */
  find(collectionHandle: string): Promise<Collection | null>;
  
  /**
   * Fetches collections that are showcased/featured on the store's homepage.
   */
  showcased(): Promise<Collection[]>;
  
  /**
   * Product-related methods for fetching products from specific collections.
   */
  products: {
    /**
     * Fetches products from a specific collection with pagination support.
     */
    paginated(
      collectionHandle: string,
      options?: { page?: number; limit?: number }
    ): Promise<Product[] | null>;
    
    /**
     * Fetches all products from a specific collection.
     */
    all(collectionHandle: string): Promise<Product[] | null>;
  };
}

/**
 * Creates collection operations for a store instance
 */
export function createCollectionOperations(
  baseUrl: string,
  storeDomain: string,
  fetchCollections: (page: number, limit: number) => Promise<Collection[] | null>,
  collectionsDto: (collections: ShopifyCollection[]) => Collection[],
  fetchPaginatedProductsFromCollection: (
    collectionHandle: string,
    options?: { page?: number; limit?: number }
  ) => Promise<Product[] | null>,
  getStoreInfo: () => Promise<any>,
  findCollection: (handle: string) => Promise<Collection | null>
): CollectionOperations {
  return {
    /**
     * Fetches all collections from the store across all pages.
     * 
     * @returns {Promise<Collection[]>} Array of all collections
     * 
     * @throws {Error} When there's a network error or API failure
     * 
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * const allCollections = await shop.collections.all();
     * 
     * console.log(`Found ${allCollections.length} collections`);
     * allCollections.forEach(collection => {
     *   console.log(collection.title, collection.handle);
     * });
     * ```
     */
    all: async (): Promise<Collection[]> => {
      const limit = 250;
      let allCollections: Collection[] = [];

      async function fetchAll() {
        let currentPage = 1;

        while (true) {
          const collections = await fetchCollections(currentPage, limit);

          if (
            !collections ||
            collections.length === 0 ||
            collections.length < limit
          ) {
            if (!collections) {
              console.warn(
                "fetchCollections returned null, treating as empty array.",
              );
              break;
            }
            if (collections && collections.length > 0) {
              allCollections.push(...collections);
            }
            break;
          }

          allCollections.push(...collections);
          currentPage++;
        }
        return allCollections;
      }

      try {
        const collections = await fetchAll();
        return collections || [];
      } catch (error) {
        console.error(
          "Failed to fetch all collections:",
          storeDomain,
          error,
        );
        throw error;
      }
    },

    /**
     * Finds a specific collection by its handle.
     * 
     * @param collectionHandle - The collection handle (URL slug) to search for
     * 
     * @returns {Promise<Collection | null>} The collection if found, null if not found
     * 
     * @throws {Error} When the handle is invalid or there's a network error
     * 
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * const collection = await shop.collections.find('featured-products');
     * console.log(collection);
     * ```
     */
    find: async (collectionHandle: string): Promise<Collection | null> => {
      // Validate collection handle
      if (!collectionHandle || typeof collectionHandle !== 'string') {
        throw new Error('Collection handle is required and must be a string');
      }

      // Sanitize handle - remove potentially dangerous characters
      const sanitizedHandle = collectionHandle.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
      if (!sanitizedHandle) {
        throw new Error('Invalid collection handle format');
      }

      // Check handle length (reasonable limits)
      if (sanitizedHandle.length > 255) {
        throw new Error('Collection handle is too long');
      }

      try {
        const url = `${baseUrl}collections/${encodeURIComponent(sanitizedHandle)}.json`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = (await response.json()) as {
          collection: ShopifyCollection;
        };
        
        let collectionImage = result.collection.image;
        if (!collectionImage) {
          const collectionProduct = (
            await fetchPaginatedProductsFromCollection(
              result.collection.handle,
              {
                limit: 1,
                page: 1,
              },
            )
          )?.at(0);
          const collectionProductImage = collectionProduct?.images?.[0];
          if (collectionProduct && collectionProductImage) {
            collectionImage = {
              id: collectionProductImage.id,
              src: collectionProductImage.src,
              alt: collectionProductImage.alt || collectionProduct.title,
              created_at:
                collectionProductImage.createdAt || new Date().toISOString(),
            };
          }
        }
        
        const collectionData = collectionsDto([
          {
            ...result.collection,
            image: collectionImage,
          },
        ]);
        return collectionData[0] || null;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching collection ${sanitizedHandle}:`,
            baseUrl,
            error.message,
          );
        }
        throw error;
      }
    },

    /**
     * Fetches collections that are showcased/featured on the store's homepage.
     * 
     * @returns {Promise<Collection[]>} Array of showcased collections found on the homepage
     * 
     * @throws {Error} When there's a network error or API failure
     * 
     * @example
     * ```typescript
     * const store = new Store('https://example.myshopify.com');
     * const showcasedCollections = await store.collections.showcased();
     * 
     * console.log(`Found ${showcasedCollections.length} showcased collections`);
     * showcasedCollections.forEach(collection => {
     *   console.log(`Featured: ${collection.title} - ${collection.productsCount} products`);
     * });
     * ```
     */
    showcased: async () => {
      const storeInfo = await getStoreInfo();
      const collections = await Promise.all(
        storeInfo.showcase.collections.map((collectionHandle: string) =>
          findCollection(collectionHandle),
        ),
      );
      return filter(collections, isNonNullish);
    },

    products: {
      /**
       * Fetches products from a specific collection with pagination support.
       * 
       * @param collectionHandle - The collection handle to fetch products from
       * @param options - Pagination options
       * @param options.page - Page number (default: 1)
       * @param options.limit - Number of products per page (default: 250, max: 250)
       * 
       * @returns {Promise<Product[] | null>} Array of products from the collection or null if error occurs
       * 
       * @throws {Error} When the collection handle is invalid or there's a network error
       * 
       * @example
       * ```typescript
       * const shop = new ShopClient('https://example.myshopify.com');
       * 
       * // Get first page of products from a collection
       * const products = await shop.collections.products.paginated('summer-collection');
       * 
       * // Get second page with custom limit
       * const moreProducts = await shop.collections.products.paginated(
       *   'summer-collection', 
       *   { page: 2, limit: 50 }
       * );
       * ```
       */
      paginated: async (
        collectionHandle: string,
        options?: {
          page?: number;
          limit?: number;
        },
      ) => {
        // Validate collection handle
        if (!collectionHandle || typeof collectionHandle !== 'string') {
          throw new Error('Collection handle is required and must be a string');
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = collectionHandle.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!sanitizedHandle) {
          throw new Error('Invalid collection handle format');
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error('Collection handle is too long');
        }

        // Validate pagination options
        const page = options?.page || 1;
        const limit = options?.limit || 250;

        if (page < 1 || limit < 1 || limit > 250) {
          throw new Error('Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250');
        }

        return fetchPaginatedProductsFromCollection(
          sanitizedHandle,
          {
            page,
            limit,
          },
        );
      },

      /**
       * Fetches all products from a specific collection.
       * 
       * @param collectionHandle - The collection handle to fetch products from
       * 
       * @returns {Promise<Product[] | null>} Array of all products from the collection or null if error occurs
       * 
       * @throws {Error} When the collection handle is invalid or there's a network error
       * 
       * @example
       * ```typescript
       * const shop = new ShopClient('https://example.myshopify.com');
       * const allProducts = await shop.collections.products.all('summer-collection');
       * 
       * if (allProducts) {
       *   console.log(`Found ${allProducts.length} products in the collection`);
       *   allProducts.forEach(product => {
       *     console.log(`${product.title} - $${product.price}`);
       *   });
       * }
       * ```
       */
      all: async (collectionHandle: string): Promise<Product[] | null> => {
        // Validate collection handle
        if (!collectionHandle || typeof collectionHandle !== 'string') {
          throw new Error('Collection handle is required and must be a string');
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = collectionHandle.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!sanitizedHandle) {
          throw new Error('Invalid collection handle format');
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error('Collection handle is too long');
        }

        try {
          const limit = 250;
          let allProducts: Product[] = [];

          let currentPage = 1;

          while (true) {
            const products = await fetchPaginatedProductsFromCollection(
              sanitizedHandle,
              {
                page: currentPage,
                limit,
              },
            );
            
            if (
              !products ||
              products.length === 0 ||
              products.length < limit
            ) {
              if (products && products.length > 0) {
                allProducts.push(...products);
              }
              break;
            }
            
            allProducts.push(...products);
            currentPage++;
          }
          
          return allProducts;
        } catch (error) {
          console.error(
            `Error fetching all products for collection ${sanitizedHandle}:`,
            baseUrl,
            error,
          );
          return null;
        }
      },
    },
  };
}