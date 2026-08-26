import express from "express";
import { createImagesUploadMiddleware } from "@backend/shared/upload/upload.middleware";
import { analyzeProductHandler } from "./product.controller";

const router = express.Router();
const uploadImages = createImagesUploadMiddleware({
  allowPdf: false,
  unsupportedFileMessage: "Only JPEG, PNG, GIF, and WebP images are allowed",
  fileLogLabel: "File field name:",
  errorLogLabel: "Multer error details:",
});

router.post("/analyze", uploadImages, analyzeProductHandler);

export default router;
