import type { SchemaType } from "@backend/shared/contracts/schemaTypes";
import {
  getProductDefinition,
  PRODUCT_DEFINITIONS,
} from "@backend/modules/product/product.registry";
import { DocumentResponseSchema } from "@backend/modules/receipt/receipt.schema";
import { GrowingAreaCertificateResponseSchema } from "@backend/modules/ga_certificate/gaCertificate.schema";
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
  | typeof DocumentResponseSchema
  | typeof GrowingAreaCertificateResponseSchema;

export const MODEL_BY_SCHEMA_TYPE: Record<SchemaType, string> = {
  fish_feed: PRODUCT_DEFINITIONS.fish_feed.model,
  pesticide: PRODUCT_DEFINITIONS.pesticide.model,
  fertilizer: PRODUCT_DEFINITIONS.fertilizer.model,
  seed: PRODUCT_DEFINITIONS.seed.model,
  receipt: "gemini-3.1-flash-lite",
  growing_area_certificate: "gemini-3.1-flash-lite",
};

export const FALLBACK_MODEL = "gemini-2.5-flash";
export const TEST_MODEL = "gemini-3.1-flash-lite";
export const FUSION_MODEL = "gemini-3.1-flash-lite";

export function getModelForSchemaType(schemaType: SchemaType): string {
  return schemaType === "receipt" || schemaType === "growing_area_certificate"
    ? MODEL_BY_SCHEMA_TYPE[schemaType]
    : getProductDefinition(schemaType).model;
}

export function getResponseSchema(
  schemaType: SchemaType,
  withSearchSchema: boolean = false,
): ResponseSchema {
  if (schemaType === "receipt") return DocumentResponseSchema;
  if (schemaType === "growing_area_certificate") {
    return GrowingAreaCertificateResponseSchema;
  }

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
    case "growing_area_certificate":
      return getResponseSchema(schemaType);
    case "seed":
    case "":
      return null;
  }
}
