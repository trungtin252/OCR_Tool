import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeGrowingAreaCertificateFiles,
  attachGrowingAreaCertificateFiles,
  MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES,
  normalizeGrowingAreaCertificateServerMetadata,
} from "../src/modules/ga_certificate/gaCertificate.service.js";

test("growing area certificate normalizes only server-owned schema and page metadata", () => {
  const response = {
    success: false,
    error_code: "WRONG_DOCUMENT_TYPE",
    message: "Sai loại tài liệu",
    data: null,
    metadata: {
      schema_version: "model-value",
      document_type: "unknown",
      page_count_received: 0,
      document_count_detected: 0,
      pages: [
        {
          input_index: 0,
          printed_page_number: null,
          role: "unknown",
          usable: true,
        },
      ],
      review_required: false,
      review_warnings: [
        {
          code: "UNREADABLE_FIELD",
          field_path: "data.growing_area_code",
          page_index: 0,
          message: "Không đọc rõ trường dữ liệu",
        },
      ],
    },
  };

  const normalized = normalizeGrowingAreaCertificateServerMetadata(
    response,
    1,
  ) as typeof response;

  assert.equal(
    normalized.metadata.schema_version,
    "growing-area-certificate.v2",
  );
  assert.equal(normalized.metadata.page_count_received, 1);
  assert.equal(normalized.metadata.pages[0]?.input_index, 1);
  assert.equal(normalized.metadata.review_warnings[0]?.page_index, 1);
  assert.equal(normalized.error_code, "WRONG_DOCUMENT_TYPE");
  assert.equal(normalized.message, "Sai loại tài liệu");
});

test("growing area certificate file metadata comes from uploaded files, not the model", () => {
  const response = {
    success: true,
    data: { certificate_number: "model-data" },
  };
  const enriched = attachGrowingAreaCertificateFiles(response, [
    {
      buffer: Buffer.from("certificate"),
      mimetype: "application/pdf",
      originalname: "certificate.pdf",
    },
  ]) as {
    data: {
      certificate_number: string;
      certificate_files: Array<{
        file_name: string;
        mime_type: string;
        size_bytes: number;
      }>;
      growing_area_images: unknown[];
    };
  };

  assert.equal(enriched.data.certificate_number, "model-data");
  assert.deepEqual(enriched.data.certificate_files, [
    {
      file_name: "certificate.pdf",
      mime_type: "application/pdf",
      size_bytes: 11,
    },
  ]);
  assert.deepEqual(enriched.data.growing_area_images, []);
});

test("growing area certificate analysis rejects a declared image whose content signature is invalid", async () => {
  const result = await analyzeGrowingAreaCertificateFiles([
    {
      buffer: Buffer.from("not an image"),
      mimetype: "image/png",
      originalname: "invalid.png",
    },
  ]);

  assert.deepEqual(result, {
    success: false,
    error: "File 'invalid.png' content does not match its declared format",
  });
});

test("growing area certificate analysis applies the general page safety limit, not a two-page cap", async () => {
  assert.ok(MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES > 2);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const result = await analyzeGrowingAreaCertificateFiles(
    Array.from(
      { length: MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES + 1 },
      (_, index) => ({
        buffer: jpeg,
        mimetype: "image/jpeg",
        originalname: `certificate-${index}.jpg`,
      }),
    ),
  );

  assert.deepEqual(result, {
    success: false,
    error: `Total pages/images (${MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES + 1}) exceeds the maximum limit of ${MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES}.`,
  });
});
