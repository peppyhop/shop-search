import { filter, isNonNullish, map, toKebabCase, unique } from "remeda";
import { Product, ShopifyApiProduct, ShopifyProduct, ShopifySingleProduct } from "./types";
import { calculateDiscount, generateStoreSlug, genProductSlug } from "./utils/func";

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

  private productsDto(
    products: ShopifyProduct[],
  ): Product[] | null {
    const storeSlug = generateStoreSlug(this.storeDomain);
    const data: Product[] = [];

    for (const product of products) {
      if (!product.images[0]) continue;
      // Safe price calculation with fallback to 0
      const priceArr = unique(
        product.variants.map((variant) => {
          try {
            const price = Math.floor(
              Number.parseFloat(variant.price.toString()) * 100,
            );
            return Number.isFinite(price) ? price : 0;
          } catch {
            return 0;
          }
        }),
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
                    Number.parseFloat(variant.compare_at_price.toString()) * 100,
                  )
                : 0;
              return Number.isFinite(price) ? price : 0;
            } catch {
              return 0;
            }
          })
          .filter((price) => price > 0), // Filter out negative prices
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
      const options = product.options
        .filter((option) => option.name.toLowerCase() !== "title")
        .map((option) => ({
          ...option,
          key: toKebabCase(option.name),
          data: filter(
            map(option.values, (value) => value.toLowerCase()),
            isNonNullish,
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
        featuredImage: product.images[0].src.split("?")[0],
        isProxyFeaturedImage: true,
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
            Number.parseFloat(variant.price.toString()) * 100,
          );
          const variantCompareAtPrice = Math.floor(
            Number.parseFloat((variant.compare_at_price ?? 0).toString()) * 100,
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
              isNonNullish,
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
          src: image.src,
          width: image.width || 0,
          height: image.height || 0,
          alt: `${product.title} image ${index + 1}`,
          mediaType: "image" as ShopifyApiProduct["images"][number]["mediaType"],
          aspectRatio: image.aspect_ratio,
        })),
        url: `${this.storeDomain}/products/${product.handle}`,
        available: product.variants.some((variant) => variant.available),
      };
      data.push(p);
    }
    return data;
  }

  private productDto(
    product: ShopifySingleProduct,
  ): Product {
    const slug = genProductSlug({
      handle: product.handle,
      storeDomain: this.storeDomain,
    });
    const storeSlug = generateStoreSlug(this.storeDomain);

    const compareAtPrice = product.compare_at_price
      ? Number.parseFloat(product.compare_at_price.toString())
      : 0;

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
        src: media.src,
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
      src: media.src,
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
        product.compare_at_price_min.toString(),
      ),
      compareAtPriceMax: Number.parseFloat(
        product.compare_at_price_max.toString(),
      ),
      discount: calculateDiscount(
        Number.parseFloat(product.price_min.toString()),
        Number.parseFloat(compareAtPrice.toString()),
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
        const variantCompareAtPrice = Number.parseFloat(variant.compare_at_price || "0");
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
            isNonNullish,
          ),
          taxable: variant.taxable,
          barcode: variant.barcode || null,
          grams: variant.grams || 0,
          weight: variant.weight || 0,
          weightUnit: variant.weight_unit || "g",
          inventoryQuantity: variant.inventory_quantity || 0,
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
            isNonNullish,
          ),
        })),
      featuredImage:
        product.featured_image || product.images[0] || product.media?.[0].src,
      isProxyFeaturedImage: !product.featured_image,
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

  public products = {
    all: async (): Promise<Product[] | null> => {
      const limit = 250;
      let allProducts: Product[] = [];

      const fetchPage = async (page: number): Promise<Product[] | null> => {
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
            console.error(`Error fetching page ${page}:`, this.baseUrl, error.message);
          }
          throw error;
        }
      };

      async function fetchAll(this: Store) {
        let currentPage = 1;

        while (true) {
          const products = await fetchPage(currentPage);

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
    paginated: async (options?: { page?: number; limit?: number }): Promise<Product[] | null> => {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 250;
      const url = `${this.baseUrl}products.json?limit=${limit}&page=${page}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `HTTP error! status: ${response.status} for ${this.storeDomain} page ${page}`,
          );
          return null;
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
          error,
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
          console.error(`Error fetching product ${productHandle}:`, this.baseUrl, error.message);
        }
        throw error;
      }
    },
  };
}