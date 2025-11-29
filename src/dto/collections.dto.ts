import type { Collection, ShopifyCollection } from "../types";

export function collectionsDto(
  collections: ShopifyCollection[] | null
): Collection[] | null {
  if (!collections || collections.length === 0) return null;

  return collections.map((collection) => ({
    id: collection.id.toString(),
    title: collection.title,
    handle: collection.handle,
    description: collection.description,
    image: collection.image
      ? {
          id: collection.image.id,
          createdAt: collection.image.created_at,
          src: collection.image.src,
          alt: collection.image.alt,
        }
      : undefined,
    productsCount: collection.products_count,
    publishedAt: collection.published_at,
    updatedAt: collection.updated_at,
  }));
}
