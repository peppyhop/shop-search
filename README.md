# Shop Search

[![npm version](https://badge.fury.io/js/shop-search.svg)](https://badge.fury.io/js/shop-search)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`shop-search` is a powerful, type-safe TypeScript library for fetching and transforming product data from Shopify stores. Perfect for building e-commerce applications, product catalogs, price comparison tools, and automated store analysis.

## 🚀 Features

- **Complete Store Data Access**: Fetch products, collections, and store information
- **Flexible Product Retrieval**: Get all products, paginated results, or find specific items
- **Collection Management**: Access collections and their associated products
- **Checkout Integration**: Generate pre-filled checkout URLs
- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Performance Optimized**: Efficient data fetching with built-in error handling
- **Zero Dependencies**: Lightweight with minimal external dependencies
- **Store Type Classification**: Infers audience and verticals from showcased products (body_html-only)

## 📦 Installation

```bash
npm install shop-search
```

```bash
yarn add shop-search
```

```bash
pnpm add shop-search
```

## 🔧 Quick Start

```typescript
import { ShopClient } from 'shop-search';

// Initialize shop client instance
const shop = new ShopClient("your-store-domain.com");

// Fetch store information
const storeInfo = await shop.getInfo();

// Fetch all products
const products = await shop.products.all();

// Find specific product
const product = await shop.products.find("product-handle");
```

## 📚 API Reference

### Store Information

#### `getInfo()`

Fetches comprehensive store metadata including branding, social links, and featured content.

```typescript
const storeInfo = await shop.getInfo();
```

**Returns:** `StoreInfo` object containing:
- `name`: Store name from meta tags
- `title`: Store title
- `description`: Store description
- `domain`: Store domain
- `slug`: Generated store slug
- `logoUrl`: Store logo URL
- `socialLinks`: Social media URLs (Facebook, Instagram, etc.)
- `contactLinks`: Contact information (phone, email, contact page)
- `headerLinks`: Navigation menu links
- `showcase`: Featured products and collections
- `jsonLdData`: Structured data from the store

### Products

#### `products.all()`

Fetches all products from the store with automatic pagination handling.

```typescript
const allProducts = await shop.products.all();
```

**Returns:** `Product[]` - Array of all products in the store

#### `products.paginated(options)`

Fetches products with manual pagination control.

```typescript
const products = await shop.products.paginated({
  page: 1,
  limit: 25
});
```

**Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Products per page (default: 250, max: 250)

**Returns:** `Product[]` - Array of products for the specified page

#### `products.find(handle)`

Finds a specific product by its handle.

```typescript
const product = await shop.products.find("product-handle");
```

**Parameters:**
- `handle` (string): The product handle/slug

**Returns:** `Product | null` - Product object or null if not found

#### `products.showcased()`

Fetches products featured on the store's homepage.

```typescript
const showcasedProducts = await shop.products.showcased();
```

**Returns:** `Product[]` - Array of featured products

#### `products.filter()`

Creates a map of variant options and their distinct values from all products in the store. This is useful for building filter interfaces, search facets, and product option selectors.

```typescript
const filters = await shop.products.filter();
console.log('Available filters:', filters);

// Example output:
// {
//   "size": ["small", "medium", "large", "xl"],
//   "color": ["black", "blue", "red", "white"],
//   "material": ["cotton", "polyester", "wool"]
// }

// Use filters for UI components
Object.entries(filters || {}).forEach(([optionName, values]) => {
  console.log(`${optionName}: ${values.join(', ')}`);
});
```

**Returns:** `Record<string, string[]> | null` - Object mapping option names to arrays of their unique values (all lowercase), or null if error occurs

**Features:**
- Processes all products across all pages automatically
- Returns lowercase, unique values for consistency
- Handles products with multiple variant options
- Returns empty object `{}` if no products have variants

### Collections

#### `collections.all()`

Fetches all collections from the store.

```typescript
const collections = await shop.collections.all();
```

**Returns:** `Collection[]` - Array of all collections

#### `collections.find(handle)`

Finds a specific collection by its handle.

```typescript
const collection = await shop.collections.find("collection-handle");
```

**Parameters:**
- `handle` (string): The collection handle/slug

**Returns:** `Collection | null` - Collection object or null if not found

#### `collections.showcased()`

Fetches collections featured on the store's homepage.

```typescript
const showcasedCollections = await shop.collections.showcased();
```

**Returns:** `Collection[]` - Array of featured collections

### Collection Products

#### `collections.products.all(handle)`

Fetches all products from a specific collection.

```typescript
const products = await shop.collections.products.all("collection-handle");
```

**Parameters:**
- `handle` (string): The collection handle

**Returns:** `Product[] | null` - Array of products in the collection

#### `collections.products.paginated(handle, options)`

Fetches products from a collection with pagination.

```typescript
const products = await shop.collections.products.paginated("collection-handle", {
  page: 1,
  limit: 25
});
```

**Parameters:**
- `handle` (string): The collection handle
- `options` (object): Pagination options
  - `page` (number, optional): Page number (default: 1)
  - `limit` (number, optional): Products per page (default: 250)

**Returns:** `Product[]` - Array of products for the specified page

### Checkout

#### `checkout.createUrl(params)`

Generates a Shopify checkout URL with pre-filled customer information and cart items.

```typescript
const checkoutUrl = shop.checkout.createUrl({
  email: "customer@example.com",
  items: [
    { productVariantId: "variant-id-1", quantity: "2" },
    { productVariantId: "variant-id-2", quantity: "1" }
  ],
  address: {
    firstName: "John",
    lastName: "Doe",
    address1: "123 Main St",
    city: "Anytown",
    zip: "12345",
    country: "USA",
    province: "CA",
    phone: "123-456-7890"
  }
});
```

**Parameters:**
- `email` (string): Customer's email address
- `items` (array): Cart items with `productVariantId` and `quantity`
- `address` (object): Shipping address details

**Returns:** `string` - Complete checkout URL

### Utilities

Helper utilities exported for common normalization and parsing tasks.

```typescript
import { sanitizeDomain, safeParseDate } from 'shop-search';

// Normalize domains safely
sanitizeDomain('https://www.example.com');            // "example.com"
sanitizeDomain('www.example.com', { stripWWW: false }); // "www.example.com"
sanitizeDomain('http://example.com/path');            // "example.com"

// Safely parse dates (avoids Invalid Date)
safeParseDate('2024-10-31T12:34:56Z');  // Date
safeParseDate('');                      // undefined
safeParseDate('not-a-date');            // undefined
```

Notes:
- `sanitizeDomain` trims protocols, paths, and optional `www.` depending on `stripWWW`.
- `safeParseDate` returns `undefined` for invalid inputs; product `publishedAt` may be `null` when unavailable.

#### Release and Publishing

- Releases are automated via `semantic-release` and npm Trusted Publishing.
- The release workflow uses Node.js `22.14.0` to satisfy `semantic-release` requirements.
- npm publishes use OIDC with provenance; no `NPM_TOKEN` secret is required.
- Ensure your npm package settings add this GitHub repo as a trusted publisher and set the environment name to `npm-publish`.

### Store Type Classification

Determine the store’s primary verticals and target audiences using showcased products. Classification uses only each product’s `body_html` content and aggregates per-product results, optionally pruned by store-level signals.

```typescript
import { ShopClient } from 'shop-search';

const shop = new ShopClient('your-store-domain.com');

const breakdown = await shop.determineStoreType({
  // Optional: provide an OpenRouter API key for online classification
  // Offline mode falls back to regex heuristics if no key is set
  apiKey: process.env.OPENROUTER_API_KEY,
  // Optional: model name when using online classification
  model: 'openai/gpt-4o-mini',
  // Optional: limit the number of showcased products sampled (default 10, max 50)
  maxShowcaseProducts: 12,
  // Note: showcased collections are not used for classification
  maxShowcaseCollections: 0,
});

// Example breakdown shape
// {
//   generic: { accessories: ['general'] },
//   adult_female: { clothing: ['dresses', 'tops'] }
// }
```

Details:
- Uses only `product.bodyHtml` for classification (no images or external text).
- Samples up to `maxShowcaseProducts` from `getInfo().showcase.products`.
- Aggregates per-product audience/vertical into a multi-audience breakdown.
- If `OPENROUTER_API_KEY` is absent or `OPENROUTER_OFFLINE=1`, uses offline regex heuristics.
- Applies store-level pruning based on title/description to improve consistency.

## 🏗️ Type Definitions

### StoreInfo

```typescript
type StoreInfo = {
  name: string;
  domain: string;
  slug: string;
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
  headerLinks: string[];
  showcase: {
    products: string[];
    collections: string[];
  };
  jsonLdData: any[] | null;
};
```

### Product

```typescript
type Product = {
  slug: string;
  handle: string;
  platformId: string;
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
  // Keys formatted as name#value parts joined by '##' (alphabetically sorted), e.g., "color#blue##size#xl"
  variantOptionsMap: Record<string, string>;
};

#### Date Handling

- `createdAt` and `updatedAt` are parsed using a safe parser and may be `undefined` when source values are empty or invalid.
- `publishedAt` is `Date | null` and will be `null` when unavailable or invalid.

#### Variant Options Map

- Each product includes `variantOptionsMap: Record<string, string>` when variants are present.
- Keys are composed of normalized option name/value pairs in the form `name#value`, joined by `##` and sorted alphabetically for stability.
- Example: `{ "color#blue##size#xl": "123", "color#red##size#m": "456" }`.
- Normalization uses `normalizeKey` (lowercases; spaces → `_`; non-space separators like `-` remain intact).
```

### ProductVariant

```typescript
type ProductVariant = {
  id: string;
  platformId: string;
  name?: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  options?: string[];
  sku: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  featuredImage: ProductVariantImage | null;
  available: boolean;
  price: number;
  weightInGrams?: number;
  compareAtPrice: number;
  position: number;
  productId: number;
  createdAt?: string;
  updatedAt?: string;
};
```

### ProductVariantImage

```typescript
type ProductVariantImage = {
  id: number;
  src: string;
  position: number;
  productId: number;
  aspectRatio: number;
  variantIds: unknown[];
  createdAt: string;
  updatedAt: string;
  alt: string | null;
  width: number;
  height: number;
};
```

### ProductImage

```typescript
type ProductImage = {
  id: number;
  productId: number;
  alt: string | null;
  position: number;
  src: string;
  mediaType: "image" | "video";
  variantIds: unknown[];
  createdAt?: string;
  updatedAt?: string;
  width: number;
  height: number;
  aspect_ratio?: number;
};
```

### ProductOption

```typescript
type ProductOption = {
  key: string;
  data: string[];
  name: string;
  position: number;
  values: string[];
};
```

### Collection

```typescript
type Collection = {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: {
    id: number;
    createdAt: string;
    src: string;
    alt?: string;
  };
  productsCount: number;
  publishedAt: string;
  updatedAt: string;
};
```

### MetaTag

```typescript
type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };
```

## 💡 Use Cases

### E-commerce Applications
- Build product catalogs and search functionality
- Create comparison shopping tools
- Develop inventory management systems

### Data Analysis
- Analyze product pricing trends
- Monitor competitor stores
- Generate market research reports

### Marketing Tools
- Create automated product feeds
- Build recommendation engines
- Generate SEO-optimized product pages

### Integration Examples
- Sync products with external databases
- Create custom checkout flows
- Build headless commerce solutions

## 🔍 Advanced Examples

### Building a Product Search

```typescript
async function searchProducts(shop: ShopClient, query: string) {
  const allProducts = await shop.products.all();
  return allProducts.filter(product => 
    product.title.toLowerCase().includes(query.toLowerCase()) ||
    product.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  );
}
```

### Price Monitoring

```typescript
async function monitorPrices(shop: ShopClient) {
  const products = await shop.products.all();
  return products.map(product => ({
    handle: product.handle,
    title: product.title,
    currentPrice: product.price,
    originalPrice: product.compareAtPrice,
    discount: product.discount,
    onSale: product.compareAtPrice > product.price
  }));
}
```

### Collection Analysis

```typescript
async function analyzeCollections(shop: ShopClient) {
  const collections = await shop.collections.all();
  const analysis = [];
  
  for (const collection of collections) {
    const products = await shop.collections.products.all(collection.handle);
    if (products) {
      analysis.push({
        name: collection.title,
        productCount: products.length,
        averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
        priceRange: {
          min: Math.min(...products.map(p => p.price)),
          max: Math.max(...products.map(p => p.price))
        }
      });
    }
  }
  
  return analysis;
}
```

## 🤖 LLM Integration

This package is designed to be LLM-friendly with comprehensive documentation and structured APIs:

### For AI Code Generation
- **Complete Type Safety**: Full TypeScript definitions enable accurate code completion and generation
- **Predictable API Patterns**: Consistent method naming and return types across all operations
- **Comprehensive Examples**: Real-world usage patterns in `/examples` directory
- **Detailed Documentation**: Technical context in `/.llm` directory for AI understanding

### For E-commerce AI Applications
- **Rich Product Data**: Complete product information including variants, pricing, and metadata
- **Structured Store Information**: Organized store data perfect for AI analysis and recommendations
- **Search-Ready Data**: Product tags, descriptions, and categories optimized for semantic search
- **Batch Operations**: Efficient data fetching for large-scale AI processing

### LLM-Friendly Resources
- [`llm.txt`](./llm.txt) - Complete repository overview and API surface
- [`/.llm/context.md`](./.llm/context.md) - Technical architecture and implementation details
- [`/.llm/api-reference.md`](./.llm/api-reference.md) - Comprehensive API documentation with examples
- [`/.llm/examples.md`](./.llm/examples.md) - Code patterns and usage examples
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System design and extension points
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - Development guidelines and best practices

### AI Use Cases
- **Product Recommendation Systems**: Rich product data with relationships and metadata
- **Price Monitoring**: Automated price tracking and comparison tools
- **Inventory Analysis**: Stock level monitoring and trend analysis
- **Content Generation**: Product descriptions and marketing content creation
- **Market Research**: Competitive analysis and market trend identification

### Keywords for LLM Discovery
`shopify`, `ecommerce`, `product-data`, `store-scraping`, `typescript`, `nodejs`, `api-client`, `product-catalog`, `checkout`, `collections`, `variants`, `pricing`, `inventory`, `headless-commerce`, `ai-ready`, `llm-friendly`, `semantic-search`, `product-recommendations`, `price-monitoring`

## 🛠️ Error Handling

The library includes comprehensive error handling:

```typescript
try {
  const product = await shop.products.find("non-existent-handle");
  // Returns null for not found
} catch (error) {
  // Handles network errors, invalid domains, etc.
  console.error('Error fetching product:', error.message);
}
```

## 🔐 Security and Dependency Overrides

- This project pins vulnerable transitive dependencies using npm `overrides` to keep CI/security scans green.
- We currently force `glob` to `11.1.0` to avoid the CLI command injection vulnerability affecting `glob@10.3.7–11.0.3`.
- The library does not use the `glob` CLI; pinning removes audit warnings without impacting functionality.
- If scanners flag new CVEs, update `package.json` `overrides` and reinstall dependencies.

## ✅ Parsing Reliability Notes

- Contact link parsing is hardened to correctly detect:
  - `tel:` phone links
  - `mailto:` email links
  - `contactPage` URLs (e.g., `/pages/contact`)
- Tests cover protocol-relative social links normalization and contact page detection to prevent regressions.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions and support, please open an issue on the GitHub repository.
