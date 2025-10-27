# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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