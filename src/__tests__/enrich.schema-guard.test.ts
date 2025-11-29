import * as enrich from "../ai/enrich";

describe("mergeWithLLM runtime schema guard", () => {
  const domain = "https://example.com";
  const handle = "malformed-product";

  const ajaxProduct: any = {
    id: 1,
    title: "Test Product",
    handle,
    description: "<p>Body HTML</p>",
    images: [
      "https://cdn.shopify.com/s/files/1/0000/0001/products/hero_1024x1024.jpg",
    ],
    featured_image: "https://cdn.shopify.com/s/files/1/0000/0001/products/featured_1024x1024.jpg",
    media: [],
    variants: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws on non-JSON OpenRouter content", async () => {
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return { ok: true, json: async () => ajaxProduct } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return { ok: true, text: async () => "<html>page</html>" } as any;
      }
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        // Return non-JSON content inside message
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: "<!DOCTYPE html>oops" } }] }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(
      enrich.enrichProduct(domain, handle, { apiKey: "test", inputType: "html", outputFormat: "json" })
    ).rejects.toThrow(/LLM returned invalid JSON/);
  });

  it("throws on invalid images type in JSON", async () => {
    const invalidJson = JSON.stringify({ images: "not-an-array" });
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return { ok: true, json: async () => ajaxProduct } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return { ok: true, text: async () => "<html>page</html>" } as any;
      }
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: invalidJson } }] }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(
      enrich.enrichProduct(domain, handle, { apiKey: "test", inputType: "html", outputFormat: "json" })
    ).rejects.toThrow(/LLM JSON schema invalid: images must be null or an array/);
  });
});
