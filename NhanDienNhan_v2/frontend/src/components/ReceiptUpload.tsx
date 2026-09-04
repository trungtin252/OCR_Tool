import { useState, useRef } from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { CameraCapture } from "./CameraCapture";

const MAX_FILES = 10;

interface SampleReceipt {
  name: string;
  path: string;
  type: "image" | "pdf";
}

const SAMPLE_RECEIPTS: SampleReceipt[] = [
  { name: "hoa_don_nguyet_phat.jpg", path: "/sample-receipts/hoa_don_nguyet_phat.jpg", type: "image" },
  { name: "hoa_don_de_heus_1.jpg", path: "/sample-receipts/hoa_don_de_heus_1.jpg", type: "image" },
  { name: "hoa_don_de_heus_2.jpg", path: "/sample-receipts/hoa_don_de_heus_2.jpg", type: "image" },
  // { name: "HD 251 ĐỒNG TÂM HG 03.06 400.000.000đ.pdf", path: "/sample-receipts/HD 251 ĐỒNG TÂM HG 03.06 400.000.000đ.pdf", type: "pdf" },
  { name: "HD 159 ĐỒNG TÂM HG 250.244.075đ 08.04.pdf", path: "/sample-receipts/HD 159 ĐỒNG TÂM HG 250.244.075đ 08.04.pdf", type: "pdf"}
];

interface ReceiptUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

interface FilePreview {
  file: File;
  previewUrl: string | null; // null for PDFs
  type: "image" | "pdf";
}

export function ReceiptUpload({
  onFilesSelected,
  isLoading = false,
}: ReceiptUploadProps) {
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newRawFiles: File[]) => {
    const valid = newRawFiles.filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );

    if (valid.length === 0) {
      setError("Vui lòng chọn file ảnh (JPG, PNG, WebP) hoặc file PDF");
      return;
    }

    if (filePreviews.length + valid.length > MAX_FILES) {
      setError(
        `Tối đa ${MAX_FILES} file. Hiện có ${filePreviews.length}, thêm ${valid.length} sẽ vượt quá giới hạn.`,
      );
      return;
    }

    setError("");

    const newEntries: FilePreview[] = valid.map((file) => ({
      file,
      previewUrl: null,
      type: file.type === "application/pdf" ? "pdf" : "image",
    }));

    // Generate object URLs for images
    newEntries.forEach((entry) => {
      if (entry.type === "image") {
        entry.previewUrl = URL.createObjectURL(entry.file);
      }
    });

    const updated = [...filePreviews, ...newEntries];
    setFilePreviews(updated);
    onFilesSelected(updated.map((e) => e.file));
  };

  const handleFileInput = (files: FileList | null) => {
    if (!files) return;
    addFiles(Array.from(files));
  };

  const addSampleFile = async (sample: SampleReceipt) => {
    if (filePreviews.length >= MAX_FILES) {
      setError(`Tối đa ${MAX_FILES} file.`);
      return;
    }
    if (filePreviews.some((p) => p.file.name === sample.name)) {
      setError("File mẫu đã được thêm");
      return;
    }
    try {
      const res = await fetch(sample.path);
      if (!res.ok) {
        setError("Không thể tải file mẫu");
        return;
      }
      const blob = await res.blob();
      const mimeType = sample.type === "pdf" ? "application/pdf" : blob.type;
      const file = new File([blob], sample.name, { type: mimeType });
      setError("");
      addFiles([file]);
    } catch {
      setError("Không thể tải file mẫu");
    }
  };

  const removeFile = (index: number) => {
    const entry = filePreviews[index];
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    const updated = filePreviews.filter((_, i) => i !== index);
    setFilePreviews(updated);
    onFilesSelected(updated.map((e) => e.file));
    setError("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const remaining = MAX_FILES - filePreviews.length;

  return (
    <div className="space-y-5">
      {/* Hint */}
      <div className="text-center text-sm text-gray-500">
        Tải lên ảnh hoặc PDF chứa phiếu xuất kho, phiếu giao hàng hoặc hoá đơn bán hàng.
        Hệ thống sẽ tự động nhận diện và trích xuất thông tin.
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={`rounded-2xl border p-4 shadow-sm transition-all sm:p-5 ${
          isDragOver
            ? "border-amber-400 bg-amber-50"
            : "border-amber-100 bg-gradient-to-br from-amber-50/80 to-white"
        } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">Thêm chứng từ</p>
          <p className="mt-1 text-sm text-slate-500">
            Chụp chứng từ, chọn file có sẵn hoặc kéo thả vào vùng này.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CameraCapture
            className="flex min-h-[132px] w-full flex-col items-start justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-4 text-left text-base font-semibold text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || filePreviews.length >= MAX_FILES}
            description="Dùng camera của thiết bị"
            label="Chụp ảnh trực tiếp"
            onCapture={(file) => addFiles([file])}
          />
          <button
            className="flex min-h-[132px] w-full flex-col items-start justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 py-4 text-left text-base font-semibold text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || filePreviews.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Upload aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>Tải ảnh hoặc PDF</span>
            <span className="text-sm font-normal text-orange-700/70">Chọn file có sẵn từ thiết bị</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => handleFileInput(e.target.files)}
          className="hidden"
          disabled={isLoading}
        />
      </div>

      {/* File counter */}
      {filePreviews.length > 0 && (
        <div className="text-center text-xs text-gray-500">
          {filePreviews.length}/{MAX_FILES} file đã chọn
          {remaining <= 3 && remaining > 0 && (
            <span className="ml-2 text-amber-600 font-semibold">
              (còn {remaining} slot)
            </span>
          )}
          {remaining === 0 && (
            <span className="ml-2 text-red-600 font-semibold">(đã đầy)</span>
          )}
        </div>
      )}

      {/* Selected file previews */}
      {filePreviews.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 text-center">
            File đã tải lên
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filePreviews.map((entry, index) => (
              <div
                key={index}
                className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square border border-gray-200"
              >
                {entry.type === "pdf" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-1 p-2">
                    <FileText className="h-10 w-10 text-red-500" />
                    <span className="text-[10px] text-center text-red-700 font-medium leading-tight break-all px-1">
                      {entry.file.name}
                    </span>
                    <span className="text-[9px] text-gray-400">PDF</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {entry.previewUrl ? (
                      <img
                        src={entry.previewUrl}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  disabled={isLoading}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample files */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          File mẫu (bấm để thêm)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLE_RECEIPTS.map((sample) => (
            <button
              key={sample.name}
              onClick={() => addSampleFile(sample)}
              disabled={isLoading || filePreviews.some((p) => p.file.name === sample.name)}
              className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square border-2 border-transparent hover:border-amber-400 hover:ring-2 hover:ring-amber-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sample.type === "pdf" ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-1 p-2">
                  <FileText className="h-8 w-8 text-red-400" />
                  <span className="text-[9px] text-center text-red-600 font-medium leading-tight break-all px-1">
                    {sample.name}
                  </span>
                </div>
              ) : (
                <img
                  src={sample.path}
                  alt={sample.name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
