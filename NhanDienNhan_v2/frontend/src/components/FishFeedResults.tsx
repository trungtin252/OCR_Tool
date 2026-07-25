import { AlertTriangle } from "lucide-react";
import type { ProductInfo } from "../apis/imageApi";
import { getFieldWarning, isFieldEmpty } from "../apis/imageApi";
import {
  getNetContentTitle,
  getFormTypeLabel,
  getUnitLabel,
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

interface FishFeedResultsProps {
  data: ProductInfo;
  images: File[];
  onReset: () => void;
}

const ACCENT = "blue" as const;

export function FishFeedResults({
  data,
  images,
  onReset,
}: FishFeedResultsProps) {
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
      label: "Mã biến thể",
      key: "variant_code",
      icon: "🏷️",
      value: data.variant_code,
      isEmpty: isFieldEmpty(data.variant_code),
      warning: getFieldWarning(data, "variant_code"),
    },
    {
      label: "Loài cá",
      key: "species",
      icon: "🐟",
      value: data.species,
      isEmpty: isFieldEmpty(data.species),
      warning: getFieldWarning(data, "species"),
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
      label: "Loại sản phẩm",
      key: "product_type",
      icon: "📋",
      value: data.product_type,
      isEmpty: isFieldEmpty(data.product_type),
      warning: getFieldWarning(data, "product_type"),
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
  ];

  return (
    <div className="space-y-6">
      <ImageGallery images={images} accentColor={ACCENT} />

      <FieldsGrid fields={basicFields} accentColor={ACCENT} />

      {/* Ingredients (string) */}
      <DataSection
        title="Thành phần"
        icon="🥣"
        fieldKey="ingredients"
        data={data}
        hasData={!isFieldEmpty(data.ingredients)}
      >
        <div className="bg-linear-to-br from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-lg p-4">
          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
            {data.ingredients as string}
          </p>
        </div>
      </DataSection>

      {/* Nutrition Facts */}
      <DataSection
        title="Thành phần dinh dưỡng"
        icon="📊"
        fieldKey="nutrition_facts"
        data={data}
        hasData={!isFieldEmpty(data.nutrition_facts)}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-green-100">
                <th className="border border-green-300 px-4 py-2 text-left text-xs font-semibold text-green-700">
                  Chỉ tiêu
                </th>
                <th className="border border-green-300 px-4 py-2 text-left text-xs font-semibold text-green-700">
                  Giá trị
                </th>
              </tr>
            </thead>
            <tbody>
              {data.nutrition_facts?.map((fact, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-green-50"}
                >
                  <td className="border border-green-200 px-4 py-2 text-xs font-medium text-gray-900">
                    {fact.name}
                  </td>
                  <td className="border border-green-200 px-4 py-2 text-sm font-bold text-gray-900">
                    {fact.value + " " + (fact.unit || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>

      {/* Feeding Guide */}
      {data.feeding_guide ? (
        <div
          className={`rounded-lg p-4 ${
            getFieldWarning(data, "feeding_guide")
              ? "bg-orange-50 border border-orange-200"
              : "bg-indigo-50 border-l-4 border-indigo-400"
          }`}
        >
          <h2 className="text-sm font-bold uppercase text-gray-900 mb-3 pb-2 border-b">
            🍽️ Hướng dẫn cho ăn
          </h2>

          {getFieldWarning(data, "feeding_guide") && (
            <div className="mb-3 pb-3 border-b border-orange-200">
              <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {getFieldWarning(data, "feeding_guide")?.issue}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                {getFieldWarning(data, "feeding_guide")?.message}
              </p>
            </div>
          )}

          {data.feeding_guide.code && (
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Mã: {data.feeding_guide.code}
            </p>
          )}

          {data.feeding_guide.guide && data.feeding_guide.guide.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-100">
                    <th className="border border-indigo-300 px-4 py-2 text-left text-xs font-semibold text-indigo-700">
                      Chỉ tiêu
                    </th>
                    <th className="border border-indigo-300 px-4 py-2 text-left text-xs font-semibold text-indigo-700">
                      Giá trị
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.feeding_guide.guide.map((item, index) => (
                    <tr
                      key={index}
                      className={
                        index % 2 === 0
                          ? "bg-white"
                          : getFieldWarning(data, "feeding_guide")
                            ? "bg-orange-50"
                            : "bg-indigo-50"
                      }
                    >
                      <td className="border border-indigo-200 px-4 py-2 text-xs font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="border border-indigo-200 px-4 py-2 text-sm font-bold text-gray-900">
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-700 italic">
              Không trích xuất được dữ liệu
            </p>
          )}
        </div>
      ) : (
        <DataSection
          title="Hướng dẫn cho ăn"
          icon="🍽️"
          fieldKey="feeding_guide"
          data={data}
          hasData={false}
        >
          <></>
        </DataSection>
      )}

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
