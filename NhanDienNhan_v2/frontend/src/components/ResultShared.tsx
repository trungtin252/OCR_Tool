import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { ProductInfo, ReviewWarning } from "../apis/imageApi";
import { getFieldWarning } from "../apis/imageApi";
import { Document, Page, pdfjs } from "react-pdf";

// Configure pdfjs worker via CDN — works out of the box with Vite
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Types ──────────────────────────────────────────────────

export interface FieldDisplay {
  label: string;
  key: string;
  icon?: string;
  value?: any;
  isEmpty: boolean;
  warning?: any;
}

type AccentColor = "purple" | "blue" | "emerald";

const ACCENT_CLASSES: Record<
  AccentColor,
  {
    border: string;
    gradient: string;
    fieldBg: string;
    fieldBorder: string;
    fieldLabel: string;
  }
> = {
  purple: {
    border: "border-purple-400",
    gradient: "from-purple-600 to-purple-700",
    fieldBg: "bg-blue-50",
    fieldBorder: "border-blue-200",
    fieldLabel: "text-purple-600",
  },
  blue: {
    border: "border-blue-400",
    gradient: "from-blue-600 to-blue-700",
    fieldBg: "bg-blue-50",
    fieldBorder: "border-blue-200",
    fieldLabel: "text-blue-600",
  },
  emerald: {
    border: "border-emerald-400",
    gradient: "from-emerald-600 to-emerald-700",
    fieldBg: "bg-emerald-50",
    fieldBorder: "border-emerald-200",
    fieldLabel: "text-emerald-600",
  },
};

// ─── ImageGallery ───────────────────────────────────────────

interface ImageGalleryProps {
  images: File[];
  accentColor: AccentColor;
}

