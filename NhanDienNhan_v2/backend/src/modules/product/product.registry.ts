import type { z } from "zod";
import {
  FertilizerResponseSchema,
  FertilizerResponseSchemaWithSearch,
  FishFeedResponseSchema,
  PesticideResponseSchema,
  PesticideResponseSchemaWithSearch,
  SeedResponseSchema,
} from "./product.schema";
import { buildPrompt } from "./product.prompts";
import type { ProductSchemaType } from "./product.requestValidation";

export interface ProductDefinition {
  model: string;
  responseSchema: z.ZodType;
  searchResponseSchema?: z.ZodType;
  supportsSearch: boolean;
  buildPrompt: (enableSearch: boolean) => string;
}

export const PRODUCT_DEFINITIONS = {
  pesticide: {
    model: "gemini-3.1-flash-lite",
    responseSchema: PesticideResponseSchema,
    searchResponseSchema: PesticideResponseSchemaWithSearch,
    supportsSearch: true,
    buildPrompt: (enableSearch) => buildPrompt("pesticide", enableSearch),
  },
  fertilizer: {
    model: "gemini-3.1-flash-lite",
    responseSchema: FertilizerResponseSchema,
    searchResponseSchema: FertilizerResponseSchemaWithSearch,
    supportsSearch: true,
    buildPrompt: (enableSearch) => buildPrompt("fertilizer", enableSearch),
  },
  fish_feed: {
    model: "gemini-3-flash-preview",
    responseSchema: FishFeedResponseSchema,
    supportsSearch: false,
    buildPrompt: (enableSearch) => buildPrompt("fish_feed", enableSearch),
  },
  seed: {
    model: "gemini-3.1-flash-lite",
    responseSchema: SeedResponseSchema,
    supportsSearch: false,
    buildPrompt: (enableSearch) => buildPrompt("seed", enableSearch),
  },
} satisfies Record<ProductSchemaType, ProductDefinition>;

export function getProductDefinition(
  category: ProductSchemaType,
): ProductDefinition {
  return PRODUCT_DEFINITIONS[category]!;
}
