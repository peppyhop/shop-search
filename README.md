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

### Response Type

```ts
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
```
