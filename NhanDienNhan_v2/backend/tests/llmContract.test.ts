import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { z } from "zod";
import {
  buildPrompt,
  feed_prompt,
  fertilizer_prompt,
  pesticide_prompt,
  seed_prompt,
  test_prompt,
} from "../src/modules/product/product.prompts.js";
import { receipt_prompt } from "../src/modules/receipt/receipt.prompts.js";
import {
  FertilizerResponseSchema,
  FishFeedResponseSchema,
  PesticideResponseSchema,
  PesticideResponseSchemaWithSearch,
  FertilizerResponseSchemaWithSearch,
  SeedResponseSchema,
} from "../src/modules/product/product.schema.js";
import { DocumentResponseSchema } from "../src/modules/receipt/receipt.schema.js";
import { growing_area_certificate_prompt } from "../src/modules/ga_certificate/gaCertificate.prompts.js";
import {
  GrowingAreaCertificateResponseContractSchema,
  GrowingAreaCertificateResponseSchema,
} from "../src/modules/ga_certificate/gaCertificate.schema.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function extractFusionSystemPrompt(): string {
  const source = readFileSync(
    resolve(process.cwd(), "src/modules/search/fusionService.ts"),
    "utf8",
  );
  const backtick = String.fromCharCode(96);
  const prefix = `const FUSION_SYSTEM_PROMPT = ${backtick}`;
  const start = source.indexOf(prefix);
  const end = source.indexOf(`${backtick};`, start + prefix.length);

  assert.ok(start >= 0 && end >= 0, "FUSION_SYSTEM_PROMPT must be present");
  return source.slice(start + prefix.length, end);
}

test("all LLM prompt text remains byte-for-byte unchanged", () => {
  const promptHashes = {
    pesticide_prompt: sha256(pesticide_prompt),
    fertilizer_prompt: sha256(fertilizer_prompt),
    feed_prompt: sha256(feed_prompt),
    seed_prompt: sha256(seed_prompt),
    test_prompt: sha256(test_prompt),
    pesticide_without_search: sha256(buildPrompt("pesticide", false)),
    pesticide_with_search: sha256(buildPrompt("pesticide", true)),
    fertilizer_without_search: sha256(buildPrompt("fertilizer", false)),
    fertilizer_with_search: sha256(buildPrompt("fertilizer", true)),
    fish_feed: sha256(buildPrompt("fish_feed", false)),
    seed: sha256(buildPrompt("seed", false)),
    unsupported_category_fallback: sha256(buildPrompt("receipt", false)),
    receipt_prompt: sha256(receipt_prompt),
    fusion_system_prompt: sha256(extractFusionSystemPrompt()),
  };

  assert.deepEqual(promptHashes, {
    pesticide_prompt:
      "24eec64f2cd0c298bf6ea2f68ebefabe62a8dfbfbbf4602e4da2993b640fe0ef",
    fertilizer_prompt:
      "b20bd2b11074d9536680af8edcee51c53189e046bbefd744ba482d1cfc4c4a11",
    feed_prompt:
      "1ce7f062bf1854e8236333952e5ae63a81ee3adac8e7a132ed80f6efafe56409",
    seed_prompt:
      "e8ec5453b11ef5288348a42772d402b5a828b15b6fd50abbb8b92e3fee8a4c27",
    test_prompt:
      "f7a4e2bab413eb8124a8501e457547639da48604684b88bc3023899600fe4680",
    pesticide_without_search:
      "b66d17d17b4a9c239414ebd50e56ee8c0834a4aaf94a7438b5edcdbcd000fdcf",
    pesticide_with_search:
      "eb3dce224c54863564931368c8e896d391ed2f71a9cdfb48a1b147c48e2d43f5",
    fertilizer_without_search:
      "3976de3eb08df5749170b76803cd4a2b4a4e88a092a4baf4c407d415c4b992a1",
    fertilizer_with_search:
      "10dd11a1c16e0cfd0ca73307929e3695b21a37c0c846152fd7dbc0036bb8f4de",
    fish_feed:
      "1ce7f062bf1854e8236333952e5ae63a81ee3adac8e7a132ed80f6efafe56409",
    seed: "e8ec5453b11ef5288348a42772d402b5a828b15b6fd50abbb8b92e3fee8a4c27",
    unsupported_category_fallback:
      "24eec64f2cd0c298bf6ea2f68ebefabe62a8dfbfbbf4602e4da2993b640fe0ef",
    receipt_prompt:
      "aae4de2a74ded581897b95642a1443a4622ddab66c4cf55ed72062aa871b1f36",
    fusion_system_prompt:
      "ad1d0473df1165926ff8ff56c77b6af531dea47c7f2af1c23dede96da47a62ee",
  });
});

