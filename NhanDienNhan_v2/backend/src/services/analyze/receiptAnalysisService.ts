import { pdfToPng } from "pdf-to-png-converter";
import { reconcileDocumentMath } from "@backend/utils/documentReconciler";
import { receipt_prompt } from "@backend/utils/prompts/receiptPrompt";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
} from "@backend/shared/upload/uploadValidation";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@backend/shared/upload/limits";
import { processImagesWithOpenAI_chatCompletions } from "./imageProcessor";

export const MAX_RESOLVED_RECEIPT_IMAGES = 10;

export interface ReceiptInputFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface ReceiptAnalysisFailure {
  success: false;
  error: string;
}

interface ReceiptAnalysisSuccess {
  success: true;
  response: unknown;
  totalImages: number;
}

export type ReceiptAnalysisResult =
  | ReceiptAnalysisFailure
  | ReceiptAnalysisSuccess;

export async function analyzeReceiptFiles(
  files: ReceiptInputFile[],
): Promise<ReceiptAnalysisResult> {
  const invalidFile = files.find(
    (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
  );
  if (invalidFile) {
    return {
      success: false,
      error: `File '${invalidFile.originalname}' content does not match its declared format`,
    };
  }

  const imageBuffers: Buffer[] = [];
  const imageTypes: string[] = [];
  let totalResolvedImages = files.filter(
    (file) => file.mimetype.toLowerCase() !== "application/pdf",
  ).length;
  const pdfPageNumbers = new Map<ReceiptInputFile, number[]>();

  for (const file of files) {
    if (file.mimetype.toLowerCase() !== "application/pdf") continue;

    try {
      const metadata = await pdfToPng(file.buffer, {
        viewportScale: 1.0,
        returnMetadataOnly: true,
        maxInputBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
      });
      const pageNumbers = metadata.map((page) => page.pageNumber);

      if (pageNumbers.length === 0) {
        return {
          success: false,
          error: `PDF '${file.originalname}' does not contain any readable pages`,
        };
      }

      totalResolvedImages += pageNumbers.length;
      if (totalResolvedImages > MAX_RESOLVED_RECEIPT_IMAGES) {
        return {
          success: false,
          error: `Total pages/images (${totalResolvedImages}) exceeds the maximum limit of ${MAX_RESOLVED_RECEIPT_IMAGES}.`,
        };
      }

      pdfPageNumbers.set(file, pageNumbers);
    } catch (error) {
      console.warn("Unable to inspect receipt PDF:", error);
      return {
        success: false,
        error: `PDF '${file.originalname}' could not be read`,
      };
    }
  }

  for (const file of files) {
    if (file.mimetype.toLowerCase() === "application/pdf") {
      try {
        const pngPages = await pdfToPng(file.buffer, {
          viewportScale: 1.0,
          pagesToProcess: pdfPageNumbers.get(file)!,
          maxInputBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
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
        return {
          success: false,
          error: `PDF '${file.originalname}' could not be rendered`,
        };
      }
    } else {
      imageBuffers.push(file.buffer);
      imageTypes.push(getCanonicalImageMime(file.mimetype)!);
    }
  }

  console.log("Total resolved receipt images/pages:", imageBuffers.length);

  if (imageBuffers.length === 0) {
    return {
      success: false,
      error: "No readable receipt images or PDF pages were resolved",
    };
  }

  if (imageBuffers.length > MAX_RESOLVED_RECEIPT_IMAGES) {
    return {
      success: false,
      error: `Total pages/images (${imageBuffers.length}) exceeds the maximum limit of ${MAX_RESOLVED_RECEIPT_IMAGES}.`,
    };
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

  return {
    success: true,
    response: reconcileDocumentMath(result.response),
    totalImages: imageBuffers.length,
  };
}
