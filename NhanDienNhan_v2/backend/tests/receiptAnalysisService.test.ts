import assert from "node:assert/strict";
import test from "node:test";
import { analyzeReceiptFiles } from "../src/modules/receipt/receipt.service.js";

test("receipt analysis rejects a declared image whose content signature is invalid", async () => {
  const result = await analyzeReceiptFiles([
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

test("receipt analysis rejects more resolved images than the existing limit", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const result = await analyzeReceiptFiles(
    Array.from({ length: 11 }, (_, index) => ({
      buffer: jpeg,
      mimetype: "image/jpeg",
      originalname: `receipt-${index}.jpg`,
    })),
  );

  assert.deepEqual(result, {
    success: false,
    error: "Total pages/images (11) exceeds the maximum limit of 10.",
  });
});
