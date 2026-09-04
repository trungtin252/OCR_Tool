import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Download,
  Eye,
  FileImage,
  FileText,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  OCR_HISTORY_STATUSES,
  OCR_INTERACTION_TYPES,
  getOcrHistory,
  getOcrHistoryDetail,
  getOcrHistoryFileUrl,
  getOcrTrash,
  purgeOcrTrash,
  purgeOcrTrashBulk,
  reviewOcrHistory,
  trashOcrHistory,
  trashOcrHistoryBulk,
  type OcrHistoryDetail,
  type OcrHistoryFilters,
  type OcrHistoryItem,
  type OcrHistoryStatus,
  type OcrTrashItem,
} from "../apis/adminApi";
import { ArchivedOcrVisualResult } from "./ArchivedOcrVisualResult";

const PAGE_SIZE = 20;

const interactionLabels: Record<string, string> = {
  OCR_VAT_TU: "Vật tư nông nghiệp",
  OCR_CHUNG_TU: "Chứng từ",
  OCR_GIAY_VUNG_TRONG: "Giấy vùng trồng",
};

const statusClasses: Record<OcrHistoryStatus, string> = {
  SUCCEEDED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  INTERRUPTED: "bg-amber-100 text-amber-800",
  UNKNOWN: "bg-slate-200 text-slate-700",
};

function reviewLabel(userConfirmed: boolean | null): string {
  if (userConfirmed === true) return "Đạt";
  if (userConfirmed === false) return "Không đạt";
  return "Chưa duyệt";
}

function reviewClasses(userConfirmed: boolean | null): string {
  if (userConfirmed === true) return "bg-emerald-100 text-emerald-800";
  if (userConfirmed === false) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "medium",
      });
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function asJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "null";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

interface AdminPanelProps {
  onLogout: () => void;
}

interface HistoryDetailDialogProps {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}

