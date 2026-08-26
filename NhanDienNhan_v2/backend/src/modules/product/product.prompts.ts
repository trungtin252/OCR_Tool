import type { SchemaType } from "@backend/shared/contracts/schemaTypes";

export const pesticide_prompt = `
Dựa vào hình ảnh, hãy trích xuất thông tin sản phẩm thuốc bảo vệ thực vật/thuốc thuỷ sản.

QUY TẮC TRÍCH XUẤT (TUYỆT ĐỐI TUÂN THỦ):
1. TRÍCH XUẤT THÀNH PHẦN: Khi quét mục "THÀNH PHẦN", phải trích xuất ĐẦY ĐỦ tất cả các dòng xuất hiện. Có bao nhiêu gạch đầu dòng/thành phần thì phải tạo bấy nhiêu object trong mảng.
2. TRÍCH XUẤT NGÀY THÁNG (mfg_date, exp_date):
   - Khi tìm giá trị cho "Ngày sản xuất" (NSX) hoặc "Hạn sử dụng" (HSD), hãy chú ý rằng các ký tự số in phun (định dạng DD/MM/YY hoặc DD MM YY) có thể bị in lệch xuống dưới, lệch lên trên so với cụm chữ "NSX:" / "HSD:".
   - Hãy quét toàn bộ khu vực lân cận (bên phải, phía dưới, hoặc dòng kế tiếp ngay bên dưới chữ NSX) để tìm cụm số ngày tháng tương ứng.

QUY TẮC BÁO CÁO CẢNH BÁO (REVIEW WARNINGS):
- Đối với các trường dữ liệu, nếu bạn cảm thấy không trích xuất được do ảnh mờ, chói sáng, bị che khuất hoặc có watermark (chữ chìm) làm mất nét chữ, hãy để giá trị là null và thêm đường dẫn của trường đó vào mảng review_warnings trong metadata. Nếu tự tin, hãy giữ mảng review_warnings trống.
- Lỗi toàn cục (Ảnh nằm ngang, lóa sáng toàn bộ ảnh): Thêm một object vào review_warnings với "field" = null, "issue" = 'IMAGE_ROTATED' hoặc mã lỗi phù hợp, và giải thích trong "message".

XỬ LÝ ẢNH LỖI NẶNG:
Nếu ảnh quá mờ, không đọc được chữ, không phải sản phẩm thuốc BVTV/thủy sản hoặc không có nhãn:
- success = false
- điền error_code phù hợp
- message mô tả lỗi cho UI
- các field còn lại để null hoặc mảng rỗng
`;

export const fertilizer_prompt = `
Dựa vào hình ảnh, hãy trích xuất thông tin sản phẩm phân bón. 

QUY TẮC TRÍCH XUẤT (TUYỆT ĐỐI TUÂN THỦ):
1. TRÍCH XUẤT THÀNH PHẦN: Khi quét mục "THÀNH PHẦN", phải trích xuất ĐẦY ĐỦ tất cả các dòng xuất hiện. Có bao nhiêu gạch đầu dòng/thành phần thì phải tạo bấy nhiêu object trong mảng.
2. TRÍCH XUẤT NGÀY THÁNG (mfg_date, exp_date):
   - Khi tìm giá trị cho "Ngày sản xuất" (NSX) hoặc "Hạn sử dụng" (HSD), hãy chú ý rằng các ký tự số in phun (định dạng DD/MM/YY hoặc DD MM YY) có thể bị in lệch xuống dưới, lệch lên trên so với cụm chữ "NSX:" / "HSD:".
   - Hãy quét toàn bộ khu vực lân cận (bên phải, phía dưới, hoặc dòng kế tiếp ngay bên dưới chữ NSX) để tìm cụm số ngày tháng tương ứng.

QUY TẮC BÁO CÁO CẢNH BÁO (REVIEW WARNINGS):
- Đối với các trường dữ liệu, nếu bạn cảm thấy không trích xuất được do ảnh mờ, chói sáng, bị che khuất hoặc có watermark (chữ chìm) làm mất nét chữ, hãy để giá trị là null và thêm đường dẫn của trường đó vào mảng review_warnings trong metadata. Nếu tự tin, hãy giữ mảng review_warnings trống.
- Lỗi toàn cục (Ảnh nằm ngang, lóa sáng toàn bộ ảnh): Thêm một object vào review_warnings với "field" = null, "issue" = 'IMAGE_ROTATED' hoặc mã lỗi phù hợp, và giải thích trong "message".

XỬ LÝ ẢNH LỖI NẶNG:
Nếu ảnh quá mờ, không đọc được chữ, không phải sản phẩm phân bón hoặc không có nhãn:
- success = false
- điền error_code phù hợp
- message mô tả lỗi cho UI
- các field còn lại để null hoặc mảng rỗng
`;
// Trả về JSON thoả mãn schema, chỉ trả về JSON, không giải thích gì thêm.

