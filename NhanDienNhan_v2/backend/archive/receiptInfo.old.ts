import {z} from "zod";
import {BaseResponseSchema} from "@backend/shared/contracts/baseResponse.schema";

// ==========================================
// 1. DETAIL SCHEMA: CHI TIẾT TỪNG DÒNG VẬT TƯ
// ==========================================
export const ReceiptItemSchema = z.object({
  product_name: z
    .string()
    .nullable()
    .describe("Tên vật tư/sản phẩm ghi trên dòng (Ví dụ: 'Phân bón NPK 16-16-8', 'Thuốc trừ sâu Haihamec')"),
  
  quantity: z
    .number()
    .nullable()
    .describe("Số lượng mua (Chuyển đổi về dạng số nếu có thể, Ví dụ: 5, 10.5)"),
  
  unit: z
    .string()
    .nullable()
    .describe("Đơn vị tính ghi trên dòng (Ví dụ: 'bao', 'chai', 'gói', 'kg'), chỉ điền khi phiếu có ghi rõ, nếu không để null"),

  unit_price: z
    .number()
    .nullable()
    .describe("Đơn giá của 1 đơn vị vật tư (Dạng số, Ví dụ: 120000)"),

  total_amount: z
    .number()
    .nullable()
    .describe("Thành tiền của dòng đó = số lượng * đơn giá (Dạng số, Ví dụ: 600000)"),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

// ==========================================
// 2. MASTER SCHEMA: THÔNG TIN CHUNG CỦA PHIẾU
// ==========================================
export const ReceiptDataSchema = z.object({
  category: z
    .literal("receipt")
    .describe("Danh mục sản phẩm/tài liệu"),

  // --- Thông tin đơn vị bán/mua ---
  supplier_name: z
    .string()
    .nullable()
    .describe("Tên đại lý/công ty/cửa hàng bán vật tư nông nghiệp"),
  
  customer_name: z
    .string()
    .nullable()
    .describe("Tên người mua hàng / chủ nông trại. Giữ đúng như trên phiếu, không bỏ bớt chữ, Ví dụ: Chú 7 cồ (3 liên)"),

  // --- Thông tin thời gian & chứng từ ---
  purchase_date: z
    .string()
    .nullable()
    .describe("Ngày mua hàng/lập phiếu (Chuẩn hóa về DD/MM/YYYY nếu rõ ràng, nếu không giữ nguyên text gốc)"),
  
  receipt_number: z
    .string()
    .nullable()
    .describe("Số phiếu / Số hóa đơn (nếu có)"),

  // --- Danh sách vật tư chi tiết ---
  items: z
    .array(ReceiptItemSchema)
    .describe("Danh sách các dòng vật tư chi tiết trích xuất được từ bảng hóa đơn"),

  // --- Tổng kết phiếu ---
  grand_total: z
    .number()
    .nullable()
    .describe("Tổng tiền phải thanh toán cuối cùng của toàn bộ phiếu (Dạng số, Ví dụ: 2500000)"),
  
  notes: z
    .string()
    .nullable()
    .describe("Ghi chú chung trên phiếu (Ví dụ: 'Nợ lại vụ sau', 'Đã thanh toán tiền mặt')"),
});

// ==========================================
// 3. RESPONSE WRAPPER SCHEMA
// ==========================================
export const ReceiptResponseSchema = BaseResponseSchema.extend({
  data: ReceiptDataSchema.nullable().describe("Dữ liệu bóc tách từ phiếu mua vật tư"),
});
