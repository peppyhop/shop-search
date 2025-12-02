## [3.8.0](https://github.com/peppyhop/shop-search/compare/v3.7.0...v3.8.0) (2025-12-02)

### Features

* **collections:** add paginated method for collection fetching ([#15](https://github.com/peppyhop/shop-search/issues/15)) ([d4676d3](https://github.com/peppyhop/shop-search/commit/d4676d36ca17a137f28a68d0cfddd939684b10f9))

## [3.7.0](https://github.com/peppyhop/shop-search/compare/v3.6.1...v3.7.0) (2025-12-02)

### Features

* **collections:** add paginated method to fetch collections with pagination support ([#14](https://github.com/peppyhop/shop-search/issues/14)) ([821a3eb](https://github.com/peppyhop/shop-search/commit/821a3eb10c086928752d448867b3a8065eb6a1cf))

## [3.6.1](https://github.com/peppyhop/shop-search/compare/v3.6.0...v3.6.1) (2025-11-29)

## [3.6.0](https://github.com/peppyhop/shop-search/compare/v3.5.0...v3.6.0) (2025-11-28)

### Features

* **currency:** add localized pricing and currency override support ([#11](https://github.com/peppyhop/shop-search/issues/11)) ([32ae8c5](https://github.com/peppyhop/shop-search/commit/32ae8c52dc9eb7b7137c16a15d587653fd3126bf))

## [3.5.0](https://github.com/peppyhop/shop-search/compare/v3.4.0...v3.5.0) (2025-11-27)

### Features

* **build:** enable subpath exports and lazy rate limiter initialization ([#8](https://github.com/peppyhop/shop-search/issues/8)) ([d6dd0c6](https://github.com/peppyhop/shop-search/commit/d6dd0c6e6bf249c0721d35120e103bb302d0099b))

## [3.4.0](https://github.com/peppyhop/shop-search/compare/v3.3.0...v3.4.0) (2025-11-27)

### Features

* **rate-limit:** add global rate limiting for HTTP requests ([#6](https://github.com/peppyhop/shop-search/issues/6)) ([8070e4f](https://github.com/peppyhop/shop-search/commit/8070e4f2e40cb464b39d15e5d2ccbc22c5131722))

## [3.3.0](https://github.com/peppyhop/shop-search/compare/v3.2.1...v3.3.0) (2025-11-26)

### Features

* **collections:** add slugs method to fetch product slugs from collection ([#5](https://github.com/peppyhop/shop-search/issues/5)) ([7532b17](https://github.com/peppyhop/shop-search/commit/7532b17269d95271be26ad0c54ce4ab8ef05b528))

## [1.0.3](https://github.com/peppyhop/shop-search/compare/v1.0.2...v1.0.3) (2025-11-26)

### Bug Fixes

* minor bugs and linting issues ([#3](https://github.com/peppyhop/shop-search/issues/3)) ([65150f6](https://github.com/peppyhop/shop-search/commit/65150f63d2af89d2a21ddaf9803a483f8df53634))
* update collection endpoint from .js to .json extension ([46f0a26](https://github.com/peppyhop/shop-search/commit/46f0a26d8467bf9f0bea83e221c4cc5229ae5432))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.2] - Current Version

### Added
- New utility `sanitizeDomain(domain, options)` to normalize and validate domains
- New utility `safeParseDate(input)` that returns `Date` for valid inputs or `undefined` for invalid/empty values
- Unit tests for domain sanitization and safe date parsing

### Changed
- Product mapping now uses `safeParseDate` for `createdAt`, `updatedAt`, and `publishedAt` to prevent `Invalid Date`
- `publishedAt` mapping in single-product DTO now defaults to `null` when input is invalid
- Store info parsing: normalize protocol-relative (`//...`) and relative (`/...`) social/contact URLs to `https://`

### Fixed
- Preserved `www.` when `stripWWW: false` in `sanitizeDomain`
- TypeScript issues in tests: removed non-existent variant fields and aligned `compare_at_price` types
- Strengthened URL handling to avoid malformed links in `StoreInfo`

## [2.1.1] - Current Version

### Fixed
- Updated JSDoc comments for consistency with new API structure
- Improved documentation for `StoreOperations` and `StoreInfo` interfaces

## [2.0.0] - 2024 (Major Release)

### 🚀 Major Changes

#### **Complete API Redesign**
- **BREAKING**: Renamed main class from `Store` to `ShopClient` for better clarity
- **BREAKING**: Restructured API from single class to modular operations-based architecture
- **BREAKING**: Changed method signatures and return types for improved type safety

#### **New Modular Architecture**
- Split functionality into dedicated operation modules:
  - `CheckoutOperations` - Handle Shopify checkout URL creation
  - `CollectionOperations` - Manage collection fetching and pagination
  - `ProductOperations` - Enhanced product search and filtering
  - `StoreOperations` - Store information and metadata retrieval

### ✨ New Features

#### **Store Information & Analytics**
- Added comprehensive store information retrieval via `getInfo()` method
- Automatic country detection based on store content analysis
- Store metadata extraction including:
  - Store name, description, and contact information
  - Currency and locale detection
  - Address and contact URL parsing
  - Store catalog categorization by demographics

#### **Enhanced Collection Support**
- Full collection management with `CollectionOperations`
- Collection listing with pagination support
- Product fetching by collection with filtering options
- Collection metadata and image handling

#### **Advanced Product Operations**
- Enhanced product search and filtering capabilities
- Improved pagination with better performance
- Advanced product data normalization
- Better handling of product variants and pricing

#### **Checkout Integration**
- New `CheckoutOperations` for Shopify checkout URL generation
- Support for variant-specific checkout links
- Streamlined e-commerce integration

#### **Country Detection System**
- Intelligent country detection from store content
- Multi-signal analysis including:
  - Phone number prefixes
  - Currency symbols and formats
  - Shopify features data
  - HTML content analysis
- Confidence scoring for detection accuracy

### 🔧 Technical Improvements

#### **Enhanced Type System**
- Comprehensive TypeScript definitions for all new features
- Added 20+ new type definitions including:
  - `StoreInfo` - Complete store metadata structure
  - `CountryDetectionResult` - Country detection with confidence scores
  - `Collection` - Normalized collection data structure
  - `ShopifyFeaturesData` - Shopify platform feature detection
  - Enhanced product and variant type definitions

#### **Improved Error Handling**
- Better error messages and debugging information
- Graceful handling of network failures
- Improved validation for store URLs and parameters

#### **Performance Optimizations**
- Optimized API calls and data processing
- Better caching strategies
- Reduced bundle size through modular architecture

### 📁 New Files Added
- `src/checkout.ts` - Checkout operations and URL generation
- `src/collections.ts` - Collection management and operations
- `src/products.ts` - Enhanced product operations
- `src/store.ts` - Store information and metadata operations
- `src/utils/detect-country.ts` - Country detection utilities

### 🔄 Migration Guide

#### **Class Name Change**
```typescript
// v1.x
import { Store } from 'shop-search';
const store = new Store("your-store.myshopify.com");

// v2.x
import { ShopClient } from 'shop-search';
const client = new ShopClient("your-store.myshopify.com");
```

#### **Product Operations**
```typescript
// v1.x
const products = await store.products.all();
const product = await store.products.find("handle");

// v2.x - Same methods, enhanced functionality
const products = await client.products.all();
const product = await client.products.find("handle");
```

#### **New Store Information**
```typescript
// v2.x - New feature
const storeInfo = await client.getInfo();
console.log(storeInfo.country); // Detected country
console.log(storeInfo.name);    // Store name
console.log(storeInfo.currency); // Store currency
```

#### **New Collection Operations**
```typescript
// v2.x - New feature
const collections = await client.collections.all();
const collection = await client.collections.find("collection-handle");
const products = await client.collections.products("collection-handle");
```

#### **New Checkout Operations**
```typescript
// v2.x - New feature
const checkoutUrl = await client.checkout.create([
  { variantId: "123", quantity: 1 }
]);
```

### 📋 Dependencies
- Maintained compatibility with existing dependencies
- No new external dependencies added
- Improved internal dependency management

---

## [1.0.2] - Previous Stable Release

### Features
- Basic product fetching with `Store` class
- Product pagination and search by handle
- Basic product data normalization
- Simple TypeScript type definitions

### API Structure (v1.x)
```typescript
class Store {
  products: {
    all(): Promise<Product[]>
    paginated(options): Promise<Product[]>
    find(handle: string): Promise<Product>
  }
}
```

---

## Migration Notes

### Breaking Changes Summary
1. **Class renamed**: `Store` → `ShopClient`
2. **Enhanced type system**: Many new types added, some existing types enhanced
3. **New modular architecture**: Operations split into dedicated modules
4. **Enhanced return types**: More comprehensive data structures

### Backward Compatibility
- Core product fetching methods maintain the same signatures
- Existing product data structure remains compatible
- TypeScript users may need to update import statements

### Recommended Upgrade Path
1. Update import statements to use `ShopClient`
2. Test existing product operations (should work without changes)
3. Gradually adopt new features like store info and collections
4. Update TypeScript types if using custom type definitions

For detailed migration assistance, please refer to the updated README.md or create an issue in the repository.
