import { AlertTriangle, CheckCircle2, FileSearch } from "lucide-react";

type JsonRecord = Record<string, unknown>;

interface ArchivedOcrVisualResultProps {
  interactionType: string | null;
  taskSubtype: string | null;
  result: unknown;
}

interface DisplayField {
  label: string;
  value: unknown;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Chưa có dữ liệu";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Có dữ liệu";
}

function FieldGrid({ fields, accent = "indigo" }: { fields: DisplayField[]; accent?: "indigo" | "amber" | "teal" }) {
  const palette = {
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
  }[accent];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div className={`rounded-lg border p-3 ${palette}`} key={field.label}>
          <p className="text-xs font-semibold uppercase tracking-wide">{field.label}</p>
          <p className="mt-1 break-words text-sm font-medium text-slate-900">{displayValue(field.value)}</p>
        </div>
      ))}
    </div>
  );
}

function ObjectTable({ rows }: { rows: JsonRecord[] }) {
  if (rows.length === 0) return null;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>{columns.map((column) => <th className="px-3 py-2" key={column}>{column.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr className={index % 2 === 0 ? "bg-white" : "bg-slate-50"} key={index}>
              {columns.map((column) => <td className="max-w-60 px-3 py-2 align-top text-slate-700" key={column}>{displayValue(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBanner({ result }: { result: JsonRecord }) {
  const succeeded = result.success === true;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${succeeded ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      {succeeded ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
      <div>
        <p className="font-semibold text-slate-900">{succeeded ? "Kết quả OCR đã trích xuất" : "OCR không thể hoàn tất"}</p>
        <p className="mt-1 text-sm text-slate-700">{displayValue(result.message)}</p>
      </div>
    </div>
  );
}

function ProductVisual({ result, subtype }: { result: JsonRecord; subtype: string | null }) {
  const data = asRecord(result.data) ?? result;
  const fieldsBySubtype: Record<string, DisplayField[]> = {
    pesticide: [
      { label: "Tên sản phẩm", value: data.product_name },
      { label: "Loại", value: data.product_type },
      { label: "Nhà sản xuất", value: data.registrant },
      { label: "Số đăng ký", value: data.registration_number },
      { label: "Khối lượng", value: data.net_content },
      { label: "Ngày sản xuất", value: data.mfg_date },
      { label: "Hạn sử dụng", value: data.exp_date },
    ],
    fertilizer: [
      { label: "Tên sản phẩm", value: data.product_name },
      { label: "Loại phân bón", value: data.product_type },
      { label: "Nhà sản xuất", value: data.registrant },
      { label: "Số đăng ký", value: data.registration_number },
      { label: "Khối lượng", value: data.net_content },
      { label: "Ngày sản xuất", value: data.mfg_date },
      { label: "Hạn sử dụng", value: data.exp_date },
    ],
    fish_feed: [
      { label: "Tên sản phẩm", value: data.product_name },
      { label: "Mã biến thể", value: data.variant_code },
      { label: "Loài cá", value: data.species },
      { label: "Nhà sản xuất", value: data.registrant },
      { label: "Khối lượng", value: data.net_content },
      { label: "Ngày sản xuất", value: data.mfg_date },
      { label: "Hạn sử dụng", value: data.exp_date },
    ],
    seed: [
      { label: "Tên giống", value: data.product_name },
      { label: "Nhà sản xuất", value: data.manufacturer },
      { label: "Xuất xứ", value: data.origin },
      { label: "Số lô", value: data.lot_number },
      { label: "Khối lượng", value: data.net_content },
      { label: "Ngày sản xuất", value: data.mfg_date },
      { label: "Hạn sử dụng", value: data.exp_date },
    ],
  };
  const tableRows = asArray(data.ingredients).map(asRecord).filter((row): row is JsonRecord => row !== null);
  const nutritionRows = asArray(data.nutrition_facts).map(asRecord).filter((row): row is JsonRecord => row !== null);

  return (
    <div className="space-y-5">
      <FieldGrid fields={fieldsBySubtype[subtype ?? ""] ?? fieldsBySubtype.pesticide} />
      {typeof data.ingredients === "string" && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold text-amber-900">Thành phần</h4><p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{data.ingredients}</p></section>}
      {tableRows.length > 0 && <section><h4 className="mb-2 font-semibold text-slate-900">Thành phần</h4><ObjectTable rows={tableRows} /></section>}
      {nutritionRows.length > 0 && <section><h4 className="mb-2 font-semibold text-slate-900">Dinh dưỡng</h4><ObjectTable rows={nutritionRows} /></section>}
    </div>
  );
}

function ReceiptVisual({ result }: { result: JsonRecord }) {
  const data = asRecord(result.data);
  const documents = asArray(data?.documents).map(asRecord).filter((document): document is JsonRecord => document !== null);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <FileSearch className="h-5 w-5 text-amber-700" />
        <p className="font-semibold text-slate-900">Tìm thấy {displayValue(data?.document_count ?? documents.length)} chứng từ</p>
      </div>
      {documents.map((document, index) => {
        const items = asArray(document.items).map(asRecord).filter((item): item is JsonRecord => item !== null);
        return (
          <section className="rounded-xl border border-slate-200 p-4" key={index}>
            <h4 className="mb-3 font-bold text-slate-900">{document.document_type === "invoice" ? "Hóa đơn" : "Phiếu giao hàng"} #{index + 1}</h4>
            <FieldGrid accent="amber" fields={[
              { label: "Nhà cung cấp", value: document.supplier_name },
              { label: "Khách hàng", value: document.customer_name },
              { label: "Số chứng từ", value: document.document_number },
              { label: "Ngày", value: document.date },
              { label: "Biển số xe", value: document.license_plate },
              { label: "Tổng tiền", value: document.grand_total ?? document.total_weight_kg },
            ]} />
            {items.length > 0 && <div className="mt-4"><h5 className="mb-2 text-sm font-semibold text-slate-800">Hàng hóa</h5><ObjectTable rows={items} /></div>}
          </section>
        );
      })}
    </div>
  );
}

function CertificateVisual({ result }: { result: JsonRecord }) {
  const data = asRecord(result.data);
  if (!data) return null;
  const address = asRecord(data.address);
  return (
    <div className="space-y-5">
      <FieldGrid accent="teal" fields={[
        { label: "Số chứng nhận", value: data.certificate_number },
        { label: "Ngày cấp", value: data.issue_date },
        { label: "Ngày hết hiệu lực", value: data.expiry_date },
        { label: "Đơn vị cấp", value: data.issuing_authority },
        { label: "Mã vùng trồng", value: data.growing_area_code },
        { label: "Tên vùng trồng", value: data.growing_area_name },
        { label: "Diện tích (ha)", value: data.total_area_ha },
        { label: "Đơn vị quản lý", value: data.growing_area_management_unit },
        { label: "Địa chỉ", value: data.growing_area_administrative_address ?? address?.full_display_address },
      ]} />
      {typeof data.scope_note === "string" && <section className="rounded-xl border border-teal-200 bg-teal-50 p-4"><h4 className="font-semibold text-teal-900">Phạm vi/Ghi chú</h4><p className="mt-2 text-sm text-slate-800">{data.scope_note}</p></section>}
    </div>
  );
}

export function ArchivedOcrVisualResult({ interactionType, taskSubtype, result }: ArchivedOcrVisualResultProps) {
  const normalized = asRecord(result);
  if (!normalized) {
    return <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Kết quả OCR không ở dạng dữ liệu có thể hiển thị trực quan.</p>;
  }
  return (
    <div className="space-y-5">
      <StatusBanner result={normalized} />
      {interactionType === "OCR_VAT_TU" && <ProductVisual result={normalized} subtype={taskSubtype} />}
      {interactionType === "OCR_CHUNG_TU" && <ReceiptVisual result={normalized} />}
      {interactionType === "OCR_GIAY_VUNG_TRONG" && <CertificateVisual result={normalized} />}
    </div>
  );
}
