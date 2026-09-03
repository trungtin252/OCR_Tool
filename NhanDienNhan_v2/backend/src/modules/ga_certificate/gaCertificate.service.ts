import { pdfToPng } from "pdf-to-png-converter";
import {
  GrowingAreaCertificateResponseContractSchema,
  type GrowingAreaCertificateResponse,
} from "./gaCertificate.schema";
import { growing_area_certificate_prompt } from "./gaCertificate.prompts";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
} from "@backend/shared/upload/uploadValidation";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@backend/shared/upload/limits";
import { processImagesWithOpenAI_chatCompletions } from "@backend/services/analyze/imageProcessor";

export const MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES = 10;

export interface GrowingAreaCertificateInputFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface GrowingAreaCertificateAnalysisFailure {
  success: false;
  error: string;
}

interface GrowingAreaCertificateAnalysisSuccess {
  success: true;
  response: GrowingAreaCertificateResponse;
  totalImages: number;
}

export type GrowingAreaCertificateAnalysisResult =
  | GrowingAreaCertificateAnalysisFailure
  | GrowingAreaCertificateAnalysisSuccess;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Schema version and input order are known by the server, not inferred OCR
 * values. Normalizing them avoids a model's common zero-based page index from
 * invalidating an otherwise valid extraction.
 */
export function normalizeGrowingAreaCertificateServerMetadata(
  response: unknown,
  totalImages: number,
): unknown {
  if (!isRecord(response) || !isRecord(response.metadata)) return response;

  const metadata = response.metadata;
  const modelUsedZeroBasedPageIndexes =
    Array.isArray(metadata.pages) &&
    metadata.pages.some((page) => isRecord(page) && page.input_index === 0);
  const pages = Array.isArray(metadata.pages)
    ? metadata.pages.map((page, index) =>
        isRecord(page) ? { ...page, input_index: index + 1 } : page,
      )
    : metadata.pages;
  const reviewWarnings = Array.isArray(metadata.review_warnings)
    ? metadata.review_warnings.map((warning) => {
        if (!isRecord(warning)) return warning;
        const pageIndex = warning.page_index;
        return modelUsedZeroBasedPageIndexes &&
          typeof pageIndex === "number" &&
          Number.isInteger(pageIndex) &&
          pageIndex >= 0
          ? { ...warning, page_index: pageIndex + 1 }
          : warning;
      })
    : metadata.review_warnings;

  return {
    ...response,
    metadata: {
      ...metadata,
      schema_version: "growing-area-certificate.v2",
      page_count_received: totalImages,
      pages,
      review_warnings: reviewWarnings,
    },
  };
}

/** File references are transport data and must never be inferred by the model. */
export function attachGrowingAreaCertificateFiles(
  response: unknown,
  files: GrowingAreaCertificateInputFile[],
): unknown {
  if (
    !isRecord(response) ||
    response.success !== true ||
    !isRecord(response.data)
  ) {
    return response;
  }

  return {
    ...response,
    data: {
      ...response.data,
      certificate_files: files.map((file) => ({
        file_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.buffer.length,
      })),
      // This endpoint receives certificate pages only. Field images belong to
      // the later growing-area upload/storage flow.
      growing_area_images: [],
    },
  };
}

function createFailureResponse(
  errorCode: "EXTRACTION_FAILED" | "SCHEMA_VALIDATION_FAILED",
  totalImages: number,
): GrowingAreaCertificateResponse {
  return {
    success: false,
    error_code: errorCode,
    message:
      errorCode === "EXTRACTION_FAILED"
        ? "Không thể trích xuất dữ liệu chứng nhận vùng trồng"
        : "Kết quả trích xuất không đúng cấu trúc chứng nhận vùng trồng",
    data: null,
    metadata: {
      schema_version: "growing-area-certificate.v2",
      document_type: "unknown",
      page_count_received: totalImages,
      document_count_detected: 0,
      pages: Array.from({ length: totalImages }, (_, index) => ({
        input_index: index + 1,
        printed_page_number: null,
        role: "unknown" as const,
        usable: false,
      })),
      review_required: false,
      review_warnings: [],
    },
  };
}

export async function analyzeGrowingAreaCertificateFiles(
  files: GrowingAreaCertificateInputFile[],
): Promise<GrowingAreaCertificateAnalysisResult> {
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
  const pdfPageNumbers = new Map<GrowingAreaCertificateInputFile, number[]>();

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
      if (totalResolvedImages > MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES) {
        return {
          success: false,
          error: `Total pages/images (${totalResolvedImages}) exceeds the maximum limit of ${MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES}.`,
        };
      }

      pdfPageNumbers.set(file, pageNumbers);
    } catch {
      console.warn("Unable to inspect growing area certificate PDF");
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
      } catch {
        console.warn("Unable to render growing area certificate PDF");
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

  if (imageBuffers.length === 0) {
    return {
      success: false,
      error: "No readable certificate images or PDF pages were resolved",
    };
  }

  if (imageBuffers.length > MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES) {
    return {
      success: false,
      error: `Total pages/images (${imageBuffers.length}) exceeds the maximum limit of ${MAX_RESOLVED_GROWING_AREA_CERTIFICATE_IMAGES}.`,
    };
  }

  console.log(
    "Total resolved growing area certificate images/pages:",
    imageBuffers.length,
  );

  try {
    const result = await processImagesWithOpenAI_chatCompletions(
      imageBuffers,
      imageTypes,
      growing_area_certificate_prompt,
      "growing_area_certificate",
      /* isParsed */ true,
      /* formatDates */ false,
      /* withSearchSchema */ false,
      { fallbackOnEmptyContent: true },
    );
    const validationResult =
      GrowingAreaCertificateResponseContractSchema.safeParse(
        attachGrowingAreaCertificateFiles(
          normalizeGrowingAreaCertificateServerMetadata(
            result.response,
            imageBuffers.length,
          ),
          files,
        ),
      );

    if (!validationResult.success) {
      console.warn(
        "Growing area certificate model response failed schema validation",
        {
          issueCodes: validationResult.error.issues.map((issue) => issue.code),
          paths: validationResult.error.issues.map((issue) =>
            issue.path.join("."),
          ),
        },
      );
      return {
        success: true,
        response: createFailureResponse(
          "SCHEMA_VALIDATION_FAILED",
          imageBuffers.length,
        ),
        totalImages: imageBuffers.length,
      };
    }

    return {
      success: true,
      response: validationResult.data,
      totalImages: imageBuffers.length,
    };
  } catch {
    console.error("Growing area certificate OCR extraction failed");
    return {
      success: true,
      response: createFailureResponse("EXTRACTION_FAILED", imageBuffers.length),
      totalImages: imageBuffers.length,
    };
  }
}
