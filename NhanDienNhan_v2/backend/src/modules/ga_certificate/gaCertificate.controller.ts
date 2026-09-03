import type { NextFunction, Request, RequestHandler, Response } from "express";
import { toError } from "@backend/shared/errors/errorUtils";
import {
  analyzeGrowingAreaCertificateFiles,
  type GrowingAreaCertificateAnalysisResult,
  type GrowingAreaCertificateInputFile,
} from "./gaCertificate.service";

export type GrowingAreaCertificateAnalyzer = (
  files: GrowingAreaCertificateInputFile[],
) => Promise<GrowingAreaCertificateAnalysisResult>;

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

export function createAnalyzeGrowingAreaCertificateHandler(
  analyzer: GrowingAreaCertificateAnalyzer = analyzeGrowingAreaCertificateFiles,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendBadRequest(
          res,
          "No certificate files provided. Make sure to send files with field name 'images'",
        );
      }

      const files = req.files as Express.Multer.File[];
      console.log("Growing area certificate files received:", files.length);
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
      console.error("Growing area certificate analysis error:", error);
      next(toError(error, "Failed to analyze growing area certificate"));
    }
  };
}

export const analyzeGrowingAreaCertificateHandler =
  createAnalyzeGrowingAreaCertificateHandler();
