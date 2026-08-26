import type { NextFunction, Request, RequestHandler, Response } from "express";
import { toError } from "@backend/shared/errors/errorUtils";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
} from "@backend/shared/upload/uploadValidation";
import {
  parseBooleanQuery,
  parseProductSchemaType,
  parseSearchMode,
} from "./product.requestValidation";
import {
  analyzeProduct,
  type ProductAnalysisOptions,
  type ProductAnalysisResult,
} from "./product.service";

export type ProductAnalyzer = (
  options: ProductAnalysisOptions,
) => Promise<ProductAnalysisResult>;

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

export function createAnalyzeProductHandler(
  analyzer: ProductAnalyzer = analyzeProduct,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
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
      const analysis = await analyzer({
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
  };
}

export const analyzeProductHandler = createAnalyzeProductHandler();
