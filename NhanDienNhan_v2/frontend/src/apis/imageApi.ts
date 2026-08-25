/**
 * Image upload utilities for communicating with the backend
 */

import { getApiErrorMessage, getNetworkErrorMessage } from "./apiError";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export type ProductCategory = "pesticide" | "fertilizer" | "fish_feed" | "seed";
export type SearchMode = "none" | "always" | "interactive";
type JsonRecord = Record<string, unknown>;
export type ProductResponsePayload = string | JsonRecord;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export interface ReviewWarning {
  confidence?: number;
  field_path: string;
  issue: string;
  message: string;
}

export interface ResponseMetadata {
  overall_confidence?: number;
  review_warnings?: ReviewWarning[];
}

export interface ProductInfo {
  success: boolean;
  category?: ProductCategory;
  message?: string;
  error_code?: string;
  metadata?: ResponseMetadata;
  mfg_date?: string;
  exp_date?: string;
  form_type?: string;
  net_unit?: string;
  ingredients?: Array<{ name: string; content: string }> | string;
  // Pesticide fields
  product_name?: string;
  product_type?: string;
  registrant?: string;
  registration_number?: string;
  uses?: string;
  dosage?: Array<{ target: string; instruction: string }> | string;
  target_crops?: string[];
  target_pests?: string[];
  pre_harvest_interval_days?: number;
  // Fish feed fields
  variant_code?: string;
  species?: string;
  net_content?: string;
  nutrition_facts?: Array<{ name: string; value: string; unit?: string }>;
  feeding_guide?: {
    code?: string;
    guide?: Array<{ name: string; value: string }>;
  };
  confidence_score?: number;
  // Seed fields
  cropping_season?: string[] | null;
  growth_duration?: string | null;
  lot_number?: string | null;
  manufacturer?: string | null;
  origin?: string | null;
  quality_criteria?: Array<{
    name: string;
    value: string;
    unit?: string | null;
  }> | null;
}

export interface ImageAnalysisResponse {
  success: boolean;
  data?: {
    response: ProductResponsePayload;
    totalImages: number;
    fileName?: string;
    mimeType?: string;
  };
  message?: string;
}

export interface SearchMetadata {
  search_status: "enriched" | "not_found" | "skipped" | "failed";
  source_url?: string;
  search_query?: string;
}

export interface MultipleImagesResponse {
  success: boolean;
  data?: {
    response: ProductResponsePayload;
    raw?: ProductResponsePayload; // Original extraction before search enrichment
    totalImages: number;
    search_metadata?: SearchMetadata;
    // LLM's search decision (only present when searchMode is interactive)
    search_decision?: {
      needs_web_search: boolean;
      search_reason: string | null;
    };
  };
  message?: string;
  error?: string;
}

/**
 * Parse product info from API response
 * The response.data.response contains the actual product info as JSON text or object.
 */
export const parseProductInfo = (
  response: ImageAnalysisResponse | MultipleImagesResponse,
): ProductInfo => {
  try {
    if (!response.data?.response) {
      return {
        success: false,
        message:
          response.message || "Không thể trích xuất thông tin từ phản hồi",
        error_code: "INVALID_RESPONSE",
      };
    }

    // Handle both string and object responses
    let parsedResponse: unknown;
    if (typeof response.data.response === "string") {
      parsedResponse = JSON.parse(response.data.response);
    } else {
      parsedResponse = response.data.response;
    }

    if (!isJsonRecord(parsedResponse)) {
      throw new TypeError("Product response must be a JSON object");
    }

    // The response contains a 'data' field with product info, and metadata
    const productData = isJsonRecord(parsedResponse.data)
      ? parsedResponse.data
      : parsedResponse;

    // Combine data and metadata into ProductInfo
    const productInfo: ProductInfo = {
      ...(productData as Partial<ProductInfo>),
      success: parsedResponse.success === true,
      error_code: getOptionalString(parsedResponse.error_code),
      message: getOptionalString(parsedResponse.message),
      metadata: isJsonRecord(parsedResponse.metadata)
        ? (parsedResponse.metadata as ResponseMetadata)
        : undefined,
    };

    return productInfo;
  } catch {
    return {
      success: false,
      message: "Lỗi xử lý dữ liệu phản hồi",
      error_code: "PARSE_ERROR",
    };
  }
};

/**
 * Get warning for a specific field
 */
export const getFieldWarning = (
  productInfo: ProductInfo,
  fieldPath: string,
): ReviewWarning | undefined => {
  return productInfo.metadata?.review_warnings?.find(
    (w) => w.field_path === fieldPath,
  );
};

/**
 * Check if a field is empty or has a warning
 */
export const isFieldEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && Object.keys(value).length === 0) return true;
  return false;
};

/**
 * Upload a single image for analysis
 * @param file - Image file to upload
 * @param prompt - Optional custom prompt for the analysis
 * @returns Analysis result from OpenAI
 */
export const uploadImageForAnalysis = async (
  file: File,
  prompt?: string,
): Promise<ImageAnalysisResponse> => {
  const formData = new FormData();
  formData.append("images", file);
  if (prompt) {
    formData.append("prompt", prompt);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/image/analyze`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = (await response.json()) as unknown;
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to analyze image"),
      };
    }

    return await response.json();
  } catch (error: unknown) {
    return {
      success: false,
      message: getNetworkErrorMessage(
        error,
        "Network error while uploading image",
      ),
    };
  }
};

/**
 * Upload multiple images for analysis
 * @param files - Array of image files to upload
 * @param category - Product category: "pesticide" | "fertilizer" | "fish_feed"
 * @param searchMode - Search enrichment mode: "none" (default) | "always" | "interactive"
 * @returns Analysis results from the backend
 */
export const uploadMultipleImagesForAnalysis = async (
  files: File[],
  category: ProductCategory = "pesticide",
  searchMode: SearchMode = "none",
): Promise<MultipleImagesResponse> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  try {
    const url = new URL(`${API_BASE_URL}/api/image/analyze`);
    url.searchParams.append("category", category);
    url.searchParams.append("parsed", "true");
    url.searchParams.append("formatDates", "true");
    const mappedMode = searchMode === "none" ? "off" : searchMode;
    url.searchParams.append("searchMode", mappedMode);

    const response = await fetch(url.toString(), {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      try {
        const error = (await response.json()) as unknown;
        return {
          success: false,
          message: getApiErrorMessage(error, "Failed to analyze images"),
        };
      } catch {
        return {
          success: false,
          message: `Server error: ${response.status}`,
        };
      }
    }

    return await response.json();
  } catch (error: unknown) {
    return {
      success: false,
      message: getNetworkErrorMessage(
        error,
        "Network error while uploading images",
      ),
    };
  }
};
