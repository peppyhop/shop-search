// Simplified version of RequireAtLeastOne utility type
type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];

type Audience =
  | "adult_male"
  | "adult_female"
  | "kid_male"
  | "kid_female"
  | "adult_unisex"
  | "kid_unisex";

type Category = {
  clothing?: string[];
  jewellery?: string[];
  accessories?: string[];
};

type NoneCategory = {
  home_decor: string[];
  accessories: string[];
};

export type StoreCatalog = RequireAtLeastOne<{
  [K in Audience]: RequireAtLeastOne<Category>;
}> & {
  none: RequireAtLeastOne<NoneCategory>;
};
// Base types for common properties
export type ShopifyTimestamps = {
  created_at: string;
  updated_at: string;
};

export type ShopifyBasicInfo = {
  id: number;
  title: string;
  handle: string;
};

// Image types
export type ShopifyImageDimensions = {
  width: number;
  height: number;
  aspect_ratio?: number;
};

export type ShopifyImage = ShopifyBasicInfo &
  ShopifyTimestamps &
  ShopifyImageDimensions & {
    src: string;
    position: number;
    product_id: number;
    variant_ids: string[];
  };

export type ShopifyVariantImage = ShopifyBasicInfo &
  ShopifyTimestamps &
  ShopifyImageDimensions & {
    src: string;
    position: number;
    product_id: number;
    variant_ids: number[];
    alt: string | null;
  };

export type ShopifyFeaturedMedia = {
  alt: string | null;
  id: number;
  position: number;
  preview_image: {
    aspect_ratio: number;
    height: number;
    width: number;
    src: string;
  };
};

export type ShopifyMedia = ShopifyFeaturedMedia &
  ShopifyImageDimensions & {
    media_type: "image" | "video";
    src: string;
  };

// Option type
export type ShopifyOption = {
  name: string;
  position: number;
  values: string[];
};

// Variant types
export type ShopifyBaseVariant = ShopifyBasicInfo &
  ShopifyTimestamps & {
    option1: string | null;
    option2: string | null;
    option3: string | null;
    sku: string | null;
    requires_shipping: boolean;
    taxable: boolean;
    position: number;
    product_id: number;
  };

export type ShopifyProductVariant = ShopifyBaseVariant & {
  name?: string | undefined;
  options?: string[] | undefined;
  featured_image: {
    id: number;
    src: string;
    width: number;
    height: number;
    position: number;
    product_id: number;
    aspect_ratio: number;
    variant_ids: unknown[];
    created_at: string;
    updated_at: string;
    alt: string | null;
  } | null;
  available: boolean;
  price: string | number;
  weightInGrams?: number | undefined;
  compare_at_price?: string | number | undefined;
};

export type ShopifySingleProductVariant = ShopifyBaseVariant & {
  featured_image: ShopifyVariantImage | null;
  featured_media: ShopifyFeaturedMedia | null;
  available?: boolean | undefined;
  price: string;
  compare_at_price: string | null;
  inventory_quantity?: number | undefined;
  inventory_management: string | null;
  inventory_policy?: string | undefined;
  fulfillment_service?: string | undefined;
  barcode?: string | null | undefined;
  grams?: number | undefined;
  weight?: number | undefined;
  weight_unit?: string | undefined;
  requires_selling_plan?: boolean | undefined;
  selling_plan_allocations?: unknown[] | undefined;
};

// Product types
export type ShopifyBaseProduct = ShopifyBasicInfo &
  ShopifyTimestamps & {
    vendor: string;
    tags: string[];
    options: ShopifyOption[];
  };

export type ShopifyProduct = ShopifyBaseProduct & {
  body_html: string;
  body?: string | undefined;
  published_at: string;
  product_type: string;
  variants: ShopifyProductVariant[];
  images: ShopifyImage[];
};

export type ShopifyProductAndStore = ShopifyProduct;

export type ShopifySingleProduct = ShopifyBaseProduct & {
  description: string;
  published_at: string;
  type: string;
  tags: (string | string[] | undefined) & (string | string[]);
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number;
  compare_at_price_max: number;
  compare_at_price_varies: boolean;
  variants: ShopifySingleProductVariant[];
  images: string[];
  featured_image: string | null;
  url?: string;
  media?: ShopifyMedia[];
  requires_selling_plan?: boolean;
  selling_plan_groups?: string[];
};

