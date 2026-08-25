import express, { Request, Response, NextFunction } from "express";
import { createImagesUploadMiddleware } from "../middleware/upload.middleware.js";
import { analyzeReceiptFiles } from "../services/analyze/receiptAnalysisService.js";

const router = express.Router();
const uploadReceiptFiles = createImagesUploadMiddleware({
  allowPdf: true,
  unsupportedFileMessage:
    "Only PDF, JPEG, PNG, GIF, and WebP files are allowed",
  fileLogLabel: "Receipt file field name:",
  errorLogLabel: "Multer error details for receipt:",
});

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

router.post("/analyze", uploadReceiptFiles);

router.post(
  "/analyze",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendBadRequest(
          res,
          "No receipt files provided. Make sure to send files with field name 'images'",
        );
      }

      const files = req.files as Express.Multer.File[];
      console.log("Receipt files received:", files.length);
      const analysis = await analyzeReceiptFiles(files);
      if (!analysis.success) {
        return sendBadRequest(res, analysis.error);
      }

      return res.status(200).json({
        success: true,
        data: {
          response: analysis.response,
          totalImages: analysis.totalImages,
        },
      });
    } catch (error: any) {
      console.error("Receipt analysis error:", error);
      error.message = error.message || "Failed to analyze receipt images";
      next(error);
    }
  },
);

export default router;