export function ImageGallery({ images, accentColor }: ImageGalleryProps) {
  const [selectedImgIndex, setSelectedImgIndex] = useState<number | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [numPages, setNumPages] = useState<number | null>(null);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setImageUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  // Reset page count when switching files
  useEffect(() => {
    setNumPages(null);
  }, [selectedImgIndex]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const colors = ACCENT_CLASSES[accentColor];

  const selectedFile = selectedImgIndex !== null ? images[selectedImgIndex] : null;
  const isPdf = selectedFile
    ? selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf")
    : false;

  return (
    <>
      <div className={`border-b-2 ${colors.border} pb-6 text-center`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          📷 File đã tải lên ({images.length}){" "}
          <span className="text-xs font-normal text-gray-400">
            — bấm để xem chi tiết
          </span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((file, index) => {
            const url = imageUrls[index];
            const fileIsPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            return (
              <div
                key={index}
                onClick={() => url && setSelectedImgIndex(index)}
                className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square cursor-pointer hover:ring-2 hover:ring-purple-500 hover:scale-[1.02] transition-all flex items-center justify-center border border-gray-200"
              >
                {fileIsPdf ? (
                  <div className="flex flex-col items-center justify-center p-4 bg-red-50 text-red-700 w-full h-full gap-2">
                    <FileText className="h-10 w-10 text-red-500" />
                    <span className="text-xs font-semibold text-center line-clamp-2 break-all px-1 leading-tight">
                      {file.name}
                    </span>
                    <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-800 font-medium">
                      PDF
                    </span>
                  </div>
                ) : (
                  url && (
                    <img
                      src={url}
                      alt={`Uploaded ${index + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Viewer Modal ── */}
      {selectedImgIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex flex-col p-4 md:p-6"
          style={{ backdropFilter: "blur(4px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between text-white mb-3 shrink-0">
            <div>
              <h3 className="text-base font-bold">
                {isPdf ? "Xem tài liệu PDF" : "So sánh & Kiểm tra ảnh"}
              </h3>
              <p className="text-xs text-gray-400">
                {isPdf
                  ? numPages
                    ? `${numPages} trang — cuộn để xem toàn bộ`
                    : "Đang tải..."
                  : "Cuộn / chụm ngón tay để phóng to • Kéo để di chuyển"}
              </p>
            </div>
            <button
              onClick={() => setSelectedImgIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 relative overflow-hidden bg-neutral-950 rounded-xl min-h-0">
            {isPdf ? (
              /* ── PDF: all pages stacked, native scroll (Google Drive style) ── */
              <div className="w-full h-full overflow-y-auto overflow-x-auto py-6">
                <Document
                  file={selectedFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="text-gray-400 flex items-center justify-center h-64 text-sm font-medium">
                      Đang tải tài liệu...
                    </div>
                  }
                  error={
                    <div className="text-red-400 flex items-center justify-center h-64 text-sm font-medium">
                      Không thể tải tài liệu PDF
                    </div>
                  }
                  className="flex flex-col items-center gap-4"
                >
                  {numPages &&
                    Array.from({ length: numPages }, (_, i) => (
                      <div
                        key={i}
                        className="bg-white shadow-2xl rounded"
                        style={{ width: "fit-content" }}
                      >
                        <Page
                          pageNumber={i + 1}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          width={Math.min(window.innerWidth - 48, 800)}
                        />
                      </div>
                    ))}
                </Document>
              </div>
            ) : (
              /* ── Image: zoom/pan ── */
              <TransformWrapper
                key={selectedImgIndex}
                initialScale={1}
                minScale={0.3}
                maxScale={10}
                centerOnInit
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    {/* Controls */}
                    <div className="absolute top-3 left-3 flex gap-2 z-10 items-center">
                      <button
                        onClick={() => zoomIn()}
                        className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/10 transition-colors"
                        title="Phóng to"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => zoomOut()}
                        className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/10 transition-colors"
                        title="Thu nhỏ"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => resetTransform()}
                        className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/10 transition-colors"
                        title="Đặt lại"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>

                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {imageUrls[selectedImgIndex] && (
                        <img
                          src={imageUrls[selectedImgIndex]}
                          alt={`Zoomed ${selectedImgIndex + 1}`}
                          style={{
                            maxHeight: "100%",
                            maxWidth: "100%",
                            objectFit: "contain",
                          }}
                          className="cursor-grab active:cursor-grabbing"
                        />
                      )}
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex justify-center gap-3 mt-3 overflow-x-auto py-1 shrink-0">
              {images.map((file, idx) => {
                const url = imageUrls[idx];
                const fileIsPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                return (
                  <button
                    key={idx}
                    onClick={() => url && setSelectedImgIndex(idx)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      selectedImgIndex === idx
                        ? "border-purple-500 scale-110 shadow-lg shadow-purple-500/40"
                        : "border-transparent opacity-50 hover:opacity-90 hover:scale-105"
                    }`}
                  >
                    {fileIsPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-700 p-1 border border-red-200">
                        <FileText className="h-6 w-6 text-red-500" />
                        <span className="text-[8px] font-bold truncate max-w-full px-0.5">PDF</span>
                      </div>
                    ) : (
                      url && (
                        <img
                          src={url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}



// ─── ErrorState ─────────────────────────────────────────────

interface ErrorStateProps {
  data: ProductInfo;
  images: File[];
  accentColor: AccentColor;
  onReset: () => void;
}

export function ErrorState({
  data,
  images,
  accentColor,
  onReset,
}: ErrorStateProps) {
  const colors = ACCENT_CLASSES[accentColor];
  return (
    <div className="space-y-6">
      <ImageGallery images={images} accentColor={accentColor} />

      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-16 w-16 text-orange-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Không thể trích xuất thông tin
        </h2>
        <p className="text-gray-600 mb-4">{data.message}</p>
        {data.error_code && data.error_code !== "NONE" && (
          <p className="text-sm text-gray-500 mb-6">
            Mã lỗi: {data.error_code}
          </p>
        )}
      </div>

      <button
        onClick={onReset}
        className={`w-full py-3 bg-linear-to-r ${colors.gradient} text-white rounded-lg font-semibold hover:shadow-lg transition-shadow`}
      >
        ↺ Tải lên ảnh mới
      </button>
    </div>
  );
}

// ─── FieldsGrid ─────────────────────────────────────────────

interface FieldsGridProps {
  fields: FieldDisplay[];
  accentColor: AccentColor;
}

export function FieldsGrid({ fields, accentColor }: FieldsGridProps) {
  const colors = ACCENT_CLASSES[accentColor];
  return (
    <div className={`border-b-2 border-${accentColor}-600 pb-6`}>
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b text-center">
        ℹ️ Thông tin sản phẩm
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => {
          const hasWarning = field.warning !== undefined;
          const isOrange = field.isEmpty || hasWarning;

          return (
            <div
              key={field.key}
              className={`rounded-lg p-3 ${isOrange ? "bg-orange-50 border border-orange-200" : `${colors.fieldBg} border ${colors.fieldBorder}`}`}
            >
              {hasWarning && (
                <div className="mb-2 pb-2 border-b border-orange-200">
                  <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {field.warning.issue}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {field.warning.message}
                  </p>
                </div>
              )}

              <p
                className={`text-xs font-semibold uppercase ${isOrange ? "text-orange-700" : colors.fieldLabel}`}
              >
                {field.label}
              </p>

              <p
                className={`text-sm font-medium mt-1 ${
                  field.isEmpty
                    ? isOrange
                      ? "text-orange-500 italic"
                      : "text-gray-400 italic"
                    : "text-gray-900"
                }`}
              >
                {field.isEmpty ? "Không có dữ liệu" : field.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DataSection ────────────────────────────────────────────

interface DataSectionProps {
  title: string;
  icon: string;
  fieldKey: string;
  data: ProductInfo;
  hasData: boolean;
  children: React.ReactNode;
}

/**
 * Renders a data section. If hasData is false, shows an orange "no data" box instead.
 */
export function DataSection({
  title,
  icon,
  fieldKey,
  data,
  hasData,
  children,
}: DataSectionProps) {
  const warning = getFieldWarning(data, fieldKey);

  if (!hasData) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
          <div>
            <p className="text-xs font-semibold uppercase text-orange-700">
              {icon} {title}
            </p>
            <p className="text-sm text-orange-700 mt-1">Không có dữ liệu</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-bold uppercase text-gray-900 mb-3 pb-2 border-b">
        {icon} {title}
      </h2>
      {warning && (
        <div className="mb-3 pb-3 border-b border-orange-200">
          <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {warning.issue}
          </p>
          <p className="text-xs text-orange-600 mt-1">{warning.message}</p>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── QualityWarnings ────────────────────────────────────────

interface QualityWarningsProps {
  warnings: ReviewWarning[];
}

export function QualityWarnings({ warnings }: QualityWarningsProps) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-bold uppercase text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Tóm tắt cảnh báo chất lượng
      </h2>
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <div
            key={index}
            className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700">
                  {warning.field_path}
                </p>
                <p className="text-xs text-amber-600 mt-1">{warning.issue}</p>
                <p className="text-sm text-gray-700 mt-1">{warning.message}</p>
              </div>
              {warning.confidence !== undefined && (
                <span className="ml-3 text-xs font-bold text-amber-700">
                  {(warning.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ExportJsonModal ────────────────────────────────────────

interface ExportJsonModalProps {
  data: any;
  onClose: () => void;
  accentColor: AccentColor;
}

export function ExportJsonModal({
  data,
  onClose,
  accentColor,
}: ExportJsonModalProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Không thể sao chép dữ liệu", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fileName = data?.product_name
      ? `${data.product_name.toLowerCase().replace(/[^a-z0-9\u00C0-\u1EF9]+/g, "_")}_export.json`
      : "export.json";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const colors = ACCENT_CLASSES[accentColor];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-100 transition-all duration-300">
        {/* Header */}
        <div className={`p-4 flex items-center justify-between bg-linear-to-r ${colors.gradient} text-white`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="text-base font-bold text-white">Xuất dữ liệu JSON</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50">
          <p className="text-xs text-gray-500 mb-3">
            Dữ liệu kết quả phân tích dạng cấu trúc JSON:
          </p>
          <div className="flex-1 min-h-0 relative flex flex-col">
            <pre className="w-full max-h-[50vh] overflow-auto p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono text-xs leading-relaxed select-all">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Sao chép</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className={`px-4 py-2 bg-linear-to-r ${colors.gradient} text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:shadow-md transition-all cursor-pointer`}
          >
            <Download className="h-4 w-4" />
            <span>Tải xuống (.json)</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium text-sm transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ResultFooter ───────────────────────────────────────────

interface ResultFooterProps {
  confidence?: number; // 0-100 scale
  accentColor: AccentColor;
  onReset: () => void;
  jsonData?: any;
}

export function ResultFooter({
  confidence,
  accentColor,
  onReset,
  jsonData,
}: ResultFooterProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const colors = ACCENT_CLASSES[accentColor];

  return (
    <>
      {confidence !== undefined && (
        <div className="flex items-center gap-2 pt-4 border-t">
          <CheckCircle2
            className={`h-5 w-5 ${confidence >= 80 ? "text-green-600" : "text-amber-600"}`}
          />
          <span
            className={`text-sm font-semibold ${confidence >= 80 ? "text-green-700" : "text-amber-700"}`}
          >
            Độ tin cậy: {confidence.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <button
          onClick={onReset}
          className={`flex-1 py-3 bg-linear-to-r ${colors.gradient} text-white rounded-lg font-semibold hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer`}
        >
          ↺ Tải lên ảnh mới
        </button>
        {jsonData && (
          <button
            onClick={() => setIsExportOpen(true)}
            className="flex-1 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer animate-fade-in"
          >
            <FileText className="h-4 w-4" />
            Xuất dữ liệu JSON
          </button>
        )}
      </div>

      {isExportOpen && jsonData && (
        <ExportJsonModal
          data={jsonData}
          onClose={() => setIsExportOpen(false)}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
