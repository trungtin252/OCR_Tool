import type { ProductInfo } from "../apis/imageApi";
import { getFieldWarning, isFieldEmpty } from "../apis/imageApi";
import {
  getNetContentTitle,
  getFormTypeLabel,
  getUnitLabel,
  getFertilizerTypeLabel,
} from "../utils/dataMapper";
import {
  ImageGallery,
  ErrorState,
  FieldsGrid,
  DataSection,
  QualityWarnings,
  ResultFooter,
  type FieldDisplay,
} from "./ResultShared";

interface FertilizerResultsProps {
  data: ProductInfo;
  images: File[];
  onReset: () => void;
}

const ACCENT = "emerald" as const;

export function FertilizerResults({
  data,
  images,
  onReset,
}: FertilizerResultsProps) {
  const confidenceScore =
    data.metadata?.overall_confidence ?? data.confidence_score ?? 0;
  const confidence = confidenceScore * 100;

  if (!data.success) {
    return (
      <ErrorState
        data={data}
        images={images}
        accentColor={ACCENT}
        onReset={onReset}
      />
    );
  }

  const basicFields: FieldDisplay[] = [
    {
      label: "Tên sản phẩm",
      key: "product_name",
      icon: "📦",
      value: data.product_name,
      isEmpty: isFieldEmpty(data.product_name),
      warning: getFieldWarning(data, "product_name"),
    },
    {
      label: "Loại phân bón",
      key: "product_type",
      icon: "📋",
      value: getFertilizerTypeLabel(data.product_type || ""),
      isEmpty: isFieldEmpty(data.product_type),
      warning: getFieldWarning(data, "product_type"),
    },
    {
      label: "Nhà sản xuất",
      key: "registrant",
      icon: "🏭",
      value: data.registrant,
      isEmpty: isFieldEmpty(data.registrant),
      warning: getFieldWarning(data, "registrant"),
    },
    {
      label: "Số đăng ký",
      key: "registration_number",
      icon: "📜",
      value: data.registration_number,
      isEmpty: isFieldEmpty(data.registration_number),
      warning: getFieldWarning(data, "registration_number"),
    },
    {
      label: getNetContentTitle(data.net_unit || ""),
      key: "net_content",
      icon: "📏",
      value: data.net_content
        ? `${data.net_content}${data.net_unit ? ` ${getUnitLabel(data.net_unit)}` : ""}`
        : null,
      isEmpty: isFieldEmpty(data.net_content),
      warning: getFieldWarning(data, "net_content"),
    },
    {
      label: "Hình dạng/Dạng sản phẩm",
      key: "form_type",
      icon: "🏷️",
      value: getFormTypeLabel(data.form_type || ""),
      isEmpty: isFieldEmpty(data.form_type),
      warning: getFieldWarning(data, "form_type"),
    },
    {
      label: "Ngày sản xuất",
      key: "mfg_date",
      icon: "📅",
      value: data.mfg_date,
      isEmpty: isFieldEmpty(data.mfg_date),
      warning: getFieldWarning(data, "mfg_date"),
    },
    {
      label: "Ngày hết hạn",
      key: "exp_date",
      icon: "⏰",
      value: data.exp_date,
      isEmpty: isFieldEmpty(data.exp_date),
      warning: getFieldWarning(data, "exp_date"),
    },
    {
      label: "Thời gian cách ly trước thu hoạch",
      key: "pre_harvest_interval_days",
      icon: "⏱️",
      value:
        data.pre_harvest_interval_days || data.pre_harvest_interval_days === 0
          ? `${data.pre_harvest_interval_days} ngày`
          : null,
      isEmpty: isFieldEmpty(data.pre_harvest_interval_days),
      warning: getFieldWarning(data, "pre_harvest_interval_days"),
    },
  ];

  return (
    <div className="space-y-6">
      <ImageGallery images={images} accentColor={ACCENT} />

      <FieldsGrid fields={basicFields} accentColor={ACCENT} />

      {/* Uses */}
      <DataSection
        title="Công dụng"
        icon="🎯"
        fieldKey="uses"
        data={data}
        hasData={!isFieldEmpty(data.uses)}
      >
        <div className="bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          {data.uses?.split("\n").map((line, index) => (
            <p
              key={index}
              className="text-sm text-green-900 leading-relaxed text-left"
            >
              {line}
            </p>
          ))}
        </div>
      </DataSection>

      {/* Dosage */}
      <DataSection
        title="Cách sử dụng & Liều lượng"
        icon="💊"
        fieldKey="dosage"
        data={data}
        hasData={!isFieldEmpty(data.dosage)}
      >
        <div className="bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
          {typeof data.dosage === "string" ? (
            data.dosage.split("\n").map((line, index) => (
              <p
                key={index}
                className="text-sm text-emerald-900 leading-relaxed text-left"
              >
                {line}
              </p>
            ))
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-emerald-100">
                    <th className="border border-emerald-300 px-4 py-2 text-left text-xs font-semibold text-emerald-700">
                      Đối tượng
                    </th>
                    <th className="border border-emerald-300 px-4 py-2 text-left text-xs font-semibold text-emerald-700">
                      Liều lượng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(data.dosage) &&
                    data.dosage.map((item, index) => (
                      <tr
                        key={index}
                        className={
                          index % 2 === 0 ? "bg-white" : "bg-emerald-50"
                        }
                      >
                        <td className="border border-emerald-200 px-4 py-2 text-xs font-medium text-gray-900">
                          {item.target}
                        </td>
                        <td className="border border-emerald-200 px-4 py-2 text-sm text-gray-900">
                          {item.instruction || "---"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataSection>

      {/* Ingredients */}
      <DataSection
        title="Thành phần"
        icon="🧪"
        fieldKey="ingredients"
        data={data}
        hasData={!isFieldEmpty(data.ingredients)}
      >
        {typeof data.ingredients === "string" ? (
          <div className="bg-linear-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
            {data.ingredients.split("\n").map((line, index) => (
              <p
                key={index}
                className="text-sm text-orange-900 leading-relaxed text-left"
              >
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-orange-100">
                  <th className="border border-orange-300 px-4 py-2 text-left text-xs font-semibold text-orange-700">
                    Thành phần
                  </th>
                  <th className="border border-orange-300 px-4 py-2 text-left text-xs font-semibold text-orange-700">
                    Hàm lượng
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data.ingredients) &&
                  data.ingredients.map((ingredient, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-white" : "bg-orange-50"}
                    >
                      <td className="border border-orange-200 px-4 py-2 text-xs font-medium text-gray-900">
                        {ingredient.name}
                      </td>
                      <td className="border border-orange-200 px-4 py-2 text-sm font-bold text-gray-900">
                        {ingredient.content || "---"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </DataSection>

      {/* Target Crops */}
      <DataSection
        title="Đối tượng áp dụng"
        icon="🌱"
        fieldKey="target_crops"
        data={data}
        hasData={!isFieldEmpty(data.target_crops)}
      >
        <div className="flex flex-wrap gap-2">
          {data.target_crops?.map((crop, index) => (
            <span
              key={index}
              className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium"
            >
              {crop}
            </span>
          ))}
        </div>
      </DataSection>

      {/* Target Pests */}
      <DataSection
        title="Sâu/Bệnh mục tiêu"
        icon="🦠"
        fieldKey="target_pests"
        data={data}
        hasData={!isFieldEmpty(data.target_pests)}
      >
        <div className="flex flex-wrap gap-2">
          {data.target_pests?.map((pest, index) => (
            <span
              key={index}
              className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium"
            >
              {pest}
            </span>
          ))}
        </div>
      </DataSection>

      {data.metadata?.review_warnings && (
        <QualityWarnings warnings={data.metadata.review_warnings} />
      )}

      <ResultFooter
        confidence={
          data.metadata?.overall_confidence !== undefined ||
          data.confidence_score !== undefined
            ? confidence
            : undefined
        }
        accentColor={ACCENT}
        onReset={onReset}
        jsonData={data}
      />
    </div>
  );
}
