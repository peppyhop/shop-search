import { classifyProduct } from "../ai/enrich";

describe("classifyProduct", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns validated classification for a clothing t-shirt", async () => {
    const productContent = "Men's cotton crew neck t-shirt with classic fit.";

    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    audience: "adult_male",
                    vertical: "clothing",
                    category: "tops",
                    subCategory: "t-shirts",
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const res = await classifyProduct(productContent, { apiKey: "test", model: "stub" });
    expect(res).toEqual({
      audience: "adult_male",
      vertical: "clothing",
      category: "tops",
      subCategory: "t-shirts",
    });
  });

  it("throws on non-JSON content", async () => {
    const productContent = "Moisturizing face cream for women.";

    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: "<!DOCTYPE html>oops" } }] }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(classifyProduct(productContent, { apiKey: "test", model: "stub" }))
      .rejects.toThrow(/LLM returned invalid JSON/);
  });

  it("throws on invalid audience enum", async () => {
    const productContent = "Kids backpack with reflective strips.";

    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ audience: "child", vertical: "accessories" }) } }] }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(classifyProduct(productContent, { apiKey: "test", model: "stub" }))
      .rejects.toThrow(/audience must be one of/);
  });

  it("throws when subCategory contains spaces", async () => {
    const productContent = "Home decor minimalist wall art poster.";

    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("openrouter.ai") || url.includes("/chat/completions")) {
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ audience: "generic", vertical: "home-decor", category: "wall-art", subCategory: "framed poster" }) } }] }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(classifyProduct(productContent, { apiKey: "test", model: "stub" }))
      .rejects.toThrow(/subCategory must be single word or hyphenated, no spaces/);
  });
});
