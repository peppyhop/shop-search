# Shop Search Examples

This folder contains example implementations demonstrating how to use the `shop-search` library with real-world scenarios using the `anuki.in` domain.

## 📁 Examples Overview

### 1. Basic Usage (`basic-usage.ts`)
A simple example showing fundamental operations:
- Creating a shop client
- Fetching store information
- Getting all products
- Retrieving collections
- Basic error handling

**Key Features Demonstrated:**
- Store information retrieval
- Product listing and details
- Collection browsing
- Null safety patterns

### 2. Advanced Usage (`advanced-usage.ts`)
A comprehensive example showcasing advanced features:
- Store analysis and metrics
- Product filtering and categorization
- Collection operations and analysis
- Detailed data processing
- Performance considerations

**Key Features Demonstrated:**
- Store analytics and insights
- Product filtering by price, availability, and tags
- Collection product analysis
- Showcased collections
- Data aggregation and reporting

## 🚀 Running the Examples

### Prerequisites
Make sure you have the shop-search library installed:

```bash
npm install shop-search
```

### Running Basic Example
```bash
npx ts-node examples/basic-usage.ts
```

### Running Advanced Example
```bash
npx ts-node examples/advanced-usage.ts
```

## 🔧 Configuration

Both examples use `anuki.in` as the target domain. To use with your own store:

1. Replace `'https://anuki.in'` with your store's domain
2. Ensure your store is publicly accessible
3. Verify your store has products and collections

### Rate Limiting

Examples can optionally enable the global rate limiter to avoid `429` responses when crawling:

```typescript
import { ShopClient, configureRateLimit } from '../src/index';

configureRateLimit({
  enabled: true,
  maxRequestsPerInterval: 20,
  intervalMs: 1000,
  maxConcurrency: 4,
  perHost: {
    '*.myshopify.com': { maxRequestsPerInterval: 6, intervalMs: 1000, maxConcurrency: 3 },
  },
});

const shop = new ShopClient('https://anuki.in');
```

Resolution order: class → host → default. See the main README for advanced configuration.

## 📊 Expected Output

### Basic Example Output
```
🏪 Store Information:
  Name: Anuki
  Domain: anuki.in
  Country: IN
  Description: [Store description]

📦 Products Found: [number]
  First Product: [product name] - $[price]

📚 Collections Found: [number]
  First Collection: [collection name] ([product count] products)
```

### Advanced Example Output
```
🏪 Comprehensive Store Analysis for: Anuki

📊 Store Overview:
  Domain: anuki.in
  Country: IN
  Total Products: [number]
  Total Collections: [number]

💰 Product Analysis:
  Price Range: $[min] - $[max]
  Average Price: $[average]
  Available Products: [number] ([percentage]%)
  
🏷️ Product Categories:
  [category]: [count] products
  
🏆 Top Collections by Product Count:
  1. [collection name] ([count] products)
  
⭐ Showcased Collections: [number]
  1. [collection name] ([count] products)
```

## 🛠️ Customization

### Adding Your Own Examples

1. Create a new TypeScript file in the `examples` folder
2. Import the necessary types and classes:
   ```typescript
   import { ShopClient } from '../src/index';
   ```
3. Follow the patterns established in existing examples
4. Add error handling for production use

### Error Handling Patterns

Both examples demonstrate proper error handling:

```typescript
try {
  const result = await shop.someOperation();
  if (!result) {
    console.log('No data found');
    return;
  }
  // Process result
} catch (error) {
  console.error('Operation failed:', error);
}
```

## 📝 Notes

- Examples use `anuki.in` as a demonstration domain
- All operations are read-only and safe to run
- Network timeouts may occur with slow connections
- Some stores may have restricted access or rate limiting

## 🔗 Related Documentation

- [Main README](../README.md) - Complete library documentation
- [API Reference](../src/types.ts) - Type definitions and interfaces
- [Source Code](../src/) - Implementation details

## 💡 Tips for Development

1. **Start Simple**: Begin with the basic example to understand core concepts
2. **Handle Nulls**: Always check for null/undefined values in responses
3. **Error Handling**: Implement proper try-catch blocks for network operations
4. **Rate Limiting**: Be mindful of API rate limits when making multiple requests
5. **Type Safety**: Use TypeScript types provided by the library for better development experience

## 🤝 Contributing

Found an issue or want to add more examples? Please contribute:

1. Fork the repository
2. Create your example file
3. Update this README if needed
4. Submit a pull request

---

*These examples are provided for educational purposes. Always respect store owners' terms of service and rate limits when accessing their data.*
