// ============================================================
// Pesticide product scraper — danhmuc.thuocbvtv.com
// ============================================================

import * as cheerio from "cheerio";
import { fetchWithRetry } from "./httpClient.js";
import type {
  SearchProvider,
  PesticideSearchResult,
  Ingredient,
  PesticideDosage,
} from "./types.js";

const BASE_URL = "https://danhmuc.thuocbvtv.com";
const SEARCH_URL = `${BASE_URL}/thuoc/search?q=`;

// ─── Helpers ────────────────────────────────────────────────

/** Remove Vietnamese diacritics and lowercase for fuzzy comparison */
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

interface SearchResultItem {
  name: string;
  activeIngredients: string;
  detailUrl: string;
  company: string;
}

// ─── Search result page parser ──────────────────────────────

export function parseSearchResultPage(html: string): SearchResultItem[] {
  const $ = cheerio.load(html);
  const items: SearchResultItem[] = [];

  $(".data-table tbody tr").each((_, row) => {
    const nameCell = $(row).find("td.col-name");
    const name = nameCell.find("a.thuoc-name").text().trim();
    const activeIngredients = nameCell.find(".thuoc-hoatchat").text().trim();
    const detailHref = nameCell.find("a.thuoc-name").attr("href") ?? "";
    const detailUrl = detailHref.startsWith("http")
      ? detailHref
      : `${BASE_URL}${detailHref}`;
    const company = $(row).find("td.col-congty a.congty-link").text().trim();

    if (name && detailUrl) {
      items.push({ name, activeIngredients, detailUrl, company });
    }
  });

  return items;
}

/**
 * Pick the best-matching result from the search list.
 *
 * Priority:
 * 1. Exact match (case-insensitive)
 * 2. Normalized match (diacritics stripped)
 * 3. Fuzzy containment in either direction
 * 4. No result when multiple candidates remain ambiguous
 */
function pickBestMatch(
  items: SearchResultItem[],
  query: string,
): SearchResultItem | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0] ?? null;

  const queryLower = query.toLowerCase().trim();
  const queryNorm = normalize(query);

  // 1. Exact match
  const exact = items.find((i) => i.name.toLowerCase().trim() === queryLower);
  if (exact) return exact;

  // 2. Normalized match
  const normMatch = items.find((i) => normalize(i.name) === queryNorm);
  if (normMatch) return normMatch;

  // 3. Fuzzy containment
  const fuzzy = items.find(
    (i) =>
      normalize(i.name).includes(queryNorm) ||
      queryNorm.includes(normalize(i.name)),
  );
  if (fuzzy) return fuzzy;

  // Do not silently enrich with an unrelated first result.
  return null;
}

function normalizeIdentifier(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

// ─── Detail page parser ─────────────────────────────────────

export function parseDetailPage(
  html: string,
  sourceUrl: string,
): PesticideSearchResult {
  const $ = cheerio.load(html);

  // Product name
  const product_name = $("h1.detail-title").text().trim() || undefined;

  // Registrant / company
  const registrant =
    $('.info-item[itemprop="brand"] a[itemprop="name"]').text().trim() ||
    undefined;

  // Registration number
  let registration_number: string | undefined;
  $(".info-item").each((_, el) => {
    const label = $(el).find("label").text();
    if (label.includes("Số đăng ký")) {
      registration_number =
        $(el).find("div[itemprop='identifier']").text().trim() || undefined;
    }
  });

  // Ingredients — parse from "Hoạt chất - Hàm lượng" info block
  const ingredients: Ingredient[] = [];
  $(".info-item.info-full").each((_, el) => {
    const label = $(el).find("label").text();
    if (label.includes("Hoạt chất")) {
      // The active ingredients string is the first span[itemprop="value"]
      // e.g. "Profenofos 450g/l + Thiamethoxam 100g/l"
      const ingredientStr = $(el)
        .find('span[itemprop="additionalProperty"]')
        .first()
        .find('span[itemprop="value"]')
        .text()
        .trim();

      // Split on "+" delimiter to get individual ingredients
      ingredientStr.split("+").forEach((part) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        // Try to split off the trailing amount (e.g. "Profenofos 450g/l")
        // Pattern: ingredient name followed by amount (digits + unit)
        const match = trimmed.match(/^(.+?)\s+(\d[\d.,/\s]*\s*[a-zA-Z%/]+)$/);
        if (match) {
          ingredients.push({
            name: (match[1] ?? trimmed).trim(),
            content: (match[2] ?? "").trim(),
          });
        } else {
          ingredients.push({ name: trimmed, content: "" });
        }
      });
    }
  });

  // Usage scope cards — each card = one crop/pest/dosage entry
  const dosage: PesticideDosage[] = [];
  const target_crops_set = new Set<string>();
  const target_pests_set = new Set<string>();

  $(".pham-vi-card").each((_, card) => {
    const target_crop = $(card)
      .find(".pv-target.pv-caytrong strong")
      .text()
      .trim();
    const target_pest = $(card)
      .find(".pv-target.pv-dichhai strong")
      .text()
      .trim();

    if (target_crop) target_crops_set.add(target_crop);
    if (target_pest) target_pests_set.add(target_pest);

    // Dosage amount, pre-harvest interval, usage instructions
    let amount = "";
    let pre_harvest_interval = "";
    let usage_instructions = "";

    $(card)
      .find(".pv-detail-row")
      .each((_, row) => {
        const label = $(row).find(".pv-detail-label").text();
        const val = $(row).find(".pv-detail-val").text().trim();
        if (label.includes("Liều lượng")) amount = val;
        else if (label.includes("cách ly")) pre_harvest_interval = val;
        else if (label.includes("Cách dùng")) usage_instructions = val;
      });

    if (target_crop || target_pest) {
      dosage.push({
        target_crop,
        target_pest,
        amount,
        pre_harvest_interval,
        usage_instructions,
      });
    }
  });

  return {
    ...(product_name ? { product_name } : {}),
    ...(registration_number ? { registration_number } : {}),
    ...(registrant ? { registrant } : {}),
    ...(ingredients.length > 0 ? { ingredients } : {}),
    ...(target_crops_set.size > 0
      ? { target_crops: [...target_crops_set] }
      : {}),
    ...(target_pests_set.size > 0
      ? { target_pests: [...target_pests_set] }
      : {}),
    ...(dosage.length > 0 ? { dosage } : {}),
    source_url: sourceUrl,
  };
}

