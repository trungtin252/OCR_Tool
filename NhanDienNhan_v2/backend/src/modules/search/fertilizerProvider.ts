// ============================================================
// Fertilizer product scraper — 113.190.254.147/PhanBon
// ============================================================

import * as cheerio from "cheerio";
import { fetchWithRetry } from "./httpClient.js";
import type {
  SearchProvider,
  FertilizerSearchResult,
  Ingredient,
} from "./types.js";

const BASE_URL = "http://113.190.254.147/PhanBon/en/phanbonchungnhan";

// ─── URL builders ────────────────────────────────────────────

function buildNameSearchUrl(name: string): string {
  return `${BASE_URL}?TenPhanBon=${encodeURIComponent(name)}`;
}

function buildCodeSearchUrl(code: string): string {
  return `${BASE_URL}?MaPhanBon=${encodeURIComponent(code)}`;
}

// ─── Detail page parser ──────────────────────────────────────

/**
 * Detect if the page returned a valid product result.
 * The page always returns 200; we check for product name in the header section.
 */
function hasResult($: cheerio.CheerioAPI): boolean {
  const productName = $(".section1 .tdPhanBon h3").text().trim();
  return productName.length > 0;
}

export function parseFertilizerPage(
  html: string,
  sourceUrl: string,
): FertilizerSearchResult | null {
  const $ = cheerio.load(html);

  if (!hasResult($)) return null;

  // ── Product name
  const product_name = $(".section1 .tdPhanBon h3").text().trim() || undefined;

  // ── Registration code (Mã số phân bón) — next to fa-code icon
  let registration_number: string | undefined;
  $(".section1 li").each((_, li) => {
    const text = $(li).text().trim();
    if ($(li).find(".fa-code").length > 0) {
      // Text is like " 15028" after the icon
      registration_number = text.replace(/\s+/g, " ").trim() || undefined;
    }
  });

  // ── General info table (Thông tin chung)
  // Rows: Loại phân bón, Nguồn gốc, Phương thức sử dụng, Thời hạn sử dụng
  let fertilizerType: string | undefined;
  let usageMethod: string | undefined;

  // The general info table is the first `.table` inside the description tab
  $(".tab-pane#description .col-md-6")
    .first()
    .find("table tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");
      const label = cells.eq(0).text().trim();
      const value = cells.eq(1).text().trim();
      if (label.includes("Loại phân bón")) {
        fertilizerType = value || undefined;
      } else if (label.includes("Phương thức sử dụng")) {
        usageMethod = value || undefined;
      }
    });

  // ── Ingredients table (Thành phần, hàm lượng dinh dưỡng)
  const ingredients: Ingredient[] = [];
  $(".tab-pane#description .col-md-6")
    .last()
    .find("table tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;
      const name = cells.eq(1).text().trim();
      const content = cells.eq(2).text().trim();
      if (name) {
        ingredients.push({ name, content });
      }
    });

  // ── Usage guide (Hướng dẫn sử dụng)
  // The usage guide is the first col-md-6 in the second main row
  let dosage: string | undefined;
  const dosageEl = $("h3.panel-title")
    .filter((_, el) => $(el).text().includes("Hướng dẫn sử dụng"))
    .closest(".col-md-6")
    .find("table tbody tr td");
  if (dosageEl.length > 0) {
    dosage = dosageEl.text().trim() || undefined;
  }

  // ── Registrant
  let registrant: string | undefined;
  $("h3.panel-title")
    .filter(
      (_, el) =>
        $(el).text().includes("Tổ chức") || $(el).text().includes("đăng ký"),
    )
    .closest(".col-md-6")
    .find("table tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");
      const label = cells.eq(0).text().trim();
      if (label.includes("Tên tổ chức") || label.includes("cá nhân đăng ký")) {
        registrant = cells.eq(1).text().trim() || undefined;
      }
    });

  // Build a note about fertilizer type and usage method if present
  const notes = [fertilizerType, usageMethod].filter(Boolean).join(" | ");

  return {
    ...(product_name ? { product_name } : {}),
    ...(registration_number ? { registration_number } : {}),
    ...(registrant ? { registrant } : {}),
    ...(ingredients.length > 0 ? { ingredients } : {}),
    ...((dosage ?? notes) ? { dosage: dosage ?? notes } : {}),
    source_url: sourceUrl,
  };
}

// ─── Provider implementation ─────────────────────────────────

export class FertilizerProvider implements SearchProvider<FertilizerSearchResult> {
  /**
   * Search strategy (per FEATURE.md):
   * 1. Search by registration_number (product code) first if available
   * 2. Fall back to product_name search
   *
   * Unlike pesticide site, the search result IS the detail page —
   * no additional navigation required.
   */
  async search(
    productName?: string | null,
    registrationNumber?: string | null,
  ): Promise<FertilizerSearchResult | null> {
    const queries: Array<{ url: string; label: string }> = [];

    if (registrationNumber?.trim()) {
      queries.push({
        url: buildCodeSearchUrl(registrationNumber.trim()),
        label: `registration_number="${registrationNumber.trim()}"`,
      });
    }
    if (productName?.trim()) {
      queries.push({
        url: buildNameSearchUrl(productName.trim()),
        label: `product_name="${productName.trim()}"`,
      });
    }

    if (queries.length === 0) return null;

    for (const { url, label } of queries) {
      try {
        console.log(`[FertilizerProvider] Searching: ${url}`);
        const html = await fetchWithRetry(url);
        const result = parseFertilizerPage(html, url);
        if (result) {
          console.log(`[FertilizerProvider] Found result for ${label}`);
          return result;
        }
        console.log(`[FertilizerProvider] No result for ${label}`);
      } catch (err) {
        console.warn(
          `[FertilizerProvider] Search failed for ${label}:`,
          err instanceof Error ? err.message : err,
        );
        // Continue to next query
      }
    }

    return null;
  }
}
