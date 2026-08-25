import assert from "node:assert/strict";
import test from "node:test";
import {
  FertilizerResponseSchema,
  FertilizerResponseSchemaWithSearch,
  FishFeedResponseSchema,
  PesticideResponseSchema,
  PesticideResponseSchemaWithSearch,
  SeedResponseSchema,
} from "../src/validation/productInfo.js";
import { DocumentResponseSchema } from "../src/validation/receiptInfo.js";
import {
  FALLBACK_MODEL,
  FUSION_MODEL,
  getModelForSchemaType,
  getResponseSchema,
  getTestResponseSchema,
  MODEL_BY_SCHEMA_TYPE,
  TEST_MODEL,
} from "../src/services/analyze/llmRegistry.js";

test("model selection remains unchanged for every OCR and fusion flow", () => {
  assert.deepEqual(MODEL_BY_SCHEMA_TYPE, {
    fish_feed: "gemini-3-flash-preview",
    pesticide: "gemini-3.1-flash-lite",
    fertilizer: "gemini-3.1-flash-lite",
    seed: "gemini-3.1-flash-lite",
    receipt: "gemini-3.1-flash-lite",
  });
  assert.equal(getModelForSchemaType("pesticide"), "gemini-3.1-flash-lite");
  assert.equal(FALLBACK_MODEL, "gemini-2.5-flash");
  assert.equal(TEST_MODEL, "gemini-3.1-flash-lite");
  assert.equal(FUSION_MODEL, "gemini-3.1-flash-lite");
});

test("schema selection preserves every structured-output contract", () => {
  assert.equal(getResponseSchema("pesticide"), PesticideResponseSchema);
  assert.equal(
    getResponseSchema("pesticide", true),
    PesticideResponseSchemaWithSearch,
  );
  assert.equal(getResponseSchema("fertilizer"), FertilizerResponseSchema);
  assert.equal(
    getResponseSchema("fertilizer", true),
    FertilizerResponseSchemaWithSearch,
  );
  assert.equal(getResponseSchema("fish_feed"), FishFeedResponseSchema);
  assert.equal(getResponseSchema("seed"), SeedResponseSchema);
  assert.equal(getResponseSchema("receipt"), DocumentResponseSchema);
  assert.equal(getTestResponseSchema("seed"), null);
  assert.equal(getTestResponseSchema(""), null);
});
