import TurndownService from "turndown";
// @ts-expect-error
import { gfm } from "turndown-plugin-gfm";
import type {
  ProductClassification,
  SEOContent,
  ShopifySingleProduct,
} from "../types";
import { rateLimitedFetch } from "../utils/rate-limit";

function ensureOpenRouter(apiKey?: string) {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "Missing OpenRouter API key. Set OPENROUTER_API_KEY or pass apiKey."
    );
  }
  return key;
}

function normalizeDomainToBase(domain: string): string {
  // Accept both bare domains (example.com) and full URLs (https://example.com)
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    try {
      const u = new URL(domain);
      return `${u.protocol}//${u.hostname}`;
    } catch {
      // Fallback to https
      return domain;
    }
  }
  return `https://${domain}`;
}

export interface EnrichedProductResult {
  bodyHtml: string;
  pageHtml: string;
  extractedMainHtml: string;
  mergedMarkdown: string;
}

/**
 * Fetch Shopify Product AJAX API
 * /products/{handle}.js
 */
export async function fetchAjaxProduct(
  domain: string,
  handle: string
): Promise<ShopifySingleProduct> {
  const base = normalizeDomainToBase(domain);
  const url = `${base}/products/${handle}.js`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch AJAX product: ${url}`);
  const data: ShopifySingleProduct = await res.json();
  return data;
}

/**
 * Fetch full product page HTML
 */
export async function fetchProductPage(
  domain: string,
  handle: string
): Promise<string> {
  const base = normalizeDomainToBase(domain);
  const url = `${base}/products/${handle}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch product page: ${url}`);
  return res.text();
}

/**
 * Extract the main Shopify product section WITHOUT cheerio
 * Uses regex + indexing (fast & reliable)
 */
export function extractMainSection(html: string): string | null {
  const startMatch = html.match(
    /<section[^>]*id="shopify-section-template--.*?__main"[^>]*>/
  );

  if (!startMatch) return null;

  const startIndex = html.indexOf(startMatch[0]);
  if (startIndex === -1) return null;

  const endIndex = html.indexOf("</section>", startIndex);
  if (endIndex === -1) return null;

  return html.substring(startIndex, endIndex + "</section>".length);
}

/**
 * Convert HTML → Clean Markdown using Turndown
 * Includes Shopify cleanup rules + GFM support
 */
export function htmlToMarkdown(
  html: string | null,
  options?: { useGfm?: boolean }
): string {
  if (!html) return "";

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // Enable GitHub flavored markdown
  const useGfm = options?.useGfm ?? true;
  if (useGfm) {
    td.use(gfm);
  }

  // Remove noise: scripts, styles, theme blocks
  ["script", "style", "nav", "footer"].forEach((tag) => {
    td.remove((node) => node.nodeName?.toLowerCase() === tag);
  });

  // Remove Shopify-specific junk
  const removeByClass = (className: string) =>
    td.remove((node: any) => {
      const cls =
        typeof node.getAttribute === "function"
          ? node.getAttribute("class") || ""
          : "";
      return (cls as string).split(/\s+/).includes(className);
    });
  [
    "product-form",
    "shopify-payment-button",
    "shopify-payment-buttons",
    "product__actions",
    "product__media-wrapper",
    "loox-rating",
    "jdgm-widget",
    "stamped-reviews",
  ].forEach(removeByClass);

  // Remove UI input elements
  ["button", "input", "select", "label"].forEach((tag) => {
    td.remove((node) => node.nodeName?.toLowerCase() === tag);
  });

  // Remove add-to-cart + quantity controls
  ["quantity-selector", "product-atc-wrapper"].forEach(removeByClass);

  return td.turndown(html);
}

/**
 * Merge the two markdown sources using OpenAI GPT
 */
export async function mergeWithLLM(
  bodyInput: string,
  pageInput: string,
  options?: {
    apiKey?: string;
    inputType?: "markdown" | "html";
    model?: string;
    outputFormat?: "markdown" | "json";
  }
): Promise<string> {
  const inputType = options?.inputType ?? "markdown";
  const bodyLabel = inputType === "html" ? "BODY HTML" : "BODY MARKDOWN";
  const pageLabel = inputType === "html" ? "PAGE HTML" : "PAGE MARKDOWN";
  const prompt =
    options?.outputFormat === "json"
      ? `You are extracting structured buyer-useful information from Shopify product content.

Inputs:
1) ${bodyLabel}: ${inputType === "html" ? "Raw Shopify product body_html" : "Cleaned version of Shopify product body_html"}
2) ${pageLabel}: ${inputType === "html" ? "Raw product page HTML (main section)" : "Extracted product page HTML converted to markdown"}

