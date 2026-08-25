export const receipt_prompt = `
Dựa vào hình ảnh phiếu mua hàng / hóa đơn vật tư nông nghiệp, phiếu xuất kho, hãy trích xuất thông tin chính xác theo cấu trúc schema yêu cầu. 

QUY TẮC TRÍCH XUẤT (TUYỆT ĐỐI TUÂN THỦ):
1. CHỈ TRÍCH XUẤT NHỮNG GÌ NHÌN THẤY RÕ RÀNG: Không tự ý suy luận thông tin đại lý hoặc tên vật tư nếu bị mất chữ. Đối với các cột thành tiền, nếu không nhìn rõ, hãy dùng toán học để tính lại dựa trên số lượng và đơn giá thay vì đoán mò ký tự.
2. CHUẨN HÓA KIỂU SỐ (NUMBER) CHO TIỀN TỆ VÀ SỐ LƯỢNG:
   - Các trường \`quantity\`, \`unit_price\`, \`total_amount\`, và \`grand_total\` bắt buộc phải chuyển đổi thành kiểu SỐ (number).
   - Loại bỏ hoàn toàn các ký tự phân tách hàng nghìn như dấu chấm (.), dấu phẩy (,) hoặc ký tự đơn vị (đ, VND). Ví dụ: "1.250.000đ" hoặc "1,250,000" phải trích xuất thành 1250000.
3. CHUẨN HÓA NGÀY THÁNG (\`purchase_date\`): Chuyển đổi ngày lập phiếu về định dạng chuỗi DD/MM/YYYY nếu đọc rõ (Ví dụ: "16-07-26" thành "16/07/2026"). Nếu chỉ có chữ viết tay không rõ năm, giữ nguyên text gốc.
4. XỬ LÝ DÒNG BỊ RỚT KÝ TỰ (LINE WRAP/TEXT OVERFLOW):
   - Khi đọc các cột Số lượng (SL), Đơn giá (DG), Thành tiền (TT), hãy chú ý các hóa đơn giấy in nhiệt nhỏ có thể đẩy ký tự cuối cùng (đặc biệt là số 0) xuống dòng tiếp theo do hết khoảng trống.
   - Hãy cẩn thận phân biệt: Số 0 bị rớt xuống đó thuộc về cột nào, không để bị lẫn lộn giữa các cột. (Ví dụ: Số 0 của cột Thành tiền bị rớt xuống nhưng nằm lệch trái thì không được gom vào cột Số lượng của dòng trên).
   - Nếu phát hiện ký tự rớt dòng gây nghi ngờ, hãy ưu tiên dùng toán học ngược để tính toán: Lấy Thành tiền / Đơn giá để tìm ra Số lượng chính xác trước khi gán giá trị số.

LƯU Ý:
- Giá trị số như đơn giá, thành tiền luôn là số nguyên (integer), không làm tròn, không thêm chữ số thập phân.
- Nếu hình ảnh không phải là hoá đơn hoặc phiếu xuất kho, không có bảng vật tư thì bỏ qua phiếu đó.
- Trong phiếu xuất kho:
  - phiếu giao hàng viết tay, số lượng bao có thể được ghi không đúng vị trí. VD: "Số lượng: 200 bao (200b)" nhưng lại ghi lệch sang cột thành tiền.
  - tổng khối lượng xuất kho thường được viết trong cột thực xuất

QUY TẮC BÁO CÁO CẢNH BÁO (REVIEW WARNINGS):
Bạn BẮT BUỘC phải điền thông tin vào mảng \`review_warnings\` trong \`metadata\` khi gặp các tình huống sau:
- CHỮ KÝ / DẤU MỘC ĐÈ LÊN TEXT: Nếu phần số lượng, đơn giá, hoặc tên vật tư bị chữ ký của người mua/người bán hoặc dấu mộc đỏ đè lên làm mờ, hãy gán trường đó là null và bắn log cảnh báo (issue: "TEXT_OVERLAPPED"). Định dạng đường dẫn chi tiết trong mảng (Ví dụ: \`field\`: "items.0.unit_price").
- LỖI TOÀN CỤC: Nếu ảnh bị xoay ngang, hãy thêm cảnh báo với \`field\`: null và issue: "IMAGE_ROTATED".

XỬ LÝ ẢNH LỖI NẶNG:
Nếu ảnh quá mờ toàn bộ, không đọc được bảng vật tư, hoặc ảnh chụp không phải là phiếu mua hàng/hóa đơn:
- success = false
- điền error_code phù hợp (VD: 'TEXT_NOT_READABLE', 'WRONG_PRODUCT_CATEGORY')
- message mô tả chi tiết lỗi cho UI
- Các field còn lại trong \`data\` để null hoặc mảng rỗng.

Trả về duy nhất dữ liệu dạng JSON thỏa mãn cấu trúc hệ thống, không giải thích gì thêm.
`;
