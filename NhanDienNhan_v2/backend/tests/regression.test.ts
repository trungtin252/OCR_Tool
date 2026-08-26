import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import {
  parseBooleanQuery,
  parseProductSchemaType,
  parseSearchMode,
} from "../src/modules/product/product.requestValidation.js";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
  isSupportedUploadMime,
} from "../src/shared/upload/uploadValidation.js";
import {
  calculateExpiryDate,
  formatDateString,
} from "../src/shared/postprocessing/dateUtils.js";
import { formatDatesInResponse } from "../src/shared/postprocessing/dateProcessor.js";
import { reconcileDocumentMath } from "../src/utils/documentReconciler.js";
import { PesticideDataSchema } from "../src/modules/product/product.schema.js";

test("product category parsing keeps the documented default", () => {
  assert.equal(parseProductSchemaType(undefined), "pesticide");
  assert.equal(parseProductSchemaType("fertilizer"), "fertilizer");
  assert.equal(parseProductSchemaType("receipt"), null);
  assert.equal(parseProductSchemaType("unknown"), null);
  assert.equal(parseProductSchemaType(["pesticide"]), null);
});

test("boolean and search query parsing preserve the existing contract", () => {
  assert.equal(parseBooleanQuery("true"), true);
  assert.equal(parseBooleanQuery("TRUE"), false);
  assert.equal(parseBooleanQuery(undefined), false);
  assert.equal(parseSearchMode("always"), "always");
  assert.equal(parseSearchMode("interactive"), "interactive");
  assert.equal(parseSearchMode("off"), "none");
  assert.equal(parseSearchMode("unexpected"), "none");
});

test("upload MIME aliases and magic bytes are checked", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");
  const pdf = Buffer.from("%PDF-1.7", "ascii");

  assert.equal(getCanonicalImageMime("image/jpg"), "image/jpeg");
  assert.equal(isSupportedUploadMime("image/svg+xml", false), false);
  assert.equal(isSupportedUploadMime("application/pdf", true), true);
  assert.equal(hasExpectedFileSignature(jpeg, "image/jpeg"), true);
  assert.equal(hasExpectedFileSignature(png, "image/png"), true);
  assert.equal(hasExpectedFileSignature(webp, "image/webp"), true);
  assert.equal(hasExpectedFileSignature(pdf, "application/pdf"), true);
  assert.equal(hasExpectedFileSignature(pdf, "image/png"), false);
});

test("date normalization rejects impossible dates", () => {
  assert.equal(formatDateString("29/02/2024"), "29/02/2024");
  assert.equal(formatDateString("29/02/2023"), "");
  assert.equal(formatDateString("31/04/2025"), "");
  assert.equal(formatDateString("16-07-26"), "16/07/2026");
});

test("expiry calculation clamps end-of-month dates", () => {
  assert.equal(calculateExpiryDate("31/01/2024", "1 tháng"), "29/02/2024");
  assert.equal(calculateExpiryDate("31/01/2023", "1 tháng"), "28/02/2023");
  assert.equal(calculateExpiryDate("31/02/2024", "1 tháng"), "");
});

test("receipt dates nested in documents are normalized without shape changes", () => {
  const response = {
    success: true,
    data: {
      document_count: 1,
      documents: [
        {
          document_type: "invoice",
          date: "16-07-26",
          items: [],
        },
      ],
    },
  };

  const formatted = formatDatesInResponse(response);
  assert.equal(formatted.data.documents[0].date, "16/07/2026");
  assert.equal(formatted.data.document_count, 1);
});

test("document reconciliation appends warnings without changing response shape", () => {
  const response = {
    success: true,
    error_code: "NONE",
    message: "ok",
    metadata: { overall_confidence: 0.9, review_warnings: [] as object[] },
    data: {
      document_count: 1,
      documents: [
        {
          document_type: "invoice",
          items: [
            {
              quantity: 2,
              unit_price: 10,
              total_amount: 25,
            },
          ],
          grand_total: 25,
        },
      ],
    },
  };

  const reconciled = reconcileDocumentMath(response);
  assert.equal(reconciled, response);
  assert.equal(response.metadata.review_warnings.length, 1);
  assert.equal(
    (response.metadata.review_warnings[0] as { issue: string }).issue,
    "MATH_MISMATCH",
  );
});

test("pesticide schema preserves the existing default interval", () => {
  const result = PesticideDataSchema.safeParse({
    category: "pesticide",
    form_type: null,
    registrant: null,
    product_name: "Sample",
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
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.pre_harvest_interval_days, 7);
  }
});

test("HTTP endpoint validation returns stable JSON errors without calling the LLM", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.ENABLE_TEST_ENDPOINTS = "false";

  const app = (await import("../src/app.js")).default as unknown as Express;
  const server = app.listen(0);

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), {
      status: "ok",
      message: "Server is running",
    });

    const missingRouteResponse = await fetch(`${baseUrl}/missing`);
    assert.equal(missingRouteResponse.status, 404);
    assert.equal(
      ((await missingRouteResponse.json()) as { message: string }).message,
      "Route not found",
    );

    const disabledTestResponse = await fetch(`${baseUrl}/test-openai`, {
      method: "POST",
    });
    assert.equal(disabledTestResponse.status, 404);

    const form = new FormData();
    form.append(
      "images",
      new Blob(
        [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "sample.png",
    );

    const invalidCategoryResponse = await fetch(
      `${baseUrl}/api/image/analyze?category=receipt`,
      { method: "POST", body: form },
    );
    assert.equal(invalidCategoryResponse.status, 400);
    const invalidCategoryBody = (await invalidCategoryResponse.json()) as {
      success: boolean;
      error: string;
      message: string;
    };
    assert.equal(invalidCategoryBody.success, false);
    assert.equal(invalidCategoryBody.error, invalidCategoryBody.message);
    assert.match(invalidCategoryBody.message, /Invalid category/);

    const unsupportedFileForm = new FormData();
    unsupportedFileForm.append(
      "images",
      new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
      "sample.svg",
    );
    const unsupportedFileResponse = await fetch(
      `${baseUrl}/api/image/analyze?category=pesticide`,
      { method: "POST", body: unsupportedFileForm },
    );
    assert.equal(unsupportedFileResponse.status, 400);
    const unsupportedFileBody = (await unsupportedFileResponse.json()) as {
      error: string;
      message: string;
    };
    assert.equal(unsupportedFileBody.error, unsupportedFileBody.message);
    assert.match(unsupportedFileBody.message, /JPEG, PNG, GIF, and WebP/);

    const missingReceiptResponse = await fetch(
      `${baseUrl}/api/receipt/analyze`,
      { method: "POST" },
    );
    assert.equal(missingReceiptResponse.status, 400);
    const missingReceiptBody = (await missingReceiptResponse.json()) as {
      error: string;
      message: string;
    };
    assert.equal(missingReceiptBody.error, missingReceiptBody.message);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});