Return ONLY valid JSON (no markdown, no code fences) with this shape:
{
  "title": null | string,
  "description": null | string,
  "materials": string[] | [],
  "care": string[] | [],
  "fit": null | string,
  "images": null | string[],
  "returnPolicy": null | string
}

Rules:
- Do not invent facts; if a field is unavailable, use null or []
- Prefer concise, factual statements
 - Do NOT include product gallery/hero images in "images"; include only documentation images like size charts or measurement guides. If none, set "images": null.

${bodyLabel}:
${bodyInput}

${pageLabel}:
${pageInput}
`
      : `
You are enriching a Shopify product for a modern shopping-discovery app.

Inputs:
1) ${bodyLabel}: ${inputType === "html" ? "Raw Shopify product body_html" : "Cleaned version of Shopify product body_html"}
2) ${pageLabel}: ${inputType === "html" ? "Raw product page HTML (main section)" : "Extracted product page HTML converted to markdown"}

Your tasks:
- Merge them into a single clean markdown document
- Remove duplicate content
- Remove product images
- Remove UI text, buttons, menus, review widgets, theme junk
- Remove product options
- Keep only available buyer-useful info: features, materials, care, fit, size chart, return policy, size chart, care instructions
- Include image of size-chart if present
- Don't include statements like information not available.
- Maintain structured headings (## Description, ## Materials, etc.)
- Output ONLY markdown (no commentary)

${bodyLabel}:
${bodyInput}

${pageLabel}:
${pageInput}
`;
  const apiKey = ensureOpenRouter(options?.apiKey);

  // Default model via environment or safe fallback (OpenRouter slug)
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const model = options?.model ?? defaultModel;

  // OpenRouter path only
  const result = await callOpenRouter(model, prompt, apiKey);
  if (options?.outputFormat === "json") {
    const cleaned = result.replace(/```json|```/g, "").trim();
    // Validate shape early to fail fast on malformed JSON responses
    const obj = safeParseJson(cleaned);
    if (!obj.ok) {
      throw new Error(`LLM returned invalid JSON: ${obj.error}`);
    }
    const schema = validateStructuredJson(obj.value);
    if (!schema.ok) {
      throw new Error(`LLM JSON schema invalid: ${schema.error}`);
    }

    // Sanitize any returned image URLs to avoid product gallery/hero images
    const value = obj.value as any;
    if (Array.isArray(value.images)) {
      const filtered = value.images.filter((url: string) => {
        if (typeof url !== "string") return false;
        const u = url.toLowerCase();
        // Common Shopify product image patterns to exclude
        const productPatterns = [
          "cdn.shopify.com",
          "/products/",
          "%2Fproducts%2F",
          "_large",
          "_grande",
          "_1024x1024",
          "_2048x",
        ];
        const looksLikeProductImage = productPatterns.some((p) =>
          u.includes(p)
        );
        return !looksLikeProductImage;
      });
      value.images = filtered.length > 0 ? filtered : null;
    }
    return JSON.stringify(value);
  }
  return result;
}

// Runtime JSON parse helper with descriptive errors
function safeParseJson(
  input: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const v = JSON.parse(input);
    return { ok: true, value: v };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to parse JSON" };
  }
}

// Validate relaxed schema of structured product JSON from LLM
function validateStructuredJson(
  obj: unknown
): { ok: true } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;

  // Optional fields must match expected types when present
  if ("title" in o && !(o.title === null || typeof o.title === "string")) {
    return { ok: false, error: "title must be null or string" };
  }
  if (
    "description" in o &&
    !(o.description === null || typeof o.description === "string")
  ) {
    return { ok: false, error: "description must be null or string" };
  }
  if ("fit" in o && !(o.fit === null || typeof o.fit === "string")) {
    return { ok: false, error: "fit must be null or string" };
  }
  if (
    "returnPolicy" in o &&
    !(o.returnPolicy === null || typeof o.returnPolicy === "string")
  ) {
    return { ok: false, error: "returnPolicy must be null or string" };
  }

  const validateStringArray = (
    arr: unknown,
    field: string
  ): { ok: true } | { ok: false; error: string } => {
    if (!Array.isArray(arr))
      return { ok: false, error: `${field} must be an array` };
    for (const item of arr) {
      if (typeof item !== "string")
        return { ok: false, error: `${field} items must be strings` };
    }
    return { ok: true };
  };

  if ("materials" in o) {
    const res = validateStringArray(o.materials, "materials");
    if (!res.ok) return res;
  }
  if ("care" in o) {
    const res = validateStringArray(o.care, "care");
    if (!res.ok) return res;
  }

  if ("images" in o) {
    if (!(o.images === null || Array.isArray(o.images))) {
      return { ok: false, error: "images must be null or an array" };
    }
    if (Array.isArray(o.images)) {
      const res = validateStringArray(o.images, "images");
      if (!res.ok) return res;
    }
  }

  return { ok: true };
}

// OpenRouter handler (OpenAI-compatible payload, single key to access many models)
async function callOpenRouter(
  model: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  // Offline fallback for environments without network egress.
  // Enable by setting OPENROUTER_OFFLINE=1.
  if (process.env.OPENROUTER_OFFLINE === "1") {
    return mockOpenRouterResponse(prompt);
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const referer = process.env.OPENROUTER_SITE_URL || process.env.SITE_URL;
  const title = process.env.OPENROUTER_APP_TITLE || "Shop Search";
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  const buildPayload = (m: string) => ({
    model: m,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  // Use Quickstart-recommended base: https://openrouter.ai/api/v1
  // Allow override via OPENROUTER_BASE_URL
  const base = (
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  const endpoints = [`${base}/chat/completions`];

  // Prepare fallback models
  const fallbackEnv = (process.env.OPENROUTER_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const modelsToTry = Array.from(
    new Set([model, ...fallbackEnv, defaultModel])
  ).filter(Boolean);

  let lastErrorText = "";
  for (const m of modelsToTry) {
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await rateLimitedFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(buildPayload(m)),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const text = await response.text();
          // If server error, try next model; otherwise capture and continue to next endpoint/model
          lastErrorText = text || `${url}: HTTP ${response.status}`;
          // Small delay before trying next
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === "string") return content;
        // If content missing, still capture and try fallback
        lastErrorText = JSON.stringify(data);
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        lastErrorText = `${url}: ${err?.message || String(err)}`;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
  throw new Error(`OpenRouter request failed: ${lastErrorText}`);
}

// Generate a deterministic offline response tailored to the prompt.
function mockOpenRouterResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  // Classification prompt contains "keys:" section
  if (p.includes("return only valid json") && p.includes('"audience":')) {
    return JSON.stringify({
      audience: "generic",
      vertical: "clothing",
      category: null,
      subCategory: null,
    });
  }

  // Structured merge prompt contains "with this shape:" section
  if (p.includes("return only valid json") && p.includes('"materials":')) {
    return JSON.stringify({
      title: null,
      description: null,
      materials: [],
      care: [],
      fit: null,
      images: null,
      returnPolicy: null,
    });
  }

  // Markdown merge fallback
  return [
    "## Description",
    "Offline merge of product body and page.",
    "",
    "## Materials",
    "- Not available",
  ].join("\n");
}

/**
 * MAIN WORKFLOW
 */
export async function enrichProduct(
  domain: string,
  handle: string,
  options?: {
    apiKey?: string;
    useGfm?: boolean;
    inputType?: "markdown" | "html";
    model?: string;
    outputFormat?: "markdown" | "json";
  }
): Promise<EnrichedProductResult> {
  // STEP 1: Fetch Shopify single product (AJAX) and use its description
  const ajaxProduct = await fetchAjaxProduct(domain, handle);
  const bodyHtml = ajaxProduct.description || "";

  // STEP 2: Full product page HTML
  const pageHtml = await fetchProductPage(domain, handle);

  // STEP 3: Extract main section
  const extractedHtml = extractMainSection(pageHtml);

  // STEP 4: Prepare inputs based on desired input type
  const inputType = options?.inputType ?? "markdown";
  const bodyInput =
    inputType === "html"
      ? bodyHtml
      : htmlToMarkdown(bodyHtml, { useGfm: options?.useGfm });
  const pageInput =
    inputType === "html"
      ? extractedHtml || pageHtml
      : htmlToMarkdown(extractedHtml, { useGfm: options?.useGfm });

  // STEP 5: Merge using LLM
  const mergedMarkdown = await mergeWithLLM(bodyInput, pageInput, {
    apiKey: options?.apiKey,
    inputType,
    model: options?.model,
    outputFormat: options?.outputFormat,
  });

  // If JSON output requested, further sanitize images using Shopify REST data
  if (options?.outputFormat === "json") {
    try {
      const obj = JSON.parse(mergedMarkdown);
      if (obj && Array.isArray(obj.images)) {
        const productImageCandidates: string[] = [];
        // Collect featured_image (string URL)
        if (ajaxProduct.featured_image) {
          productImageCandidates.push(String(ajaxProduct.featured_image));
        }
        // Collect images (string[])
        if (Array.isArray(ajaxProduct.images)) {
          for (const img of ajaxProduct.images) {
            if (typeof img === "string" && img.length > 0) {
              productImageCandidates.push(img);
            }
          }
        }
        // Collect media[].src
        if (Array.isArray(ajaxProduct.media)) {
          for (const m of ajaxProduct.media) {
            if (m?.src) productImageCandidates.push(String(m.src));
          }
        }
        // Collect variants[].featured_image?.src
        if (Array.isArray(ajaxProduct.variants)) {
          for (const v of ajaxProduct.variants) {
            const fi = v?.featured_image;
            if (fi?.src) productImageCandidates.push(String(fi.src));
          }
        }

        const productSet = new Set(
          productImageCandidates.map((u) => String(u).toLowerCase())
        );
        const filtered = obj.images.filter((url: string) => {
          if (typeof url !== "string") return false;
          const u = url.toLowerCase();
          if (productSet.has(u)) return false;
          // Also exclude common Shopify product image patterns
          const productPatterns = [
            "cdn.shopify.com",
            "/products/",
            "%2Fproducts%2F",
            "_large",
            "_grande",
            "_1024x1024",
            "_2048x",
          ];
          const looksLikeProductImage = productPatterns.some((p) =>
            u.includes(p)
          );
          return !looksLikeProductImage;
        });
        obj.images = filtered.length > 0 ? filtered : null;
        const sanitized = JSON.stringify(obj);
        return {
          bodyHtml,
          pageHtml,
          extractedMainHtml: extractedHtml || "",
          mergedMarkdown: sanitized,
        };
      }
    } catch {
      // fallthrough to default return
    }
  }

  return {
    bodyHtml,
    pageHtml,
    extractedMainHtml: extractedHtml || "",
    mergedMarkdown,
  };
}

/**
 * Classify product content into a three-tier hierarchy using LLM.
 * Returns strictly validated JSON with audience, vertical, and optional category/subCategory.
 */
export async function classifyProduct(
  productContent: string,
  options?: { apiKey?: string; model?: string }
): Promise<ProductClassification> {
  const apiKey = ensureOpenRouter(options?.apiKey);
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const model = options?.model ?? defaultModel;

  const prompt = `Classify the following product using a three-tiered hierarchy:

Product Content:
${productContent}

Classification Rules:
1. First determine the vertical (main product category)
2. Then determine the category (specific type within that vertical)
3. Finally determine the subCategory (sub-type within that category)

Vertical must be one of: clothing, beauty, accessories, home-decor, food-and-beverages
Audience must be one of: adult_male, adult_female, kid_male, kid_female, generic

Hierarchy Examples:
- Clothing → tops → t-shirts
- Clothing → footwear → sneakers
- Beauty → skincare → moisturizers
- Accessories → bags → backpacks
- Home-decor → furniture → chairs
- Food-and-beverages → snacks → chips

IMPORTANT CONSTRAINTS:
- Category must be relevant to the chosen vertical
- subCategory must be relevant to both vertical and category
- subCategory must be a single word or hyphenated words (no spaces)
- subCategory should NOT be material (e.g., "cotton", "leather") or color (e.g., "red", "blue")
- Focus on product type/function, not attributes

If you're not confident about category or sub-category, you can leave them optional.

Return ONLY valid JSON (no markdown, no code fences) with keys:
{
  "audience": "adult_male" | "adult_female" | "kid_male" | "kid_female" | "generic",
  "vertical": "clothing" | "beauty" | "accessories" | "home-decor" | "food-and-beverages",
  "category": null | string,
  "subCategory": null | string
}`;

  const raw = await callOpenRouter(model, prompt, apiKey);
  const cleaned = raw.replace(/```json|```/g, "").trim();

  // Parse and validate
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateClassification(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return validated.value as ProductClassification;
}

// Validate product classification schema
function validateClassification(
  obj: unknown
): { ok: true; value: ProductClassification } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;

  const audienceValues = [
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ] as const;
  if (typeof o.audience !== "string" || !audienceValues.includes(o.audience)) {
    return {
      ok: false,
      error:
        "audience must be one of: adult_male, adult_female, kid_male, kid_female, generic",
    };
  }

  const verticalValues = [
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ] as const;
  if (typeof o.vertical !== "string" || !verticalValues.includes(o.vertical)) {
    return {
      ok: false,
      error:
        "vertical must be one of: clothing, beauty, accessories, home-decor, food-and-beverages",
    };
  }

  // Optional fields
  if (
    "category" in o &&
    !(o.category === null || typeof o.category === "string")
  ) {
    return { ok: false, error: "category must be null or string" };
  }
  if (
    "subCategory" in o &&
    !(o.subCategory === null || typeof o.subCategory === "string")
  ) {
    return { ok: false, error: "subCategory must be null or string" };
  }

  // Enforce subCategory format when provided: single word or hyphenated (no spaces)
  if (typeof o.subCategory === "string") {
    const sc = o.subCategory.trim();
    if (!/^[A-Za-z0-9-]+$/.test(sc)) {
      return {
        ok: false,
        error: "subCategory must be single word or hyphenated, no spaces",
      };
    }
  }

  return {
    ok: true,
    value: {
      audience: o.audience,
      vertical: o.vertical,
      category:
        typeof o.category === "string" ? o.category : (o.category ?? null),
      subCategory:
        typeof o.subCategory === "string"
          ? o.subCategory
          : (o.subCategory ?? null),
    },
  };
}

/**
 * Generate SEO and marketing content for a product. Returns strictly validated JSON.
 */
export async function generateSEOContent(
  product: {
    title: string;
    description?: string;
    vendor?: string;
    price?: number;
    tags?: string[];
  },
  options?: { apiKey?: string; model?: string }
): Promise<SEOContent> {
  const apiKey = ensureOpenRouter(options?.apiKey);
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const model = options?.model ?? defaultModel;

  // Offline deterministic mock
  if (process.env.OPENROUTER_OFFLINE === "1") {
    const baseTags = Array.isArray(product.tags)
      ? product.tags.slice(0, 6)
      : [];
    const titlePart = product.title.trim().slice(0, 50);
    const vendorPart = (product.vendor || "").trim();
    const pricePart =
      typeof product.price === "number" ? `$${product.price}` : "";
    const metaTitle = vendorPart ? `${titlePart} | ${vendorPart}` : titlePart;
    const metaDescription =
      `Discover ${product.title}. ${pricePart ? `Priced at ${pricePart}. ` : ""}Crafted to delight customers with quality and style.`.slice(
        0,
        160
      );
    const shortDescription = `${product.title} — ${vendorPart || "Premium"} quality, designed to impress.`;
    const longDescription =
      product.description ||
      `Introducing ${product.title}, combining performance and style for everyday use.`;
    const marketingCopy = `Get ${product.title} today${pricePart ? ` for ${pricePart}` : ""}. Limited availability — don’t miss out!`;
    const res: SEOContent = {
      metaTitle,
      metaDescription,
      shortDescription,
      longDescription,
      tags: baseTags.length ? baseTags : ["new", "featured", "popular"],
      marketingCopy,
    };
    const validated = validateSEOContent(res);
    if (!validated.ok)
      throw new Error(`Offline SEO content invalid: ${validated.error}`);
    return validated.value;
  }

  const prompt = `Generate SEO-optimized content for this product:\n\nTitle: ${product.title}\nDescription: ${product.description || "N/A"}\nVendor: ${product.vendor || "N/A"}\nPrice: ${typeof product.price === "number" ? `$${product.price}` : "N/A"}\nTags: ${Array.isArray(product.tags) && product.tags.length ? product.tags.join(", ") : "N/A"}\n\nCreate compelling, SEO-friendly content that will help this product rank well and convert customers.\n\nReturn ONLY valid JSON (no markdown, no code fences) with keys: {\n  "metaTitle": string,\n  "metaDescription": string,\n  "shortDescription": string,\n  "longDescription": string,\n  "tags": string[],\n  "marketingCopy": string\n}`;

  const raw = await callOpenRouter(model, prompt, apiKey);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateSEOContent(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return validated.value as SEOContent;
}

function validateSEOContent(
  obj: unknown
): { ok: true; value: SEOContent } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;
  const requiredStrings = [
    "metaTitle",
    "metaDescription",
    "shortDescription",
    "longDescription",
    "marketingCopy",
  ];
  for (const key of requiredStrings) {
    if (typeof o[key] !== "string" || !o[key].trim()) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
  }
  if (!Array.isArray(o.tags)) {
    return { ok: false, error: "tags must be an array" };
  }
  for (const t of o.tags) {
    if (typeof t !== "string")
      return { ok: false, error: "tags items must be strings" };
  }
  // Light heuristic: metaTitle ~50-80 chars, metaDescription ~80-180 chars (do not hard-fail)
  return {
    ok: true,
    value: {
      metaTitle: String(o.metaTitle),
      metaDescription: String(o.metaDescription),
      shortDescription: String(o.shortDescription),
      longDescription: String(o.longDescription),
      tags: o.tags as string[],
      marketingCopy: String(o.marketingCopy),
    },
  };
}

/**
 * Determine store type (primary vertical and audience) from store information.
 * Accepts flexible input for showcase products/collections (titles or handles) and returns
 * strictly validated `vertical` and `audience` values.
 */
export async function determineStoreType(
  storeInfo: {
    title: string;
    description?: string | null;
    showcase: {
      products:
        | Array<{ title: string; productType?: string | null }>
        | string[];
      collections: Array<{ title: string }> | string[];
    };
  },
  options?: { apiKey?: string; model?: string }
): Promise<
  Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  >
> {
  const apiKey = ensureOpenRouter(options?.apiKey);
  const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const model = options?.model ?? defaultModel;

  // Normalize showcase items to titles for readable prompt content
  const productLines = (
    Array.isArray(storeInfo.showcase.products)
      ? storeInfo.showcase.products.slice(0, 10).map((p: any) => {
          if (typeof p === "string") return `- ${p}`;
          const pt =
            typeof p?.productType === "string" && p.productType.trim()
              ? p.productType
              : "N/A";
          return `- ${String(p?.title || "N/A")}: ${pt}`;
        })
      : []
  ) as string[];
  const collectionLines = (
    Array.isArray(storeInfo.showcase.collections)
      ? storeInfo.showcase.collections.slice(0, 5).map((c: any) => {
          if (typeof c === "string") return `- ${c}`;
          return `- ${String(c?.title || "N/A")}`;
        })
      : []
  ) as string[];

  const storeContent = `Store Title: ${storeInfo.title}
Store Description: ${storeInfo.description ?? "N/A"}

Sample Products:\n${productLines.join("\n") || "- N/A"}

Sample Collections:\n${collectionLines.join("\n") || "- N/A"}`;
  const textNormalized =
    `${storeInfo.title} ${storeInfo.description ?? ""} ${productLines.join(" ")} ${collectionLines.join(" ")}`.toLowerCase();

  // Offline deterministic mock with light heuristics
  if (process.env.OPENROUTER_OFFLINE === "1") {
    const text =
      `${storeInfo.title} ${storeInfo.description ?? ""} ${productLines.join(" ")} ${collectionLines.join(" ")}`.toLowerCase();
    const verticalKeywords: Record<string, RegExp> = {
      clothing:
        /(dress|shirt|pant|jean|hoodie|tee|t[- ]?shirt|sneaker|apparel|clothing)/,
      beauty: /(skincare|moisturizer|serum|beauty|cosmetic|makeup)/,
      accessories:
        /(bag|belt|watch|wallet|accessor(y|ies)|sunglasses|jewell?ery)/,
      "home-decor": /(sofa|chair|table|decor|home|candle|lamp|rug)/,
      "food-and-beverages":
        /(snack|food|beverage|coffee|tea|chocolate|gourmet)/,
    };
    // Use strict word-boundary matching to avoid false positives like "boyfriend" or "girlfriend"
    const audienceKeywords: Record<string, RegExp> = {
      kid: /(\bkid\b|\bchild\b|\bchildren\b|\btoddler\b|\bboy\b|\bgirl\b)/,
      kid_male: /\bboys\b|\bboy\b/,
      kid_female: /\bgirls\b|\bgirl\b/,
      adult_male: /\bmen\b|\bmale\b|\bman\b|\bmens\b/,
      adult_female: /\bwomen\b|\bfemale\b|\bwoman\b|\bwomens\b/,
    };
    const audiences: ProductClassification["audience"][] = [];
    if (audienceKeywords.kid?.test(text)) {
      if (audienceKeywords.kid_male?.test(text)) audiences.push("kid_male");
      if (audienceKeywords.kid_female?.test(text)) audiences.push("kid_female");
      if (
        !audienceKeywords.kid_male?.test(text) &&
        !audienceKeywords.kid_female?.test(text)
      )
        audiences.push("generic");
    } else {
      if (audienceKeywords.adult_male?.test(text)) audiences.push("adult_male");
      if (audienceKeywords.adult_female?.test(text))
        audiences.push("adult_female");
      if (audiences.length === 0) audiences.push("generic");
    }

    // Determine verticals present
    const verticals = Object.entries(verticalKeywords)
      .filter(([, rx]) => rx.test(text))
      .map(([k]) => k as ProductClassification["vertical"]);
    if (verticals.length === 0) verticals.push("accessories");

    // Derive categories from showcase product titles
    const allTitles = productLines.join(" ").toLowerCase();
    const categoryMap: Record<string, RegExp> = {
      shirts: /(shirt|t[- ]?shirt|tee)/,
      pants: /(pant|trouser|chino)/,
      shorts: /shorts?/,
      jeans: /jeans?/,
      dresses: /dress/,
      skincare: /(serum|moisturizer|skincare|cream)/,
      accessories: /(belt|watch|wallet|bag)/,
      footwear: /(sneaker|shoe|boot)/,
      decor: /(candle|lamp|rug|sofa|chair|table)/,
      beverages: /(coffee|tea|chocolate)/,
    };
    const categories = Object.entries(categoryMap)
      .filter(([, rx]) => rx.test(allTitles))
      .map(([name]) => name);
    const defaultCategories = categories.length ? categories : ["general"];

    const breakdown: Partial<
      Record<
        ProductClassification["audience"],
        Partial<Record<ProductClassification["vertical"], string[]>>
      >
    > = {};
    for (const aud of audiences) {
      breakdown[aud] = breakdown[aud] || {};
      for (const v of verticals) {
        breakdown[aud]![v] = Array.from(new Set(defaultCategories));
      }
    }
    // Apply pruning even in offline mode to drop un-signaled audiences/verticals
    return pruneBreakdownForSignals(breakdown, textNormalized);
  }

  const prompt = `Analyze this store and build a multi-audience breakdown of verticals and categories.
Store Information:
${storeContent}

Return ONLY valid JSON (no markdown, no code fences) using this shape:
{
  "adult_male": { "clothing": ["shirts", "pants"], "accessories": ["belts"] },
  "adult_female": { "beauty": ["skincare"], "clothing": ["dresses"] },
  "generic": { "clothing": ["t-shirts"] }
}

Rules:
- Keys MUST be audience: "adult_male" | "adult_female" | "kid_male" | "kid_female" | "generic".
- Nested keys MUST be vertical: "clothing" | "beauty" | "accessories" | "home-decor" | "food-and-beverages".
- Values MUST be non-empty arrays of category strings.
`;

  const raw = await callOpenRouter(model, prompt, apiKey);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateStoreTypeBreakdown(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return pruneBreakdownForSignals(validated.value, textNormalized);
}

function validateStoreTypeBreakdown(obj: unknown):
  | {
      ok: true;
      value: Partial<
        Record<
          ProductClassification["audience"],
          Partial<Record<ProductClassification["vertical"], string[]>>
        >
      >;
    }
  | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      error: "Top-level must be an object keyed by audience",
    };
  }
  const audienceKeys = [
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ] as const;
  const verticalKeys = [
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ] as const;
  const o = obj as Record<string, unknown>;
  const out: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  > = {};
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return { ok: false, error: "At least one audience key is required" };
  }
  for (const aKey of keys) {
    if (!audienceKeys.includes(aKey as any)) {
      return { ok: false, error: `Invalid audience key: ${aKey}` };
    }
    const vObj = o[aKey];
    if (!vObj || typeof vObj !== "object" || Array.isArray(vObj)) {
      return {
        ok: false,
        error: `Audience ${aKey} must map to an object of verticals`,
      };
    }
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const vKey of Object.keys(vObj as Record<string, unknown>)) {
      if (!verticalKeys.includes(vKey as any)) {
        return {
          ok: false,
          error: `Invalid vertical key ${vKey} for audience ${aKey}`,
        };
      }
      const cats = (vObj as any)[vKey];
      if (
        !Array.isArray(cats) ||
        cats.length === 0 ||
        !cats.every((c) => typeof c === "string" && c.trim())
      ) {
        return {
          ok: false,
          error: `Vertical ${vKey} for audience ${aKey} must be a non-empty array of strings`,
        };
      }
      vOut[vKey as ProductClassification["vertical"]] = cats.map((c: string) =>
        c.trim()
      );
    }
    out[aKey as ProductClassification["audience"]] = vOut;
  }
  return { ok: true, value: out };
}

export function pruneBreakdownForSignals(
  breakdown: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  >,
  text: string
): Partial<
  Record<
    ProductClassification["audience"],
    Partial<Record<ProductClassification["vertical"], string[]>>
  >
> {
  const audienceKeywords: Record<string, RegExp> = {
    kid: /(\bkid\b|\bchild\b|\bchildren\b|\btoddler\b|\bboy\b|\bgirl\b)/,
    kid_male: /\bboys\b|\bboy\b/,
    kid_female: /\bgirls\b|\bgirl\b/,
    adult_male: /\bmen\b|\bmale\b|\bman\b|\bmens\b/,
    adult_female: /\bwomen\b|\bfemale\b|\bwoman\b|\bwomens\b/,
  };
  const verticalKeywords: Record<string, RegExp> = {
    clothing:
      /(dress|shirt|pant|jean|hoodie|tee|t[- ]?shirt|sneaker|apparel|clothing)/,
    beauty: /(skincare|moisturizer|serum|beauty|cosmetic|makeup)/,
    accessories:
      /(bag|belt|watch|wallet|accessor(y|ies)|sunglasses|jewell?ery)/,
    // Tighten home-decor detection to avoid matching generic "Home" nav labels
    // and other unrelated uses. Require specific furniture/decor terms or phrases.
    "home-decor":
      /(sofa|chair|table|candle|lamp|rug|furniture|home[- ]?decor|homeware|housewares|living\s?room|dining\s?table|bed(?:room)?|wall\s?(art|mirror|clock))/,
    "food-and-beverages": /(snack|food|beverage|coffee|tea|chocolate|gourmet)/,
  };

  const signaledAudiences = new Set<ProductClassification["audience"]>();
  if (audienceKeywords.kid?.test(text)) {
    if (audienceKeywords.kid_male?.test(text))
      signaledAudiences.add("kid_male");
    if (audienceKeywords.kid_female?.test(text))
      signaledAudiences.add("kid_female");
    if (
      !audienceKeywords.kid_male?.test(text) &&
      !audienceKeywords.kid_female?.test(text)
    )
      signaledAudiences.add("generic");
  } else {
    if (audienceKeywords.adult_male?.test(text))
      signaledAudiences.add("adult_male");
    if (audienceKeywords.adult_female?.test(text))
      signaledAudiences.add("adult_female");
    if (signaledAudiences.size === 0) signaledAudiences.add("generic");
  }

  const signaledVerticals = new Set<ProductClassification["vertical"]>(
    Object.entries(verticalKeywords)
      .filter(([, rx]) => rx.test(text))
      .map(([k]) => k as ProductClassification["vertical"]) || []
  );
  if (signaledVerticals.size === 0) signaledVerticals.add("accessories");

  const pruned: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  > = {};
  for (const [audience, verticals] of Object.entries(breakdown)) {
    const a = audience as ProductClassification["audience"];
    if (!signaledAudiences.has(a)) continue;
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const [vertical, categories] of Object.entries(verticals || {})) {
      const v = vertical as ProductClassification["vertical"];
      if (!signaledVerticals.has(v)) continue;
      vOut[v] = categories as string[];
    }
    if (Object.keys(vOut).length > 0) {
      pruned[a] = vOut;
    }
  }

  // If pruning removes all audiences, fall back to generic with any verticals present in original or signaled
  if (Object.keys(pruned).length === 0) {
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const v of Array.from(signaledVerticals)) {
      vOut[v] = ["general"];
    }
    pruned.generic = vOut;
  }

  // Remove generic when adult audiences exist and have verticals
  const adultHasData =
    (pruned.adult_male && Object.keys(pruned.adult_male).length > 0) ||
    (pruned.adult_female && Object.keys(pruned.adult_female).length > 0);
  if (adultHasData) {
    delete pruned.generic;
  }

  return pruned;
}
