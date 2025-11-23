import { unique } from "remeda";
import { CheckoutOperations, createCheckoutOperations } from "./checkout";
import {
  CollectionOperations,
  createCollectionOperations,
} from "./collections";
import { createProductOperations, ProductOperations } from "./products";
import { createStoreOperations, StoreInfo, StoreOperations } from "./store";
import type { StoreTypeBreakdown } from "./types";
import {
  Collection,
  Product,
  ShopifyCollection,
  ShopifyProduct,
  ShopifySingleProduct,
} from "./types";
import { detectShopifyCountry } from "./utils/detect-country";
import {
  buildVariantOptionsMap,
  extractDomainWithoutSuffix,
  generateStoreSlug,
  genProductSlug,
  normalizeKey,
  safeParseDate,
  sanitizeDomain,
} from "./utils/func";

/**
 * A comprehensive Shopify store client for fetching products, collections, and store information.
 *
 * @example
 * ```typescript
 * import { ShopClient } from 'shop-search';
 *
 * const shop = new ShopClient('https://exampleshop.com');
 *
 * // Fetch all products
 * const products = await shop.products.all();
 *
 * // Get store information
 * const storeInfo = await shop.getInfo();
 * ```
 */
export class ShopClient {
  private storeDomain: string;
  private baseUrl: string;
  private validationCache: Map<string, boolean> = new Map(); // Simple cache for validation results
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes cache expiry
  private cacheTimestamps: Map<string, number> = new Map();

  // Cache frequently used values to avoid recalculation
  private storeSlug: string;
  private normalizeImageUrlCache: Map<string, string> = new Map();
  private storeOperations: StoreOperations;

  // Public operations interfaces
  public products: ProductOperations;
  public collections: CollectionOperations;
  public checkout: CheckoutOperations;

  /**
   * Creates a new ShopClient instance for interacting with a Shopify store.
   *
   * @param urlPath - The Shopify store URL (e.g., 'https://exampleshop.com' or 'exampleshop.com')
   *
   * @throws {Error} When the URL is invalid or contains malicious patterns
   *
   * @example
   * ```typescript
   * // With full URL
   * const shop = new ShopClient('https://exampleshop.com');
   *
   * // Without protocol (automatically adds https://)
   * const shop = new ShopClient('exampleshop.com');
   *
   * // Works with any Shopify store domain
   * const shop1 = new ShopClient('https://example.myshopify.com');
   * const shop2 = new ShopClient('https://boutique.fashion');
   * ```
   */
  constructor(urlPath: string) {
    // Validate input URL
    if (!urlPath || typeof urlPath !== "string") {
      throw new Error("Store URL is required and must be a string");
    }

    // Sanitize and validate URL
    let normalizedUrl = urlPath.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let storeUrl: URL;
    try {
      storeUrl = new URL(normalizedUrl);
    } catch (error) {
      throw new Error("Invalid store URL format");
    }

    // Validate domain format (basic check for Shopify domains)
    const hostname = storeUrl.hostname;
    if (!hostname || hostname.length < 3) {
      throw new Error("Invalid domain name");
    }

    // Check for potentially malicious patterns
    if (
      hostname.includes("..") ||
      hostname.includes("//") ||
      hostname.includes("@")
    ) {
      throw new Error("Invalid characters in domain name");
    }

    // Validate domain structure - must contain at least one dot for TLD
    if (
      !hostname.includes(".") ||
      hostname.startsWith(".") ||
      hostname.endsWith(".")
    ) {
      throw new Error(
        "Invalid domain format - must be a valid domain with TLD"
      );
    }

    // Check for valid domain pattern (basic regex)
    const domainPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainPattern.test(hostname)) {
      throw new Error("Invalid domain format");
    }

    this.storeDomain = `https://${hostname}`;
    let fetchUrl = `https://${hostname}${storeUrl.pathname}`;
    if (!fetchUrl.endsWith("/")) {
      fetchUrl = `${fetchUrl}/`;
    }
    this.baseUrl = fetchUrl;

    // Pre-calculate store slug once
    this.storeSlug = generateStoreSlug(this.storeDomain);

    // Initialize operations
    this.storeOperations = createStoreOperations({
      baseUrl: this.baseUrl,
      storeDomain: this.storeDomain,
      validateProductExists: this.validateProductExists.bind(this),
      validateCollectionExists: this.validateCollectionExists.bind(this),
      validateLinksInBatches: this.validateLinksInBatches.bind(this),
      handleFetchError: this.handleFetchError.bind(this),
    });

