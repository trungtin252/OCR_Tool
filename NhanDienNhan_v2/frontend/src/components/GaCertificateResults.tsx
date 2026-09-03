import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import type {
  GrowingAreaCertificateApiResponse,
  GrowingAreaCertificateData,
  UploadedFileReference,
} from "../apis/gaCertificateApi";
import { ImageGallery } from "./ResultShared";

interface GrowingAreaCertificateResultsProps {
  response: GrowingAreaCertificateApiResponse;
  files: File[];
  onReset: () => void;
}

function displayValue(value: string | number | null): string {
  return value == null ? "Không có dữ liệu" : String(value);
}

function InfoGrid({
  fields,
}: {
  fields: Array<{ label: string; value: string | number | null }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-lg border border-teal-100 bg-teal-50 p-3"
        >
          <p className="text-xs font-semibold uppercase text-teal-700">
            {field.label}
          </p>
          <p
            className={`mt-1 break-words text-sm font-medium ${
              field.value == null ? "italic text-gray-400" : "text-gray-900"
            }`}
          >
            {displayValue(field.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function FileList({ files }: { files: UploadedFileReference[] }) {
  if (files.length === 0) {
    return <p className="text-sm italic text-gray-400">Chưa có file</p>;
  }

  return (
    <ul className="space-y-2 text-sm text-gray-700">
      {files.map((file, index) => (
        <li
          key={`${file.file_name}-${index}`}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <p className="break-all font-medium text-gray-900">
            {file.file_name}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {file.mime_type} · {(file.size_bytes / 1024).toFixed(1)} KB
          </p>
        </li>
      ))}
    </ul>
  );
}

function CertificateData({ data }: { data: GrowingAreaCertificateData }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 border-b pb-2 text-sm font-bold uppercase text-gray-900">
          Thông tin chứng nhận
        </h2>
        <InfoGrid
          fields={[
            { label: "Số chứng nhận", value: data.certificate_number },
            { label: "Ngày cấp", value: data.issue_date },
            { label: "Ngày hết hiệu lực", value: data.expiry_date },
            { label: "Cơ quan/đơn vị cấp", value: data.issuing_authority },
            { label: "Ghi chú phạm vi áp dụng", value: data.scope_note },
            {
              label: "Sản lượng được chứng nhận",
              value: data.certified_production,
            },
            {
              label: "Đơn vị sản lượng chứng nhận",
              value: data.certified_production_unit,
            },
          ]}
        />
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-700">
            Hình/file chứng nhận
          </p>
          <FileList files={data.certificate_files} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 border-b pb-2 text-sm font-bold uppercase text-gray-900">
          Vùng trồng
        </h2>
        <InfoGrid
          fields={[
            {
              label: "Đơn vị quản lý vùng trồng",
              value: data.growing_area_management_unit,
            },
            { label: "Mã vùng trồng", value: data.growing_area_code },
            { label: "Tên vùng trồng", value: data.growing_area_name },
            {
              label: "Tổng diện tích vùng trồng (ha)",
              value: data.total_area_ha,
            },
            {
              label: "Địa chỉ hành chính của vùng trồng",
              value: data.growing_area_administrative_address,
            },
            { label: "Ghi chú", value: data.note },
          ]}
        />

        <div className="mt-4 overflow-x-auto rounded-lg border border-teal-100">
          <p className="border-b border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold uppercase text-teal-800">
            Ranh giới tổng thể vùng trồng
          </p>
          {data.overall_boundary.length === 0 ? (
            <p className="p-3 text-sm italic text-gray-400">
              Không có dữ liệu tọa độ
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-teal-50 text-left text-xs text-teal-800">
                  <th className="border border-teal-100 px-3 py-2">Điểm</th>
                  <th className="border border-teal-100 px-3 py-2">Vĩ độ</th>
                  <th className="border border-teal-100 px-3 py-2">Kinh độ</th>
                </tr>
              </thead>
              <tbody>
                {data.overall_boundary.map((point, index) => (
                  <tr key={`${point.point_label}-${index}`}>
                    <td className="border border-teal-100 px-3 py-2">
                      {displayValue(point.point_label)}
                    </td>
                    <td className="border border-teal-100 px-3 py-2">
                      {displayValue(point.latitude)}
                    </td>
                    <td className="border border-teal-100 px-3 py-2">
                      {displayValue(point.longitude)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-700">
            Hình ảnh vùng trồng
          </p>
          <FileList files={data.growing_area_images} />
          {data.growing_area_images.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Ảnh thực địa cần được tải lên bằng luồng quản lý vùng trồng.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 border-b pb-2 text-sm font-bold uppercase text-gray-900">
          Chi tiết địa chỉ
        </h2>
        <InfoGrid
          fields={[
            { label: "Số nhà", value: data.address.house_number },
            { label: "Tên đường", value: data.address.street_name },
            { label: "Tổ / tổ dân phố", value: data.address.neighborhood },
            {
              label: "Ấp / khu vực / khóm / thôn",
              value: data.address.hamlet_or_equivalent,
            },
            {
              label: "Mã đơn vị hành chính cấp xã",
              value: data.address.commune_code,
            },
            {
              label: "Xã / Phường / Đặc khu",
              value: data.address.commune_name,
            },
            {
              label: "Mã đơn vị hành chính cấp huyện cũ",
              value: data.address.former_district_code,
            },
            {
              label: "Huyện / Quận / Thị xã / Thành phố thuộc tỉnh",
              value: data.address.former_district_name,
            },
            {
              label: "Mã tỉnh / thành phố trực thuộc Trung ương",
              value: data.address.province_code,
            },
            {
              label: "Tỉnh / Thành phố trực thuộc Trung ương",
              value: data.address.province_name,
            },
            {
              label: "Địa chỉ đầy đủ dùng để hiển thị",
              value: data.address.full_display_address,
            },
            {
              label: "Ghi chú / chỉ dẫn thêm cho địa chỉ",
              value: data.address.address_notes,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function GaCertificateResults({
  response,
  files,
  onReset,
}: GrowingAreaCertificateResultsProps) {
  const responseData = response.data;
  if (!responseData) return null;
  const ocrResponse = responseData.response;
  const warnings = ocrResponse.metadata.review_warnings;

  return (
    <div className="space-y-6">
      <ImageGallery images={files} accentColor="emerald" />

      <div
        className={`rounded-xl border p-4 ${
          ocrResponse.success
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-start gap-3">
          {ocrResponse.success ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          <div>
            <p className="font-semibold text-gray-900">
              {ocrResponse.success
                ? "Đã trích xuất chứng nhận vùng trồng"
                : "Không thể trích xuất chứng nhận"}
            </p>
            <p className="mt-1 text-sm text-gray-700">{ocrResponse.message}</p>
            {!ocrResponse.success && (
              <p className="mt-1 text-xs font-medium text-red-700">
                Mã lỗi: {ocrResponse.error_code}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">Trang nhận</p>
          <p className="mt-1 font-bold text-gray-900">
            {ocrResponse.metadata.page_count_received}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">Trang đã xử lý</p>
          <p className="mt-1 font-bold text-gray-900">
            {responseData.totalImages}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">Cần xem lại</p>
          <p className="mt-1 font-bold text-gray-900">
            {ocrResponse.metadata.review_required ? "Có" : "Không"}
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Cảnh báo cần kiểm tra ({warnings.length})
          </h2>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${warning.field_path}-${index}`}
                className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-amber-950"
              >
                <p className="font-semibold">{warning.code}</p>
                <p className="mt-1">{warning.message}</p>
                {(warning.field_path || warning.page_index) && (
                  <p className="mt-1 text-xs text-amber-700">
                    {warning.field_path ?? "Toàn bộ tài liệu"}
                    {warning.page_index ? ` · Trang ${warning.page_index}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ocrResponse.success && <CertificateData data={ocrResponse.data} />}

      <details className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Xem JSON OCR gốc
        </summary>
        <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(ocrResponse, null, 2)}
        </pre>
      </details>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-teal-600 to-cyan-700 py-3 font-semibold text-white transition-shadow hover:shadow-lg"
        onClick={onReset}
        type="button"
      >
        <RotateCcw className="h-4 w-4" />
        Tải chứng nhận khác
      </button>
    </div>
  );
}
