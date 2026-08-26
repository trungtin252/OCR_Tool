import { z } from "zod";
import {
  BaseResponseSchema,
  BaseResponseSchemaWithSearch,
} from "@backend/validation/baseSchema";

const unitMap = {
  gram: "Gram",
  kg: "Kg",
  lit: "Lít",
  m: "Mét",
  ml: "ml",
  m2: "M^2",
  m3: "M^3",
  kwh: "KWh",
};

const packageMap = {
  bao: "Bao",
  bo: "Bộ",
  cai: "Cái",
  cay: "Cây",
  con: "Con",
  chai: "Chai",
  cuon: "Cuộn",
  goi: "Gói",
  hop: "Hộp",
  lon: "Lon",
  can: "Can",
  mieng: "Miếng",
  ong: "Ống",
  tam: "Tấm",
  thanh: "Thanh",
  thung: "Thùng",
  tui: "Túi",
  vien: "Viên",
  nguoi: "Người",
  lan: "Lần",
  gio: "Giờ",
  ngay: "Ngày",
  thang: "Tháng",
  nam: "Năm",
};

// Dữ liệu chung của tất cả sản phẩm
const BaseProductDataSchema = z.object({
  category: z
    .enum(["fish_feed", "pesticide", "fertilizer", "seed", "unknown"])
    .describe("Danh mục sản phẩm"),
  form_type: z
    .enum(["bot", "nuoc", "vien", "khac"])
    .nullable()
    .describe("Dạng vật lý/thương phẩm của sản phẩm (bột, nước, viên...)"),
  registrant: z.string().nullable().describe("Công ty đăng ký"),
  product_name: z
    .string()
    .nullable()
    .describe(
      "Tên đầy đủ của sản phẩm. BẮT BUỘC bao gồm cả tên thương mại chính và tên gợi nhớ/tên phụ/biệt danh marketing in trên nhãn nếu có. Nếu hai phần này nằm tách biệt, hãy nối chúng lại bằng dấu gạch ngang ' - '. (Ví dụ: 'HAIHAMEC 3.6EC - SƯ TỬ ĐỎ')",
    ),
  net_content: z.string().nullable().describe("Giá trị định lượng (số)"),
  net_unit: z
    .enum(Object.keys(unitMap) as (keyof typeof unitMap)[])
    .nullable()
    .describe(
      `Đơn vị của giá trị định lượng: ${Object.values(unitMap).join(", ")}`,
    ),
  package_type: z
    .enum(Object.keys(packageMap) as (keyof typeof packageMap)[])
    .nullable()
    .describe(`Quy cách đóng gói: ${Object.values(packageMap).join(", ")}`),
  mfg_date: z.string().nullable().describe("Ngày sản xuất (NSX)"),
  exp_date: z
    .string()
    .nullable()
    .describe(
      "Hạn sử dụng (HSD), nếu chỉ ghi khoảng thời gian (VD: '12 tháng') thì trả về những gì có trên nhãn",
    ),
});

// Hạn sử dụng, nếu ghi thời gian cụ thể thì ưu tiên ngày tháng, nếu chỉ ghi khoảng thời gian (VD: '12 tháng') thì ghi nguyên văn

// ==========================================
// 3. SCHEMA CHI TIẾT THEO DANH MỤC (DATA & RESPONSE)
// ==========================================

// --- THUỐC BẢO VỆ THỰC VẬT (PESTICIDE) ---

export const IngredientSchema = z.object({
  name: z.string().describe("Tên thành phần"),
  content: z
    .string()
    .nullable()
    .describe("Hàm lượng tương ứng (VD: 50%, 1kg, vừa đủ)"),
});

export const PesticideDataSchema = BaseProductDataSchema.extend({
  category: z.literal("pesticide").describe("Danh mục sản phẩm"),
  product_type: z
    .enum(["hoa_hoc", "sinh_hoc"])
    .nullable()
    .describe("Loại sản phẩm dựa trên thành phần"),
  registration_number: z
    .string()
    .nullable()
    .describe("Số đăng ký, thường có dạng: (số)/CNĐKT-BVTV"),
  uses: z.string().nullable().describe("Công dụng (nếu có)"),
  ingredients: z
    .array(IngredientSchema)
    .nullable()
    .describe("Danh sách tất cả các thành phần có trong sản phẩm"),
  dosage: z
    .union([
      z
        .array(
          z.object({
            target: z.string().describe("Mục đích, đối tượng áp dụng"),
            instruction: z.string().describe("Hướng dẫn sử dụng"),
            // khi chỉ muốn lấy liều lượng sử dụng thì chỉ cần amount: z.string().describe("Liều lượng sử dụng")
          }),
        )
        .describe(
          "Liều lượng sử dụng chi tiết theo từng mục đích/đối tượng, nếu có.",
        ),
      z
        .string()
        .describe(
          "Liều sử dụng chung nếu không có hướng dẫn riêng cho từng đối tượng",
        ),
    ])
    .nullable()
    .describe("Liều lượng sử dụng"),
  target_crops: z
    .array(z.string())
    .nullable()
    .describe("Danh sách cây trồng/loài cá áp dụng"),
  target_pests: z
    .array(z.string())
    .nullable()
    .describe("Danh sách bệnh/dịch hại"),
  pre_harvest_interval_days: z
    .number()
    .int()
    // .nullable()
    .default(7)
    .describe(
      "Thời gian cách ly trước thu hoạch, thường được in trên nhãn với nội dung 'ngừng sử dụng X ngày trước khi thu hoạch', có thể được tách riêng thành mục riêng hoặc nằm trong phần hướng dẫn sử dụng chung. Nếu có khoảng thời gian như '7-10 ngày', thì trả về ngày lớn nhất (VD: 10). Nếu không tìm thấy thông tin này trên nhãn, thì mặc định là 7 ngày.",
    ),
});

