// ============================================================
// Fusion LLM service — merges image extraction + web search results
// ============================================================
import { zodResponseFormat } from "openai/helpers/zod";
import {
  PesticideResponseSchema,
  FertilizerResponseSchema,
} from "@backend/validation/productInfo.js";
import type { PesticideSearchResult, FertilizerSearchResult } from "./types.js";
import { client } from "@backend/utils/llmModel";

// Use gemini-3.1-flash-lite for the fusion step (good at structured reasoning)
const FUSION_MODEL = "gemini-3.1-flash-lite";

// const FUSION_SYSTEM_PROMPT = `You are an expert at merging product information from two sources:
// 1. "imageExtraction": information extracted by OCR/Vision AI from a product label image
// 2. "webSearchResult": official information retrieved from a government agricultural database

// Your task is to produce a single unified product data object that:
// - VERIFY the searched product is the same product as the image-extracted product. If the product names or key attributes differ significantly and you cannot confirm they are the same product, return only the image extraction data unchanged.
// - RESOLVE conflicts by preferring official database information (webSearchResult) over image extraction.
// - FILL MISSING fields in imageExtraction using data from webSearchResult when available.
// - PRESERVE the "metadata" (overall_confidence, review_warnings) exactly from the imageExtraction — do NOT modify it.
// - PRESERVE the "success", "error_code", and "message" fields from imageExtraction.
// - OUTPUT must conform exactly to the schema provided — do not add extra fields.

// Return only valid JSON matching the schema. No explanations.`;

//prioritize label when instructions have conflicts, since the label is what the user has in hand and can directly compare to. The database is more likely to have outdated/wrong info than the label being wrong, especially for local/traditional products that may have less accurate database entries.

// ------ test prompt 1
// const FUSION_SYSTEM_PROMPT = `You are an expert at merging and reconciling agricultural product information from two sources:
// 1. "imageExtraction": information extracted by OCR/Vision AI from the physical product label image (represents the specific manufacturer's guide on the bottle).
// 2. "webSearchResult": official registration information retrieved from the government agricultural database (represents the generic registration framework).

// Your core task is to intelligently fuse these two sources into a single unified product data object according to the following logic:

// 1. VERIFICATION:
// - Confirm that the searched product (webSearchResult) matches the physical product (imageExtraction). If they are completely different products, return "imageExtraction" data unchanged.

// 2. DOSAGE & USAGE FIELD FUSION LOGIC (CRITICAL):
// - ANALYZE SPECIFICITY: Check if the "dosage" or target crops in "imageExtraction" are highly specific/customized (e.g., tailored for a specific sub-crop like "Sầu riêng" with detailed crop stages like "nhú mắt cua", "xổ nhụy", "tượng trái non"), while "webSearchResult" only provides generic instructions for broader categories (e.g., "Cây ăn trái" in general).
// - RESOLVE BY SPECIFICITY (SIGNIFICANT DIFFERENCE): If there is a significant difference because the label (imageExtraction) is highly specific to a particular crop or growth stage while the web database is generic, YOU MUST PRESERVE AND PREFER the detailed instructions from the label ("imageExtraction"). Do NOT overwrite specific label guides with generic database entries.
// - RESOLVE BY OFFICIAL STANDARDS (HIGH SIMILARITY): If the targets and instructions in both sources are highly similar or cover the exact same scope (e.g., both talk about generic "Cây lúa" or "Cây rau màu"), prefer the wording and structured values from "webSearchResult" to clean up any OCR typos.

// 3. CONFLICT RESOLUTION FOR OTHER FIELDS:
// - For static fields like "registrant", "registration_number", or "ingredients", resolve conflicts by preferring official database information ("webSearchResult") to fix OCR errors.
// - FILL MISSING fields in "imageExtraction" (such as missing ingredients, pre_harvest_interval_days) using data from "webSearchResult" when available.

// 4. INVARIANT FIELDS (DO NOT TOUCH):
// - PRESERVE the "metadata" (overall_confidence, review_warnings) exactly from the "imageExtraction" — do NOT modify or delete it.
// - PRESERVE the "success", "error_code", and "message" fields from "imageExtraction".

// Return only valid JSON matching the schema. No explanations.`;

//------ test prompt 2
const FUSION_SYSTEM_PROMPT = `You are an expert at merging product information from two sources:
1. "imageExtraction": information extracted by OCR/Vision AI from a product label image
2. "webSearchResult": official information retrieved from a government agricultural database

Your task is to produce a single unified product data object that:
- VERIFY that imageExtraction and webSearchResult refer to the same product.
- For product identity fields (product name, registration number, manufacturer, ingredients): prefer webSearchResult when available because it comes from an official database.

- For usage-related fields (dosage, application instructions, target crops, growth stages, timing, dilution rates): compare the information from both sources before replacing anything.
- If the information is substantially similar and appears to describe the same usage recommendation, prefer the webSearchResult version because it is more standardized.
- If the information differs significantly in crop type, growth stage, dosage unit, application method, timing, or level of detail, assume the label contains more specific instructions and KEEP the imageExtraction version.
- Never overwrite a specific crop-level recommendation from the label with a broader generic recommendation from the database.
- When imageExtraction contains detailed crop-specific instructions and webSearchResult contains general usage guidance, preserve the label instructions.
- Only replace usage-related fields when the database information is clearly equivalent or clearly more complete without changing the meaning.

- When uncertain, prefer the imageExtraction value.
- For metadata: keep overall_confidence unchanged and update review_warnings to reflect the final merged output.
- PRESERVE the "success", "error_code", and "message" fields from imageExtraction.
- OUTPUT must conform exactly to the schema provided — do not add extra fields.

Return only valid JSON matching the schema. No explanations.`;

/**
 * Call the fusion LLM to merge image extraction and web search results.
 * Returns the enriched response object, or the original if fusion fails.
 */
export async function fuseResults(
  imageExtraction: object,
  webSearchResult: PesticideSearchResult | FertilizerSearchResult,
  category: "pesticide" | "fertilizer",
): Promise<object> {
  const targetSchema =
    category === "fertilizer"
      ? FertilizerResponseSchema
      : PesticideResponseSchema;

  const userMessage = JSON.stringify(
    {
      imageExtraction,
      webSearchResult,
    },
    null,
    2,
  );

  const response = await client.chat.completions.create({
    model: FUSION_MODEL,
    messages: [
      { role: "system", content: FUSION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: zodResponseFormat(targetSchema, "schema_name"),
  });

  const outputText = response.choices[0]?.message?.content;
  if (!outputText) {
    throw new Error("[fusionService] No content received from fusion model.");
  }

  const parsedOutput = JSON.parse(outputText);
  const validationResult = targetSchema.safeParse(parsedOutput);
  if (!validationResult.success) {
    console.error(
      "[fusionService] Response schema validation failed:",
      validationResult.error.issues,
    );
    throw new Error("Fusion response does not match the expected schema");
  }

  return validationResult.data;
}