// Collection type
export type ShopifyCollection = {
  id: number;
  title: string;
  handle: string;
  description?: string | undefined;
  published_at: string;
  updated_at: string;
  image?:
    | {
        id: number;
        created_at: string;
        src: string;
        alt?: string;
      }
    | undefined;
  products_count: number;
};

// Search type
export type ShopifyPredictiveProductSearch = {
  resources: {
    results: {
      products: Array<
        Omit<ShopifySingleProduct, "description"> & {
          body: string;
        }
      >;
    };
  };
};

// Define additional base types for Product
export type ProductPricing = {
  price: number;
  priceMin: number;
  priceMax: number;
  priceVaries: boolean;
  compareAtPrice: number;
  compareAtPriceMin: number;
  compareAtPriceMax: number;
  compareAtPriceVaries: boolean;
  discount: number;
  currency?: string;
};

export type ProductOption = {
  key: string;
  data: string[];
  name: string;
  position: number;
  values: string[];
};

export type ProductVariantImage = ShopifyImageDimensions & {
  id: number;
  src: string;
  position: number;
  productId: number;
  aspectRatio: number;
  variantIds: unknown[];
  createdAt: string;
  updatedAt: string;
  alt: string | null;
};

export type ProductVariant = {
  id: string;
  platformId?: string | undefined;
  name?: string | undefined;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  options?: string[] | undefined;
  sku: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  featuredImage: ProductVariantImage | null;
  available: boolean;
  price: number;
  weightInGrams?: number | undefined;
  compareAtPrice: number;
  position: number;
  productId: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

export type ProductImage = ShopifyImageDimensions & {
  id: number;
  productId: number;
  alt: string | null;
  position: number;
  src: string;
  mediaType: "image" | "video";
  variantIds: unknown[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

export type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };

// Refactored Product type
export type Product = {
  slug: string;
  handle: string;
  platformId: string | null;
  title: string;
  available: boolean;
  price: number;
  priceMin: number;
  priceVaries: boolean;
  compareAtPrice: number;
  compareAtPriceMin: number;
  priceMax: number;
  compareAtPriceMax: number;
  compareAtPriceVaries: boolean;
  discount: number;
  currency?: string;
  options: ProductOption[];
  bodyHtml: string | null;
  active?: boolean;
  productType: string | null;
  tags: string[];
  vendor: string;
  featuredImage?: string | null;
  isProxyFeaturedImage: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
  variants: ProductVariant[] | null;
  images: ProductImage[];
  publishedAt: Date | null;
  seo?: MetaTag[] | null;
  metaTags?: MetaTag[] | null;
  displayScore?: number;
  deletedAt?: Date | null;
  storeSlug: string;
  storeDomain: string;
  embedding?: number[] | null;
  url: string;
  requiresSellingPlan?: boolean | null;
  sellingPlanGroups?: unknown;
};

// Refactored ShopifyApiProduct type
export type ShopifyApiProduct = ShopifyBasicInfo & {
  bodyHtml: string;
  body?: string | undefined;
  publishedAt: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  vendor: string;
  productType: string;
  tags: string[];
  variants: (Omit<ShopifyBaseVariant, "id"> & {
    id: number;
    name?: string | undefined;
    title: string;
    featuredImage: ProductVariantImage | null;
    available: boolean;
    price: number;
    weightInGrams?: number | undefined;
    compareAtPrice: number;
    position: number;
    productId: number;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  })[];
  images: ProductImage[];
  options: ShopifyOption[];
};

type StoreHomepageInfo = {
  productLinks: string[];
  collectionLinks: string[];
  imageUrls?: string[];
  productImageUrls?: string[];
};

// Define base types for catalog categories
export type CatalogCategory = {
  clothing?: string[] | undefined;
  jewellery?: string[] | undefined;
  accessories?: string[] | undefined;
};

// Define demographic types
export type Demographics =
  | "adult_male"
  | "adult_female"
  | "adult_unisex"
  | "kid_male"
  | "kid_female"
  | "kid_unisex";

// Refactored ValidStoreCatalog type
export type ValidStoreCatalog = {
  [key in Demographics]?: CatalogCategory | undefined;
};

// Address type
export type Address = {
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  state: string;
  code: string;
  country: string;
  label?: string | undefined;
};

// Contact URLs type
export type ContactUrls = {
  whatsapp?: string | undefined;
  tel?: string | undefined;
  email?: string | undefined;
};

// Coupon type
export type Coupon = {
  label: string;
  description?: string | undefined;
};

// TrustLevel enum
export type TrustLevel = "none" | "silver" | "gold";
