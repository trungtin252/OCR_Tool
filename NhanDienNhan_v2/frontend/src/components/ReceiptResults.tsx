import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
import type {
  ReceiptApiResponse,
  ReceiptDocument,
  DeliveryNoteDocument,
  InvoiceDocument,
  ReceiptReviewWarning,
} from "../apis/receiptApi";
import { formatCurrency, formatNumber } from "../apis/receiptApi";
import { ImageGallery } from "./ResultShared";

// ─── Warning Helpers ──────────────────────────────────────────────────────────

function findWarning(
  warnings: ReceiptReviewWarning[],
  fieldPrefix: string,
): ReceiptReviewWarning | undefined {
  return warnings.find((w) => w.field?.startsWith(fieldPrefix));
}

// ─── Delivery Note Table ──────────────────────────────────────────────────────

function DeliveryNoteTable({
  doc,
  warnings,
  docIndex,
}: {
  doc: DeliveryNoteDocument;
  warnings: ReceiptReviewWarning[];
  docIndex: number;
}) {
  return (
    <div className="space-y-4">
      {/* Meta fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {[
          { label: "Nhà cung cấp", value: doc.supplier_name },
          { label: "Khách hàng", value: doc.customer_name },
          { label: "Số phiếu", value: doc.document_number },
          { label: "Ngày", value: doc.date },
          { label: "Biển số xe", value: doc.license_plate },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs font-semibold uppercase text-blue-600">{label}</p>
            <p className={`mt-1 font-medium ${value ? "text-gray-900" : "text-gray-400 italic"}`}>
              {value ?? "Không có"}
            </p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border border-blue-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-blue-100">
              {["#", "Tên sản phẩm", "Mã SP", "Số lô", "KL tịnh", "Số bao", "Tổng KL (kg)"].map((h) => (
                <th
                  key={h}
                  className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold text-blue-700 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => {
              const hasMismatch = !!findWarning(
                warnings,
                `documents.${docIndex}.items.${i}`,
              );
              return (
                <tr
                  key={i}
                  className={hasMismatch ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-blue-50/40"}
                >
                  <td className="border border-blue-200 px-3 py-2 text-xs text-gray-500">{i + 1}</td>
                  <td className="border border-blue-200 px-3 py-2 font-medium text-gray-900">
                    {item.product_name ?? "—"}
                    {hasMismatch && (
                      <AlertTriangle className="inline-block h-3 w-3 text-amber-500 ml-1 mb-0.5" />
                    )}
                  </td>
                  <td className="border border-blue-200 px-3 py-2 text-gray-600 text-xs">{item.product_code ?? "—"}</td>
                  <td className="border border-blue-200 px-3 py-2 text-gray-600 text-xs">{item.lot_number ?? "—"}</td>
                  <td className="border border-blue-200 px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                    {item.net_content != null ? `${formatNumber(item.net_content)} ${item.net_unit ?? ""}` : "—"}
                  </td>
                  <td className="border border-blue-200 px-3 py-2 text-right font-medium text-gray-900">
                    {formatNumber(item.bag_count)}
                  </td>
                  <td className="border border-blue-200 px-3 py-2 text-right font-bold text-blue-700">
                    {formatNumber(item.total_weight)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-100 font-bold">
              <td colSpan={5} className="border border-blue-200 px-3 py-2 text-xs text-right text-blue-700">
                Tổng
              </td>
              <td className="border border-blue-200 px-3 py-2 text-right text-blue-800">
                {formatNumber(doc.total_bags)} bao
              </td>
              <td className="border border-blue-200 px-3 py-2 text-right text-blue-800">
                {formatNumber(doc.total_weight_kg)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Invoice Table ────────────────────────────────────────────────────────────

function InvoiceTable({
  doc,
  warnings,
  docIndex,
}: {
  doc: InvoiceDocument;
  warnings: ReceiptReviewWarning[];
  docIndex: number;
}) {
  return (
    <div className="space-y-4">
      {/* Meta fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {[
          { label: "Nhà cung cấp", value: doc.supplier_name },
          { label: "Khách hàng", value: doc.customer_name },
          { label: "Số hoá đơn", value: doc.document_number },
          { label: "Ngày", value: doc.date },
        ].map(({ label, value }) => (
          <div key={label} className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            <p className="text-xs font-semibold uppercase text-emerald-600">{label}</p>
            <p className={`mt-1 font-medium ${value ? "text-gray-900" : "text-gray-400 italic"}`}>
              {value ?? "Không có"}
            </p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border border-emerald-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-emerald-100">
              {["#", "Tên sản phẩm", "Mã SP", "Số lô", "SL", "ĐVT", "Đơn giá", "Thành tiền"].map((h) => (
                <th
                  key={h}
                  className="border border-emerald-200 px-3 py-2 text-left text-xs font-semibold text-emerald-700 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => {
              const hasMismatch = !!findWarning(
                warnings,
                `documents.${docIndex}.items.${i}`,
              );
              return (
                <tr
                  key={i}
                  className={hasMismatch ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}
                >
                  <td className="border border-emerald-200 px-3 py-2 text-xs text-gray-500">{i + 1}</td>
                  <td className="border border-emerald-200 px-3 py-2 font-medium text-gray-900">
                    {item.product_name ?? "—"}
                    {hasMismatch && (
                      <AlertTriangle className="inline-block h-3 w-3 text-amber-500 ml-1 mb-0.5" />
                    )}
                  </td>
                  <td className="border border-emerald-200 px-3 py-2 text-gray-600 text-xs">{item.product_code ?? "—"}</td>
                  <td className="border border-emerald-200 px-3 py-2 text-gray-600 text-xs">{item.lot_number ?? "—"}</td>
                  <td className="border border-emerald-200 px-3 py-2 text-right text-gray-900">{formatNumber(item.quantity)}</td>
                  <td className="border border-emerald-200 px-3 py-2 text-gray-600">{item.unit ?? "—"}</td>
                  <td className="border border-emerald-200 px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="border border-emerald-200 px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                    {formatCurrency(item.total_amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-100 font-bold">
              <td colSpan={7} className="border border-emerald-200 px-3 py-2 text-right text-emerald-700">
                Tổng tiền
              </td>
              <td className="border border-emerald-200 px-3 py-2 text-right text-emerald-800 whitespace-nowrap">
                {formatCurrency(doc.grand_total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Document Tab/Accordion ───────────────────────────────────────────────────

function DocumentCard({
  doc,
  docIndex,
  warnings,
  mode,
  isActive,
  onSelect,
}: {
  doc: ReceiptDocument;
  docIndex: number;
  warnings: ReceiptReviewWarning[];
  mode: "tab" | "accordion";
  isActive: boolean;
  onSelect: () => void;
}) {
  const isDelivery = doc.document_type === "delivery_note";
  const hasWarning = warnings.some((w) => w.field?.includes(`documents.${docIndex}`));

  const label = isDelivery
    ? `Phiếu xuất ${docIndex + 1}`
    : `Hoá đơn ${docIndex + 1}`;

  const Icon = isDelivery ? Truck : FileText;
  const accentClass = isDelivery
    ? "border-blue-400 bg-blue-600"
    : "border-emerald-400 bg-emerald-600";
  const activeTabClass = isDelivery
    ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50"
    : "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50";

  if (mode === "tab") {
    return (
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${
          isActive
            ? activeTabClass
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
        {hasWarning && (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        )}
      </button>
    );
  }

  // Accordion header
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
          isActive ? `${accentClass.split(" ")[1]} text-white` : "bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? "bg-white/20" : accentClass}`}>
          <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-white"}`} />
        </div>
        <span className={`flex-1 font-semibold ${isActive ? "text-white" : "text-gray-800"}`}>
          {label}
        </span>
        {hasWarning && !isActive && (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
        {isActive ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isActive && (
        <div className="p-4 border-t border-gray-200">
          {isDelivery ? (
            <DeliveryNoteTable
              doc={doc as DeliveryNoteDocument}
              warnings={warnings}
              docIndex={docIndex}
            />
          ) : (
            <InvoiceTable
              doc={doc as InvoiceDocument}
              warnings={warnings}
              docIndex={docIndex}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ReceiptResults ──────────────────────────────────────────────────────

interface ReceiptResultsProps {
  response: ReceiptApiResponse;
  files: File[];
  onReset: () => void;
}

export function ReceiptResults({ response, files, onReset }: ReceiptResultsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const inner = response.data?.response;
  const totalImages = response.data?.totalImages ?? 0;

  // Error state
  if (!inner?.success || !inner.data) {
    return (
      <div className="space-y-6">
        <ImageGallery images={files} accentColor="purple" />
        <div className="text-center py-10">
          <AlertTriangle className="mx-auto h-14 w-14 text-orange-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Không thể trích xuất thông tin
          </h2>
          <p className="text-gray-600 mb-1">{inner?.message}</p>
          {inner?.error_code && inner.error_code !== "NONE" && (
            <p className="text-sm text-gray-400">Mã lỗi: {inner.error_code}</p>
          )}
        </div>
        <button
          onClick={onReset}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow"
        >
          ↺ Tải lên file mới
        </button>
      </div>
    );
  }

  const { document_count, documents } = inner.data;
  const warnings = inner.metadata?.review_warnings ?? [];
  const confidence = inner.metadata?.overall_confidence ?? null;

  const USE_TABS = document_count <= 5;

  return (
    <div className="space-y-6">
      {/* Image gallery */}
      <ImageGallery images={files} accentColor="purple" />

      {/* Summary header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Tìm thấy</p>
            <p className="text-xl font-bold text-gray-900">
              {document_count} chứng từ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {confidence !== null && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-4 w-4 ${confidence >= 0.8 ? "text-green-600" : "text-amber-500"}`}
              />
              <span className={`text-sm font-semibold ${confidence >= 0.8 ? "text-green-700" : "text-amber-600"}`}>
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-600 font-semibold">
                {warnings.length} cảnh báo
              </span>
            </div>
          )}
          <span className="text-xs text-gray-400">{totalImages} ảnh xử lý</span>
        </div>
      </div>

      {/* Tabs (≤5 docs) */}
      {USE_TABS && documents.length > 0 && (
        <div>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
            {documents.map((doc, i) => (
              <DocumentCard
                key={i}
                doc={doc}
                docIndex={i}
                warnings={warnings}
                mode="tab"
                isActive={activeIndex === i}
                onSelect={() => setActiveIndex(i)}
              />
            ))}
          </div>

          {/* Active tab content */}
          <div className="pt-5">
            {documents[activeIndex]?.document_type === "delivery_note" ? (
              <DeliveryNoteTable
                doc={documents[activeIndex] as DeliveryNoteDocument}
                warnings={warnings}
                docIndex={activeIndex}
              />
            ) : (
              <InvoiceTable
                doc={documents[activeIndex] as InvoiceDocument}
                warnings={warnings}
                docIndex={activeIndex}
              />
            )}
          </div>
        </div>
      )}

      {/* Accordion (>5 docs) */}
      {!USE_TABS && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <DocumentCard
              key={i}
              doc={doc}
              docIndex={i}
              warnings={warnings}
              mode="accordion"
              isActive={activeIndex === i}
              onSelect={() => setActiveIndex(activeIndex === i ? -1 : i)}
            />
          ))}
        </div>
      )}

      {/* Quality Warnings summary */}
      {warnings.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Tóm tắt cảnh báo chất lượng
          </h2>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                <p className="text-xs font-semibold text-amber-700">{w.field ?? "Toàn phiếu"}</p>
                <p className="text-xs text-amber-600 mt-0.5">{w.issue}</p>
                <p className="text-sm text-gray-700 mt-1">{w.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow"
        >
          <RotateCcw className="h-4 w-4" />
          Tải lên file mới
        </button>
      </div>
    </div>
  );
}