test("LLM response schemas, descriptions, defaults, and field shapes remain unchanged", () => {
  const schemaHashes = {
    pesticide: sha256(JSON.stringify(z.toJSONSchema(PesticideResponseSchema))),
    pesticideWithSearch: sha256(
      JSON.stringify(z.toJSONSchema(PesticideResponseSchemaWithSearch)),
    ),
    fertilizer: sha256(
      JSON.stringify(z.toJSONSchema(FertilizerResponseSchema)),
    ),
    fertilizerWithSearch: sha256(
      JSON.stringify(z.toJSONSchema(FertilizerResponseSchemaWithSearch)),
    ),
    fishFeed: sha256(JSON.stringify(z.toJSONSchema(FishFeedResponseSchema))),
    seed: sha256(JSON.stringify(z.toJSONSchema(SeedResponseSchema))),
    receipt: sha256(JSON.stringify(z.toJSONSchema(DocumentResponseSchema))),
  };

  assert.deepEqual(schemaHashes, {
    pesticide:
      "7109047e1b5dc9a32df87385eec298032484eaf035b6128fb1d0d72024f9191e",
    pesticideWithSearch:
      "b5343c58cb90713955f3bf8798627d315c48c6b5f5708648d133284b4424db00",
    fertilizer:
      "934ab4714e939a07900b927f61c09d60982db1734cf3146fc5e265bee610537f",
    fertilizerWithSearch:
      "af901ce41cd61d8ab9ef58374a343a5ff0809599a2aa7bfbdc0dcd3b47edbe06",
    fishFeed:
      "a13c69e325263eeb08bf1cf4e727307968894348f0203cebf0978b933ec7138a",
    seed: "f5bc92fc500d8e2fe22be670317c357bb60cf48ff877efe604a869e5974c7a6b",
    receipt: "6c13f9227bf7a4a59c9604187037d70452b4100810b9348c395f734d56ed9c0f",
  });
});

test("ga_certificate prompt and schema remain locked", () => {
  assert.equal(
    sha256(growing_area_certificate_prompt),
    "b6c08cebad108f0a76a1fa314297092362c15fd11e76039afe1a20fae68bd46c",
  );
  assert.equal(
    sha256(
      JSON.stringify(z.toJSONSchema(GrowingAreaCertificateResponseSchema)),
    ),
    "9e010db63041fe9d2c2a8b457a231e24a8e41deda678b46f4dfc73e0edadb0e0",
  );
  assert.equal(
    sha256(
      JSON.stringify(
        z.toJSONSchema(GrowingAreaCertificateResponseContractSchema),
      ),
    ),
    "43a8b50654bd4d0974ca21cd678a93fcb4df049f8065bf02e4be824bd7b1744a",
  );
});

test("representative model responses still parse without response-shape changes", () => {
  const baseResponse = {
    success: true,
    error_code: "NONE" as const,
    message: "OCR completed",
    metadata: { overall_confidence: 0.95, review_warnings: [] },
  };
  const pesticideResponse = {
    ...baseResponse,
    data: {
      category: "pesticide" as const,
      form_type: null,
      registrant: null,
      product_name: "Sample pesticide",
      net_content: null,
      net_unit: null,
      package_type: null,
      mfg_date: null,
      exp_date: null,
      product_type: null,
      registration_number: null,
      uses: null,
      ingredients: null,
      dosage: null,
      target_crops: null,
      target_pests: null,
      pre_harvest_interval_days: 7,
    },
  };
  const fertilizerResponse = {
    ...baseResponse,
    data: {
      category: "fertilizer" as const,
      form_type: null,
      registrant: null,
      product_name: "Sample fertilizer",
      net_content: null,
      net_unit: null,
      package_type: null,
      mfg_date: null,
      exp_date: null,
      product_type: null,
      registration_number: null,
      uses: null,
      ingredients: null,
      dosage: null,
      target_crops: null,
      pre_harvest_interval_days: 7,
    },
  };
  const fishFeedResponse = {
    ...baseResponse,
    data: {
      category: "fish_feed" as const,
      form_type: null,
      registrant: null,
      product_name: "Sample feed",
      net_content: null,
      net_unit: null,
      package_type: null,
      mfg_date: null,
      exp_date: null,
      product_type: null,
      species: null,
      uses: null,
      ingredients: null,
      variant_code: null,
      nutrition_facts: null,
      feeding_guide: null,
    },
  };
  const seedResponse = {
    ...baseResponse,
    data: {
      category: "seed" as const,
      form_type: null,
      registrant: null,
      product_name: "Sample seed",
      net_content: null,
      net_unit: null,
      package_type: null,
      mfg_date: null,
      exp_date: null,
      cropping_season: null,
      growth_duration: null,
      lot_number: null,
      manufacturer: null,
      origin: null,
      quality_criteria: null,
    },
  };
  const receiptResponse = {
    ...baseResponse,
    data: {
      document_count: 1,
      documents: [
        {
          document_type: "invoice" as const,
          supplier_name: null,
          customer_name: null,
          document_number: null,
          date: null,
          items: [],
          grand_total: null,
        },
      ],
    },
  };

  assert.deepEqual(
    PesticideResponseSchema.parse(pesticideResponse),
    pesticideResponse,
  );
  assert.deepEqual(
    FertilizerResponseSchema.parse(fertilizerResponse),
    fertilizerResponse,
  );
  assert.deepEqual(
    FishFeedResponseSchema.parse(fishFeedResponse),
    fishFeedResponse,
  );
  assert.deepEqual(SeedResponseSchema.parse(seedResponse), seedResponse);
  assert.deepEqual(
    DocumentResponseSchema.parse(receiptResponse),
    receiptResponse,
  );
});