export const PesticideResponseSchema = BaseResponseSchema.extend({
  data: PesticideDataSchema.nullable().describe(
    "Dữ liệu sản phẩm thuốc BVTV/thuốc thuỷ sản",
  ),
});

export const PesticideResponseSchemaWithSearch =
  BaseResponseSchemaWithSearch.extend({
    data: PesticideDataSchema.nullable().describe(
      "Dữ liệu sản phẩm thuốc BVTV/thuốc thuỷ sản",
    ),
  });

// --- PHÂN BÓN (FERTILIZER) ---

export const FertilizerDataSchema = BaseProductDataSchema.extend({
  category: z.literal("fertilizer").describe("Danh mục sản phẩm"),
  product_type: z
    .enum(["vo_co", "huu_co"])
    .nullable()
    .describe("Loại sản phẩm dựa trên thành phần"),
  registration_number: z
    .string()
    .nullable()
    .describe(
      "Mã số phân bón, thường là dãy 4-5 số. Ví dụ: Mã số phân bón/MSPB: 10699",
    ),
  uses: z.string().nullable().describe("Công dụng (nếu có)"),
  ingredients: z
    .array(IngredientSchema)
    .nullable()
    .describe(
      "Danh sách tất cả các thành phần có trong sản phẩm, bao gồm cả tỷ trọng, phụ gia nếu có",
    ),
  dosage: z
    .union([
      z
        .array(
          z.object({
            target: z.string().describe("Mục đích, đối tượng áp dụng"),
            instruction: z.string().describe("Hướng dẫn sử dụng"),
          }),
        )
        .describe(
          "Liều lượng sử dụng chi tiết theo từng mục đích/đối tượng, nếu có.",
        ),
      // Nếu có cả hướng dẫn riêng cho từng đối tượng và hướng dẫn chung, thì trích phần hướng dẫn riêng trước và phần hướng dẫn chung đặt target là 'Hướng dẫn chung' để phân biệt với các mục tiêu cụ thể khác. ví dụ: [{target: 'Cây lúa', instruction: 'Bón 20kg/sào'}, {target: 'Hướng dẫn chung', instruction: 'Bón 100kg/ha'}]
      z
        .string()
        .describe(
          "Liều sử dụng chung nếu không có hướng dẫn riêng cho từng đối tượng",
        ),
    ])
    .nullable()
    .describe("Liều lượng sử dụng"),
  target_crops: z
    .array(z.string())
    .nullable()
    .describe("Danh sách cây trồng áp dụng"),
  pre_harvest_interval_days: z
    .number()
    .int()
    // .nullable()
    .default(7)
    .describe(
      "Thời gian cách ly trước thu hoạch, thường được in trên nhãn với nội dung 'ngừng sử dụng X ngày trước khi thu hoạch', có thể được tách riêng thành mục riêng hoặc nằm trong phần hướng dẫn sử dụng chung. Nếu có khoảng thời gian như '7-10 ngày', thì trả về ngày lớn nhất (VD: 10). Nếu không tìm thấy thông tin này trên nhãn, thì mặc định là 7 ngày.",
    ),
});

export const FertilizerResponseSchema = BaseResponseSchema.extend({
  data: FertilizerDataSchema.nullable().describe("Dữ liệu sản phẩm phân bón"),
});

export const FertilizerResponseSchemaWithSearch =
  BaseResponseSchemaWithSearch.extend({
    data: FertilizerDataSchema.nullable().describe("Dữ liệu sản phẩm phân bón"),
  });

// --- THỨC ĂN THỦY SẢN (FISH FEED) ---

const FeedGuideVariantSchema = z.object({
  code: z
    .string()
    .nullable()
    .describe(
      "Mã biến thể thức ăn, phải giống với variant_code của sản phẩm nếu có",
    ),
  guide: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Tên mục hướng dẫn, nếu có song ngữ thì ưu tiên tiếng Việt",
          ),
        value: z.string().describe("Nội dung hướng dẫn cho mục này"),
      }),
    )
    .describe(
      "Hướng dẫn bóc tách riêng cho mã code này. Tuyệt đối không gom data của mã khác vào.",
    ),
});

