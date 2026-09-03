import type { Request, RequestHandler, Response } from "express";
import { hasExpectedFileSignature } from "@backend/shared/upload/uploadValidation";
import {
  extractNormalizedOcrOutput,
  ocrArchive,
  type BeginOcrArchiveInput,
  type FilesystemOcrArchive,
  type OcrInteractionType,
} from "./ocrArchive";

interface OcrArchiveMiddlewareOptions {
  interactionType: OcrInteractionType;
  apiContractVersion: string;
  initialTaskSubtype: (request: Request) => string;
  finalTaskSubtype?: (normalizedOutput: unknown, request: Request) => string;
  shouldArchive?: (request: Request) => boolean;
}

type ArchiveAdapter = Pick<FilesystemOcrArchive, "begin" | "complete">;

function getUploadFiles(request: Request): Express.Multer.File[] {
  return request.files && Array.isArray(request.files)
    ? (request.files as Express.Multer.File[])
    : [];
}

function copyQuery(request: Request): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(request.query).map(([key, value]) => [key, value]),
  );
}

function setArchiveStatusHeader(
  response: Response,
  status: "saved" | "failed" | "disabled",
): void {
  if (!response.headersSent) {
    response.setHeader("X-OCR-Archive-Status", status);
  }
}

export function createOcrArchiveMiddleware(
  options: OcrArchiveMiddlewareOptions,
  archive: ArchiveAdapter = ocrArchive,
): RequestHandler {
  return async (request, response, next) => {
    const files = getUploadFiles(request);

    // Requests rejected before a controller validates their OCR inputs are not
    // archive interactions. The controllers retain ownership of the response.
    if (
      files.length === 0 ||
      files.some(
        (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
      ) ||
      options.shouldArchive?.(request) === false
    ) {
      next();
      return;
    }

    const beginInput: BeginOcrArchiveInput = {
      interactionType: options.interactionType,
      taskSubtype: options.initialTaskSubtype(request),
      endpoint: `${request.baseUrl}${request.path}`,
      query: copyQuery(request),
      apiContractVersion: options.apiContractVersion,
      files: files.map((file) => ({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      })),
    };
    const started = await archive.begin(beginInput);

    if (started.status !== "pending") {
      setArchiveStatusHeader(response, started.status);
      next();
      return;
    }

    const originalJson = response.json.bind(response);
    let responseCaptured = false;
    response.json = ((body: unknown) => {
      if (responseCaptured) return response;
      responseCaptured = true;

      const normalized = extractNormalizedOcrOutput(body);
      const taskSubtype =
        options.finalTaskSubtype?.(normalized, request) ??
        started.handle.input.taskSubtype;

      void archive
        .complete(started.handle, {
          httpStatus: response.statusCode,
          responseBody: body,
          taskSubtype,
        })
        .then((status) => {
          setArchiveStatusHeader(response, status);
          originalJson(body);
        })
        .catch((error: unknown) => {
          console.error("ARCHIVE_WRITE_FAILED", {
            operation: "middleware-complete",
            interaction_id: started.handle.id,
            message: error instanceof Error ? error.message : String(error),
          });
          setArchiveStatusHeader(response, "failed");
          originalJson(body);
        });

      return response;
    }) as Response["json"];

    next();
  };
}
