import { filter, isNonNullish } from "remeda";
import { Product, ShopifyProduct, ShopifySingleProduct } from "./types";

/**
 * Interface for product operations
 */
export interface ProductOperations {
  /**
   * Fetches all products from the store across all pages.
   */
  all(): Promise<Product[] | null>;
  
  /**
   * Fetches products with pagination support.
   */
  paginated(options?: { page?: number; limit?: number }): Promise<Product[] | null>;
  
  /**
   * Finds a specific product by its handle.
   */
  find(productHandle: string): Promise<Product | null>;
  
  /**
   * Fetches products that are showcased/featured on the store's homepage.
   */
  showcased(): Promise<Product[]>;
}

/**
 * Creates product operations for a store instance
 */
export function createProductOperations(
  baseUrl: string,
  storeDomain: string,
  fetchProducts: (page: number, limit: number) => Promise<Product[] | null>,
  productsDto: (products: ShopifyProduct[]) => Product[] | null,
  productDto: (product: ShopifySingleProduct) => Product,
  getStoreInfo: () => Promise<any>,
  findProduct: (handle: string) => Promise<Product | null>
): ProductOperations {
  return {
    /**
     * Fetches all products from the store across all pages.
     * 
     * @returns {Promise<Product[] | null>} Array of all products or null if error occurs
     * 
     * @throws {Error} When there's a network error or API failure
     * 
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * const allProducts = await shop.products.all();
     * 
     * console.log(`Found ${allProducts?.length} products`);
     * allProducts?.forEach(product => {
     *   console.log(product.title, product.price);
     * });
     * ```
     */
    all: async (): Promise<Product[] | null> => {
      const limit = 250;
      let allProducts: Product[] = [];

      async function fetchAll() {
        let currentPage = 1;

        while (true) {
          const products = await fetchProducts(currentPage, limit);

          if (!products || products.length === 0 || products.length < limit) {
            if (products && products.length > 0) {
              allProducts.push(...products);
            }
            break;
          }

          allProducts.push(...products);
          currentPage++;
        }
        return allProducts;
      }

      try {
        const products = await fetchAll();
        return products;
      } catch (error) {
        console.error("Failed to fetch all products:", storeDomain, error);
        throw error;
      }
    },

    /**
     * Fetches products with pagination support.
     * 
     * @param options - Pagination options
     * @param options.page - Page number (default: 1)
     * @param options.limit - Number of products per page (default: 250, max: 250)
     * 
     * @returns {Promise<Product[] | null>} Array of products for the specified page or null if error occurs
     * 
     * @throws {Error} When there's a network error or API failure
     * 
     * @example
   * ```typescript
   * const shop = new ShopClient('https://example.myshopify.com');
   * 
   * // Get first page with default limit (250)
   * const firstPage = await shop.products.paginated();
   * 
   * // Get second page with custom limit
   * const secondPage = await shop.products.paginated({ page: 2, limit: 50 });
   * ```
     */
    paginated: async (options?: {
      page?: number;
      limit?: number;
    }): Promise<Product[] | null> => {
      const page = options?.page ?? 1;
      const limit = Math.min(options?.limit ?? 250, 250);
      const url = `${baseUrl}products.json?limit=${limit}&page=${page}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `HTTP error! status: ${response.status} for ${storeDomain} page ${page}`,
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = (await response.json()) as {
          products: ShopifyProduct[];
        };
        if (data.products.length === 0) {
          return [];
        }
        return productsDto(data.products);
      } catch (error) {
        console.error(
          `Error fetching products for ${storeDomain} page ${page} with limit ${limit}:`,
          error,
        );
        return null;
      }
    },

    /**
     * Finds a specific product by its handle.
     * 
     * @param productHandle - The product handle (URL slug) to search for
     * 
     * @returns {Promise<Product | null>} The product if found, null if not found
     * 
     * @throws {Error} When the handle is invalid or there's a network error
     * 
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * 
     * // Find product by handle
     * const product = await shop.products.find('awesome-t-shirt');
     * 
     * if (product) {
     *   console.log(product.title, product.price);
     *   console.log('Available variants:', product.variants.length);
     * }
     * 
     * // Handle with query string
     * const productWithVariant = await shop.products.find('t-shirt?variant=123');
     * ```
     */
    find: async (productHandle: string): Promise<Product | null> => {
      // Validate product handle
      if (!productHandle || typeof productHandle !== 'string') {
        throw new Error('Product handle is required and must be a string');
      }

      try {
        let qs: string | null = null;
        if (productHandle.includes("?")) {
          const parts = productHandle.split("?");
          productHandle = parts[0];
          qs = parts[1];
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = productHandle.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!sanitizedHandle) {
          throw new Error('Invalid product handle format');
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error('Product handle is too long');
        }

        const url = `${baseUrl}products/${encodeURIComponent(sanitizedHandle)}.js${qs ? `?${qs}` : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const product = (await response.json()) as ShopifySingleProduct;
        const productData = productDto(product);
        return productData;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching product ${productHandle}:`,
            baseUrl,
            error.message,
          );
        }
        throw error;
      }
    },

    /**
     * Fetches products that are showcased/featured on the store's homepage.
     * 
     * @returns {Promise<Product[]>} Array of showcased products found on the homepage
     * 
     * @throws {Error} When there's a network error or API failure
     * 
     * @example
   * ```typescript
   * const shop = new ShopClient('https://example.myshopify.com');
   * const showcasedProducts = await shop.products.showcased();
   * 
   * console.log(`Found ${showcasedProducts.length} showcased products`);
   * showcasedProducts.forEach(product => {
   *   console.log(`Featured: ${product.title} - ${product.price}`);
   * });
   * ```
     */
    showcased: async () => {
      const storeInfo = await getStoreInfo();
      const products = await Promise.all(
        storeInfo.showcase.products.map((productHandle: string) =>
          findProduct(productHandle),
        ),
      );
      return filter(products, isNonNullish);
    },
  };
}