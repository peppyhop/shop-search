import { filter, isNonNullish, map, toKebabCase, unique } from "remeda";
import {
  Collection,
  Product,
  ShopifyApiProduct,
  ShopifyCollection,
  ShopifyProduct,
  ShopifySingleProduct,
} from "./types";
import {
  calculateDiscount,
  generateStoreSlug,
  genProductSlug,
} from "./utils/func";

export class Store {
  private storeDomain: string;
  private baseUrl: string;

  constructor(urlPath: string) {
    const storeUrl = new URL(urlPath);
    this.storeDomain = `https://${storeUrl.hostname}`;
    let fetchUrl = `https://${storeUrl.hostname}${storeUrl.pathname}`;
    if (!fetchUrl.endsWith("/")) {
      fetchUrl = `${fetchUrl}/`;
    }
    this.baseUrl = fetchUrl;
  }

  private productsDto(products: ShopifyProduct[]): Product[] | null {
    const storeSlug = generateStoreSlug(this.storeDomain);
    const data: Product[] = [];

    const normalizeImageUrl = (url?: string | null): string => {
      if (!url) return "";
      let newUrl = url.split("?")[0];
      if (newUrl.startsWith("//")) {
        newUrl = "https:" + newUrl;
      }
      return newUrl;
    };

    for (const product of products) {
      if (
        !product.images ||
        product.images.length === 0 ||
        !product.images[0]?.src
      )
        continue; // Added more robust check
      // Safe price calculation with fallback to 0
      const priceArr = unique(
        product.variants.map((variant) => {
          try {
            const price = Math.floor(
              Number.parseFloat(variant.price.toString()) * 100
          );
            return Number.isFinite(price) ? price : 0;
          } catch {
            return 0;
          }
        })
      ).filter((price) => price > 0); // Filter out negative prices

      const priceMin = priceArr.length > 0 ? Math.min(...priceArr) : 0;
      const priceMax = priceArr.length > 0 ? Math.max(...priceArr) : 0;
      const priceVaries = priceMin !== priceMax;
      const price = priceMin;

      // Safe compare_at_price calculation with fallback to 0
      const compareAtPriceArr = unique(
        product.variants
          .map((variant) => {
            try {
              const price = variant.compare_at_price
                ? Math.floor(
                    Number.parseFloat(variant.compare_at_price.toString()) * 100
                  )
                : 0;
              return Number.isFinite(price) ? price : 0;
            } catch {
              return 0;
            }
          })
          .filter((price) => price > 0) // Filter out negative prices
      );

      const compareAtPriceMin =
        compareAtPriceArr.length > 0 ? Math.min(...compareAtPriceArr) : 0;
      const compareAtPriceMax =
        compareAtPriceArr.length > 0 ? Math.max(...compareAtPriceArr) : 0;
      const compareAtPriceVaries = compareAtPriceMin !== compareAtPriceMax;
      const compareAtPrice = compareAtPriceMin;

      // Safe discount calculation
      const discount =
        compareAtPrice > 0 && price > 0
          ? calculateDiscount(price, compareAtPrice)
          : 0;

      const finalFeaturedImageUrl = normalizeImageUrl(product.images[0].src);

      const options = product.options
        .filter((option) => option.name.toLowerCase() !== "title")
        .map((option) => ({
          ...option,
          key: toKebabCase(option.name),
          data: filter(
            map(option.values, (value) => value.toLowerCase()),
            isNonNullish
          ),
        }));
      const p: Product = {
        slug: genProductSlug({
          handle: product.handle,
          storeDomain: this.storeDomain,
        }),
        storeSlug,
        storeDomain: this.storeDomain,
        platformId: product.id.toString(),
        title: product.title,
        handle: product.handle,
        bodyHtml: product.body_html,
        price: price,
        priceMin: priceMin,
        priceMax: priceMax,
        priceVaries,
        compareAtPrice: compareAtPrice,
        compareAtPriceMin: compareAtPriceMin,
        compareAtPriceMax: compareAtPriceMax,
        compareAtPriceVaries,
        discount,
        featuredImage: finalFeaturedImageUrl,
        isProxyFeaturedImage: !finalFeaturedImageUrl,
        publishedAt: new Date(product.published_at),
        vendor: product.vendor,
        productType: product.product_type,
        tags: product.tags,
        variants: product.variants.map((variant) => {
          const featuredImage = variant.featured_image
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
                alt: variant.featured_image.alt ?? null,
              }
            : null;

          const variantPrice = Math.floor(
            Number.parseFloat(variant.price.toString()) * 100
          );
          const variantCompareAtPrice = Math.floor(
            Number.parseFloat((variant.compare_at_price ?? 0).toString()) * 100
          );
          return {
            id: `${variant.id}-by-${storeSlug}`,
            platformId: variant.id.toString(),
            productId: variant.product_id || product.id,
            title: variant.title,
            price: variantPrice,
            compareAtPrice: variantCompareAtPrice,
            discount: calculateDiscount(variantPrice, variantCompareAtPrice),
            sku: variant.sku,
            position: variant.position,
            inventoryPolicy: null,
            fulfillmentService: null,
            inventoryManagement: null,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
            options: filter(
              [variant.option1, variant.option2, variant.option3],
              isNonNullish
            ),
            taxable: variant.taxable,
            barcode: null,
            grams: variant.weightInGrams,
            weight: variant.weightInGrams,
            weightUnit: "grams",
            inventoryQuantity: null,
            requiresShipping: variant.requires_shipping,
            available: variant.available,
            featuredImage,
            url: `${this.storeDomain}/products/${product.handle}?variant=${variant.id}`,
          };
        }),
        options,
        images: product.images.map((image, index) => ({
          id: image.id,
          productId: image.product_id,
          position: image.position || 0,
          variantIds: image.variant_ids || [],
          src: normalizeImageUrl(image.src), // Normalize all image srcs
          width: image.width || 0,
          height: image.height || 0,
          alt: `${product.title} image ${index + 1}`,
          mediaType:
            "image" as ShopifyApiProduct["images"][number]["mediaType"],
          aspectRatio: image.aspect_ratio,
        })),
        url: `${this.storeDomain}/products/${product.handle}`,
        available: product.variants.some((variant) => variant.available),
      };
      data.push(p);
    }
    return data;
  }

  private productDto(product: ShopifySingleProduct): Product {
    const slug = genProductSlug({
      handle: product.handle,
      storeDomain: this.storeDomain,
    });
    const storeSlug = generateStoreSlug(this.storeDomain);

    const normalizeImageUrl = (url?: string | null): string => {
      if (!url) return "";
      let newUrl = url.split("?")[0];
      if (newUrl.startsWith("//")) {
        newUrl = "https:" + newUrl;
      }
      return newUrl;
    };

    const compareAtPrice = product.compare_at_price
      ? Number.parseFloat(product.compare_at_price.toString())
      : 0;

    let rawFeaturedImageUrlFromSource: string | undefined | null =
      product.featured_image;

    // Fallback for featured image if product.featured_image is not available
    if (
      !rawFeaturedImageUrlFromSource &&
      product.images &&
      product.images.length > 0 &&
      typeof product.images[0] === "string"
    ) {
      rawFeaturedImageUrlFromSource = product.images[0];
    }
    // Further fallback to media if still not found
    if (
      !rawFeaturedImageUrlFromSource &&
      product.media &&
      product.media.length > 0 &&
      product.media[0]?.src
    ) {
      rawFeaturedImageUrlFromSource = product.media[0].src;
    }

    const finalFeaturedImageUrl = normalizeImageUrl(
      rawFeaturedImageUrlFromSource
    );

    const medias = product.media?.map((media, index) => {
      const variantIds = product.variants
        .filter((v) => v.featured_media?.id === media.id)
        .map((v) => `${v.id}-by-${storeSlug}`);
      return {
        id: media.id,
        productId: product.id,
        position: media.position,
        alt: media.alt || `${product.title} image ${index + 1}`,
        mediaType: media.media_type,
        src: normalizeImageUrl(media.src), // Normalize media src
        width: media.width,
        height: media.height,
        aspectRatio: media.aspect_ratio,
        previewImage: media.preview_image,
        variantIds,
        variant_ids: variantIds,
      };
    });
    const images = medias?.map((media) => ({
      id: media.id,
      productId: product.id,
      position: media.position,
      variantIds: media.variantIds,
      src: media.src, // Already normalized from medias mapping
      width: media.width,
      height: media.height,
      alt: media.alt,
      mediaType: media.mediaType,
      aspectRatio: media.aspectRatio,
    }));

    return {
      slug,
      storeSlug,
      storeDomain: this.storeDomain,
      platformId: product.id.toString(),
      title: product.title,
      handle: product.handle,
      bodyHtml: product.description,
      publishedAt: new Date(product.published_at),
      vendor: product.vendor,
      productType: product.type,
      tags: product.tags,
      price: Number.parseFloat(product.price_min.toString()),
      priceMin: Number.parseFloat(product.price_min.toString()),
      priceMax: Number.parseFloat(product.price_max.toString()),
      compareAtPrice,
      compareAtPriceMin: Number.parseFloat(
        product.compare_at_price_min.toString()
      ),
      compareAtPriceMax: Number.parseFloat(
        product.compare_at_price_max.toString()
      ),
      discount: calculateDiscount(
        Number.parseFloat(product.price_min.toString()),
        Number.parseFloat(compareAtPrice.toString())
      ),
      available: product.available,
      priceVaries: product.price_varies,
      compareAtPriceVaries: product.compare_at_price_varies,
      variants: product.variants.map((variant) => {
        const featuredImage = variant.featured_image
          ? {
              id: variant.featured_image.id,
              src: variant.featured_image.src,
              width: variant.featured_image.width,
              height: variant.featured_image.height,
              position: variant.featured_image.position,
              productId: variant.featured_image.product_id,
              aspectRatio:
                variant.featured_image.width / variant.featured_image.height,
              variantIds: variant.featured_image.variant_ids || [],
              createdAt: variant.featured_image.created_at,
              updatedAt: variant.featured_image.updated_at,
              alt: variant.featured_image.alt,
            }
          : null;

        const variantPrice = Number.parseFloat(variant.price);
        const variantCompareAtPrice = Number.parseFloat(
          variant.compare_at_price || "0"
        );
        return {
          id: `${variant.id}-by-${storeSlug}`,
          platformId: variant.id.toString(),
          productId: variant.product_id,
          title: variant.title,
          price: variantPrice,
          compareAtPrice: variantCompareAtPrice,
          discount: calculateDiscount(variantPrice, variantCompareAtPrice),
          sku: variant.sku || "",
          position: variant.position,
          inventoryPolicy: variant.inventory_policy || null,
          fulfillmentService: variant.fulfillment_service || null,
          inventoryManagement: variant.inventory_management,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          options: filter(
            [variant.option1, variant.option2, variant.option3],
            isNonNullish
          ),
          taxable: variant.taxable,
          barcode: variant.barcode || null,
          grams: variant.grams ?? null,
          weight: variant.weight ?? null,
          weightUnit: variant.weight_unit || "g",
          inventoryQuantity: variant.inventory_quantity ?? null,
          requiresShipping: variant.requires_shipping,
          available: variant.available ?? true,
          featuredImage,
          url: `${this.storeDomain}/products/${product.handle}?variant=${variant.id}`,
        };
      }),
      options: product.options
        .filter((x) => x.name.toLowerCase() !== "title")
        .map((option) => ({
          ...option,
          key: toKebabCase(option.name),
          data: filter(
            map(option.values, (value) => value.toLowerCase()),
            isNonNullish
          ),
        })),
      featuredImage: finalFeaturedImageUrl, // CORRECTED: Use the normalized variable
      isProxyFeaturedImage: !product.featured_image, // Review this logic
      images: !images
        ? product.images.map((imageSrc, index) => ({
            id: 0, // Single product format might not have image IDs
            productId: product.id,
            position: index,
            variantIds: [],
            src: imageSrc,
            width: 0, // These might not be available in the single product format
            height: 0,
            alt: `${product.title} image ${index + 1}`,
            mediaType: "image",
            aspectRatio: 1, // Default aspect ratio
          }))
        : images,
      // Handle media if available
      ...(product.media && {
        medias,
      }),
      url: product.url ?? `${this.storeDomain}/products/${product.handle}`,
      requiresSellingPlan: product.requires_selling_plan,
      sellingPlanGroups: product.selling_plan_groups || [],
    };
  }

  private collectionsDto(collections: ShopifyCollection[]): Collection[] {
    return collections.map((collection) => ({
      id: collection.id.toString(),
      title: collection.title,
      handle: collection.handle,
      description: collection.description,
      productsCount: collection.products_count,
      publishedAt: collection.published_at,
      updatedAt: collection.updated_at,
      image: collection.image ? {
        id: collection.image?.id,
        createdAt: collection.image?.created_at,
        src: collection.image?.src,
        alt: collection.image?.alt,
      } : undefined,
    }));
  }

  private async fetchProducts(page: number, limit: number): Promise<Product[] | null> {
    try {
      const url = `${this.baseUrl}products.json?limit=${limit}&page=${page}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as {
        products: ShopifyProduct[];
      };
      // urlPath = extractDomainWithoutSuffix(this.storeDomain); // No longer needed to reassign urlPath
      const productsData = this.productsDto(data.products);
      return productsData;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error fetching page ${page}:`,
          this.baseUrl,
          error.message
        );
      }
      throw error;
    }
  };

  private async fetchCollections(page: number, limit: number): Promise<Collection[] | null> {
    try {
      const url = `${this.baseUrl}collections.json?limit=${limit}&page=${page}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as {
        collections: ShopifyCollection[];
      };
      const collectionsData = this.collectionsDto(data.collections);
      return collectionsData;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error fetching page ${page}:`,
          this.baseUrl,
          error.message
        );
      }
      throw error;
    }
  };

  public store = {
    info: async () => {
      try {
        const response = await fetch(this.baseUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();

        const getMetaTag = (name: string) => {
          const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["'](.*?)["']`);
          const match = html.match(regex);
          return match ? match[1] : null;
        };

        const getPropertyMetaTag = (property: string) => {
          const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["'](.*?)["']`);
          const match = html.match(regex);
          return match ? match[1] : null;
        }

        const title = getMetaTag("og:title") || getMetaTag("twitter:title");

        const description = getMetaTag("description") || getPropertyMetaTag("og:description");

        const shopifyWalletId = getMetaTag("shopify-digital-wallet")?.split("/")[1];

        const myShopifySubdomainMatch = html.match(/['"](.*?\.myshopify\.com)['"]/);
        const myShopifySubdomain = myShopifySubdomainMatch ? myShopifySubdomainMatch[1] : null;

        let logoUrl = getPropertyMetaTag("og:image") || getPropertyMetaTag("og:image:secure_url");
        if (!logoUrl) {
          const logoMatch = html.match(/<img[^>]+src=["']([^"']+\/cdn\/shop\/[^"']+)["']/);
          logoUrl = logoMatch ? logoMatch[1].replace('http://', 'https://') : null;
        } else {
          logoUrl = logoUrl.replace('http://', 'https://');
        }

        const socialLinks: Record<string, string> = {};
        const socialRegex = /<a[^>]+href=["']([^"']*(?:facebook|twitter|instagram|pinterest|youtube|linkedin|tiktok|vimeo)\.com[^"']*)["']/g;
        let socialMatch;
        while ((socialMatch = socialRegex.exec(html)) !== null) {
          const url = new URL(socialMatch[1]);
          const domain = url.hostname.replace("www.", "").split('.')[0];
          if (domain) {
            socialLinks[domain] = socialMatch[1];
          }
        }

        const contactLinks = {
          tel: null as string | null,
          email: null as string | null,
          contactPage: null as string | null
        };
        
        const contactRegex = new RegExp('<a[^>]+href=["\']((?:mailto:|tel:)[^"\']*|[^"\']*(?:\\/contact|\\/pages\\/contact)[^"\']*)["\']', 'g');
        let contactMatch;
        while ((contactMatch = contactRegex.exec(html)) !== null) {
          const link = contactMatch[1];
          if (link.startsWith('tel:')) {
            contactLinks.tel = link.replace("tel:", "").trim();
          } else if (link.startsWith('mailto:')) {
            contactLinks.email = link.replace("mailto:", "").trim();
          } else if (link.includes('/contact') || link.includes('/pages/contact')) {
            contactLinks.contactPage = link;
          }
        }

        const homePageProductLinks = html.match(/href=["']([^"']*\/products\/[^"']+)["']/g)?.map(match => match.split('href=')[1].replace(/['"]/g, '').split("/").at(-1));
        const homePageCollectionLinks = html.match(/href=["']([^"']*\/collections\/[^"']+)["']/g)?.map(match => match.split('href=')[1].replace(/['"]/g, '').split("/").at(-1));
        // const homePagePageLinks = html.match(/href=["']([^"']*\/pages\/[^"']+)["']/g)?.map(match => match.split('href=')[1].replace(/['"]/g, '').split("/").at(-1));

        const jsonLd = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g)?.map(match => match.split('>')[1].replace(/<\/script/g, ''));
        const jsonLdData = jsonLd?.map(json => JSON.parse(json));

        return {
          title,
          description,
          shopifyWalletId,
          myShopifySubdomain,
          logoUrl,
          socialLinks,
          contactLinks,
          showcase: {
            products: unique(homePageProductLinks ?? []),
            collections: unique(homePageCollectionLinks ?? [])
          },
          jsonLdData
        };
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error fetching store info:`, this.baseUrl, error.message);
        }
        throw error;
      }
    }
  }

  public products = {
    all: async (): Promise<Product[] | null> => {
      const limit = 250;
      let allProducts: Product[] = [];

      async function fetchAll(this: Store) {
        let currentPage = 1;

        while (true) {
          const products = await this.fetchProducts.call(this, currentPage, limit);

          if (!products || products.length === 0 || products.length < limit) {
            if (products && products.length > 0) {
              allProducts = [...allProducts, ...products];
            }
            break;
          }

          allProducts = [...allProducts, ...products];
          currentPage++;
        }
        return allProducts;
      }

      try {
        // Bind `this` for fetchAll if it uses `this.productsDto`
        const products = await fetchAll.call(this);
        return products;
      } catch (error) {
        console.error("Failed to fetch all products:", this.storeDomain, error);
        throw error;
      }
    },
    paginated: async (options?: {
      page?: number;
      limit?: number;
    }): Promise<Product[] | null> => {
      const page = options?.page ?? 1;
      const limit = Math.min(options?.limit ?? 250, 250);
      const url = `${this.baseUrl}products.json?limit=${limit}&page=${page}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `HTTP error! status: ${response.status} for ${this.storeDomain} page ${page}`
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Corrected type assertion to match the 'all' method's 'fetchPage' function
        const data = (await response.json()) as {
          products: ShopifyProduct[];
        };
        if (data.products.length === 0) {
          return []; // No products on this page or end of products
        }
        return this.productsDto(data.products);
      } catch (error) {
        console.error(
          `Error fetching products for ${this.storeDomain} page ${page} with limit ${limit}:`,
          error
        );
        return null;
      }
    },

    find: async (productHandle: string): Promise<Product | null> => {
      try {
        const url = `${this.baseUrl}products/${productHandle}.js`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const product = (await response.json()) as ShopifySingleProduct;
        const productData = this.productDto(product);
        return productData;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching product ${productHandle}:`,
            this.baseUrl,
            error.message
          );
        }
        throw error;
      }
    },
  };

  public collections = {
    all: async (): Promise<Collection[]> => {
      const limit = 250;
      let allCollections: Collection[] = [];

      async function fetchAll(this: Store) {
        let currentPage = 1;

        while (true) {
          const collections = await this.fetchCollections.call(this, currentPage, limit);

          if (!collections || collections.length === 0 || collections.length < limit) {
            if (!collections) {
              console.warn("fetchCollections returned null, treating as empty array.");
              break;
            }
            if (collections && collections.length > 0) {
              allCollections = [...allCollections, ...collections];
            }
            break;
          }

          allCollections = [...allCollections, ...collections];
          currentPage++;
        }
        return allCollections;
      }

      try {
        // Bind `this` for fetchAll if it uses `this.collectionsDto`
        const collections = await fetchAll.call(this);
        return collections || [];
      } catch (error) {
        console.error("Failed to fetch all collections:", this.storeDomain, error);
        throw error;
      }
    },
    find: async (collectionHandle: string): Promise<Collection | null> => {
      try {
        const url = `${this.baseUrl}collections/${collectionHandle}.js`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const collection = (await response.json()) as ShopifyCollection;
        const collectionData = this.collectionsDto([collection]);
        return collectionData[0] || null;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching collection ${collectionHandle}:`,
            this.baseUrl,
            error.message
          );  
        }
        throw error;
      }
    },
    products: {
      paginated: async (collectionHandle: string, options?: {
        page?: number;
        limit?: number;
      }): Promise<Product[] | null> => {
        try {
          const page = options?.page ?? 1;
          const limit = Math.min(options?.limit ?? 250, 250);
          const url = `${this.baseUrl}collections/${collectionHandle}/products.json?limit=${limit}&page=${page}`;
          const response = await fetch(url);

          if (!response.ok) {
            console.error(
              `HTTP error! status: ${response.status} for ${this.storeDomain} collection ${collectionHandle}`
            );
            return null;
          }
          const products = (await response.json()) as {
            products: ShopifyProduct[];
          };
          const productsData = this.productsDto(products.products);
          return productsData;
        } catch (error) {
          if (error instanceof Error) {
            console.error(
              `Error fetching products for collection ${collectionHandle}:`,
              this.baseUrl,
              error.message
            );
          }
          throw error;
        }
      },
      all: async (collectionHandle: string): Promise<Product[] | null> => {
        try {
          const limit = 250;
          let allProducts: Product[] = [];

          async function fetchAll(this: Store) {
            let currentPage = 1;

            while (true) {
              const products = await this.fetchProducts.call(this, currentPage, limit);
              if (!products || products.length === 0 || products.length < limit) {
                if (products && products.length > 0) {
                  allProducts = [...allProducts, ...products];
                }
                break;
              }
              allProducts = [...allProducts, ...products];
              currentPage++;
            }
            return allProducts;
          }

          try {
            // Bind `this` for fetchAll if it uses `this.productsDto`
            const products = await fetchAll.call(this);
            return products || [];
          } catch (error) {
            console.error(
              `Error fetching all products for collection ${collectionHandle}:`,
              this.baseUrl,
              error
            );
            return null;
          }
        } catch (error) {
          console.error(
            `Error fetching all products for collection ${collectionHandle}:`,
            this.baseUrl,
            error
          );
          return null;
        }
      },
    }
  };
}


// Test script for store.info
