import type { RequestHandler } from "express";
import multer from "multer";
import { isSupportedUploadMime } from "@backend/shared/upload/uploadValidation";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILES,
} from "@backend/shared/upload/limits";

export { MAX_UPLOAD_FILE_SIZE_BYTES, MAX_UPLOAD_FILES } from "@backend/shared/upload/limits";

interface UploadMiddlewareOptions {
  allowPdf: boolean;
  unsupportedFileMessage: string;
  fileLogLabel: string;
  errorLogLabel: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function createImagesUploadMiddleware(
  options: UploadMiddlewareOptions,
): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      console.log(options.fileLogLabel, file.fieldname, "MIME:", file.mimetype);
      if (isSupportedUploadMime(file.mimetype, options.allowPdf)) {
        cb(null, true);
      } else {
        cb(new Error(options.unsupportedFileMessage));
      }
    },
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
      files: MAX_UPLOAD_FILES,
      fields: 10,
      parts: 20,
    },
  });

  return (req, res, next) => {
    upload.array("images", MAX_UPLOAD_FILES)(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      console.error(options.errorLogLabel, {
        name: error.name,
        message: error.message,
        code: error.code,
        field: error.field,
      });

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            success: false,
            error: "File size exceeds 10MB limit",
            message: "File size exceeds 10MB limit",
          });
          return;
        }
        res.status(400).json({
          success: false,
          error: getErrorMessage(error, "File upload error"),
          message: getErrorMessage(error, "File upload error"),
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: getErrorMessage(error, "File upload failed"),
        message: getErrorMessage(error, "File upload failed"),
      });
    });
  };
}
