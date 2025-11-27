import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/products.ts",
    "src/collections.ts",
    "src/checkout.ts",
    "src/store.ts",
    "src/utils/rate-limit.ts",
  ],
  format: ["cjs", "esm"], // Support CommonJS and ESM
  dts: true, // Generate TypeScript declaration files
  sourcemap: true,
  clean: true, // Clean dist folder before build
});
