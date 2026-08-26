import type {
  ProductSchemaType,
  SearchMode,
} from "@backend/modules/product/product.requestValidation";
import { enrichWithSearch } from "@backend/services/search";
import type { SearchMetadata } from "@backend/services/search";
import { processImagesWithOpenAI_chatCompletions } from "@backend/services/analyze/imageProcessor";
import { getProductDefinition } from "./product.registry";

export interface ProductAnalysisOptions {
  imageBuffers: Buffer[];
  imageTypes: string[];
  schemaType: ProductSchemaType;
  isParsed: boolean;
  formatDates: boolean;
  searchMode: SearchMode;
}

interface SearchGateOptions {
  schemaType: ProductSchemaType;
  searchMode: SearchMode;
  responseData: unknown;
}

interface SearchGateResult {
  shouldEnrich: boolean;
  searchDecision?: unknown;
  extractionObject?: object;
}

export interface ProductAnalysisResult {
  response: unknown;
  rawResponse: unknown;
  shouldIncludeRawResponse: boolean;
  searchMetadata?: SearchMetadata;
  searchDecision?: unknown;
}

function isSearchableCategory(
  schemaType: ProductSchemaType,
): schemaType is "pesticide" | "fertilizer" {
  return getProductDefinition(schemaType).supportsSearch;
}

function toExtractionObject(responseData: unknown): object {
  return typeof responseData === "string"
    ? (JSON.parse(responseData) as object)
    : (responseData as object);
}

/**
 * Preserves the existing interactive-search gate: only pesticide/fertilizer
 * may enrich, and interactive mode searches when the LLM asks for it or when
 * ingredients/pre-harvest interval are absent from the extraction.
 */
export function evaluateProductSearchGate({
  schemaType,
  searchMode,
  responseData,
}: SearchGateOptions): SearchGateResult {
  if (!isSearchableCategory(schemaType)) {
    return { shouldEnrich: false };
  }

  if (searchMode === "always") {
    return { shouldEnrich: true };
  }

  if (searchMode !== "interactive") {
    return { shouldEnrich: false };
  }

  const extractionObject = toExtractionObject(responseData) as {
    search_decision?: unknown;
    data?: {
      ingredients?: { length?: number } | null;
      pre_harvest_interval_days?: unknown;
    } | null;
  } | null;
  const searchDecision = extractionObject?.search_decision ?? undefined;
  const data = extractionObject?.data;
  const decision = searchDecision as { needs_web_search?: unknown } | undefined;
  const llmWantsSearch = decision?.needs_web_search === true;
  const missingIngredients =
    !data?.ingredients || data.ingredients.length === 0;
  const missingInterval = data?.pre_harvest_interval_days == null;
  const shouldEnrich = llmWantsSearch || missingIngredients || missingInterval;

  console.log("Interactive search gate:", {
    llmWantsSearch,
    missingIngredients,
    missingInterval,
    shouldEnrich,
  });

  return {
    shouldEnrich,
    ...(extractionObject ? { extractionObject } : {}),
    ...(searchDecision !== undefined ? { searchDecision } : {}),
  };
}

export async function analyzeProduct(
  options: ProductAnalysisOptions,
): Promise<ProductAnalysisResult> {
  const definition = getProductDefinition(options.schemaType);
  const prompt = definition.buildPrompt(options.searchMode === "interactive");
  const result = await processImagesWithOpenAI_chatCompletions(
    options.imageBuffers,
    options.imageTypes,
    prompt,
    options.schemaType,
    options.isParsed,
    options.formatDates,
    /* withSearchSchema */ options.searchMode === "interactive",
  );

  const gate = evaluateProductSearchGate({
    schemaType: options.schemaType,
    searchMode: options.searchMode,
    responseData: result.response,
  });
  let responseData = result.response;
  let searchMetadata: SearchMetadata | undefined;

  if (gate.shouldEnrich) {
    const enrichment = await enrichWithSearch(
      gate.extractionObject ?? toExtractionObject(responseData),
      options.schemaType as "pesticide" | "fertilizer",
    );
    searchMetadata = enrichment.searchMetadata;
    responseData = options.isParsed
      ? enrichment.enrichedResult
      : JSON.stringify(enrichment.enrichedResult);
  }

  return {
    response: responseData,
    rawResponse: result.response,
    shouldIncludeRawResponse: gate.shouldEnrich,
    ...(searchMetadata ? { searchMetadata } : {}),
    ...(gate.searchDecision !== undefined
      ? { searchDecision: gate.searchDecision }
      : {}),
  };
}
