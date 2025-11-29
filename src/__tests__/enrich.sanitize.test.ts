import * as enrich from "../ai/enrich";
import type { ShopifySingleProduct } from "../types";

describe("enrichProduct JSON image sanitization", () => {
  const domain = "examplestore.com";
  const handle = "test-product";

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("filters product gallery/hero images and keeps documentation images", async () => {
    const ajaxProduct: ShopifySingleProduct = {
      // ShopifyBasicInfo
      id: 1,
      title: "Test Product",
      handle: handle,
      // ShopifyTimestamps
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      // ShopifyBaseProduct additions
      vendor: "Example",
      tags: ["tag1"],
      options: [],

      // ShopifySingleProduct additions
      description: "<p>Product description</p>",
      published_at: "2024-01-01T00:00:00Z",
      type: "default",
      price: 100,
      price_min: 100,
      price_max: 100,
      available: true,
      price_varies: false,
      compare_at_price: null,
      compare_at_price_min: 0,
      compare_at_price_max: 0,
      compare_at_price_varies: false,
      variants: [
        {
          // Minimal variant stub with featured_image
          id: 11,
          title: "Default",
          handle: "default",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          option1: null,
          option2: null,
          option3: null,
          sku: null,
          requires_shipping: true,
          taxable: true,
          position: 1,
          product_id: 1,
          featured_image: {
            id: 101,
            src: "https://cdn.shopify.com/s/files/1/0000/0001/products/variant_grande.jpg",
            width: 800,
            height: 800,
            position: 1,
            product_id: 1,
            aspect_ratio: 1,
            variant_ids: [],
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
            alt: null,
          },
          available: true,
          price: "100",
          compare_at_price: null,
          inventory_quantity: 10,
          inventory_management: null,
          grams: 0,
          weight: 0,
          weight_unit: "g",
          selling_plan_allocations: [],
        } as any,
      ],
      images: [
        "https://cdn.shopify.com/s/files/1/0000/0001/products/hero_1024x1024.jpg",
      ],
      featured_image: "https://cdn.shopify.com/s/files/1/0000/0001/products/featured_large.jpg",
      url: `https://${domain}/products/${handle}`,
      media: [
        {
          alt: null,
          id: 201,
          position: 1,
          preview_image: {
            aspect_ratio: 1,
            height: 800,
            width: 800,
            src: "https://cdn.shopify.com/s/files/1/0000/0001/products/media_2048x.jpg",
          },
          aspect_ratio: 1,
          height: 800,
          width: 800,
          media_type: "image",
          src: "https://cdn.shopify.com/s/files/1/0000/0001/products/media_2048x.jpg",
        },
      ],
      requires_selling_plan: false,
      selling_plan_groups: [],
    } as any;

    const jsonWithMixedImages = JSON.stringify({
      content: "Some content",
      images: [
        "https://cdn.shopify.com/s/files/1/0000/0001/products/hero_1024x1024.jpg",
        "https://docs.example.com/size-chart.png",
      ],
    });
    // Mock global fetch to handle both Shopify AJAX/page and OpenRouter
    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ajaxProduct,
        } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return {
          ok: true,
          text: async () => "<html>page</html>",
        } as any;
      }
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: jsonWithMixedImages } },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    const result = await enrich.enrichProduct(domain, handle, {
      apiKey: "test-key",
      model: "stub-model",
      inputType: "html",
      outputFormat: "json",
    });

    const parsed = JSON.parse(result.mergedMarkdown);
    expect(parsed.images).toEqual(["https://docs.example.com/size-chart.png"]);
  });

  test("sets images to null when all candidates are product images", async () => {
    const ajaxProduct: ShopifySingleProduct = {
      id: 2,
      title: "Another Product",
      handle: handle,
      created_at: "2024-02-01T00:00:00Z",
      updated_at: "2024-02-02T00:00:00Z",
      vendor: "Example",
      tags: ["tag2"],
      options: [],
      description: "<p>Another description</p>",
      published_at: "2024-02-01T00:00:00Z",
      type: "default",
      price: 200,
      price_min: 200,
      price_max: 200,
      available: true,
      price_varies: false,
      compare_at_price: null,
      compare_at_price_min: 0,
      compare_at_price_max: 0,
      compare_at_price_varies: false,
      variants: [],
      images: [
        "https://cdn.shopify.com/s/files/1/0000/0002/products/only_1024x1024.jpg",
      ],
      featured_image:
        "https://cdn.shopify.com/s/files/1/0000/0002/products/featured_1024x1024.jpg",
      url: `https://${domain}/products/${handle}`,
      media: [],
      requires_selling_plan: false,
      selling_plan_groups: [],
    } as any;

    const jsonWithOnlyProductImages = JSON.stringify({
      content: "Content",
      images: [
        "https://cdn.shopify.com/s/files/1/0000/0002/products/only_1024x1024.jpg",
        "https://cdn.shopify.com/s/files/1/0000/0002/products/featured_1024x1024.jpg",
      ],
    });
    // Mock global fetch to handle both Shopify AJAX/page and OpenRouter
    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ajaxProduct,
        } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return {
          ok: true,
          text: async () => "<html>page</html>",
        } as any;
      }
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: jsonWithOnlyProductImages } },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    const result = await enrich.enrichProduct(domain, handle, {
      apiKey: "test-key",
      model: "stub-model",
      inputType: "html",
      outputFormat: "json",
    });

    const parsed = JSON.parse(result.mergedMarkdown);
    expect(parsed.images).toBeNull();
  });
});
