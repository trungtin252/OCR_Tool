import { FertilizerProvider } from "./fertilizerProvider.js";
import { PesticideProvider } from "./pesticideProvider.js";
import type {
  FertilizerSearchResult,
  PesticideSearchResult,
  SearchProvider,
} from "./types.js";

export type SearchableCategory = "pesticide" | "fertilizer";
export type CachedSearchResult = PesticideSearchResult | FertilizerSearchResult;

export const SEARCH_PROVIDER_REGISTRY = {
  pesticide: new PesticideProvider(),
  fertilizer: new FertilizerProvider(),
} satisfies Record<SearchableCategory, SearchProvider<CachedSearchResult>>;

export function getSearchProvider(
  category: SearchableCategory,
): SearchProvider<CachedSearchResult> {
  return SEARCH_PROVIDER_REGISTRY[category];
}
