import express, { Request, Response, NextFunction } from "express";
import { createImagesUploadMiddleware } from "../shared/upload/upload.middleware.js";
import { processImagesTest } from "../services/analyze/imageProcessor.js";
import { analyzeProduct } from "../services/analyze/productAnalysisService.js";
import { test_prompt } from "../utils/prompts/productPrompts.js";
import {
  parseBooleanQuery,
  parseProductSchemaType,
  parseSearchMode,
} from "../utils/requestValidation.js";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
} from "../shared/upload/uploadValidation.js";
import { appConfig } from "../config/env.js";
import { getErrorMessage, toError } from "../shared/errors/errorUtils.js";

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

router.post("/analyze", uploadImages);

router.post(
  "/analyze",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendBadRequest(
          res,
          "No image files provided. Make sure to send files with field name 'images'",
        );
      }

      const schemaType = parseProductSchemaType(req.query.category);
      if (!schemaType) {
        return sendBadRequest(
          res,
          "Invalid category. Supported values: pesticide, fertilizer, fish_feed, seed",
        );
      }

      const isParsed = parseBooleanQuery(req.query.parsed);
      const formatDates = parseBooleanQuery(req.query.formatDates);
      const searchMode = parseSearchMode(req.query.searchMode);
      console.log(
        "Processing images for category:",
        schemaType,
        "formatDates:",
        formatDates,
        "searchMode:",
        searchMode,
      );

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
      const analysis = await analyzeProduct({
        imageBuffers: files.map((file) => file.buffer),
        imageTypes: files.map((file) => getCanonicalImageMime(file.mimetype)!),
        schemaType,
        isParsed,
        formatDates,
        searchMode,
      });

      return res.status(200).json({
        success: true,
        data: {
          response: analysis.response,
          ...(analysis.shouldIncludeRawResponse
            ? { raw: analysis.rawResponse }
            : {}),
          totalImages: files.length,
          ...(analysis.searchMetadata
            ? { search_metadata: analysis.searchMetadata }
            : {}),
          ...(searchMode === "interactive" &&
          analysis.searchDecision !== undefined
            ? { search_decision: analysis.searchDecision }
            : {}),
        },
      });
    } catch (error) {
      console.error("Image analysis error:", error);
      next(toError(error, "Failed to analyze images"));
    }
  },
);

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
