/**
 * Receipt OCR API — types and call function
 */

import { getApiErrorMessage, getNetworkErrorMessage } from "./apiError";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ─── Item Types ──────────────────────────────────────────────────────────────

export interface DeliveryNoteItem {
  product_name: string | null;
  product_code: string | null;
  lot_number: string | null;
  net_content: number | null;
  net_unit: string | null;
  bag_count: number | null;
  total_weight: number | null;
}

export interface InvoiceItem {
  product_name: string | null;
  product_code: string | null;
  lot_number: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_amount: number | null;
}

// ─── Document Types ──────────────────────────────────────────────────────────

export interface DeliveryNoteDocument {
  document_type: "delivery_note";
  supplier_name: string | null;
  customer_name: string | null;
  document_number: string | null;
  date: string | null;
  license_plate: string | null;
  items: DeliveryNoteItem[];
  total_bags: number | null;
  total_weight_kg: number | null;
}

export interface InvoiceDocument {
  document_type: "invoice";
  supplier_name: string | null;
  customer_name: string | null;
  document_number: string | null;
  date: string | null;
  items: InvoiceItem[];
  grand_total: number | null;
}

export type ReceiptDocument = DeliveryNoteDocument | InvoiceDocument;

// ─── Warning ─────────────────────────────────────────────────────────────────

export interface ReceiptReviewWarning {
  field: string | null;
  issue: string;
  message: string;
}

// ─── Response ────────────────────────────────────────────────────────────────

export interface ReceiptResponseData {
  document_count: number;
  documents: ReceiptDocument[];
}

export interface ReceiptInnerResponse {
  success: boolean;
  error_code: string;
  message: string;
  metadata: {
    overall_confidence: number;
    review_warnings: ReceiptReviewWarning[];
  } | null;
  data: ReceiptResponseData | null;
}

export interface ReceiptApiResponse {
  success: boolean;
  data?: {
    response: ReceiptInnerResponse;
    totalImages: number;
  };
  message?: string;
  error?: string;
}

// ─── API Call ────────────────────────────────────────────────────────────────

/**
 * Upload receipt files (images and/or PDFs) for multi-document OCR analysis.
 * Accepts up to 10 combined files/PDF pages.
 */
export const uploadFilesForReceiptAnalysis = async (
  files: File[],
): Promise<ReceiptApiResponse> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  try {
    const response = await fetch(`${API_BASE_URL}/api/receipt/analyze`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      try {
        const err = (await response.json()) as unknown;
        return {
          success: false,
          message: getApiErrorMessage(err, `Server error: ${response.status}`),
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
        "Network error while uploading files",
      ),
    };
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format number as Vietnamese currency string (e.g. 1.120.000 đ) */
export const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("vi-VN") + " đ";
};

/** Format number with thousands separator (for weights, bag counts) */
export const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("vi-VN");
};
