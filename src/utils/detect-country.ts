import type { CountryDetectionResult, CountryScores, ShopifyFeaturesData } from '../types';

const COUNTRY_CODES: Record<string, string> = {
  "+1": "US", // United States (primary) / Canada also uses +1
  "+44": "GB", // United Kingdom
  "+61": "AU", // Australia
  "+65": "SG", // Singapore
  "+91": "IN", // India
  "+81": "JP", // Japan
  "+49": "DE", // Germany
  "+33": "FR", // France
  "+971": "AE", // United Arab Emirates
  "+39": "IT", // Italy
  "+34": "ES", // Spain
  "+82": "KR", // South Korea
  "+55": "BR", // Brazil
  "+62": "ID", // Indonesia
  "+92": "PK", // Pakistan
  "+7": "RU", // Russia
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "₹": "IN", // India
  "$": "US", // United States (primary, though many countries use $)
  "CA$": "CA", // Canada
  "A$": "AU", // Australia
  "£": "GB", // United Kingdom
  "€": "EU", // European Union (not a country code, but commonly used)
  "AED": "AE", // United Arab Emirates
  "₩": "KR", // South Korea
  "¥": "JP", // Japan (primary, though China also uses ¥)
};

function scoreCountry(countryScores: CountryScores, country: string, weight: number, reason: string): void {
  if (!country) return;
  if (!countryScores[country])
    countryScores[country] = { score: 0, reasons: [] };
  countryScores[country].score += weight;
  countryScores[country].reasons.push(reason);
}

/**
 * Detects the country of a Shopify store by analyzing various signals in the HTML content.
 * 
 * This function examines multiple data sources within the HTML to determine the store's country:
 * - Shopify features JSON data (country, locale, money format)
 * - Phone number prefixes in contact information
 * - JSON-LD structured data with address information
 * - Footer mentions of country names
 * - Currency symbols in money formatting
 * 
 * @param html - The HTML content of the Shopify store's homepage
 * @returns Promise resolving to country detection results containing:
 * - `country` - The detected country ISO 3166-1 alpha-2 code (e.g., "US", "GB") or "Unknown" if no reliable detection
 * - `confidence` - Confidence score between 0 and 1 (higher = more confident)
 * - `signals` - Array of detection signals that contributed to the result
 * 
 * @example
 * ```typescript
 * const response = await fetch('https://example.myshopify.com');
 * const html = await response.text();
 * const result = await detectShopifyCountry(html);
 * 
 * console.log(result.country); // "US" (ISO code for United States)
 * console.log(result.confidence); // 0.85
 * console.log(result.signals); // ["shopify-features.country", "phone prefix +1"]
 * ```
 */
export async function detectShopifyCountry(html: string): Promise<CountryDetectionResult> {

  const countryScores: CountryScores = {};

  // 1️⃣ Extract Shopify features JSON
  const shopifyFeaturesMatch = html.match(
    /<script[^>]+id=["']shopify-features["'][^>]*>([\s\S]*?)<\/script>/
  );
  if (shopifyFeaturesMatch) {
    try {
      const data: ShopifyFeaturesData = JSON.parse(shopifyFeaturesMatch[1]);
      if (data.country)
        scoreCountry(countryScores, data.country, 1, "shopify-features.country");
      if (data.locale?.includes("-")) {
        const localeCountry = data.locale.split("-")[1];
        scoreCountry(countryScores, localeCountry.toUpperCase(), 0.7, "shopify-features.locale");
      }
      if (data.moneyFormat) {
        for (const symbol in CURRENCY_SYMBOLS) {
          if (data.moneyFormat.includes(symbol))
            scoreCountry(countryScores, CURRENCY_SYMBOLS[symbol], 0.6, "moneyFormat symbol");
        }
      }
    } catch (error) {
      // Silently handle JSON parsing errors
    }
  }

  // 2️⃣ Extract phone numbers
  const phones = html.match(/\+\d{1,3}[\s\-()0-9]{5,}/g);
  if (phones) {
    for (const phone of phones) {
      const prefix = phone.match(/^\+\d{1,3}/)?.[0];
      if (prefix && COUNTRY_CODES[prefix])
        scoreCountry(countryScores, COUNTRY_CODES[prefix], 0.8, `phone prefix ${prefix}`);
    }
  }

  // 3️⃣ Extract JSON-LD addressCountry fields
  const jsonLdRegex = /<script[^>]+application\/ld\+json[^>]*>(.*?)<\/script>/g;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1]) as any;
      const addr = data?.address?.addressCountry;
      if (addr) scoreCountry(countryScores, addr, 1, "JSON-LD addressCountry");
    } catch (error) {
      // Silently handle JSON parsing errors
    }
  }

  // 4️⃣ Footer country mentions - now using ISO codes
  const footerMatch = html.match(/<footer[^>]*>(.*?)<\/footer>/i);
  if (footerMatch) {
    const footerText = footerMatch[1].toLowerCase();
    // Create a mapping of country names to ISO codes for footer detection
    const countryNameToISO: Record<string, string> = {
      'india': 'IN',
      'united states': 'US',
      'canada': 'CA', 
      'australia': 'AU',
      'united kingdom': 'GB',
      'britain': 'GB',
      'uk': 'GB',
      'japan': 'JP',
      'south korea': 'KR',
      'korea': 'KR',
      'germany': 'DE',
      'france': 'FR',
      'italy': 'IT',
      'spain': 'ES',
      'brazil': 'BR',
      'russia': 'RU',
      'singapore': 'SG',
      'indonesia': 'ID',
      'pakistan': 'PK'
    };
    
    for (const [countryName, isoCode] of Object.entries(countryNameToISO)) {
      if (footerText.includes(countryName))
        scoreCountry(countryScores, isoCode, 0.4, "footer mention");
    }
  }

  // Pick best guess
  const sorted = Object.entries(countryScores).sort((a, b) => b[1].score - a[1].score);
  const best = sorted[0];

  return best
    ? {
        country: best[0],
        confidence: Math.min(1, best[1].score / 2),
        signals: best[1].reasons,
      }
    : { country: "Unknown", confidence: 0, signals: [] };
}
