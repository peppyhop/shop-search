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
  format: ["esm"],
  dts: true,
  sourcemap: false,
  minify: true,
  treeshake: true,
  target: "node18",
  external: ["remeda", "tldts", "turndown", "turndown-plugin-gfm"],
  splitting: true,
  clean: true,
});