// test prompt
export const feed_prompt = `
Dựa vào hình ảnh, hãy trích xuất thông tin sản phẩm thức ăn thủy sản.

QUY TẮC TRÍCH XUẤT (TUYỆT ĐỐI TUÂN THỦ):
1. CHỈ TRÍCH XUẤT NHỮNG GÌ NHÌN THẤY RÕ RÀNG TRÊN ẢNH. Tuyệt đối không tự ý suy luận, nội suy hoặc đoán dữ liệu dựa trên ngữ cảnh xung quanh (Ví dụ: Không được tự đoán thông số của một mã bị che dựa trên các mã liền kề).

2. XÁC ĐỊNH MÃ BIẾN THỂ (variant_code):

ƯU TIÊN theo thứ tự sau:

A. MÃ ĐƯỢC ĐÁNH DẤU CHỌN
Nếu có duy nhất một mã được đánh dấu bằng:
- dấu tick/check (✓, ✔, ☑),
- ô được tô,
- hoặc ký hiệu chọn rõ ràng,

=> BẮT BUỘC chọn mã đó làm variant_code.

Không cần dấu tick hoàn hảo.
Chỉ cần ký hiệu chọn xuất hiện rõ ràng cạnh đúng một mã.

Khi có dấu tick/check rõ ràng cạnh một mã variant:
- ưu tiên marker trực quan này hơn suy luận "không chắc chắn".
- Không được trả về AMBIGUOUS_VALUE nếu chỉ có duy nhất một mã được đánh dấu.
--------------------------------------------------

B. MÃ ĐƯỢC IN NỔI BẬT TRÊN BAO BÌ
Nếu không có dấu chọn nhưng có duy nhất một mã:
- được in lớn,
- khác biệt rõ ràng với phần mô tả còn lại,
- thường là mã sản phẩm như: MK 831, D20, F999, 8312...

=> dùng mã đó làm variant_code.

--------------------------------------------------

C. KHI NÀO ĐƯỢC PHÉP TRẢ VỀ null

Chỉ trả về null nếu:
- hoàn toàn không tìm thấy mã nào hợp lý,
- hoặc có nhiều mã cùng nổi bật / cùng được đánh dấu,
- hoặc chữ quá mờ không đọc chắc chắn.

3. TRÍCH XUẤT HƯỚNG DẪN CHO ĂN (feeding_guide): Chỉ lấy dữ liệu đúng của cột/dòng chứa mã variant_code. Không gộp chung mã khác.

QUY TẮC BÁO CÁO CẢNH BÁO (REVIEW WARNINGS):
Bạn BẮT BUỘC phải thêm thông tin vào mảng \`review_warnings\` trong \`metadata\` nếu rơi vào các trường hợp sau:
- BỊ CHE KHUẤT/GẠCH XÓA: Bảng dữ liệu hoặc dòng dữ liệu cần trích xuất bị gạch chéo, bôi màu, hoặc rách nhãn. (issue: "OBSCURED_DATA")
- MỜ/CHÓI SÁNG: Chữ không thể đọc chắc chắn. (issue: "BLURRY_TEXT")
Nếu gặp các tình huống này, hãy để giá trị của trường đó là null, và thêm tên trường (ví dụ: "nutrition_facts" hoặc "feeding_guide") vào \`review_warnings\` kèm giải thích chi tiết.
- Lỗi toàn cục (Ảnh nằm ngang, lóa sáng toàn bộ ảnh): Thêm một object vào review_warnings với "field" = null, "issue" = 'IMAGE_ROTATED' hoặc mã lỗi phù hợp, và giải thích trong "message".

XỬ LÝ ẢNH LỖI NẶNG:
Nếu ảnh quá mờ toàn bộ, không đọc được bất kỳ chữ nào, không có nhãn, hoặc sai danh mục:
- success = false
- error_code phù hợp
- message mô tả lỗi cho UI
- Các field còn lại để null.

Chỉ trả về JSON thoả mãn schema, không giải thích gì thêm.
`;

