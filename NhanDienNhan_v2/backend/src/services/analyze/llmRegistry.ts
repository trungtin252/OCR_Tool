import type { SchemaType } from "@backend/validation/types";
import {
  FishFeedResponseSchema,
  SeedResponseSchema,
  PesticideResponseSchema,
  FertilizerResponseSchema,
  PesticideResponseSchemaWithSearch,
  FertilizerResponseSchemaWithSearch,
} from "@backend/validation/productInfo";
import { DocumentResponseSchema } from "@backend/validation/receiptInfo";

export const MODEL_BY_SCHEMA_TYPE: Record<SchemaType, string> = {
  fish_feed: "gemini-3-flash-preview",
  pesticide: "gemini-3.1-flash-lite",
  fertilizer: "gemini-3.1-flash-lite",
  seed: "gemini-3.1-flash-lite",
  receipt: "gemini-3.1-flash-lite",
};

export const FALLBACK_MODEL = "gemini-2.5-flash";
export const TEST_MODEL = "gemini-3.1-flash-lite";
export const FUSION_MODEL = "gemini-3.1-flash-lite";

export function getModelForSchemaType(schemaType: SchemaType): string {
  return MODEL_BY_SCHEMA_TYPE[schemaType];
}

export function getResponseSchema(
  schemaType: SchemaType,
  withSearchSchema: boolean = false,
) {
  switch (schemaType) {
    case "fish_feed":
      return FishFeedResponseSchema;
    case "fertilizer":
      return withSearchSchema
        ? FertilizerResponseSchemaWithSearch
        : FertilizerResponseSchema;
    case "seed":
      return SeedResponseSchema;
    case "receipt":
      return DocumentResponseSchema;
    case "pesticide":
      return withSearchSchema
        ? PesticideResponseSchemaWithSearch
        : PesticideResponseSchema;
  }
}

/**
 * The raw test endpoint deliberately has no response schema. Keep the legacy
 * behavior for the exported helper as well, including the absence of seed
 * schema validation in this diagnostic-only path.
 */
export function getTestResponseSchema(schemaType: SchemaType | "") {
  switch (schemaType) {
    case "fish_feed":
    case "pesticide":
    case "fertilizer":
    case "receipt":
      return getResponseSchema(schemaType);
    case "seed":
    case "":
      return null;
  }
}