function HistoryDetailDialog({ id, onClose, onChanged }: HistoryDetailDialogProps) {
  const [detail, setDetail] = useState<OcrHistoryDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"visual" | "normalized" | "raw" | "metadata">("visual");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [reviewDecision, setReviewDecision] = useState<boolean | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getOcrHistoryDetail(id, controller.signal)
      .then((data) => {
        setDetail(data);
        setPreviewIndex(data.item.files[0]?.index ?? null);
        setReviewDecision(data.item.user_confirmed);
        setReviewComment(data.item.user_correction ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Không thể tải chi tiết lịch sử.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const previewFile = detail?.item.files.find((file) => file.index === previewIndex) ?? null;

  const saveReview = async () => {
    if (!detail || reviewDecision === null) {
      setReviewError("Hãy chọn kết quả xét duyệt trước khi lưu.");
      return;
    }
    if (!reviewDecision && !reviewComment.trim()) {
      setReviewError("Vui lòng ghi rõ kết quả OCR sai hoặc cần chỉnh sửa ở đâu.");
      return;
    }
    setSavingReview(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const item = await reviewOcrHistory(
        detail.item.id,
        reviewDecision,
        reviewDecision ? null : reviewComment.trim(),
      );
      setDetail((current) => current ? { ...current, item } : current);
      setReviewComment(item.user_correction ?? "");
      setReviewNotice("Đã lưu xét duyệt kết quả OCR.");
      onChanged();
    } catch (reason) {
      setReviewError(reason instanceof Error ? reason.message : "Không thể lưu xét duyệt.");
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 sm:p-8"
      role="dialog"
    >
      <section className="mx-auto min-h-full max-w-6xl rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Chi tiết OCR</p>
            <h2 className="mt-1 break-all text-lg font-bold text-slate-900">{id}</h2>
          </div>
          <button
            aria-label="Đóng chi tiết"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {loading && (
          <div className="flex min-h-80 items-center justify-center gap-3 text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Đang tải chi tiết…
          </div>
        )}
        {error && (
          <div className="m-6 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        {detail && (
          <div className="space-y-6 p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Loại OCR", interactionLabels[detail.item.loai_tuong_tac ?? ""] ?? detail.item.loai_tuong_tac ?? "—"],
                ["Subtype", detail.item.task_subtype ?? "—"],
                ["Tạo lúc", formatDate(detail.item.created_at)],
                ["Hoàn tất", formatDate(detail.item.completed_at)],
                ["Trạng thái", detail.item.ocr_status],
                ["Confidence", detail.item.confidence === null ? "—" : `${Math.round(detail.item.confidence * 100)}%`],
                ["HTTP status", detail.item.http_status === null ? "—" : String(detail.item.http_status)],
                ["Lỗi", detail.item.error_code ?? "—"],
              ].map(([label, value]) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Xét duyệt kết quả OCR</h3>
                  <p className="mt-1 text-sm text-slate-600">Chọn Đạt khi dữ liệu đúng; chọn Không đạt để lưu nhận xét cần chỉnh sửa.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${reviewClasses(detail.item.user_confirmed)}`}>
                  {reviewLabel(detail.item.user_confirmed)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    reviewDecision === true ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                  }`}
                  onClick={() => { setReviewDecision(true); setReviewError(""); }}
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Đạt
                </button>
                <button
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    reviewDecision === false ? "border-red-600 bg-red-600 text-white" : "border-red-300 bg-white text-red-800 hover:bg-red-50"
                  }`}
                  onClick={() => { setReviewDecision(false); setReviewError(""); }}
                  type="button"
                >
                  <CircleX className="h-4 w-4" />
                  Không đạt
                </button>
              </div>
              {reviewDecision === false && (
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Nội dung sai hoặc cần chỉnh sửa
                  <textarea
                    className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    maxLength={2000}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Ví dụ: sai số đăng ký, thiếu thành phần hoạt chất, sai ngày sản xuất..."
                    value={reviewComment}
                  />
                </label>
              )}
              {detail.item.reviewed_at && <p className="mt-3 text-xs text-slate-500">Lần duyệt gần nhất: {formatDate(detail.item.reviewed_at)}</p>}
              {reviewError && <p className="mt-3 text-sm text-red-700" role="alert">{reviewError}</p>}
              {reviewNotice && <p className="mt-3 text-sm text-emerald-700">{reviewNotice}</p>}
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingReview}
                onClick={() => void saveReview()}
                type="button"
              >
                {savingReview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu xét duyệt
              </button>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h3 className="mb-3 text-base font-bold text-slate-900">Tệp gốc</h3>
                <div className="space-y-2">
                  {detail.item.files.map((file) => (
                    <div
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 ${
                        previewIndex === file.index
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-white"
                      }`}
                      key={file.index}
                    >
                      {isImage(file.mime_type) ? (
                        <FileImage className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
                      ) : (
                        <FileText className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
                      )}
                      <div className="min-w-32 flex-1">
                        <p className="break-all text-sm font-medium text-slate-900">{file.original_name}</p>
                        <p className="text-xs text-slate-500">{file.mime_type} · {formatBytes(file.size_bytes)}</p>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                        onClick={() => setPreviewIndex(file.index)}
                        type="button"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Xem
                      </button>
                      <a
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                        href={getOcrHistoryFileUrl(detail.item.id, file.index, true)}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Tải
                      </a>
                    </div>
                  ))}
                </div>
                {previewFile && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {isImage(previewFile.mime_type) && (
                      <img
                        alt={previewFile.original_name}
                        className="max-h-[32rem] w-full object-contain"
                        src={getOcrHistoryFileUrl(detail.item.id, previewFile.index)}
                      />
                    )}
                    {isPdf(previewFile.mime_type) && (
                      <iframe
                        className="h-[32rem] w-full bg-white"
                        src={getOcrHistoryFileUrl(detail.item.id, previewFile.index)}
                        title={previewFile.original_name}
                      />
                    )}
                    {!isImage(previewFile.mime_type) && !isPdf(previewFile.mime_type) && (
                      <p className="p-5 text-sm text-slate-600">Không hỗ trợ xem trước loại tệp này.</p>
                    )}
                  </div>
                )}
              </section>

              <section>
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                  {[
                    ["visual", "Kết quả trực quan"],
                    ["normalized", "Kết quả chuẩn hóa"],
                    ["raw", "Phản hồi gốc"],
                    ["metadata", "Metadata"],
                  ].map(([key, label]) => (
                    <button
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        tab === key
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                      key={key}
                      onClick={() => setTab(key as typeof tab)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {tab === "visual" ? (
                  <div className="mt-4">
                    <ArchivedOcrVisualResult
                      interactionType={detail.item.loai_tuong_tac}
                      result={detail.normalized_output}
                      taskSubtype={detail.item.task_subtype}
                    />
                  </div>
                ) : (
                  <pre className="mt-4 max-h-[40rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                    {asJson(
                      tab === "normalized"
                        ? detail.normalized_output
                        : tab === "raw"
                          ? detail.raw_output
                          : detail.interaction,
                    )}
                  </pre>
                )}
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface TrashBinPanelProps {
  onBack: () => void;
  onLogout: () => void;
}

function TrashBinPanel({ onBack, onLogout }: TrashBinPanelProps) {
  const [items, setItems] = useState<OcrTrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.trash_id));

  useEffect(() => {
    const controller = new AbortController();
    void getOcrTrash(page, PAGE_SIZE, controller.signal)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setTotalSize(data.total_size_bytes);
        if (page > 1 && data.items.length === 0 && data.total > 0) {
          setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Không thể tải thùng rác.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, refreshKey]);

  const reload = (preserveNotice = false) => {
    setError("");
    if (!preserveNotice) setNotice("");
    setLoading(true);
    setRefreshKey((current) => current + 1);
  };

  const toggleItem = (trashId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(trashId)) next.delete(trashId);
      else next.add(trashId);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        items.forEach((item) => next.delete(item.trash_id));
      } else {
        items.forEach((item) => next.add(item.trash_id));
      }
      return next;
    });
  };

  const purgeOne = async (item: OcrTrashItem) => {
    if (!window.confirm(`Xóa vĩnh viễn ${item.item.id}? Dữ liệu này không thể khôi phục.`)) return;
    setPurging(true);
    setError("");
    setNotice("");
    try {
      await purgeOcrTrash(item.trash_id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.trash_id);
        return next;
      });
      setNotice("Đã xóa vĩnh viễn 1 bản ghi và các tệp đi kèm.");
      reload(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa vĩnh viễn bản ghi.");
    } finally {
      setPurging(false);
    }
  };

  const purgeSelected = async () => {
    const trashIds = [...selectedIds];
    if (trashIds.length === 0) return;
    if (!window.confirm(`Xóa vĩnh viễn ${trashIds.length} bản ghi đã chọn? Thao tác này không thể khôi phục.`)) return;
    setPurging(true);
    setError("");
    setNotice("");
    try {
      const result = await purgeOcrTrashBulk(trashIds);
      setSelectedIds(new Set(result.failed.map((failure) => failure.id)));
      setNotice(
        result.failed.length === 0
          ? `Đã xóa vĩnh viễn ${result.deleted_ids.length} bản ghi.`
          : `Đã xóa ${result.deleted_ids.length} bản ghi; ${result.failed.length} bản ghi không thể xử lý.`,
      );
      reload(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa vĩnh viễn các bản ghi.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">OCR Admin</p>
            <h1 className="text-xl font-bold">Thùng rác OCR</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={onBack}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Lịch sử OCR
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={onLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Xóa vĩnh viễn không thể khôi phục.</p>
          <p className="mt-1 text-rose-800">Hãy kiểm tra kỹ trước khi xóa để giải phóng dung lượng archive.</p>
        </section>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <span>{error}</span>
            <button className="shrink-0 font-semibold underline" onClick={() => reload()} type="button">Thử lại</button>
          </div>
        )}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <section className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{total}</strong> bản ghi · {formatBytes(totalSize)}
            </p>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={purging}
                  onClick={() => void purgeSelected()}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Xóa vĩnh viễn ({selectedIds.size})
                </button>
              )}
              <button
                aria-label="Tải lại"
                className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
                onClick={() => reload()}
                type="button"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3"><input aria-label="Chọn tất cả bản ghi thùng rác trên trang" checked={allVisibleSelected} onChange={toggleVisible} type="checkbox" /></th>
                  <th className="px-4 py-3">Đã xóa lúc</th>
                  <th className="px-4 py-3">Bản ghi OCR</th>
                  <th className="px-4 py-3">Tệp</th>
                  <th className="px-4 py-3">Dung lượng</th>
                  <th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={6}><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải thùng rác…</td></tr>}
                {!loading && items.length === 0 && <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={6}>Thùng rác đang trống.</td></tr>}
                {!loading && items.map((entry) => (
                  <tr className="align-top hover:bg-slate-50" key={entry.trash_id}>
                    <td className="px-4 py-4"><input aria-label={`Chọn ${entry.item.id}`} checked={selectedIds.has(entry.trash_id)} onChange={() => toggleItem(entry.trash_id)} type="checkbox" /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700">{formatDate(entry.trashed_at)}</td>
                    <td className="px-4 py-4"><p className="font-medium text-slate-900">{interactionLabels[entry.item.loai_tuong_tac ?? ""] ?? entry.item.loai_tuong_tac ?? "Không rõ"}</p><p className="mt-1 text-xs text-slate-500">{entry.item.id} · tạo {formatDate(entry.item.created_at)}</p></td>
                    <td className="max-w-72 px-4 py-4"><p className="truncate font-medium text-slate-800" title={entry.item.files[0]?.original_name}>{entry.item.files[0]?.original_name ?? "Không có tệp"}</p><p className="mt-1 text-xs text-slate-500">{entry.item.file_count} tệp</p></td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{formatBytes(entry.size_bytes)}</td>
                    <td className="px-4 py-4"><button aria-label={`Xóa vĩnh viễn ${entry.item.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50" disabled={purging} onClick={() => void purgeOne(entry)} type="button"><Trash2 className="h-4 w-4" aria-hidden="true" />Xóa vĩnh viễn</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-sm text-slate-500">Trang {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button aria-label="Trang trước" className="rounded-lg border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft className="h-4 w-4" /></button>
              <button aria-label="Trang sau" className="rounded-lg border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const [draftFilters, setDraftFilters] = useState<OcrHistoryFilters>({});
  const [filters, setFilters] = useState<OcrHistoryFilters>({});
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [items, setItems] = useState<OcrHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  useEffect(() => {
    const controller = new AbortController();
    void getOcrHistory(filters, page, PAGE_SIZE, controller.signal)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        if (page > 1 && data.items.length === 0 && data.total > 0) {
          setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Không thể tải lịch sử OCR.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, page, refreshKey]);

  const selectedCount = selectedIds.size;
  const updateDraftFilter = <Key extends keyof OcrHistoryFilters>(
    key: Key,
    value: OcrHistoryFilters[Key] | "",
  ) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedIds(new Set());
    setPage(1);
    setFilters(draftFilters);
  };

  const reload = () => setRefreshKey((current) => current + 1);

  const toggleItem = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        items.forEach((item) => next.delete(item.id));
      } else {
        items.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const deleteOne = async (item: OcrHistoryItem) => {
    if (!window.confirm(`Chuyển lịch sử OCR ${item.id} vào thùng rác?`)) return;
    setDeleting(true);
    setNotice("");
    try {
      await trashOcrHistory(item.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setNotice("Đã chuyển 1 bản ghi vào thùng rác.");
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể chuyển bản ghi vào thùng rác.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Chuyển ${ids.length} bản ghi đã chọn vào thùng rác?`)) return;
    setDeleting(true);
    setNotice("");
    try {
      const result = await trashOcrHistoryBulk(ids);
      setSelectedIds(new Set(result.failed.map((failure) => failure.id)));
      setNotice(
        result.failed.length === 0
          ? `Đã chuyển ${result.moved_ids.length} bản ghi vào thùng rác.`
          : `Đã chuyển ${result.moved_ids.length} bản ghi; ${result.failed.length} bản ghi không thể xử lý.`,
      );
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể chuyển các bản ghi vào thùng rác.");
    } finally {
      setDeleting(false);
    }
  };

  if (showTrash) {
    return <TrashBinPanel onBack={() => setShowTrash(false)} onLogout={onLogout} />;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">OCR Admin</p>
            <h1 className="text-xl font-bold">Lịch sử OCR</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              onClick={() => setShowTrash(true)}
              type="button"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Thùng rác
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={onLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={applyFilters}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2">
              <span className="sr-only">Tìm theo ID hoặc tên tệp</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => updateDraftFilter("q", event.target.value)}
                  placeholder="Tìm ID hoặc tên tệp"
                  value={draftFilters.q ?? ""}
                />
              </div>
            </label>
            <select
              aria-label="Trạng thái"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              onChange={(event) => updateDraftFilter("status", event.target.value as OcrHistoryStatus)}
              value={draftFilters.status ?? ""}
            >
              <option value="">Tất cả trạng thái</option>
              {OCR_HISTORY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select
              aria-label="Loại OCR"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              onChange={(event) => updateDraftFilter("interaction_type", event.target.value as OcrHistoryFilters["interaction_type"])}
              value={draftFilters.interaction_type ?? ""}
            >
              <option value="">Tất cả loại OCR</option>
              {OCR_INTERACTION_TYPES.map((type) => <option key={type} value={type}>{interactionLabels[type]}</option>)}
            </select>
            <input
              aria-label="Subtype"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              onChange={(event) => updateDraftFilter("task_subtype", event.target.value)}
              placeholder="Subtype"
              value={draftFilters.task_subtype ?? ""}
            />
            <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700" type="submit">
              Lọc lịch sử
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:max-w-[34rem]">
            <label className="text-sm text-slate-600">
              Từ ngày
              <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => updateDraftFilter("from", event.target.value)} type="date" value={draftFilters.from ?? ""} />
            </label>
            <label className="text-sm text-slate-600">
              Đến ngày
              <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => updateDraftFilter("to", event.target.value)} type="date" value={draftFilters.to ?? ""} />
            </label>
          </div>
        </form>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <span>{error}</span>
            <button className="shrink-0 font-semibold underline" onClick={reload} type="button">Thử lại</button>
          </div>
        )}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <section className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-sm text-slate-600"><strong className="text-slate-900">{total}</strong> bản ghi</p>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleting}
                  onClick={() => void deleteSelected()}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Xóa đã chọn ({selectedCount})
                </button>
              )}
              <button
                aria-label="Tải lại"
                className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
                onClick={reload}
                type="button"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3"><input aria-label="Chọn tất cả bản ghi trên trang" checked={allVisibleSelected} onChange={toggleVisible} type="checkbox" /></th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Tệp</th>
                  <th className="px-4 py-3">Trạng thái</th>
                   <th className="px-4 py-3">Xét duyệt</th>
                   <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={8}><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải lịch sử…</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={8}>Chưa có bản ghi phù hợp.</td></tr>
                )}
                {!loading && items.map((item) => (
                  <tr className="align-top hover:bg-slate-50" key={item.id}>
                    <td className="px-4 py-4"><input aria-label={`Chọn ${item.id}`} checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} type="checkbox" /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-4"><p className="font-medium text-slate-900">{interactionLabels[item.loai_tuong_tac ?? ""] ?? item.loai_tuong_tac ?? "Không rõ"}</p><p className="mt-1 text-xs text-slate-500">{item.task_subtype ?? "—"}</p></td>
                    <td className="max-w-64 px-4 py-4"><p className="truncate font-medium text-slate-800" title={item.files[0]?.original_name}>{item.files[0]?.original_name ?? "Không có tệp"}</p><p className="mt-1 text-xs text-slate-500">{item.file_count} tệp · {item.id}</p>{item.parse_warning && <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700"><AlertCircle className="h-3 w-3" />{item.parse_warning}</p>}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[item.ocr_status]}`}>{item.ocr_status}</span>{item.error_code && <p className="mt-1 max-w-40 truncate text-xs text-red-600" title={item.error_code}>{item.error_code}</p>}</td>
                    <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${reviewClasses(item.user_confirmed)}`}>{reviewLabel(item.user_confirmed)}</span>{item.user_correction && <p className="mt-1 max-w-44 truncate text-xs text-red-700" title={item.user_correction}>{item.user_correction}</p>}</td>
                    <td className="px-4 py-4 text-slate-700">{item.confidence === null ? "—" : `${Math.round(item.confidence * 100)}%`}</td>
                    <td className="px-4 py-4"><div className="flex gap-1"><button aria-label={`Xem ${item.id}`} className="rounded-md p-2 text-indigo-600 hover:bg-indigo-50" onClick={() => setDetailId(item.id)} type="button"><Eye className="h-4 w-4" /></button><button aria-label={`Xóa ${item.id}`} className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={deleting} onClick={() => void deleteOne(item)} type="button"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-sm text-slate-500">Trang {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button aria-label="Trang trước" className="rounded-lg border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft className="h-4 w-4" /></button>
              <button aria-label="Trang sau" className="rounded-lg border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        </section>
      </div>
      {detailId && <HistoryDetailDialog id={detailId} key={detailId} onChanged={reload} onClose={() => setDetailId(null)} />}
    </main>
  );
}
