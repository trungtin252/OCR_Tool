import express from "express";
import { createOcrArchiveMiddleware } from "@backend/shared/archive/ocrArchive.middleware";
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
const archiveReceiptInteraction = createOcrArchiveMiddleware({
  interactionType: "OCR_CHUNG_TU",
  apiContractVersion: "receipt.v1",
  initialTaskSubtype: () => "unknown",
  finalTaskSubtype: (normalizedOutput) => {
    if (typeof normalizedOutput !== "object" || normalizedOutput === null) {
      return "unknown";
    }
    const normalized = normalizedOutput as Record<string, unknown>;
    const data =
      typeof normalized.data === "object" && normalized.data !== null
        ? (normalized.data as Record<string, unknown>)
        : normalized;
    if (!Array.isArray(data.documents)) return "unknown";

    const documentTypes = new Set(
      data.documents.flatMap((document) => {
        if (typeof document !== "object" || document === null) return [];
        const documentType = (document as Record<string, unknown>)
          .document_type;
        return typeof documentType === "string" ? [documentType] : [];
      }),
    );
    if (documentTypes.size > 1) return "mixed";
    return documentTypes.values().next().value ?? "unknown";
  },
});

router.post(
  "/analyze",
  uploadReceiptFiles,
  archiveReceiptInteraction,
  analyzeReceiptHandler,
);

export default router;