export const FishFeedDataSchema = BaseProductDataSchema.extend({
  category: z.literal("fish_feed").describe("Danh mục sản phẩm"),
  product_type: z.string().nullable().describe("Loại sản phẩm"),
  species: z.string().nullable().describe("Loài thủy sản áp dụng"),
  uses: z.string().nullable().describe("Công dụng (nếu có)"),
  ingredients: z.string().nullable().describe("Thành phần nguyên liệu"),
  variant_code: z.string().nullable().describe("Mã biến thể của sản phẩm"),
  nutrition_facts: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            `Tên thành phần dinh dưỡng. Ưu tiên tiếng Việt, không dịch tự động`,
          ),
        value: z
          .string()
          .describe(
            `Giá trị định lượng (số), nếu có đơn vị riêng thì chỉ lấy số`,
          ),
        unit: z
          .string()
          .nullable()
          .describe(`Đơn vị của giá trị dinh dưỡng (g, mg, %...)`),
      }),
    )
    .nullable()
    .describe(
      "Thành phần dinh dưỡng (composition) tương ứng với variant_code.",
    ),
  feeding_guide: z
    .union([
      FeedGuideVariantSchema,
      z
        .string()
        .describe(
          "Hướng dẫn chung cho sản phẩm nếu không có biến thể nào được chọn",
        ),
    ])
    .nullable()
    .describe("Hướng dẫn cho ăn tương ứng với biến thể (variant_code)"),
});

export const FishFeedResponseSchema = BaseResponseSchema.extend({
  data: FishFeedDataSchema.nullable().describe(
    "Dữ liệu sản phẩm thức ăn thủy sản",
  ),
});

// --- Hạt GIỐNG (SEED) ---

// Cấu trúc cho từng chỉ tiêu chất lượng hạt giống (Ví dụ: Độ sạch, Tỉ lệ nảy mầm)
export const SeedQualityCriterionSchema = z.object({
  name: z
    .string()
    .describe(
      "Tên chỉ tiêu chất lượng (Ưu tiên tiếng Việt, VD: 'Độ sạch', 'Tỉ lệ nảy mầm')",
    ),
  value: z
    .string()
    .describe(
      "Giá trị tiêu chuẩn/kết quả tương ứng. Nếu có giới hạn như 'không nhỏ hơn' thì điền thêm ≥, 'không lớn hơn' thì điền thêm ≤. (VD: '80', '≥ 99,0', '≤ 0,5')",
    ),
  unit: z
    .string()
    .nullable()
    .describe("Đơn vị tính của chỉ tiêu nếu có (VD: '%', 'hạt/kg')"),
});

export const SeedDataSchema = BaseProductDataSchema.extend({
  category: z.literal("seed").describe("Danh mục sản phẩm"),

  // override form_type
  form_type: z
    .enum(["hat", "cay", "khac"])
    .nullable()
    .describe("Dạng vật lý/thương phẩm của sản phẩm (hạt, cây, khác)"),

  // ===== THÔNG TIN ĐẶC THÙ CỦA GIỐNG =====

  cropping_season: z
    .array(z.string())
    .nullable()
    .describe(
      "Vụ mùa trồng/áp dụng (Ví dụ trích từ nhãn: ['Vụ Thu Đông', 'Vụ Đông Xuân'])",
    ),

  growth_duration: z
    .string()
    .nullable()
    .describe(
      "Thời gian sinh trưởng của giống cây. Trích nguyên văn cả khoảng thời gian nếu có (Ví dụ: '95-100 ngày', '100-105 ngày')",
    ),

  lot_number: z.string().nullable().describe("Mã số lô giống"),

  manufacturer: z
    .string()
    .nullable()
    .describe(
      "Nơi sản xuất / Trại nhân giống (Ví dụ: 'Trại Lúa Giống HỒ QUANG')",
    ),

  origin: z
    .string()
    .nullable()
    .describe("Xuất xứ của giống cây (Ví dụ: 'Sóc Trăng', 'Việt Nam')"),

  // ===== MẢNG CÁC CHỈ TIÊU CHẤT LƯỢNG (BẢNG QCVN) =====

  quality_criteria: z
    .array(SeedQualityCriterionSchema)
    .nullable()
    .describe(
      "Danh sách các chỉ tiêu kỹ thuật/chất lượng hạt giống. BẮT BUỘC lấy đủ các dòng trong bảng bao gồm cả ô gộp nếu có.",
    ),
});

export const SeedResponseSchema = BaseResponseSchema.extend({
  data: SeedDataSchema.nullable().describe("Dữ liệu sản phẩm hạt giống"),
});
