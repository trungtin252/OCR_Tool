import express from "express";
import { createOcrArchiveMiddleware } from "@backend/shared/archive/ocrArchive.middleware";
import { createImagesUploadMiddleware } from "@backend/shared/upload/upload.middleware";
import { analyzeProductHandler } from "./product.controller";
import { parseProductSchemaType } from "./product.requestValidation";

const router = express.Router();
const uploadImages = createImagesUploadMiddleware({
  allowPdf: false,
  unsupportedFileMessage: "Only JPEG, PNG, GIF, and WebP images are allowed",
  fileLogLabel: "File field name:",
  errorLogLabel: "Multer error details:",
});
const archiveProductInteraction = createOcrArchiveMiddleware({
  interactionType: "OCR_VAT_TU",
  apiContractVersion: "product.v1",
  initialTaskSubtype: (request) =>
    parseProductSchemaType(request.query.category) ?? "unknown",
  shouldArchive: (request) =>
    parseProductSchemaType(request.query.category) !== null,
});

router.post(
  "/analyze",
  uploadImages,
  archiveProductInteraction,
  analyzeProductHandler,
);

export default router;
