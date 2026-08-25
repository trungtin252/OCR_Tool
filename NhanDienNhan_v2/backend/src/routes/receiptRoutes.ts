import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { processImagesWithOpenAI_chatCompletions } from "../services/analyze/imageProcessor.js";
import { receipt_prompt } from "../utils/prompts/receiptPrompt.js";
import { reconcileDocumentMath } from "../utils/documentReconciler.js";
import { pdfToPng } from "pdf-to-png-converter";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
  isSupportedUploadMime,
} from "../utils/uploadValidation.js";

const router = express.Router();

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_RESOLVED_IMAGES = 10;

// Single upload handler for 1-10 images
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log(
      "Receipt file field name:",
      file.fieldname,
      "MIME:",
      file.mimetype,
    );
    // Accept PDF and only the image formats supported by the LLM mapper.
    if (isSupportedUploadMime(file.mimetype, true)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPEG, PNG, GIF, and WebP files are allowed"));
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10,
    fields: 10,
    parts: 20,
  },
});

// Custom error handler for multer
const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Multer error details for receipt:", {
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

// POST endpoint for receipt image analysis (accepts 1-10 images)
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
      // Check if files were uploaded
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "No receipt files provided. Make sure to send files with field name 'images'",
          message:
            "No receipt files provided. Make sure to send files with field name 'images'",
        });
      }

      const files = req.files as Express.Multer.File[];
      console.log("Receipt files received:", files.length);

      const invalidFile = files.find(
        (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
      );
      if (invalidFile) {
        return sendBadRequest(
          res,
          `File '${invalidFile.originalname}' content does not match its declared format`,
        );
      }

      const imageBuffers: Buffer[] = [];
      const imageTypes: string[] = [];

      // Count PDF pages without rendering first so an oversized document set
      // is rejected before allocating PNG buffers.
      let totalResolvedImages = files.filter(
        (file) => file.mimetype.toLowerCase() !== "application/pdf",
      ).length;
      const pdfPageNumbers = new Map<Express.Multer.File, number[]>();

      for (const file of files) {
        if (file.mimetype.toLowerCase() !== "application/pdf") continue;

        try {
          const metadata = await pdfToPng(file.buffer, {
            viewportScale: 1.0,
            returnMetadataOnly: true,
            maxInputBytes: MAX_FILE_SIZE_BYTES,
          });
          const pageNumbers = metadata.map((page) => page.pageNumber);

          if (pageNumbers.length === 0) {
            return sendBadRequest(
              res,
              `PDF '${file.originalname}' does not contain any readable pages`,
            );
          }

          totalResolvedImages += pageNumbers.length;
          if (totalResolvedImages > MAX_RESOLVED_IMAGES) {
            return sendBadRequest(
              res,
              `Total pages/images (${totalResolvedImages}) exceeds the maximum limit of ${MAX_RESOLVED_IMAGES}.`,
            );
          }

          pdfPageNumbers.set(file, pageNumbers);
        } catch (error) {
          console.warn("Unable to inspect receipt PDF:", error);
          return sendBadRequest(
            res,
            `PDF '${file.originalname}' could not be read`,
          );
        }
      }

      for (const file of files) {
        if (file.mimetype.toLowerCase() === "application/pdf") {
          try {
            const pngPages = await pdfToPng(file.buffer, {
              viewportScale: 1.0,
              pagesToProcess: pdfPageNumbers.get(file)!,
              maxInputBytes: MAX_FILE_SIZE_BYTES,
              processPagesInParallel: false,
            });

            pngPages.forEach((page) => {
              if (page.content) {
                imageBuffers.push(page.content);
                imageTypes.push("image/png");
              }
            });
          } catch (error) {
            console.warn("Unable to render receipt PDF:", error);
            return sendBadRequest(
              res,
              `PDF '${file.originalname}' could not be rendered`,
            );
          }
        } else {
          imageBuffers.push(file.buffer);
          imageTypes.push(getCanonicalImageMime(file.mimetype)!);
        }
      }

      console.log("Total resolved receipt images/pages:", imageBuffers.length);

      // Recheck the combined count limit of 10 pages/images
      if (imageBuffers.length === 0) {
        return sendBadRequest(
          res,
          "No readable receipt images or PDF pages were resolved",
        );
      }

      if (imageBuffers.length > MAX_RESOLVED_IMAGES) {
        return sendBadRequest(
          res,
          `Total pages/images (${imageBuffers.length}) exceeds the maximum limit of ${MAX_RESOLVED_IMAGES}.`,
        );
      }

      const result = await processImagesWithOpenAI_chatCompletions(
        imageBuffers,
        imageTypes,
        receipt_prompt,
        "receipt",
        /* isParsed */ true,
        /* formatDates */ true,
        /* withSearchSchema */ false,
      );

      // Perform mathematical reconciliations on the documents
      const reconciledResponse = reconcileDocumentMath(result.response);

      return res.status(200).json({
        success: true,
        data: {
          response: reconciledResponse,
          totalImages: imageBuffers.length,
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
