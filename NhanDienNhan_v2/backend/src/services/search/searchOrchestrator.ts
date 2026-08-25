// ============================================================
// Search orchestrator — ties together providers, cache, and fusion
// ============================================================

import { PesticideProvider } from "./pesticideProvider.js";
import { FertilizerProvider } from "./fertilizerProvider.js";
import { searchCache } from "./searchCache.js";
import { fuseResults } from "./fusionService.js";
import type {
  SearchMetadata,
  PesticideSearchResult,
  FertilizerSearchResult,
} from "./types.js";

const pesticideProvider = new PesticideProvider();
const fertilizerProvider = new FertilizerProvider();

export interface EnrichmentResult {
  enrichedResult: object;
  searchMetadata: SearchMetadata;
}

/**
 * Orchestrates the full enrichment flow:
 * 1. Extract product identifiers from the image extraction result
 * 2. Skip if no searchable identifiers
 * 3. Check cache; return cached enriched result if available
 * 4. Run the appropriate provider (pesticide / fertilizer)
 * 5. If found, run fusion LLM to merge
 * 6. Cache the search result for 24h
 * 7. Return enriched result + metadata
 *
 * This function NEVER throws — all failures are caught and the original
 * image extraction result is returned unchanged.
 */
export async function enrichWithSearch(
  imageExtractionResult: object,
  category: "pesticide" | "fertilizer",
): Promise<EnrichmentResult> {
  const original = imageExtractionResult;

  try {
    // ── Extract identifiers from the image result
    const data = (imageExtractionResult as Record<string, unknown>)["data"] as
      | Record<string, unknown>
      | null
      | undefined;

    const productName = (data?.["product_name"] as string | null) ?? null;
    const registrationNumber =
      (data?.["registration_number"] as string | null) ?? null;
    const searchQuery =
      registrationNumber?.trim() || productName?.trim() || undefined;

    // ── Skip if no usable identifiers (per FEATURE.md)
    if (!productName?.trim() && !registrationNumber?.trim()) {
      console.log(
        "[searchOrchestrator] Skipping search: no product_name or registration_number",
      );
      return {
        enrichedResult: original,
        searchMetadata: { search_status: "skipped" },
      };
    }

    const cacheKey = searchCache.buildKey(
      category,
      productName,
      registrationNumber,
    );

    // ── Cache hit check
    type CachedSearchResult = PesticideSearchResult | FertilizerSearchResult;
    const cachedSearchResult = searchCache.get<CachedSearchResult>(cacheKey);
    if (cachedSearchResult) {
      console.log(`[searchOrchestrator] Cache hit for key: ${cacheKey}`);

      // Fusion output contains image-specific fields (dates, package details,
      // confidence, warnings). Only reuse the web lookup and fuse it with the
      // current request to prevent cross-request data contamination.
      const enriched = await fuseResults(
        imageExtractionResult,
        cachedSearchResult,
        category,
      );

      return {
        enrichedResult: enriched,
        searchMetadata: {
          search_status: "enriched" as const,
          ...(cachedSearchResult.source_url
            ? { source_url: cachedSearchResult.source_url }
            : {}),
          ...(searchQuery ? { search_query: searchQuery } : {}),
        },
      };
    }

    // ── Run provider search
    let searchResult: PesticideSearchResult | FertilizerSearchResult | null =
      null;

    if (category === "pesticide") {
      searchResult = await pesticideProvider.search(
        productName,
        registrationNumber,
      );
    } else {
      searchResult = await fertilizerProvider.search(
        productName,
        registrationNumber,
      );
    }

    if (!searchResult) {
      console.log(
        `[searchOrchestrator] No search result found for category=${category}`,
      );
      return {
        enrichedResult: original,
        searchMetadata: {
          search_status: "not_found" as const,
          ...(searchQuery ? { search_query: searchQuery } : {}),
        },
      };
    }

    // ── Run fusion LLM
    console.log(
      `[searchOrchestrator] Fusing results for category=${category}, source=${searchResult.source_url}`,
    );
    const enriched = await fuseResults(
      imageExtractionResult,
      searchResult,
      category,
    );

    // ── Cache result
    searchCache.set<CachedSearchResult>(cacheKey, searchResult);

    return {
      enrichedResult: enriched,
      searchMetadata: {
        search_status: "enriched" as const,
        ...(searchResult.source_url
          ? { source_url: searchResult.source_url }
          : {}),
        ...(searchQuery ? { search_query: searchQuery } : {}),
      },
    };
  } catch (err) {
    // Search failures must NEVER fail the main request (per FEATURE.md)
    console.error(
      "[searchOrchestrator] Enrichment failed — returning original result:",
      err instanceof Error ? err.message : err,
    );
    return {
      enrichedResult: original,
      searchMetadata: { search_status: "failed" },
    };
  }
}
