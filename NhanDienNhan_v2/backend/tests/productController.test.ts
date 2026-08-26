import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createAnalyzeProductHandler } from "../src/modules/product/product.controller.js";
import type {
  ProductAnalysisOptions,
  ProductAnalysisResult,
} from "../src/modules/product/product.service.js";

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

const pngFile = {
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  mimetype: "image/png",
  originalname: "sample.png",
} as Express.Multer.File;

test("product controller keeps the successful analyze response contract", async () => {
  let receivedOptions: ProductAnalysisOptions | undefined;
  const modelResponse = { success: true, data: { product_name: "Sample" } };
  const analysis: ProductAnalysisResult = {
    response: modelResponse,
    rawResponse: modelResponse,
    shouldIncludeRawResponse: true,
    searchMetadata: {
      search_status: "enriched",
      source_url: "https://example.test/product",
      search_query: "Sample",
    },
    searchDecision: { needs_web_search: true, search_reason: "missing" },
  };
  const handler = createAnalyzeProductHandler(async (options) => {
    receivedOptions = options;
    return analysis;
  });
  const capture = createResponseCapture();
  let forwardedError: unknown;

  await handler(
    {
      files: [pngFile],
      query: {
        category: "pesticide",
        parsed: "true",
        formatDates: "true",
        searchMode: "interactive",
      },
    } as unknown as Request,
    capture.response,
    ((error?: unknown) => {
      forwardedError = error;
    }) as NextFunction,
  );

  assert.equal(forwardedError, undefined);
  assert.deepEqual(receivedOptions, {
    imageBuffers: [pngFile.buffer],
    imageTypes: ["image/png"],
    schemaType: "pesticide",
    isParsed: true,
    formatDates: true,
    searchMode: "interactive",
  });
  assert.deepEqual(capture.read(), {
    statusCode: 200,
    body: {
      success: true,
      data: {
        response: modelResponse,
        raw: modelResponse,
        totalImages: 1,
        search_metadata: analysis.searchMetadata,
        search_decision: analysis.searchDecision,
      },
    },
  });
});

test("product controller keeps the invalid-category error contract", async () => {
  let callCount = 0;
  const handler = createAnalyzeProductHandler(async () => {
    callCount += 1;
    throw new Error("analyzer must not be called");
  });
  const capture = createResponseCapture();

  await handler(
    {
      files: [pngFile],
      query: { category: "receipt" },
    } as unknown as Request,
    capture.response,
    (() => undefined) as NextFunction,
  );

  const error =
    "Invalid category. Supported values: pesticide, fertilizer, fish_feed, seed";
  assert.equal(callCount, 0);
  assert.deepEqual(capture.read(), {
    statusCode: 400,
    body: { success: false, error, message: error },
  });
});
