import express, { NextFunction, Request, Response } from "express";
import { appConfig } from "@backend/config/env";
import { test_prompt } from "@backend/modules/product/product.prompts";
import { getErrorMessage } from "@backend/shared/errors/errorUtils";
import { createImagesUploadMiddleware } from "@backend/shared/upload/upload.middleware";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
} from "@backend/shared/upload/uploadValidation";
import { processImagesTest } from "@backend/services/analyze/imageProcessor";

const router = express.Router();
const uploadImages = createImagesUploadMiddleware({
  allowPdf: false,
  unsupportedFileMessage: "Only JPEG, PNG, GIF, and WebP images are allowed",
  fileLogLabel: "File field name:",
  errorLogLabel: "Multer error details:",
});

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

function requireTestEndpointsEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!appConfig.testEndpointsEnabled) {
    return res.status(404).json({
      success: false,
      message: "Route not found",
    });
  }
  next();
}

router.post("/test", requireTestEndpointsEnabled, uploadImages);

router.post("/test", async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return sendBadRequest(
        res,
        "No image files provided. Make sure to send files with field name 'images'",
      );
    }

    const schemaType = "";
    console.log("Processing images for category:", schemaType);
    const files = req.files as Express.Multer.File[];
    const invalidFile = files.find(
      (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
    );
    if (invalidFile) {
      return sendBadRequest(
        res,
        `File '${invalidFile.originalname}' content does not match a supported image format`,
      );
    }

    console.log("Files received:", files.length);
    const result = await processImagesTest(
      files.map((file) => file.buffer),
      files.map((file) => getCanonicalImageMime(file.mimetype)!),
      test_prompt,
      schemaType,
    );

    return res.status(200).json({
      success: true,
      data: {
        response: result.response,
        totalImages: files.length,
      },
    });
  } catch (error) {
    console.error("Image analysis error:", error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Failed to analyze images"),
    });
  }
});

export default router;
