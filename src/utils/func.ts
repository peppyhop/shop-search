import { parse } from "tldts";

export function extractDomainWithoutSuffix(domain: string) {
  const parsedDomain = parse(domain);
  return parsedDomain.hostname || domain.split("://")[1];
}

export function generateStoreSlug(domain: string): string {
  const input = new URL(domain);
  const parsedDomain = parse(input.href);
  const domainName =
    parsedDomain.domainWithoutSuffix ?? input.hostname.split(".")[0];

  return domainName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const genProductSlug = ({
  handle,
  storeDomain,
}: {
  handle: string;
  storeDomain: string;
}) => {
  const storeSlug = generateStoreSlug(storeDomain);
  return `${handle}-by-${storeSlug}`;
};

export const calculateDiscount = (
  price: number,
  compareAtPrice?: number
): number =>
  !compareAtPrice || compareAtPrice === 0
    ? 0
    : Math.max(
        0,
        Math.round(100 - (price / compareAtPrice) * 100) // Removed the decimal precision
      );
