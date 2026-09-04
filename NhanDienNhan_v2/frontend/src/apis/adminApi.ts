import { getApiErrorMessage, getNetworkErrorMessage } from "./apiError";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const OCR_HISTORY_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "INTERRUPTED",
  "UNKNOWN",
] as const;

export const OCR_INTERACTION_TYPES = [
  "OCR_VAT_TU",
  "OCR_CHUNG_TU",
  "OCR_GIAY_VUNG_TRONG",
] as const;

export type OcrHistoryStatus = (typeof OCR_HISTORY_STATUSES)[number];
export type OcrInteractionType = (typeof OCR_INTERACTION_TYPES)[number];

export interface OcrHistoryFile {
  index: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
}

export interface OcrHistoryItem {
  id: string;
  created_at: string | null;
  completed_at: string | null;
  loai_tuong_tac: string | null;
  task_subtype: string | null;
  endpoint: string | null;
  ocr_status: OcrHistoryStatus;
  http_status: number | null;
  confidence: number | null;
  error_code: string | null;
  user_confirmed: boolean | null;
  user_correction: string | null;
  reviewed_at: string | null;
  file_count: number;
  files: OcrHistoryFile[];
  parse_warning: string | null;
}

export interface OcrHistoryFilters {
  q?: string;
  status?: OcrHistoryStatus;
  interaction_type?: OcrInteractionType;
  task_subtype?: string;
  from?: string;
  to?: string;
}

export interface OcrHistoryListResponse {
  items: OcrHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OcrHistoryDetail {
  item: OcrHistoryItem;
  interaction: unknown;
  normalized_output: unknown;
  raw_output: unknown;
}

export interface OcrTrashItem {
  trash_id: string;
  trashed_at: string | null;
  size_bytes: number;
  item: OcrHistoryItem;
}

export interface OcrTrashListResponse {
  items: OcrTrashItem[];
  total: number;
  total_size_bytes: number;
  page: number;
  page_size: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface BulkDeleteResponse {
  moved_ids: string[];
  failed: Array<{ id: string; reason: "not_found" | "conflict" }>;
}

interface BulkPurgeResponse {
  deleted_ids: string[];
  failed: Array<{ id: string; reason: "not_found" | "conflict" }>;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
    });
    const body = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(getApiErrorMessage(body, `Lỗi máy chủ (${response.status})`));
    }
    const payload = body as ApiSuccess<T>;
    if (!payload.success) {
      throw new Error("Phản hồi API không hợp lệ");
    }
    return payload.data;
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error(getNetworkErrorMessage(error, "Không thể kết nối máy chủ"), {
      cause: error,
    });
  }
}

function localDateBoundary(value: string, isEndDate: boolean): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    isEndDate ? 23 : 0,
    isEndDate ? 59 : 0,
    isEndDate ? 59 : 0,
    isEndDate ? 999 : 0,
  );
  return date.toISOString();
}

export async function getOcrHistory(
  filters: OcrHistoryFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<OcrHistoryListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    params.set(
      key,
      key === "from" ? localDateBoundary(value, false) : key === "to" ? localDateBoundary(value, true) : value,
    );
  });
  return request<OcrHistoryListResponse>(
    `${API_BASE_URL}/api/admin/ocr-history?${params.toString()}`,
    { signal },
  );
}

export function getOcrTrash(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<OcrTrashListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return request<OcrTrashListResponse>(
    `${API_BASE_URL}/api/admin/ocr-history/trash?${params.toString()}`,
    { signal },
  );
}

export function getOcrHistoryDetail(
  id: string,
  signal?: AbortSignal,
): Promise<OcrHistoryDetail> {
  return request<OcrHistoryDetail>(
    `${API_BASE_URL}/api/admin/ocr-history/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function getOcrHistoryFileUrl(
  id: string,
  index: number,
  download = false,
): string {
  const url = new URL(
    `${API_BASE_URL}/api/admin/ocr-history/${encodeURIComponent(id)}/files/${index}`,
  );
  if (download) url.searchParams.set("download", "true");
  return url.toString();
}

export function trashOcrHistory(id: string): Promise<{ id: string; status: "moved" }> {
  return request<{ id: string; status: "moved" }>(
    `${API_BASE_URL}/api/admin/ocr-history/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function trashOcrHistoryBulk(ids: string[]): Promise<BulkDeleteResponse> {
  return request<BulkDeleteResponse>(
    `${API_BASE_URL}/api/admin/ocr-history/bulk-delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    },
  );
}

export function purgeOcrTrash(
  trashId: string,
): Promise<{ id: string; status: "deleted" }> {
  return request<{ id: string; status: "deleted" }>(
    `${API_BASE_URL}/api/admin/ocr-history/trash/${encodeURIComponent(trashId)}`,
    { method: "DELETE" },
  );
}

export function purgeOcrTrashBulk(trashIds: string[]): Promise<BulkPurgeResponse> {
  return request<BulkPurgeResponse>(
    `${API_BASE_URL}/api/admin/ocr-history/trash/bulk-delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trash_ids: trashIds }),
    },
  );
}

export function reviewOcrHistory(
  id: string,
  userConfirmed: boolean,
  userCorrection: string | null,
): Promise<OcrHistoryItem> {
  return request<OcrHistoryItem>(
    `${API_BASE_URL}/api/admin/ocr-history/${encodeURIComponent(id)}/review`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_confirmed: userConfirmed,
        user_correction: userCorrection,
      }),
    },
  );
}
