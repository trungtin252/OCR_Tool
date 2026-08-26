import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createAnalyzeReceiptHandler } from "../src/modules/receipt/receipt.controller.js";
import type { ReceiptInputFile } from "../src/modules/receipt/receipt.service.js";

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

const receiptFile = {
  buffer: Buffer.from("%PDF-1.7", "ascii"),
  mimetype: "application/pdf",
  originalname: "receipt.pdf",
} as Express.Multer.File;

test("receipt controller keeps the successful analyze response contract", async () => {
  let receivedFiles: ReceiptInputFile[] | undefined;
  const modelResponse = { success: true, data: { documents: [] } };
  const handler = createAnalyzeReceiptHandler(async (files) => {
    receivedFiles = files;
    return {
      success: true,
      response: modelResponse,
      totalImages: 2,
    };
  });
  const capture = createResponseCapture();
  let forwardedError: unknown;

  await handler(
    { files: [receiptFile] } as unknown as Request,
    capture.response,
    ((error?: unknown) => {
      forwardedError = error;
    }) as NextFunction,
  );

  assert.equal(forwardedError, undefined);
  assert.equal(receivedFiles?.[0], receiptFile);
  assert.deepEqual(capture.read(), {
    statusCode: 200,
    body: {
      success: true,
      data: { response: modelResponse, totalImages: 2 },
    },
  });
});

test("receipt controller keeps analysis errors as stable bad requests", async () => {
  const error = "PDF 'receipt.pdf' could not be read";
  const handler = createAnalyzeReceiptHandler(async () => ({
    success: false,
    error,
  }));
  const capture = createResponseCapture();

  await handler(
    { files: [receiptFile] } as unknown as Request,
    capture.response,
    (() => undefined) as NextFunction,
  );

  assert.deepEqual(capture.read(), {
    statusCode: 400,
    body: { success: false, error, message: error },
  });
});
