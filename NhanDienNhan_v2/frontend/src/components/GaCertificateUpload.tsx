import { useRef, useState } from "react";
import { FileText, Image, Upload, X } from "lucide-react";
import { CameraCapture } from "./CameraCapture";

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

interface GrowingAreaCertificateUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

interface FilePreview {
  file: File;
  previewUrl: string | null;
  type: "image" | "pdf";
}

export function GaCertificateUpload({
  onFilesSelected,
  isLoading = false,
}: GrowingAreaCertificateUploadProps) {
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emitFiles = (previews: FilePreview[]) => {
    setFilePreviews(previews);
    onFilesSelected(previews.map((preview) => preview.file));
  };

  const addFiles = (rawFiles: File[]) => {
    const invalidType = rawFiles.find(
      (file) => !ACCEPTED_FILE_TYPES.has(file.type),
    );
    if (invalidType) {
      setError("Chỉ hỗ trợ JPEG, PNG, GIF, WebP và PDF");
      return;
    }

    const oversizedFile = rawFiles.find(
      (file) => file.size > MAX_FILE_SIZE_BYTES,
    );
    if (oversizedFile) {
      setError(`File ${oversizedFile.name} vượt quá giới hạn 10 MB`);
      return;
    }

    if (rawFiles.length === 0) return;
    if (filePreviews.length + rawFiles.length > MAX_FILES) {
      setError(`Tối đa ${MAX_FILES} file cho một chứng nhận`);
      return;
    }

    const additions = rawFiles.map<FilePreview>((file) => ({
      file,
      previewUrl:
        file.type === "application/pdf" ? null : URL.createObjectURL(file),
      type: file.type === "application/pdf" ? "pdf" : "image",
    }));

    setError("");
    emitFiles([...filePreviews, ...additions]);
  };

  const removeFile = (index: number) => {
    const entry = filePreviews[index];
    if (!entry) return;
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    setError("");
    emitFiles(filePreviews.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-center text-sm text-teal-900">
        Tải toàn bộ trang của một Giấy xác nhận cấp mã số vùng trồng. Một
        chứng nhận có thể gồm một hoặc nhiều trang.
      </div>

      {error && (
        <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className={`rounded-2xl border p-4 shadow-sm transition-all sm:p-5 ${
          isDragOver
            ? "border-teal-400 bg-teal-50"
            : "border-teal-100 bg-gradient-to-br from-teal-50/80 to-white"
        } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragOver(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">Thêm giấy chứng nhận</p>
          <p className="mt-1 text-sm text-slate-500">
            Chụp, chọn file có sẵn hoặc kéo thả từng trang vào vùng này.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CameraCapture
            className="flex min-h-[132px] w-full flex-col items-start justify-center gap-2 rounded-2xl border border-teal-200 bg-white px-5 py-4 text-left text-base font-semibold text-teal-700 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || filePreviews.length >= MAX_FILES}
            description="Dùng camera của thiết bị"
            label="Chụp ảnh trực tiếp"
            onCapture={(file) => addFiles([file])}
          />
          <button
            className="flex min-h-[132px] w-full flex-col items-start justify-center gap-2 rounded-2xl border border-cyan-200 bg-white px-5 py-4 text-left text-base font-semibold text-cyan-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || filePreviews.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50">
              <Upload aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>Tải ảnh hoặc PDF</span>
            <span className="text-sm font-normal text-cyan-700/70">Chọn file có sẵn từ thiết bị</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          className="hidden"
          disabled={isLoading}
          multiple
          type="file"
          onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
        />
      </div>

      {filePreviews.length > 0 && (
        <div>
          <p className="mb-3 text-center text-sm font-semibold text-gray-900">
            File đã chọn ({filePreviews.length}/{MAX_FILES})
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filePreviews.map((entry, index) => (
              <div
                key={`${entry.file.name}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
              >
                {entry.type === "pdf" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-red-50 p-3">
                    <FileText className="h-10 w-10 text-red-500" />
                    <span className="break-all text-center text-[10px] font-medium leading-tight text-red-700">
                      {entry.file.name}
                    </span>
                    <span className="text-[9px] text-gray-500">PDF</span>
                  </div>
                ) : entry.previewUrl ? (
                  <img
                    alt={`Trang tải lên ${index + 1}`}
                    className="h-full w-full object-cover"
                    src={entry.previewUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Image className="h-10 w-10 text-gray-400" />
                  </div>
                )}
                <button
                  aria-label={`Xóa file ${entry.file.name}`}
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow transition-colors hover:bg-red-600"
                  disabled={isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFile(index);
                  }}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
