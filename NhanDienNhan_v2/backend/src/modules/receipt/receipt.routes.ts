import express from "express";
import { createImagesUploadMiddleware } from "@backend/shared/upload/upload.middleware";
import { analyzeReceiptHandler } from "./receipt.controller";

const router = express.Router();
const uploadReceiptFiles = createImagesUploadMiddleware({
  allowPdf: true,
  unsupportedFileMessage:
    "Only PDF, JPEG, PNG, GIF, and WebP files are allowed",
  fileLogLabel: "Receipt file field name:",
  errorLogLabel: "Multer error details for receipt:",
});

router.post("/analyze", uploadReceiptFiles, analyzeReceiptHandler);

export default router;
