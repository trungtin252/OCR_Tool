/**
 * Date processor for formatting dates in ProductInfo response objects
 */

import { formatDateString, calculateExpiryDate } from "./dateUtils";

export interface ProductInfoWithDates {
  success: boolean;
  category?: string;
  message?: string;
  error_code?: string;
  metadata?: any;
  mfg_date?: string;
  exp_date?: string;
  [key: string]: any;
}

/**
 * Formats dates in a ProductInfo response object
 * Handles both mfg_date and exp_date fields
 * - If mfg_date is provided but not in dd/mm/yyyy format, it's formatted
 * - If mfg_date and exp_date (shelf life) are both provided, exp_date is calculated
 * - If exp_date is already a formatted date (contains /), it's formatted
 * @param productInfo - The product info object with potential date fields
 * @returns ProductInfo object with formatted dates
 */
export function formatDatesInProductInfo(
  productInfo: ProductInfoWithDates,
): ProductInfoWithDates {
  if (!productInfo) {
    return productInfo;
  }

  const formatted = { ...productInfo };

  // Format manufacturing date if present
  if (formatted.mfg_date && typeof formatted.mfg_date === "string") {
    const formattedMfgDate = formatDateString(formatted.mfg_date);
    if (formattedMfgDate) {
      formatted.mfg_date = formattedMfgDate;
    }
  }

  // Format purchase date if present
  if (formatted.purchase_date && typeof formatted.purchase_date === "string") {
    const formattedPurchaseDate = formatDateString(formatted.purchase_date);
    if (formattedPurchaseDate) {
      formatted.purchase_date = formattedPurchaseDate;
    }
  }

  // Handle expiry date
  if (formatted.exp_date && typeof formatted.exp_date === "string") {
    // Check if exp_date is a shelf life (contains Vietnamese keywords or time units)
    const isShelfLife =
      /(tháng|năm|ngày|tuần|months?|years?|days?|weeks?)/.test(
        formatted.exp_date.toLowerCase(),
      );

    if (isShelfLife && formatted.mfg_date) {
      // Calculate expiry date from manufacturing date and shelf life
      const calculatedExpiryDate = calculateExpiryDate(
        formatted.mfg_date,
        formatted.exp_date,
      );
      if (calculatedExpiryDate) {
        formatted.exp_date = calculatedExpiryDate;
      }
    } else {
      // Try to format it as a regular date
      const formattedExpDate = formatDateString(formatted.exp_date);
      if (formattedExpDate) {
        formatted.exp_date = formattedExpDate;
      }
    }
  }

  return formatted;
}

/**
 * Formats the response from AI processing if it contains product info
 * @param response - The raw response from AI (can be a string or object)
 * @returns Formatted response with dates formatted
 */
export function formatDatesInResponse(response: any): any {
  // If response is a string, try to parse it
  let data = response;
  if (typeof response === "string") {
    try {
      data = JSON.parse(response);
    } catch {
      // If it's not valid JSON, return as-is
      return response;
    }
  }

  // If it's an object with product info, format the dates
  if (typeof data === "object" && data !== null) {
    const formatted = { ...data } as Record<string, any>;

    if (formatted.data && typeof formatted.data === "object") {
      formatted.data = formatDatesInProductInfo(
        formatted.data as ProductInfoWithDates,
      );

      // Receipt/document responses store dates inside data.documents[] rather
      // than directly on data. Normalize those dates without changing shape.
      if (Array.isArray(formatted.data.documents)) {
        formatted.data.documents = formatted.data.documents.map(
          (document: Record<string, any>) => {
            if (!document || typeof document !== "object") return document;
            if (!document.date || typeof document.date !== "string") {
              return document;
            }

            const normalizedDate = formatDateString(document.date);
            return normalizedDate
              ? { ...document, date: normalizedDate }
              : document;
          },
        );
      }
    }

    return formatDatesInProductInfo(formatted as ProductInfoWithDates);
  }

  return response;
}
