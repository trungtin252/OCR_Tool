import type { SchemaType } from "../validation/types.js";

export type ProductSchemaType = Exclude<SchemaType, "receipt">;
export type SearchMode = "always" | "interactive" | "none";

const PRODUCT_SCHEMA_TYPES = new Set<ProductSchemaType>([
  "pesticide",
  "fertilizer",
  "fish_feed",
  "seed",
]);

/**
 * Keep the documented default while rejecting values that would otherwise
 * reach the model map as `undefined` or an unsupported key.
 */
export function parseProductSchemaType(
  value: unknown,
): ProductSchemaType | null {
  if (value === undefined) return "pesticide";
  if (typeof value !== "string") return null;
  return PRODUCT_SCHEMA_TYPES.has(value as ProductSchemaType)
    ? (value as ProductSchemaType)
    : null;
}

/** Preserve the existing query contract: only the exact string "true" is true. */
export function parseBooleanQuery(value: unknown): boolean {
  return value === "true";
}

/** Preserve backward compatibility: unknown/off/omitted values disable search. */
export function parseSearchMode(value: unknown): SearchMode {
  if (value === "always") return "always";
  if (value === "interactive") return "interactive";
  return "none";
}
