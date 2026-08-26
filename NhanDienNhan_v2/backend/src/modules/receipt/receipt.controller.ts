import type { NextFunction, Request, RequestHandler, Response } from "express";
import { toError } from "@backend/shared/errors/errorUtils";
import {
  analyzeReceiptFiles,
  type ReceiptAnalysisResult,
  type ReceiptInputFile,
} from "./receipt.service";

export type ReceiptAnalyzer = (
  files: ReceiptInputFile[],
) => Promise<ReceiptAnalysisResult>;

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

export function createAnalyzeReceiptHandler(
  analyzer: ReceiptAnalyzer = analyzeReceiptFiles,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendBadRequest(
          res,
          "No receipt files provided. Make sure to send files with field name 'images'",
        );
      }

      const files = req.files as Express.Multer.File[];
      console.log("Receipt files received:", files.length);
      const analysis = await analyzer(files);
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
    } catch (error) {
      console.error("Receipt analysis error:", error);
      next(toError(error, "Failed to analyze receipt images"));
    }
  };
}

export const analyzeReceiptHandler = createAnalyzeReceiptHandler();
