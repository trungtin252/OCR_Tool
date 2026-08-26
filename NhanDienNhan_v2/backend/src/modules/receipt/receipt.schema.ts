import { z } from "zod";
import { BaseResponseSchema } from "@backend/shared/contracts/baseResponse.schema";

export const BaseDocumentItemSchema = z
  .object({
    product_name: z
      .string()
      .nullable()
      .describe(
        "Tên vật tư/sản phẩm (VD: 'TĂ Cá Rô Phi VCD32', 'CON CÒ C5001')",
      ),
    product_code: z
      .string()
      .nullable()
      .describe("Mã sản phẩm nếu có (VD: '91C5001-00/0.5-PE10')"),
    lot_number: z
      .string()
      .nullable()
      .describe(
        "Số lô sản xuất / Ngày phối trộn đối với thành phẩm nếu in trên dòng, nếu có ngày sản xuất in kèm thì giữ nguyên text gốc (VD: '19032026-D5045004 (24/03/2026)')",
      ),
  })
  .describe(
    "Cấu trúc chung của 1 dòng vật tư trong phiếu xuất kho, phiếu giao hàng, hóa đơn bán hàng, chỉ được lấy thông tin có trong bảng, không suy đoán thêm. Nếu trong cột tương ứng không có thông tin thì để null",
  );

export const DeliveryNoteItemSchema = BaseDocumentItemSchema.extend({
  net_content: z
    .number()
    .nullable()
    .describe("Khối lượng thực xuất của 1 bao (VD: 25, 10)"),
  net_unit: z
    .string()
    .nullable()
    .describe("Đơn vị tính khối lượng thực xuất (VD: 'kg', 'g')"),
  bag_count: z
    .number()
    .nullable()
    .describe("Số lượng bao thực xuất dạng số (VD: 400, 200)"),
  total_weight: z
    .number()
    .nullable()
    .describe(
      "Tổng số kg của dòng (Số bao * Khối lượng thực xuất, VD: 10000, 2000)",
    ),
});

export const InvoiceItemSchema = BaseDocumentItemSchema.extend({
  quantity: z
    .number()
    .nullable()
    .describe("Số lượng mua chung (nếu phiếu ghi dạng đơn vị tính khác)"),
  unit: z.string().nullable().describe("Đơn vị tính (VD: 'kg', 'bao', 'chai')"),
  unit_price: z.number().nullable().describe("Đơn giá sản phẩm (VD: 5000)"),
  total_amount: z
    .number()
    .nullable()
    .describe("Thành tiền chưa thuế hoặc có thuế của dòng (VD: 1000000)"),
});

export const SingleDocumentSchema = z.discriminatedUnion("document_type", [
  // CẤU TRÚC 1: PHIẾU XUẤT KHO / PHIẾU GIAO HÀNG
  z.object({
    document_type: z
      .enum(["delivery_note"])
      .describe("Phiếu xuất kho, phiếu giao hàng, phiếu cân"),
    supplier_name: z
      .string()
      .nullable()
      .describe("Đơn vị xuất kho (VD: 'CÔNG TY TNHH HẢI LONG MEKONG')"),
    customer_name: z
      .string()
      .nullable()
      .describe(
        "Đơn vị/Cá nhân nhận hàng (VD: 'HỢP TÁC XÃ SX TM ĐỒNG TÂM HG')",
      ),
    document_number: z
      .string()
      .nullable()
      .describe(
        "Số phiếu xuất / Số chứng từ (VD: '8002142760', 'PCT/SO/260004046')",
      ),
    date: z
      .string()
      .nullable()
      .describe("Ngày xuất kho/giao hàng (DD/MM/YYYY nếu rõ)"),

    // Thông tin xe vận chuyển (Rất hay có trên phiếu xuất)
    license_plate: z
      .string()
      .nullable()
      .describe("Biển số xe vận chuyển nếu có (VD: '51C 61210')"),

    items: z
      .array(DeliveryNoteItemSchema)
      .describe("Danh sách vật tư xuất kho"),

    // Tổng kết định lượng toàn phiếu
    total_bags: z
      .number()
      .nullable()
      .describe("Tổng số bao thực xuất toàn phiếu (VD: 400)"),
    total_weight_kg: z
      .number()
      .nullable()
      .describe("Tổng trọng lượng thực xuất toàn phiếu (VD: 10000)"),
  }),

  // CẤU TRÚC 2: HÓA ĐƠN / PHIẾU BÁN HÀNG CÓ TIỀN
  z.object({
    document_type: z
      .enum(["invoice"])
      .describe("Hóa đơn bán hàng, phiếu tính tiền"),
    supplier_name: z.string().nullable().describe("Đơn vị bán hàng"),
    customer_name: z
      .string()
      .nullable()
      .describe(
        "Người mua hàng. Giữ đúng như trên phiếu, không bỏ bớt chữ, Ví dụ: Chú 7 cồ (3 liên)",
      ),
    document_number: z.string().nullable().describe("Số hóa đơn"),
    date: z.string().nullable().describe("Ngày lập hóa đơn"),

    items: z.array(InvoiceItemSchema).describe("Danh sách vật tư bán hàng"),

    // Tổng kết tài chính toàn phiếu
    grand_total: z
      .number()
      .nullable()
      .describe("Tổng số tiền phải thanh toán cuối cùng trên hóa đơn"),
  }),
]);

export const DocumentDataSchema = z.object({
  document_count: z
    .number()
    .describe("Tổng số lượng chứng từ phát hiện được trong ảnh (VD: 2)"),
  documents: z
    .array(SingleDocumentSchema)
    .describe(
      "Mảng chứa thông tin bóc tách chi tiết của từng chứng từ theo thứ tự từ trên xuống dưới",
    ),
});

// Gắn vào Response Wrapper chung của bạn
export const DocumentResponseSchema = BaseResponseSchema.extend({
  data: DocumentDataSchema.nullable().describe("Dữ liệu bóc tách đa chứng từ"),
});
