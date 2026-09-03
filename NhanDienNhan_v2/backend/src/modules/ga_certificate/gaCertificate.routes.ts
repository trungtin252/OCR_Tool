import express from "express";
import { createOcrArchiveMiddleware } from "@backend/shared/archive/ocrArchive.middleware";
import { createImagesUploadMiddleware } from "@backend/shared/upload/upload.middleware";
import { analyzeGrowingAreaCertificateHandler } from "./gaCertificate.controller";

const router = express.Router();
const uploadGrowingAreaCertificateFiles = createImagesUploadMiddleware({
  allowPdf: true,
  unsupportedFileMessage:
    "Only PDF, JPEG, PNG, GIF, and WebP files are allowed",
  fileLogLabel: "Growing area certificate file field name:",
  errorLogLabel: "Multer error details for growing area certificate:",
});
const archiveGrowingAreaCertificateInteraction = createOcrArchiveMiddleware({
  interactionType: "OCR_GIAY_VUNG_TRONG",
  apiContractVersion: "growing-area-certificate.v2",
  initialTaskSubtype: () => "growing_area_certificate",
});

router.post(
  "/analyze",
  uploadGrowingAreaCertificateFiles,
  archiveGrowingAreaCertificateInteraction,
  analyzeGrowingAreaCertificateHandler,
);

export default router;
