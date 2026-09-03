import express, { type NextFunction, type Request, type Response } from "express";
import { appConfig } from "@backend/config/env";
import AppError from "@backend/shared/errors/AppError";
import {
  OCR_HISTORY_STATUSES,
  OCR_INTERACTION_TYPES,
  OcrHistoryService,
  isValidOcrHistoryId,
  type OcrHistoryStatus,
  type OcrInteractionType,
} from "./ocrHistory.service";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BULK_DELETE_IDS = 100;

function singleQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return undefined;
  return typeof value === "string" ? value : undefined;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const raw = singleQueryValue(value);
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new AppError(400, `${name} không hợp lệ`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AppError(400, `${name} không hợp lệ`);
  }
  return parsed;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): T | undefined {
  const raw = singleQueryValue(value);
  if (raw === undefined || raw === "") return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new AppError(400, `${name} không hợp lệ`);
  }
  return raw as T;
}

function parseDate(value: unknown, isEndDate: boolean): Date | undefined {
  const raw = singleQueryValue(value);
  if (raw === undefined || raw === "") return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}${isEndDate ? "T23:59:59.999Z" : "T00:00:00.000Z"}`
    : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, "Ngày lọc không hợp lệ");
  }
  return parsed;
}

function parseTaskSubtype(value: unknown): string | undefined {
  const raw = singleQueryValue(value)?.trim();
  if (!raw) return undefined;
  if (raw.length > 100) throw new AppError(400, "task_subtype không hợp lệ");
  return raw;
}

function parseSearchQuery(value: unknown): string | undefined {
  const raw = singleQueryValue(value)?.trim();
  if (!raw) return undefined;
  if (raw.length > 200) throw new AppError(400, "q không hợp lệ");
  return raw;
}

function parseFileIndex(value: string): number {
  if (!/^\d+$/.test(value)) throw new AppError(400, "Chỉ số tệp không hợp lệ");
  const index = Number(value);
  if (!Number.isSafeInteger(index)) {
    throw new AppError(400, "Chỉ số tệp không hợp lệ");
  }
  return index;
}

function routeParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function parseArchiveId(value: string | string[] | undefined): string {
  const id = routeParam(value);
  if (!isValidOcrHistoryId(id)) {
    throw new AppError(400, "ID lịch sử OCR không hợp lệ");
  }
  return id;
}

function safeDownloadFilename(filename: string): string {
  return filename.replace(/[\\/\r\n"]/g, "_") || "ocr-file";
}

function parseBulkDeleteIds(body: unknown): string[] {
  const ids =
    typeof body === "object" && body !== null && Array.isArray((body as { ids?: unknown }).ids)
      ? (body as { ids: unknown[] }).ids
      : null;
  if (!ids || ids.length === 0 || ids.length > MAX_BULK_DELETE_IDS) {
    throw new AppError(400, "Danh sách ID xóa không hợp lệ");
  }
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.some((id) => typeof id !== "string" || !isValidOcrHistoryId(id))) {
    throw new AppError(400, "Danh sách ID xóa không hợp lệ");
  }
  return uniqueIds as string[];
}

function parseReviewInput(body: unknown): {
  userConfirmed: boolean;
  userCorrection: string | null;
} {
  if (typeof body !== "object" || body === null) {
    throw new AppError(400, "Dữ liệu xét duyệt không hợp lệ");
  }
  const review = body as {
    user_confirmed?: unknown;
    user_correction?: unknown;
  };
  if (typeof review.user_confirmed !== "boolean") {
    throw new AppError(400, "Trạng thái xét duyệt không hợp lệ");
  }
  const correction =
    typeof review.user_correction === "string"
      ? review.user_correction.trim()
      : "";
  if (!review.user_confirmed && !correction) {
    throw new AppError(400, "Vui lòng ghi rõ nội dung cần chỉnh sửa");
  }
  if (correction.length > 2_000) {
    throw new AppError(400, "Nhận xét xét duyệt không hợp lệ");
  }
  return {
    userConfirmed: review.user_confirmed,
    userCorrection: correction || null,
  };
}

export function createAdminRoutes(
  service = new OcrHistoryService(appConfig.ocrArchiveDir),
) {
  const router = express.Router();

  router.get(
    "/ocr-history",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const from = parseDate(request.query.from, false);
        const to = parseDate(request.query.to, true);
        if (from && to && from > to) {
          throw new AppError(400, "Khoảng ngày lọc không hợp lệ");
        }
        const data = await service.list({
          page: parsePositiveInteger(request.query.page, 1, 1_000_000, "page"),
          pageSize: parsePositiveInteger(
            request.query.page_size,
            DEFAULT_PAGE_SIZE,
            MAX_PAGE_SIZE,
            "page_size",
          ),
          query: parseSearchQuery(request.query.q),
          status: parseEnum<OcrHistoryStatus>(
            request.query.status,
            OCR_HISTORY_STATUSES,
            "status",
          ),
          interactionType: parseEnum<OcrInteractionType>(
            request.query.interaction_type,
            OCR_INTERACTION_TYPES,
            "interaction_type",
          ),
          taskSubtype: parseTaskSubtype(request.query.task_subtype),
          from,
          to,
        });
        response.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/ocr-history/bulk-delete",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const ids = parseBulkDeleteIds(request.body);
        const results = await Promise.all(
          ids.map(async (id) => ({ id, status: await service.trash(id) })),
        );
        response.json({
          success: true,
          data: {
            moved_ids: results.filter((result) => result.status === "moved").map((result) => result.id),
            failed: results
              .filter((result) => result.status !== "moved")
              .map((result) => ({ id: result.id, reason: result.status })),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/ocr-history/:id/files/:index",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const id = parseArchiveId(request.params.id);
        const index = parseFileIndex(routeParam(request.params.index));
        const file = await service.file(id, index);
        if (!file) throw new AppError(404, "Không tìm thấy tệp archive");
        const download = singleQueryValue(request.query.download) === "true";
        response.type(file.mimeType);
        response.setHeader(
          "Content-Disposition",
          `${download ? "attachment" : "inline"}; filename="${safeDownloadFilename(file.originalName)}"`,
        );
        response.sendFile(file.absolutePath, (error) => {
          if (error && !response.headersSent) next(error);
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/ocr-history/:id",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const data = await service.detail(parseArchiveId(request.params.id));
        if (!data) throw new AppError(404, "Không tìm thấy lịch sử OCR");
        response.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/ocr-history/:id/review",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const result = await service.review(
          parseArchiveId(request.params.id),
          parseReviewInput(request.body),
        );
        if (result.status !== "saved") {
          if (result.status === "not_found") {
            throw new AppError(404, "Không tìm thấy lịch sử OCR");
          }
          throw new AppError(409, "Không thể cập nhật bản ghi archive này");
        }
        response.json({ success: true, data: result.item });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/ocr-history/:id",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const id = parseArchiveId(request.params.id);
        const status = await service.trash(id);
        if (status === "not_found") {
          throw new AppError(404, "Không tìm thấy lịch sử OCR");
        }
        if (status === "conflict") {
          throw new AppError(409, "Lịch sử OCR đang được thay đổi, vui lòng thử lại");
        }
        response.json({ success: true, data: { id, status } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export default createAdminRoutes();
