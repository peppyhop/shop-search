import type { Product, ShopifyProduct, ShopifySingleProduct } from "../types";
import {
  buildVariantOptionsMap,
  genProductSlug,
  normalizeKey,
  safeParseDate,
} from "../utils/func";

type Ctx = {
  storeDomain: string;
  storeSlug: string;
  currency: string;
  normalizeImageUrl: (url: string | null | undefined) => string;
  formatPrice: (amountInCents: number) => string;
};

function mapVariants(
  product: ShopifyProduct | ShopifySingleProduct
): NonNullable<Product["variants"]> {
  const variants = (product as ShopifyProduct).variants ?? [];
  return variants.map((variant: any) => ({
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
          aspectRatio: variant.featured_image.aspect_ratio || 0,
          variantIds: variant.featured_image.variant_ids || [],
          createdAt: variant.featured_image.created_at,
          updatedAt: variant.featured_image.updated_at,
          alt: variant.featured_image.alt,
        }
      : null,
    available: Boolean(variant.available),
    price:
      typeof variant.price === "string"
        ? Number.parseFloat(variant.price) * 100
        : variant.price,
    weightInGrams: variant.weightInGrams ?? variant.grams,
    compareAtPrice: variant.compare_at_price
      ? typeof variant.compare_at_price === "string"
        ? Number.parseFloat(variant.compare_at_price) * 100
        : variant.compare_at_price
      : 0,
    position: variant.position,
    productId: variant.product_id,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  }));
}

export function mapProductsDto(
  products: ShopifyProduct[] | null,
  ctx: Ctx
): Product[] | null {
  if (!products || products.length === 0) return null;

  return products.map((product) => {
    const optionNames = product.options.map((o) => o.name);
    const variantOptionsMap = buildVariantOptionsMap(
      optionNames,
      product.variants
    );
    const mappedVariants = mapVariants(product);

    const priceValues = mappedVariants
      .map((v) => v.price)
      .filter((p) => typeof p === "number" && !Number.isNaN(p));
    const compareAtValues = mappedVariants
      .map((v) => v.compareAtPrice || 0)
      .filter((p) => typeof p === "number" && !Number.isNaN(p));

    const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
    const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
    const priceVaries = mappedVariants.length > 1 && priceMin !== priceMax;

    const compareAtMin = compareAtValues.length
      ? Math.min(...compareAtValues)
      : 0;
    const compareAtMax = compareAtValues.length
      ? Math.max(...compareAtValues)
      : 0;
    const compareAtVaries =
      mappedVariants.length > 1 && compareAtMin !== compareAtMax;

    return {
      slug: genProductSlug({
        handle: product.handle,
        storeDomain: ctx.storeDomain,
      }),
      handle: product.handle,
      platformId: product.id.toString(),
      title: product.title,
      available: mappedVariants.some((v) => v.available),
      price: priceMin,
      priceMin: priceMin,
      priceMax: priceMax,
      priceVaries,
      compareAtPrice: compareAtMin,
      compareAtPriceMin: compareAtMin,
      compareAtPriceMax: compareAtMax,
      compareAtPriceVaries: compareAtVaries,
      discount: 0,
      currency: ctx.currency,
      localizedPricing: {
        currency: ctx.currency,
        priceFormatted: ctx.formatPrice(priceMin),
        priceMinFormatted: ctx.formatPrice(priceMin),
        priceMaxFormatted: ctx.formatPrice(priceMax),
        compareAtPriceFormatted: ctx.formatPrice(compareAtMin),
      },
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
      featuredImage: product.images?.[0]?.src
        ? ctx.normalizeImageUrl(product.images[0].src)
        : null,
      isProxyFeaturedImage: false,
      createdAt: safeParseDate(product.created_at),
      updatedAt: safeParseDate(product.updated_at),
      variants: mappedVariants,
      images: product.images.map((image) => ({
        id: image.id,
        productId: image.product_id,
        alt: null,
        position: image.position,
        src: ctx.normalizeImageUrl(image.src),
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
      storeSlug: ctx.storeSlug,
      storeDomain: ctx.storeDomain,
      url: `${ctx.storeDomain}/products/${product.handle}`,
    } as Product;
  });
}

export function mapProductDto(
  product: ShopifySingleProduct,
  ctx: Ctx
): Product {
  const optionNames = product.options.map((o) => o.name);
  const variantOptionsMap = buildVariantOptionsMap(
    optionNames,
    product.variants
  );

  const mapped: Product = {
    slug: genProductSlug({
      handle: product.handle,
      storeDomain: ctx.storeDomain,
    }),
    handle: product.handle,
    platformId: product.id.toString(),
    title: product.title,
    available: product.available,
    price: product.price,
    priceMin: product.price_min,
    priceMax: product.price_max,
    priceVaries: product.price_varies,
    compareAtPrice: product.compare_at_price || 0,
    compareAtPriceMin: product.compare_at_price_min,
    compareAtPriceMax: product.compare_at_price_max,
    compareAtPriceVaries: product.compare_at_price_varies,
    discount: 0,
    currency: ctx.currency,
    localizedPricing: {
      currency: ctx.currency,
      priceFormatted: ctx.formatPrice(product.price),
      priceMinFormatted: ctx.formatPrice(product.price_min),
      priceMaxFormatted: ctx.formatPrice(product.price_max),
      compareAtPriceFormatted: ctx.formatPrice(product.compare_at_price || 0),
    },
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
    featuredImage: ctx.normalizeImageUrl(product.featured_image),
    isProxyFeaturedImage: false,
    createdAt: safeParseDate(product.created_at),
    updatedAt: safeParseDate(product.updated_at),
    variants: mapVariants(product),
    images: Array.isArray(product.images)
      ? product.images.map((imageSrc, index) => ({
          id: index + 1,
          productId: product.id,
          alt: null,
          position: index + 1,
          src: ctx.normalizeImageUrl(imageSrc),
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
    storeSlug: ctx.storeSlug,
    storeDomain: ctx.storeDomain,
    url: product.url || `${ctx.storeDomain}/products/${product.handle}`,
  };

  return mapped;
}
