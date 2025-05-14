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