    this.products = createProductOperations(
      this.baseUrl,
      this.storeDomain,
      this.fetchProducts.bind(this),
      this.productsDto.bind(this),
      this.productDto.bind(this),
      () => this.getInfo(),
      (handle: string) => this.products.find(handle)
    );

    this.collections = createCollectionOperations(
      this.baseUrl,
      this.storeDomain,
      this.fetchCollections.bind(this),
      this.collectionsDto.bind(this),
      this.fetchPaginatedProductsFromCollection.bind(this),
      () => this.getInfo(),
      (handle: string) => this.collections.find(handle)
    );

    this.checkout = createCheckoutOperations(this.baseUrl);
  }

  /**
   * Optimized image URL normalization with caching
   */
  private normalizeImageUrl(url?: string | null): string {
    if (!url) {
      return "";
    }

    if (this.normalizeImageUrlCache.has(url)) {
      return this.normalizeImageUrlCache.get(url)!;
    }

    const normalized = url.startsWith("//") ? `https:${url}` : url;
    this.normalizeImageUrlCache.set(url, normalized);
    return normalized;
  }

  /**
   * Calculate price statistics for variants
   */
  private calculatePriceStats(variants: any[], priceField: string) {
    const prices = variants
      .map((variant) => Number.parseFloat(variant[priceField]))
      .filter((price) => !Number.isNaN(price));

    if (prices.length === 0) {
      return { min: "0.00", max: "0.00" };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      min: minPrice.toFixed(2),
      max: maxPrice.toFixed(2),
    };
  }

  /**
   * Transform Shopify products to our Product format
   */
  productsDto(products: ShopifyProduct[]): Product[] | null {
    if (!products || products.length === 0) {
      return null;
    }
    return products.map((product) => {
      const optionNames = product.options.map((o) => o.name);
      const variantOptionsMap = buildVariantOptionsMap(
        optionNames,
        product.variants
      );

      return {
        slug: genProductSlug({
          handle: product.handle,
          storeDomain: this.storeDomain,
        }),
        handle: product.handle,
        platformId: product.id.toString(),
        title: product.title,
        available: product.variants.some((v) => v.available),
        price: Math.min(
          ...product.variants.map((v) =>
            typeof v.price === "string"
              ? Number.parseFloat(v.price) * 100
              : v.price
          )
        ),
        priceMin: Math.min(
          ...product.variants.map((v) =>
            typeof v.price === "string"
              ? Number.parseFloat(v.price) * 100
              : v.price
          )
        ),
        priceMax: Math.max(
          ...product.variants.map((v) =>
            typeof v.price === "string"
              ? Number.parseFloat(v.price) * 100
              : v.price
          )
        ),
        priceVaries:
          product.variants.length > 1 &&
          new Set(
            product.variants.map((v) =>
              typeof v.price === "string"
                ? Number.parseFloat(v.price) * 100
                : v.price
            )
          ).size > 1,
        compareAtPrice: Math.min(
          ...product.variants.map((v) =>
            v.compare_at_price
              ? typeof v.compare_at_price === "string"
                ? Number.parseFloat(v.compare_at_price) * 100
                : v.compare_at_price
              : 0
          )
        ),
        compareAtPriceMin: Math.min(
          ...product.variants.map((v) =>
            v.compare_at_price
              ? typeof v.compare_at_price === "string"
                ? Number.parseFloat(v.compare_at_price) * 100
                : v.compare_at_price
              : 0
          )
        ),
        compareAtPriceMax: Math.max(
          ...product.variants.map((v) =>
            v.compare_at_price
              ? typeof v.compare_at_price === "string"
                ? Number.parseFloat(v.compare_at_price) * 100
                : v.compare_at_price
              : 0
          )
        ),
        compareAtPriceVaries:
          product.variants.length > 1 &&
          new Set(
            product.variants.map((v) =>
              v.compare_at_price
                ? typeof v.compare_at_price === "string"
                  ? Number.parseFloat(v.compare_at_price) * 100
                  : v.compare_at_price
                : 0
            )
          ).size > 1,
        discount: 0, // Calculate if needed
        currency: "USD", // Default or extract from store
        options: product.options.map((option) => ({
          key: normalizeKey(option.name),
          data: option.values,
          name: option.name,
          position: option.position,
          values: option.values,
        })),
        variantOptionsMap,
        bodyHtml: product.body_html || null,
        active: true,
        productType: product.product_type || null,
        tags: Array.isArray(product.tags) ? product.tags : [],
        vendor: product.vendor,
        featuredImage:
          product.images.length > 0
            ? this.normalizeImageUrl(product.images[0].src)
            : null,
        isProxyFeaturedImage: false,
        createdAt: safeParseDate(product.created_at),
        updatedAt: safeParseDate(product.updated_at),
        variants: product.variants.map((variant) => ({
          id: variant.id.toString(),
          platformId: variant.id.toString(),
          name: variant.name,
          title: variant.title,
          option1: variant.option1 || null,
          option2: variant.option2 || null,
          option3: variant.option3 || null,
          options: [variant.option1, variant.option2, variant.option3].filter(
            Boolean
          ) as string[],
          sku: variant.sku || null,
          requiresShipping: variant.requires_shipping,
          taxable: variant.taxable,
          featuredImage: variant.featured_image
            ? {
                id: variant.featured_image.id,
                src: variant.featured_image.src,
                width: variant.featured_image.width,
                height: variant.featured_image.height,
                position: variant.featured_image.position,
                productId: variant.featured_image.product_id,
                aspectRatio: variant.featured_image.aspect_ratio,
                variantIds: variant.featured_image.variant_ids || [],
                createdAt: variant.featured_image.created_at,
                updatedAt: variant.featured_image.updated_at,
                alt: variant.featured_image.alt,
              }
            : null,
          available: variant.available,
          price:
            typeof variant.price === "string"
              ? Number.parseFloat(variant.price) * 100
              : variant.price, // Convert string prices from dollars to cents
          weightInGrams: variant.weightInGrams,
          compareAtPrice: variant.compare_at_price
            ? typeof variant.compare_at_price === "string"
              ? Number.parseFloat(variant.compare_at_price) * 100
              : variant.compare_at_price
            : 0, // Convert string prices from dollars to cents
          position: variant.position,
          productId: variant.product_id,
          createdAt: variant.created_at,
          updatedAt: variant.updated_at,
        })),
        images: product.images.map((image) => ({
          id: image.id,
          productId: image.product_id,
          alt: null, // ShopifyImage doesn't have alt property
          position: image.position,
          src: this.normalizeImageUrl(image.src),
          width: image.width,
          height: image.height,
          mediaType: "image" as const,
          variantIds: image.variant_ids || [],
          createdAt: image.created_at,
          updatedAt: image.updated_at,
        })),
        publishedAt: safeParseDate(product.published_at) ?? null,
        seo: null,
        metaTags: null,
        displayScore: undefined,
        deletedAt: null,
        storeSlug: this.storeDomain,
        storeDomain: this.storeDomain,
        url: `${this.storeDomain}/products/${product.handle}`,
      };
    });
  }

  productDto(product: ShopifySingleProduct): Product {
    const optionNames = product.options.map((o) => o.name);
    const variantOptionsMap = buildVariantOptionsMap(
      optionNames,
      product.variants
    );

    return {
      slug: genProductSlug({
        handle: product.handle,
        storeDomain: this.storeDomain,
      }),
      handle: product.handle,
      platformId: product.id.toString(),
      title: product.title,
      available: product.available,
      price: product.price, // Already in correct format (cents as integer)
      priceMin: product.price_min, // Already in correct format (cents as integer)
      priceMax: product.price_max, // Already in correct format (cents as integer)
      priceVaries: product.price_varies,
      compareAtPrice: product.compare_at_price || 0, // Already in correct format (cents as integer)
      compareAtPriceMin: product.compare_at_price_min, // Already in correct format (cents as integer)
      compareAtPriceMax: product.compare_at_price_max, // Already in correct format (cents as integer)
      compareAtPriceVaries: product.compare_at_price_varies,
      discount: 0, // Calculate if needed
      currency: "USD", // Default or extract from store
      options: product.options.map((option) => ({
        key: normalizeKey(option.name),
        data: option.values,
        name: option.name,
        position: option.position,
        values: option.values,
      })),
      variantOptionsMap,
      bodyHtml: product.description || null,
      active: true,
      productType: product.type || null,
      tags: Array.isArray(product.tags)
        ? product.tags
        : typeof product.tags === "string"
          ? [product.tags]
          : [],
      vendor: product.vendor,
      featuredImage: this.normalizeImageUrl(product.featured_image),
      isProxyFeaturedImage: false,
      createdAt: safeParseDate(product.created_at),
      updatedAt: safeParseDate(product.updated_at),
      variants: product.variants.map((variant) => ({
        id: variant.id.toString(),
        platformId: variant.id.toString(),
        name: undefined, // ShopifySingleProductVariant doesn't have name property
        title: variant.title,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        options: [variant.option1, variant.option2, variant.option3].filter(
          Boolean
        ) as string[],
        sku: variant.sku,
        requiresShipping: variant.requires_shipping,
        taxable: variant.taxable,
        featuredImage: variant.featured_image
          ? {
              id: variant.featured_image.id,
              src: variant.featured_image.src,
              width: variant.featured_image.width,
              height: variant.featured_image.height,
              position: variant.featured_image.position,
              productId: variant.featured_image.product_id,
              aspectRatio: variant.featured_image.aspect_ratio || 0,
              variantIds: variant.featured_image.variant_ids,
              createdAt: variant.featured_image.created_at,
              updatedAt: variant.featured_image.updated_at,
              alt: variant.featured_image.alt,
            }
          : null,
        available: variant.available || false,
        price:
          typeof variant.price === "string"
            ? Number.parseFloat(variant.price)
            : variant.price, // Already in correct format (cents as integer)
        weightInGrams: variant.grams,
        compareAtPrice:
          typeof variant.compare_at_price === "string"
            ? Number.parseFloat(variant.compare_at_price || "0")
            : variant.compare_at_price || 0, // Already in correct format (cents as integer)
        position: variant.position,
        productId: variant.product_id,
        createdAt: variant.created_at,
        updatedAt: variant.updated_at,
      })),
      images: Array.isArray(product.images)
        ? product.images.map((imageSrc, index) => ({
            id: index + 1,
            productId: product.id,
            alt: null,
            position: index + 1,
            src: this.normalizeImageUrl(imageSrc),
            width: 0,
            height: 0,
            mediaType: "image" as const,
            variantIds: [],
            createdAt: product.created_at,
            updatedAt: product.updated_at,
          }))
        : [],
      publishedAt: safeParseDate(product.published_at) ?? null,
      seo: null,
      metaTags: null,
      displayScore: undefined,
      deletedAt: null,
      storeSlug: this.storeDomain,
      storeDomain: this.storeDomain,
      url: product.url || `${this.storeDomain}/products/${product.handle}`,
    };
  }

  collectionsDto(collections: ShopifyCollection[]): Collection[] {
    return collections.map((collection) => ({
      id: collection.id.toString(),
      title: collection.title,
      handle: collection.handle,
      description: collection.description,
      image: collection.image
        ? {
            id: collection.image.id,
            createdAt: collection.image.created_at,
            src: collection.image.src,
            alt: collection.image.alt,
          }
        : undefined,
      productsCount: collection.products_count,
      publishedAt: collection.published_at,
      updatedAt: collection.updated_at,
    }));
  }

  /**
   * Enhanced error handling with context
   */
  private handleFetchError(
    error: unknown,
    context: string,
    url: string
  ): never {
    let errorMessage = `Error ${context}`;
    let statusCode: number | undefined;

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;

      // Check if it's a fetch error with response
      if ("status" in error) {
        statusCode = error.status as number;
      }
    } else if (typeof error === "string") {
      errorMessage += `: ${error}`;
    } else {
      errorMessage += ": Unknown error occurred";
    }

    // Add URL context for debugging
    errorMessage += ` (URL: ${url})`;

    // Add status code if available
    if (statusCode) {
      errorMessage += ` (Status: ${statusCode})`;
    }

    // Create enhanced error with additional properties
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).context = context;
    (enhancedError as any).url = url;
    (enhancedError as any).statusCode = statusCode;
    (enhancedError as any).originalError = error;

    throw enhancedError;
  }

  /**
   * Fetch products with pagination
   */
  private async fetchProducts(
    page: number,
    limit: number
  ): Promise<Product[] | null> {
    try {
      const url = `${this.baseUrl}products.json?page=${page}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { products: ShopifyProduct[] } = await response.json();
      return this.productsDto(data.products);
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching products",
        `${this.baseUrl}products.json`
      );
    }
  }

  /**
   * Fetch collections with pagination
   */
  private async fetchCollections(page: number, limit: number) {
    try {
      const url = `${this.baseUrl}collections.json?page=${page}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.collectionsDto(data.collections);
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching collections",
        `${this.baseUrl}collections.json`
      );
    }
  }

  /**
   * Fetch paginated products from a specific collection
   */
  private async fetchPaginatedProductsFromCollection(
    collectionHandle: string,
    options: { page?: number; limit?: number } = {}
  ) {
    try {
      const { page = 1, limit = 250 } = options;
      const url = `${this.baseUrl}collections/${collectionHandle}/products.json?page=${page}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Collection not found
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { products: ShopifyProduct[] } = await response.json();
      return this.productsDto(data.products);
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching products from collection",
        `${this.baseUrl}collections/${collectionHandle}/products.json`
      );
    }
  }

  /**
   * Validate if a product exists (with caching)
   */
  private async validateProductExists(handle: string): Promise<boolean> {
    const cacheKey = `product:${handle}`;

    if (this.isCacheValid(cacheKey)) {
      return this.validationCache.get(cacheKey) || false;
    }

    try {
      const url = `${this.baseUrl}products/${handle}.js`;
      const response = await fetch(url, { method: "HEAD" });
      const exists = response.ok;

      this.setCacheValue(cacheKey, exists);
      return exists;
    } catch (error) {
      this.setCacheValue(cacheKey, false);
      return false;
    }
  }

  /**
   * Validate if a collection exists (with caching)
   */
  private async validateCollectionExists(handle: string): Promise<boolean> {
    const cacheKey = `collection:${handle}`;

    if (this.isCacheValid(cacheKey)) {
      return this.validationCache.get(cacheKey) || false;
    }

    try {
      const url = `${this.baseUrl}collections/${handle}.js`;
      const response = await fetch(url, { method: "HEAD" });
      const exists = response.ok;

      this.setCacheValue(cacheKey, exists);
      return exists;
    } catch (error) {
      this.setCacheValue(cacheKey, false);
      return false;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;

    return Date.now() - timestamp < this.cacheExpiry;
  }

  /**
   * Set cache value with timestamp
   */
  private setCacheValue(key: string, value: boolean): void {
    this.validationCache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Validate links in batches to avoid overwhelming the server
   */
  private async validateLinksInBatches<T>(
    items: T[],
    validator: (item: T) => Promise<boolean>,
    batchSize = 10
  ): Promise<T[]> {
    const validItems: T[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const validationPromises = batch.map(async (item) => {
        const isValid = await validator(item);
        return isValid ? item : null;
      });

      const results = await Promise.all(validationPromises);
      const validBatchItems = results.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      validItems.push(...validBatchItems);

      // Add small delay between batches to be respectful
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return validItems;
  }

  /**
   * Fetches comprehensive store information including metadata, social links, and showcase content.
   *
   * @returns {Promise<StoreInfo>} Store information object containing:
   * - `name` - Store name from meta tags or domain
   * - `domain` - Store domain URL
   * - `slug` - Generated store slug
   * - `title` - Store title from meta tags
   * - `description` - Store description from meta tags
   * - `logoUrl` - Store logo URL from Open Graph or CDN
   * - `socialLinks` - Object with social media links (facebook, twitter, instagram, etc.)
   * - `contactLinks` - Object with contact information (tel, email, contactPage)
   * - `headerLinks` - Array of navigation links from header
   * - `showcase` - Object with featured products and collections from homepage
   * - `jsonLdData` - Structured data from JSON-LD scripts
   * - `techProvider` - Shopify-specific information (walletId, subDomain)
   * - `country` - Country detection results with ISO 3166-1 alpha-2 codes (e.g., "US", "GB")
   *
   * @throws {Error} When the store URL is unreachable or returns an error
   *
   * @example
   * ```typescript
   * const shop = new ShopClient('https://exampleshop.com');
   * const storeInfo = await shop.getInfo();
   *
   * console.log(storeInfo.name); // "Example Store"
   * console.log(storeInfo.socialLinks.instagram); // "https://instagram.com/example"
   * console.log(storeInfo.showcase.products); // ["product-handle-1", "product-handle-2"]
   * console.log(storeInfo.country); // "US"
   * ```
   */
  async getInfo(): Promise<StoreInfo> {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();

      const getMetaTag = (name: string) => {
        const regex = new RegExp(
          `<meta[^>]*name=["']${name}["'][^>]*content=["'](.*?)["']`
        );
        const match = html.match(regex);
        return match ? match[1] : null;
      };

      const getPropertyMetaTag = (property: string) => {
        const regex = new RegExp(
          `<meta[^>]*property=["']${property}["'][^>]*content=["'](.*?)["']`
        );
        const match = html.match(regex);
        return match ? match[1] : null;
      };

      const name =
        getMetaTag("og:site_name") ?? extractDomainWithoutSuffix(this.baseUrl);
      const title = getMetaTag("og:title") ?? getMetaTag("twitter:title");

      const description =
        getMetaTag("description") || getPropertyMetaTag("og:description");

      const shopifyWalletId = getMetaTag("shopify-digital-wallet")?.split(
        "/"
      )[1];

      const myShopifySubdomainMatch = html.match(
        /['"](.*?\.myshopify\.com)['"]/
      );
      const myShopifySubdomain = myShopifySubdomainMatch
        ? myShopifySubdomainMatch[1]
        : null;

      let logoUrl =
        getPropertyMetaTag("og:image") ||
        getPropertyMetaTag("og:image:secure_url");
      if (!logoUrl) {
        const logoMatch = html.match(
          /<img[^>]+src=["']([^"']+\/cdn\/shop\/[^"']+)["']/
        );
        logoUrl = logoMatch
          ? logoMatch[1].replace("http://", "https://")
          : null;
      } else {
        logoUrl = logoUrl.replace("http://", "https://");
      }

      const socialLinks: Record<string, string> = {};
      const socialRegex =
        /<a[^>]+href=["']([^"']*(?:facebook|twitter|instagram|pinterest|youtube|linkedin|tiktok|vimeo)\.com[^"']*)["']/g;
      for (const match of html.matchAll(socialRegex)) {
        let href: string = match[1];
        try {
          // Normalize protocol-relative URLs and relative paths
          if (href.startsWith("//")) {
            href = `https:${href}`;
          } else if (href.startsWith("/")) {
            href = new URL(href, this.baseUrl).toString();
          }

          const parsed = new URL(href);
          const domain = parsed.hostname.replace("www.", "").split(".")[0];
          if (domain) {
            socialLinks[domain] = parsed.toString();
          }
        } catch {
          // Skip invalid URLs found in markup without failing the entire operation
          // Continue to next match
        }
      }

      const contactLinks = {
        tel: null as string | null,
        email: null as string | null,
        contactPage: null as string | null,
      };

      const contactRegex = new RegExp(
        "<a[^>]+href=[\"']((?:mailto:|tel:)[^\"']*|[^\"']*(?:\\/contact|\\/pages\\/contact)[^\"']*)[\"']",
        "g"
      );
      for (const match of html.matchAll(contactRegex)) {
        const link: string = match[1];
        if (link.startsWith("tel:")) {
          contactLinks.tel = link.replace("tel:", "").trim();
        } else if (link.startsWith("mailto:")) {
          contactLinks.email = link.replace("mailto:", "").trim();
        } else if (
          link.includes("/contact") ||
          link.includes("/pages/contact")
        ) {
          contactLinks.contactPage = link;
        }
      }

      const extractedProductLinks =
        html
          .match(/href=["']([^"']*\/products\/[^"']+)["']/g)
          ?.map((match) =>
            match.split("href=")[1].replace(/['"]/g, "").split("/").at(-1)
          )
          ?.filter(Boolean) || [];

      const extractedCollectionLinks =
        html
          .match(/href=["']([^"']*\/collections\/[^"']+)["']/g)
          ?.map((match) =>
            match.split("href=")[1].replace(/['"]/g, "").split("/").at(-1)
          )
          ?.filter(Boolean) || [];

      // Validate links in batches for better performance
      const [homePageProductLinks, homePageCollectionLinks] = await Promise.all(
        [
          this.validateLinksInBatches(
            extractedProductLinks.filter((handle): handle is string =>
              Boolean(handle)
            ),
            (handle) => this.validateProductExists(handle)
          ),
          this.validateLinksInBatches(
            extractedCollectionLinks.filter((handle): handle is string =>
              Boolean(handle)
            ),
            (handle) => this.validateCollectionExists(handle)
          ),
        ]
      );

      const jsonLd = html
        .match(
          /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g
        )
        ?.map((match) => match.split(">")[1].replace(/<\/script/g, ""));
      const jsonLdData = jsonLd?.map((json) => JSON.parse(json));

      const headerLinks =
        html
          .match(
            /<(header|nav|div|section)\b[^>]*\b(?:id|class)=["'][^"']*(?=.*shopify-section)(?=.*\b(header|navigation|nav|menu)\b)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi
          )
          ?.flatMap((header) => {
            const links = header
              .match(/href=["']([^"']+)["']/g)
              ?.filter(
                (link) =>
                  link.includes("/products/") ||
                  link.includes("/collections/") ||
                  link.includes("/pages/")
              );
            return (
              links
                ?.map((link) => {
                  const href = link.match(/href=["']([^"']+)["']/)?.[1];
                  if (
                    href &&
                    !href.startsWith("#") &&
                    !href.startsWith("javascript:")
                  ) {
                    try {
                      const url = new URL(href, this.storeDomain);
                      return url.pathname.replace(/^\/|\/$/g, "");
                    } catch {
                      return href.replace(/^\/|\/$/g, "");
                    }
                  }
                  return null;
                })
                .filter((item): item is string => Boolean(item)) ?? []
            );
          }) ?? [];

      const slug = generateStoreSlug(this.baseUrl);

      // Detect country information
      const countryDetection = await detectShopifyCountry(html);

      return {
        name: name || slug,
        domain: sanitizeDomain(this.baseUrl),
        slug,
        title,
        description,
        logoUrl,
        socialLinks,
        contactLinks,
        headerLinks,
        showcase: {
          products: unique(homePageProductLinks ?? []),
          collections: unique(homePageCollectionLinks ?? []),
        },
        jsonLdData,
        techProvider: {
          name: "shopify",
          walletId: shopifyWalletId,
          subDomain: myShopifySubdomain,
        },
        country: countryDetection.country,
      };
    } catch (error) {
      this.handleFetchError(error, "fetching store info", this.baseUrl);
    }
  }

  /**
   * Determine the store's primary vertical and target audience.
   * Uses `getInfo()` internally; no input required.
   */
  async determineStoreType(options?: {
    apiKey?: string;
    model?: string;
    maxShowcaseProducts?: number;
    maxShowcaseCollections?: number;
  }): Promise<StoreTypeBreakdown> {
    try {
      const info = await this.getInfo();

      // Resolve showcased handles to actual products and classify using body_html only
      const maxProducts = Math.max(
        0,
        Math.min(50, options?.maxShowcaseProducts ?? 10)
      );
      // Helper to take a random sample without modifying the original array
      const takeRandom = <T>(arr: T[], n: number): T[] => {
        if (n <= 0) return [];
        if (n >= arr.length) return arr.slice();
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
      };
      const productHandles = Array.isArray(info.showcase.products)
        ? takeRandom(info.showcase.products, maxProducts)
        : [];
      const showcasedProducts = await Promise.all(
        productHandles.map((handle) => this.products.find(handle))
      );
      // Build breakdown by classifying each product using body_html only
      const textNormalized =
        `${info.title || info.name} ${info.description ?? ""}`.toLowerCase();

      // Regex heuristics for offline/missing API key classification
      const audienceKeywords: Record<string, RegExp> = {
        kid: /(\bkid\b|\bchild\b|\bchildren\b|\btoddler\b|\bboy\b|\bgirl\b)/,
        kid_male: /\bboys\b|\bboy\b/,
        kid_female: /\bgirls\b|\bgirl\b/,
        adult_male: /\bmen\b|\bmale\b|\bman\b|\bmens\b/,
        adult_female: /\bwomen\b|\bfemale\b|\bwoman\b|\bwomens\b/,
      };
      const verticalKeywords: Record<string, RegExp> = {
        clothing:
          /(dress|shirt|pant|jean|hoodie|tee|t[- ]?shirt|sneaker|apparel|clothing)/,
        beauty: /(skincare|moisturizer|serum|beauty|cosmetic|makeup)/,
        accessories:
          /(bag|belt|watch|wallet|accessor(y|ies)|sunglasses|jewell?ery)/,
        // Tightened home-decor detection to avoid generic "Home" noise
        "home-decor":
          /(sofa|chair|table|candle|lamp|rug|furniture|home[- ]?decor|homeware|housewares|living\s?room|dining\s?table|bed(?:room)?|wall\s?(art|mirror|clock))/,
        "food-and-beverages":
          /(snack|food|beverage|coffee|tea|chocolate|gourmet)/,
      };

      const breakdown: StoreTypeBreakdown = {};
      const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
      const isOffline = process.env.OPENROUTER_OFFLINE === "1" || !apiKey;

      const validProducts = showcasedProducts.filter((p): p is Product =>
        Boolean(
          p && p.bodyHtml && typeof p.bodyHtml === "string" && p.bodyHtml.trim()
        )
      );

      for (const p of validProducts) {
        const productText = String(p.bodyHtml || "").toLowerCase();
        let audience:
          | "adult_male"
          | "adult_female"
          | "kid_male"
          | "kid_female"
          | "generic" = "generic";
        let vertical:
          | "clothing"
          | "beauty"
          | "accessories"
          | "home-decor"
          | "food-and-beverages" = "accessories";
        let category: string | null = null;

        if (!isOffline) {
          try {
            // Use only body_html for classification via LLM
            const { classifyProduct } = await import("./utils/enrich");
            const cls = await classifyProduct(String(p.bodyHtml || ""), {
              apiKey,
              model: options?.model,
            });
            audience = cls.audience;
            vertical = cls.vertical;
            category = cls.category ?? null;
          } catch {
            // If any issue occurs, fall back to offline heuristics for this product
          }
        }

        if (isOffline) {
          // Audience detection
          if (audienceKeywords.kid.test(productText)) {
            if (audienceKeywords.kid_male.test(productText))
              audience = "kid_male";
            else if (audienceKeywords.kid_female.test(productText))
              audience = "kid_female";
            else audience = "generic";
          } else {
            if (audienceKeywords.adult_male.test(productText))
              audience = "adult_male";
            else if (audienceKeywords.adult_female.test(productText))
              audience = "adult_female";
            else audience = "generic";
          }
          // Vertical detection
          const v = Object.entries(verticalKeywords).find(([, rx]) =>
            rx.test(productText)
          );
          vertical = v ? (v[0] as typeof vertical) : "accessories";
          category = "general";
        }

        // Aggregate into breakdown
        breakdown[audience] = breakdown[audience] || {};
        if (!breakdown[audience]) {
          breakdown[audience] = {};
        }
        const audienceBucket = breakdown[audience]!;
        if (!audienceBucket[vertical]) {
          audienceBucket[vertical] = [];
        }
        const arr = audienceBucket[vertical]!;
        const cat = category?.trim() ? category.trim() : "general";
        if (!arr.includes(cat)) arr.push(cat);
      }

      // Fallback when no valid products classified
      if (Object.keys(breakdown).length === 0) {
        breakdown.generic = { accessories: ["general"] };
      }

      // Optionally prune using store-level signals for consistency
      // Build a normalized text with store title/description only (no enriched content)
      const normalized = textNormalized;
      try {
        // Lazy import to avoid circular deps at module load time
        const { pruneBreakdownForSignals } = await import("./utils/enrich");
        return pruneBreakdownForSignals(
          breakdown as any,
          normalized
        ) as StoreTypeBreakdown;
      } catch {
        return breakdown;
      }
    } catch (error) {
      throw this.handleFetchError(error, "determineStoreType", this.baseUrl);
    }
  }
}

export type { CheckoutOperations } from "./checkout";
export type { CollectionOperations } from "./collections";
// Export operation interfaces
export type { ProductOperations } from "./products";
export type { StoreInfo, StoreOperations } from "./store";
// Export all types for external use
// Classification utility
export type {
  Address,
  CatalogCategory,
  Collection,
  ContactUrls,
  // Country detection types
  CountryDetectionResult,
  CountryScore,
  CountryScores,
  Coupon,
  Demographics,
  MetaTag,
  // Core product and collection types
  Product,
  ProductClassification,
  ProductImage,
  ProductOption,
  ProductPricing,
  ProductVariant,
  ProductVariantImage,
  SEOContent,
  ShopifyApiProduct,
  ShopifyBaseProduct,
  ShopifyBaseVariant,
  ShopifyBasicInfo,
  ShopifyCollection,
  ShopifyFeaturedMedia,
  ShopifyFeaturesData,
  ShopifyImage,
  ShopifyImageDimensions,
  ShopifyMedia,
  ShopifyOption,
  ShopifyPredictiveProductSearch,
  // Shopify API types
  ShopifyProduct,
  ShopifyProductVariant,
  ShopifySingleProduct,
  ShopifySingleProductVariant,
  ShopifyTimestamps,
  ShopifyVariantImage,
  // Store and catalog types
  StoreCatalog,
  StoreTypeBreakdown,
  ValidStoreCatalog,
} from "./types";
export { detectShopifyCountry } from "./utils/detect-country";
export { classifyProduct, generateSEOContent } from "./utils/enrich";
// Export utility functions
export {
  calculateDiscount,
  extractDomainWithoutSuffix,
  generateStoreSlug,
  genProductSlug,
  safeParseDate,
  sanitizeDomain,
} from "./utils/func";
