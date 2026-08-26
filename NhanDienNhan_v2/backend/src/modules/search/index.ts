// ============================================================
// Public API barrel export for the search enrichment service
// ============================================================

export { enrichWithSearch } from "./searchOrchestrator.js";
export type {
  PesticideSearchResult,
  FertilizerSearchResult,
  SearchMetadata,
  SearchStatus,
  Ingredient,
  PesticideDosage,
} from "./types.js";
