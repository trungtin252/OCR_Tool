import type { SchemaType } from "@backend/validation/types";
import {
  getProductDefinition,
  PRODUCT_DEFINITIONS,
} from "@backend/modules/product/product.registry";
import { DocumentResponseSchema } from "@backend/validation/receiptInfo";
import type {
  FertilizerResponseSchema,
  FertilizerResponseSchemaWithSearch,
  FishFeedResponseSchema,
  PesticideResponseSchema,
  PesticideResponseSchemaWithSearch,
  SeedResponseSchema,
} from "@backend/modules/product/product.schema";

type ResponseSchema =
  | typeof PesticideResponseSchema
  | typeof PesticideResponseSchemaWithSearch
  | typeof FertilizerResponseSchema
  | typeof FertilizerResponseSchemaWithSearch
  | typeof FishFeedResponseSchema
  | typeof SeedResponseSchema
  | typeof DocumentResponseSchema;

export const MODEL_BY_SCHEMA_TYPE: Record<SchemaType, string> = {
  fish_feed: PRODUCT_DEFINITIONS.fish_feed.model,
  pesticide: PRODUCT_DEFINITIONS.pesticide.model,
  fertilizer: PRODUCT_DEFINITIONS.fertilizer.model,
  seed: PRODUCT_DEFINITIONS.seed.model,
  receipt: "gemini-3.1-flash-lite",
};

export const FALLBACK_MODEL = "gemini-2.5-flash";
export const TEST_MODEL = "gemini-3.1-flash-lite";
export const FUSION_MODEL = "gemini-3.1-flash-lite";

export function getModelForSchemaType(schemaType: SchemaType): string {
  return schemaType === "receipt"
    ? MODEL_BY_SCHEMA_TYPE.receipt
    : getProductDefinition(schemaType).model;
}

export function getResponseSchema(
  schemaType: SchemaType,
  withSearchSchema: boolean = false,
): ResponseSchema {
  if (schemaType === "receipt") return DocumentResponseSchema;

  const definition = getProductDefinition(schemaType);
  return withSearchSchema && definition.searchResponseSchema
    ? (definition.searchResponseSchema as ResponseSchema)
    : (definition.responseSchema as ResponseSchema);
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
