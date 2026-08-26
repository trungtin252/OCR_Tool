// ============================================================
// Shared types for the online search enrichment service layer
// ============================================================

export interface Ingredient {
  name: string;
  content: string;
}

export interface PesticideDosage {
  target_pest: string;
  target_crop: string;
  amount: string;
  pre_harvest_interval: string;
  usage_instructions: string;
}

/**
 * Normalized result from the pesticide government database
 * (danhmuc.thuocbvtv.com)
 */
export interface PesticideSearchResult {
  product_name?: string;
  registration_number?: string;
  registrant?: string;
  ingredients?: Ingredient[];
  target_pests?: string[];
  target_crops?: string[];
  dosage?: PesticideDosage[];
  source_url?: string;
}

/**
 * Normalized result from the fertilizer government database
 * (113.190.254.147/PhanBon)
 */
export interface FertilizerSearchResult {
  product_name?: string;
  registration_number?: string; // Mã số phân bón
  registrant?: string;
  ingredients?: Ingredient[];
  dosage?: string; // Free-form usage guide text
  source_url?: string;
}

/**
 * Provider-agnostic search interface.
 * All concrete providers must implement this.
 */
export interface SearchProvider<T> {
  /**
   * Search for a product by name and/or registration number.
   * Implementing classes decide which to use based on availability.
   * Returns null if the product was not found or search failed.
   */
  search(
    productName?: string | null,
    registrationNumber?: string | null,
  ): Promise<T | null>;
}

/**
 * Metadata attached to the enriched response to indicate search outcome.
 */
export type SearchStatus =
  | "enriched" // Search succeeded and data was merged
  | "not_found" // Search ran but no matching product found
  | "skipped" // Search skipped (no product name / reg number)
  | "failed" // Search or fusion failed (original result returned)
  | "unsupported_category"; // Category does not support search

export interface SearchMetadata {
  search_status: SearchStatus;
  source_url?: string;
  search_query?: string;
}
