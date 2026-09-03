import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createAnalyzeGrowingAreaCertificateHandler } from "../src/modules/ga_certificate/gaCertificate.controller.js";
import type { GrowingAreaCertificateInputFile } from "../src/modules/ga_certificate/gaCertificate.service.js";

function createResponseCapture() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      body = payload;
      return response;
    },
  };

  return {
    response: response as unknown as Response,
    read: () => ({ statusCode, body }),
  };
}

const certificateFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  mimetype: "image/jpeg",
  originalname: "certificate.jpg",
} as Express.Multer.File;

test("growing area certificate controller keeps the successful analyze response contract", async () => {
  let receivedFiles: GrowingAreaCertificateInputFile[] | undefined;
  const modelResponse = {
    success: false as const,
    error_code: "WRONG_DOCUMENT_TYPE" as const,
    message: "Không đúng loại tài liệu",
    data: null,
    metadata: {
      schema_version: "growing-area-certificate.v2" as const,
      document_type: "unknown" as const,
      page_count_received: 1,
      document_count_detected: 0,
      pages: [],
      review_required: false,
      review_warnings: [],
    },
  };
  const handler = createAnalyzeGrowingAreaCertificateHandler(async (files) => {
    receivedFiles = files;
    return { success: true, response: modelResponse, totalImages: 1 };
  });
  const capture = createResponseCapture();

  await handler(
    { files: [certificateFile] } as unknown as Request,
    capture.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(receivedFiles?.[0], certificateFile);
  assert.deepEqual(capture.read(), {
    statusCode: 200,
    body: {
      success: true,
      data: { response: modelResponse, totalImages: 1 },
    },
  });
});

test("growing area certificate controller keeps analysis errors as stable bad requests", async () => {
  const error = "PDF 'certificate.pdf' could not be read";
  const handler = createAnalyzeGrowingAreaCertificateHandler(async () => ({
    success: false,
    error,
  }));
  const capture = createResponseCapture();

  await handler(
    { files: [certificateFile] } as unknown as Request,
    capture.response,
    (() => undefined) as NextFunction,
  );

  assert.deepEqual(capture.read(), {
    statusCode: 400,
    body: { success: false, error, message: error },
  });
});
