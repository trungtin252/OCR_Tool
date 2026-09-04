import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

function cameraFileName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `camera-${timestamp}.jpg`;
}

export function CameraCapture({
  onCapture,
  disabled = false,
  className,
  label = "Chụp ảnh",
  description,
}: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isActive = true;
    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Trình duyệt này không hỗ trợ chụp ảnh bằng camera.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (isActive) {
          setError(
            "Không thể mở camera. Hãy cấp quyền camera rồi thử lại.",
          );
        }
      }
    };

    void startCamera();

    return () => {
      isActive = false;
      stopStream();
    };
  }, [isOpen]);

  const closeCamera = () => {
    setIsOpen(false);
    setError("");
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera chưa sẵn sàng. Hãy đợi vài giây rồi chụp lại.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Không thể tạo ảnh từ camera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Không thể tạo ảnh từ camera.");
          return;
        }

        onCapture(new File([blob], cameraFileName(), { type: "image/jpeg" }));
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <>
      <button
        className={
          className ??
          "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        }
        disabled={disabled}
        onClick={() => {
          setError("");
          setIsOpen(true);
        }}
        type="button"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-current/10">
          <Camera aria-hidden="true" className="h-5 w-5" />
        </span>
        <span>{label}</span>
        {description && <span className="text-sm font-normal opacity-70">{description}</span>}
      </button>

      {isOpen && (
        <div
          aria-label="Đóng camera"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={closeCamera}
          role="presentation"
        >
          <section
            aria-modal="true"
            aria-label="Chụp ảnh bằng camera"
            className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Chụp ảnh</h2>
                <p className="text-sm text-slate-500">
                  Hướng camera vào tài liệu hoặc nhãn cần nhận diện.
                </p>
              </div>
              <button
                aria-label="Đóng camera"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={closeCamera}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                autoPlay
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
                ref={videoRef}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={closeCamera}
                type="button"
              >
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(error)}
                onClick={takePhoto}
                type="button"
              >
                <Camera aria-hidden="true" className="h-4 w-4" />
                Chụp và dùng ảnh
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
