import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
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
  isSupportedUploadMime,
} from "../utils/uploadValidation.js";
import { appConfig } from "../config/env.js";

const router = express.Router();
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("File field name:", file.fieldname, "MIME:", file.mimetype);
    if (isSupportedUploadMime(file.mimetype, false)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
    fields: 10,
    parts: 20,
  },
});

const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Multer error details:", {
    name: err.name,
    message: err.message,
    code: err.code,
    field: err.field,
  });

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File size exceeds 10MB limit",
        message: "File size exceeds 10MB limit",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || "File upload error",
      message: err.message || "File upload error",
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "File upload failed",
      message: err.message || "File upload failed",
    });
  }

  next();
};

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

router.post("/analyze", (req: Request, res: Response, next: NextFunction) => {
  upload.array("images", 10)(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
});

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
    } catch (error: any) {
      console.error("Image analysis error:", error);
      error.message = error.message || "Failed to analyze images";
      next(error);
    }
  },
);

router.post(
  "/test",
  requireTestEndpointsEnabled,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array("images", 10)(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
);

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
  } catch (error: any) {
    console.error("Image analysis error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze images",
    });
  }
});

export default router;