// ─── Provider implementation ─────────────────────────────────

export class PesticideProvider implements SearchProvider<PesticideSearchResult> {
  /**
   * Search strategy (per FEATURE.md):
   * 1. Search by registration_number first if available (more specific)
   * 2. Fall back to product_name search
   */
  async search(
    productName?: string | null,
    registrationNumber?: string | null,
  ): Promise<PesticideSearchResult | null> {
    const queries: Array<{ q: string; isRegNum: boolean }> = [];

    if (registrationNumber?.trim()) {
      queries.push({ q: registrationNumber.trim(), isRegNum: true });
    }
    if (productName?.trim()) {
      queries.push({ q: productName.trim(), isRegNum: false });
    }

    if (queries.length === 0) return null;

    for (const { q, isRegNum } of queries) {
      try {
        const result = await this.searchOnce(q, isRegNum);
        if (result) return result;
      } catch (err) {
        console.warn(
          `[PesticideProvider] Search failed for query "${q}":`,
          err instanceof Error ? err.message : err,
        );
        // Continue to next query
      }
    }

    return null;
  }

  private async searchOnce(
    query: string,
    isRegNum: boolean,
  ): Promise<PesticideSearchResult | null> {
    const searchUrl = `${SEARCH_URL}${encodeURIComponent(query)}`;
    console.log(`[PesticideProvider] Searching: ${searchUrl}`);

    const searchHtml = await fetchWithRetry(searchUrl);
    const results = parseSearchResultPage(searchHtml);

    if (results.length === 0) {
      console.log(`[PesticideProvider] No results for query: ${query}`);
      return null;
    }

    // For registration number searches, registration numbers are often
    // in the URL slug or product name — try to find an exact match
    let chosen: SearchResultItem | null;
    if (isRegNum) {
      // Try to find a result where the URL contains the registration number
      const regNumNorm = normalize(query.replace(/[^a-zA-Z0-9]/g, ""));
      const byRegNum = results.find((r) => {
        const urlNorm = normalize(r.detailUrl.replace(/[^a-zA-Z0-9]/g, ""));
        return urlNorm.includes(regNumNorm);
      });
      chosen = byRegNum ?? results[0] ?? null;
    } else {
      chosen = pickBestMatch(results, query);
    }

    if (!chosen) return null;

    console.log(`[PesticideProvider] Fetching detail: ${chosen.detailUrl}`);
    const detailHtml = await fetchWithRetry(chosen.detailUrl);
    const parsedResult = parseDetailPage(detailHtml, chosen.detailUrl);

    if (isRegNum) {
      const expectedRegistration = normalizeIdentifier(query);
      const actualRegistration = parsedResult.registration_number
        ? normalizeIdentifier(parsedResult.registration_number)
        : "";

      if (!actualRegistration || actualRegistration !== expectedRegistration) {
        console.warn(
          `[PesticideProvider] Registration mismatch for query "${query}"; ignoring candidate ${chosen.detailUrl}`,
        );
        return null;
      }
    }

    return parsedResult;
  }
}
