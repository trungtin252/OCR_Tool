import { z } from "zod";

// ==========================================
// 1. METADATA & CẢNH BÁO (REVIEW WARNINGS)
// ==========================================

export const ReviewWarningSchema = z.object({
  field: z
    .string()
    .nullable()
    .describe(
      "Tên trường bị nghi ngờ. ĐỂ NULL nếu đây là cảnh báo chung cho toàn bộ bức ảnh (VD: ảnh bị xoay ngang, lóa sáng toàn bộ).",
    ),
  issue: z
    .string()
    .describe(
      "Phân loại lỗi (VD: 'TEXT_BLURRY', 'TABLE_UNCLEAR', 'AMBIGUOUS_VALUE', 'IMAGE_ROTATED')",
    ),
  message: z
    .string()
    .describe("Mô tả chi tiết vấn đề bằng tiếng Việt cho người duyệt xem"),
});

const searchSchema = z.object({
  needs_web_search: z
    .boolean()
    .describe("Có cần tìm kiếm thêm trên web để xác định sản phẩm hay không"),
  search_reason: z
    .string()
    .nullable()
    .describe(
      "Lý do cần tìm kiếm thêm, chỉ điền nếu needs_web_search = true. Ví dụ: 'không tìm thấy ngày cách ly trước thu hoạch trên nhãn'",
    ),
});

export const MetadataSchema = z.object({
  overall_confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Độ tin cậy tổng thể của quá trình OCR/Trích xuất"),
  review_warnings: z
    .array(ReviewWarningSchema)
    .describe(
      "Danh sách các trường không rõ ràng cần con người xem lại. Nếu tất cả đều rõ ràng, trả về mảng rỗng []",
    ),
});

// ==========================================
// 2. BASE SCHEMA CHO API RESPONSE & CORE DATA
// ==========================================

// Khung ngoài cùng của JSON trả về
export const BaseResponseSchema = z.object({
  success: z.boolean().describe("Có trích xuất thành công hay không"),
  error_code: z
    .enum([
      "NONE",
      "BLURRY_IMAGE",
      "WRONG_PRODUCT_CATEGORY",
      "TEXT_NOT_READABLE",
      "MISSING_LABEL",
      "UNKNOWN",
    ])
    .describe("Mã lỗi nếu thất bại"),
  message: z.string().describe("Thông báo cho UI"),
  metadata: MetadataSchema.nullable().describe(
    "Thông tin cảnh báo độ tin cậy (để null nếu ảnh quá mờ không trích xuất được gì)",
  ),
});

export const BaseResponseSchemaWithSearch = BaseResponseSchema.extend({
  search_decision: searchSchema
    .nullable()
    .describe(
      "Thông tin về việc có cần tìm kiếm thêm trên web hay không, và lý do nếu có",
    ),
});