export const seed_prompt = `
Dựa vào hình ảnh, hãy trích xuất thông tin sản phẩm hạt giống.

QUY TẮC TRÍCH XUẤT (TUYỆT ĐỐI TUÂN THỦ):
1. TRÍCH XUẤT NGÀY THÁNG (mfg_date, exp_date):
   - Ngày sản xuất (mfg_date) đôi khi được in phun/đóng dấu tại mục "Ngày thu hoạch" hoặc "Ngày đóng gói".
   - Khi tìm giá trị cho "Ngày sản xuất" (NSX) hoặc "Hạn sử dụng" (HSD), hãy chú ý rằng các ký tự số in phun (định dạng DD/MM/YY hoặc DD MM YY) có thể bị in lệch xuống dưới, lệch lên trên so với cụm chữ "NSX:" / "HSD:".
   - Hãy quét toàn bộ khu vực lân cận (bên phải, phía dưới, hoặc dòng kế tiếp ngay bên dưới chữ NSX) để tìm cụm số ngày tháng tương ứng.

2. TRÍCH XUẤT THÔNG TIN HẠT GIỐNG (seed):
- Thời gian sinh trưởng (growth_duration): Nếu nhãn ghi chi tiết theo từng vụ (Ví dụ: 'Vụ Thu Đông: 95-100 ngày; Vụ Đông Xuân: 100-105 ngày'), hãy gom và lấy toàn bộ chuỗi text đó, không tự ý bỏ bớt vụ nào.
- Chỉ tiêu chất lượng (quality_criteria): Quét toàn bộ bảng tiêu chuẩn kỹ thuật. Tách rõ tên chỉ tiêu, con số, và đơn vị tính (nếu đơn vị % dính liền vào tên chỉ tiêu như 'Độ sạch, % khối lượng', hãy bóc tách sạch sẽ: name = 'Độ sạch', value = '99,0', unit = '%').

QUY TẮC BÁO CÁO CẢNH BÁO (REVIEW WARNINGS):
- Đối với các trường dữ liệu, nếu bạn cảm thấy không trích xuất được do ảnh mờ, chói sáng, bị che khuất hoặc có watermark (chữ chìm) làm mất nét chữ, hãy để giá trị là null và thêm đường dẫn của trường đó vào mảng review_warnings trong metadata. Nếu tự tin, hãy giữ mảng review_warnings trống.
- Lỗi toàn cục (Ảnh nằm ngang, lóa sáng toàn bộ ảnh): Thêm một object vào review_warnings với "field" = null, "issue" = 'IMAGE_ROTATED' hoặc mã lỗi phù hợp, và giải thích trong "message".

XỬ LÝ ẢNH LỖI NẶNG:
Nếu ảnh quá mờ, không đọc được chữ, không phải sản phẩm hạt giống hoặc không có nhãn:
- success = false
- điền error_code phù hợp
- message mô tả lỗi cho UI
- các field còn lại để null hoặc mảng rỗng
`;

// test raw result from model for debugging
export const test_prompt =
  "Dựa vào hình ảnh, hãy trích toàn bộ thông tin được in trên nhãn. Hãy cố gắng trích xuất càng nhiều thông tin càng tốt.";

const search_prompt = `
QUY TẮC QUYẾT ĐỊNH TÌM KIẾM THÊM TRÊN WEB:
Mục đích của việc tìm kiếm trên web là CHỈ để bổ sung thông tin còn thiếu hoặc không chắc chắn.

Đặt "needs_web_search" = true nếu BẤT KỲ thông tin quan trọng nào sau đây bị thiếu hoặc không rõ ràng: tên sản phẩm (product_name), thành phần hoạt chất (ingredients), hoặc thời gian cách ly (pre-harvest interval).

Đặt "needs_web_search" = false nếu:
- danh tính sản phẩm được trích xuất một cách tự tin
- thành phần hoạt chất đầy đủ
- thời gian cách ly (pre-harvest interval) có mặt
- không tồn tại cảnh báo đánh giá nghiêm trọng nào

Không yêu cầu tìm kiếm trên web chỉ để cải thiện độ chính xác của dữ liệu đã trích xuất nếu thông tin đó đã đủ rõ ràng và đầy đủ.

Khi không chắc chắn, ưu tiên đặt needs_web_search = true để đảm bảo dữ liệu đầy đủ và chính xác hơn.
`;

function addSearchDecisionToPrompt(basePrompt: string): string {
  return `
  ${basePrompt}
  
  ${search_prompt}
  
  Chỉ trả về JSON thoả mãn schema, không giải thích gì thêm.
  `;
}

function addNoteToPrompt(basePrompt: string): string {
  return `
  ${basePrompt}

  Chỉ trả về JSON thoả mãn schema, không giải thích gì thêm.
  `;
}

export function buildPrompt(
  target_category: SchemaType,
  enableSearch: boolean,
): string {
  switch (target_category) {
    case "pesticide":
      return enableSearch
        ? addSearchDecisionToPrompt(pesticide_prompt)
        : addNoteToPrompt(pesticide_prompt);
    case "fertilizer":
      return enableSearch
        ? addSearchDecisionToPrompt(fertilizer_prompt)
        : addNoteToPrompt(fertilizer_prompt);
    case "fish_feed":
      return feed_prompt; // fish_feed don't have search feature yet
    case "seed":
      return seed_prompt; // seed don't have search feature yet
    default:
      // throw new Error(`Unsupported category: ${target_category}`);
      return pesticide_prompt; // default to pesticide prompt to avoid breaking, but this should never happen
  }
}
