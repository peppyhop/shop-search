# Shop Search

`shop-search` is a Node.js library to easily fetch and transform product data from Shopify stores.

## Features

*   Fetch all products from a Shopify store.
*   Fetch products with pagination.
*   Find a specific product by its handle.
*   Transforms Shopify product data into a more consistent and usable format.
*   Type-safe, written in TypeScript.

## Installation

Install the package using npm:

```bash
npm install shop-search
```
```bash
yarn add shop-search
```
```bash
pnpm add shop-search
```
## Usage
First, import the Store class from the package:
```typescript
import { Store } from 'shop-search';

// Or for CommonJS environments:
// const { Store } = require('shop-search');
```
Then, create a new instance of the Store class with your Shopify store's domain and access token:

```typescript
const store = new Store("your-store-domain.com"); // must be a valid shopify store domain
```

## Fetching Store Information

To fetch store metadata including title, description, logo, social links and more, use the `store.info` method:

```typescript
const storeInfo = await store.store.info();
```

This returns an object containing:
- `title`: Store title from meta tags
- `description`: Store description
- `shopifyWalletId`: Shopify digital wallet ID
- `myShopifySubdomain`: The myshopify.com subdomain
- `logoUrl`: Store logo URL (from meta tags or first matching image)
- `socialLinks`: Object containing social media URLs
- `contactLinks`: Object with tel, email and contact page links
- `showcase`: Object with featured products and collections
- `jsonLdData`: Parsed JSON-LD structured data

Example response:
```typescript
{
  title: "Store Name",
  description: "Store description",
  shopifyWalletId: "abc123",
  myShopifySubdomain: "store-name.myshopify.com",
  logoUrl: "https://cdn.shopify.com/.../logo.png",
  socialLinks: {
    facebook: "https://facebook.com/store",
    instagram: "https://instagram.com/store"
  },
  contactLinks: {
    tel: "+1234567890",
    email: "contact@store.com",
    contactPage: "/pages/contact"
  },
  showcase: {
    products: ["product-handle1", "product-handle2"],
    collections: ["collection-handle1"]
  },
  jsonLdData: [...] // Array of parsed JSON-LD objects
}
```

## Fetching Products
### Fetching All Products
To fetch all products from your Shopify store, use the `getAllProducts` method:
```typescript
 const products = await store.products.all();
```
### Fetching Products with Pagination
To fetch products with pagination, use the `getProducts` method:
```typescript
const products = await store.products.get({
  limit: 25,
  page: 1,
});
```

## Fetching a Specific Product
To fetch a specific product by its handle, use the `getProduct` method:
```typescript
const product = await store.products.find("product-handle");
```

## Fetching Collections
### Fetching All Collections
To fetch all collections from your Shopify store, use the `collections.all` method:
```typescript
const collections = await store.collections.all();
```

### Finding a Specific Collection
To find a specific collection by its handle, use the `collections.find` method:
```typescript
const collection = await store.collections.find("collection-handle");
```

### Fetching Products from a Collection
To fetch products belonging to a specific collection, use the `collections.products` method.

#### Fetching All Products from a Collection
```typescript
const productsInCollection = await store.collections.products.all("collection-handle");
```

#### Fetching Paginated Products from a Collection
```typescript
const paginatedProductsInCollection = await store.collections.products.paginated("collection-handle", {
  page: 1,
  limit: 25,
});
```

## Response Type

```ts
type StoreInfo = {
  title: string | null;
  description: string | null;
  shopifyWalletId: string | null;
  myShopifySubdomain: string | null;
  logoUrl: string | null;
  socialLinks: Record<string, string>;
  contactLinks: {
    tel: string | null;
    email: string | null;
    contactPage: string | null;
  };
  showcase: {
    products: string[];
    collections: string[];
  };
  jsonLdData: any[] | null;
};
type Product = {
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

type ProductOption = {
  key: string;
  data: string[];
  name: string;
  position: number;
  values: string[];
};

type ProductVariant = {
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

type ProductImage = ShopifyImageDimensions & {
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

type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };

type Collection = {
  id: string;
  title: string;
  handle: string;
  description: string;
  productsCount: number;
  publishedAt: string;
  updatedAt: string;
  image?: {
    id?: number;
    createdAt?: string;
    src?: string;
    alt?: string;
  };
};
```

