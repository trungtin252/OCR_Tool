# Tài liệu Response Schema - Receipt/Document OCR

Tài liệu này giải thích chi tiết cấu trúc dữ liệu trả về (API Response Schema) cho tính năng bóc tách đa chứng từ và xử lý hóa đơn, phiếu nhập/xuất kho vật tư nông nghiệp (Document OCR) hỗ trợ cả định dạng ảnh và file PDF.

---

## 1. Thông tin API (API Endpoint)

### Trích xuất thông tin đa chứng từ từ ảnh hoặc PDF

**URL**: `POST http://localhost:5000/api/receipt/analyze`

**Content-Type**: `multipart/form-data`

**Body**:

- `images`: Một hoặc nhiều file ảnh JPEG, PNG, GIF, WebP hoặc file PDF tài liệu (tối đa 10 file, dung lượng tối đa 10MB/file). MIME và nội dung thực tế của file được đối chiếu trước khi xử lý.

**Đặc điểm**:

- **Hỗ trợ tải lên file PDF**: Các trang trong file PDF sẽ tự động được chuyển đổi sang định dạng ảnh PNG để đưa vào luồng nhận dạng.
- **Giới hạn số trang/file**: Hệ thống đọc metadata để đếm trang PDF trước khi render. Tổng số lượng trang kết hợp với ảnh tải lên phải nằm trong khoảng từ 1 đến 10. Nếu vượt quá 10, hệ thống trả về lỗi `400 Bad Request` trước khi tạo buffer PNG.
- Luôn tự động phân tích dữ liệu sang cấu trúc JSON (`parsed = true`).
- Luôn tự động chuẩn hóa định dạng ngày tháng trong chứng từ (`formatDates = true`).
- Không yêu cầu tham số truy vấn bổ sung (Query Parameters).

---

## 2. Khung Response Tổng (Top-level Response Wrapper)

```json
{
  "success": true,
  "data": {
    "response": { ... },
    "totalImages": 2
  }
}
```

### success (boolean)

Cho biết request tổng thể có được xử lý thành công hay không.

### data (object)

Chứa kết quả bóc tách và thông tin tổng quan.

- **data.response** (object): Kết quả trích xuất cấu trúc các chứng từ chi tiết (xem chi tiết ở Mục 3).
- **data.totalImages** (number): Tổng số lượng ảnh (bao gồm cả các trang PDF đã giải nén thành ảnh) được xử lý trong lượt yêu cầu này.

---

## 3. Cấu trúc chi tiết `data.response`

### success (boolean)

Cho biết việc bóc tách thông tin từ ảnh hoặc PDF có thành công hay không.

### error_code (string enum)

Mã lỗi nếu quá trình phân tích hoặc nhận dạng thất bại.

- `NONE`: Không có lỗi.
- `BLURRY_IMAGE`: Ảnh quá mờ, không nhận dạng được chữ.
- `WRONG_PRODUCT_CATEGORY`: Ảnh được gửi không phải là chứng từ/hóa đơn hợp lệ.
- `TEXT_NOT_READABLE`: Chữ viết tay hoặc chữ in quá mờ, bị rách/che khuất hoàn toàn.
- `MISSING_LABEL`: Thiếu phần thông tin cốt lõi của phiếu.
- `UNKNOWN`: Lỗi không xác định.

### message (string)

Thông báo chi tiết bằng tiếng Việt để hiển thị lên giao diện người dùng.

### metadata (object | null)

Thông tin độ tin cậy và danh sách các cảnh báo (Để `null` nếu ảnh lỗi nặng hoặc không thể phân tích được gì).

- **metadata.overall_confidence** (number): Điểm số độ tin cậy tổng thể của quá trình OCR (giá trị từ `0` đến `1`).
- **metadata.review_warnings** (array): Danh sách các trường nghi ngờ hoặc lỗi logic cần con người kiểm tra lại. Mỗi phần tử bao gồm:
  - `field` (string | null): Đường dẫn của trường bị nghi ngờ (Ví dụ: `documents.0.items.1.unit_price`). Sẽ là `null` nếu là lỗi toàn cục (Ví dụ: ảnh bị ngược).
  - `issue` (string): Phân loại lỗi. Schema không giới hạn enum; ví dụ:
    - `TEXT_BLURRY`: Chữ bị mờ.
    - `TEXT_OVERLAPPED`: Chữ ký, dấu mộc đỏ hoặc vết bẩn đè lên văn bản.
    - `MATH_MISMATCH`: Sai lệch số học tự động đối chiếu bằng code logic (Ví dụ: Số lượng \* Đơn giá khác Thành tiền, tổng thành tiền các dòng không khớp với Tổng thanh toán, hoặc tổng số bao/khối lượng không khớp với tổng kết toàn phiếu).
    - `IMAGE_ROTATED`: Ảnh bị xoay ngang hoặc xoay ngược.
  - `message` (string): Mô tả chi tiết lỗi bằng tiếng Việt cho người duyệt xem.

### data (object | null)

Dữ liệu chi tiết của đa chứng từ trích xuất được.

---

## 4. Chi tiết cấu trúc `data.response.data`

Dữ liệu gốc chứa thông tin tổng hợp của tất cả chứng từ phát hiện được trong file:

| Tên trường       | Kiểu dữ liệu | Mô tả                                                                                  |
| :--------------- | :----------- | :------------------------------------------------------------------------------------- |
| `document_count` | number       | Tổng số lượng chứng từ phát hiện được trong file ảnh/PDF (Ví dụ: `3`)                  |
| `documents`      | array        | Mảng chứa thông tin bóc tách chi tiết của từng chứng từ theo thứ tự từ trên xuống dưới |

### Chi tiết cấu trúc từng chứng từ trong danh sách `documents`

Mỗi chứng từ trong danh sách `documents` sẽ thuộc một trong hai định dạng cấu trúc tùy theo trường `document_type`:

#### Cấu trúc 1: Phiếu xuất kho / Phiếu giao hàng / Phiếu cân (`document_type = "delivery_note"`)

| Tên trường        | Kiểu dữ liệu   | Mô tả                                                                |
| :---------------- | :------------- | :------------------------------------------------------------------- |
| `document_type`   | string (enum)  | Luôn là `"delivery_note"`                                            |
| `supplier_name`   | string \| null | Đơn vị xuất kho hoặc đơn vị bán (VD: `'CHI NHÁNH PROCONCO CẦN THƠ'`) |
| `customer_name`   | string \| null | Đơn vị/Cá nhân nhận hàng (VD: `'Hợp Tác Xã Nhất Tâm'`)               |
| `document_number` | string \| null | Số phiếu xuất / Số chứng từ (VD: `'PCT/SO/260003579'`)               |
| `date`            | string \| null | Ngày xuất kho hoặc giao hàng (định dạng `DD/MM/YYYY` nếu rõ ràng)    |
| `license_plate`   | string \| null | Biển số xe vận chuyển nếu có ghi trên phiếu (VD: `'65C15869'`)       |
| `items`           | array          | Danh sách các dòng vật tư xuất kho chi tiết (xem bảng dưới)          |
| `total_bags`      | number \| null | Tổng số bao thực xuất ghi nhận trên toàn phiếu                       |
| `total_weight_kg` | number \| null | Tổng trọng lượng thực xuất ghi nhận trên toàn phiếu (tính theo kg)   |

##### Chi tiết cấu trúc dòng vật tư của Phiếu xuất/giao hàng (`delivery_note`)

| Tên trường     | Kiểu dữ liệu   | Mô tả                                                                                                                                     |
| :------------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `product_name` | string \| null | Tên vật tư/sản phẩm (VD: `'CON CÒ C5001 - Thức ăn cá'`)                                                                                   |
| `product_code` | string \| null | Mã sản phẩm nếu có (VD: `'91C5001-00/0.5-PE10'`)                                                                                          |
| `lot_number`   | string \| null | Số lô sản xuất / Ngày phối trộn sản phẩm (VD: `'06032026-D5017001'`)                                                                      |
| `net_content`  | number \| null | Khối lượng tịnh của 1 bao (VD: `10`, `25`)                                                                                                |
| `net_unit`     | string \| null | Đơn vị tính khối lượng tịnh (VD: `'kg'`, `'g'`)                                                                                           |
| `bag_count`    | number \| null | Số lượng bao của dòng đó (VD: `100`)                                                                                                      |
| `total_weight` | number \| null | Tổng trọng lượng ghi trên dòng (thường là Số bao \* Khối lượng tịnh). Service sẽ thêm warning `MATH_MISMATCH` nếu các số liệu không khớp. |

---

#### Cấu trúc 2: Hóa đơn / Phiếu bán hàng có tiền (`document_type = "invoice"`)

| Tên trường        | Kiểu dữ liệu   | Mô tả                                                                 |
| :---------------- | :------------- | :-------------------------------------------------------------------- |
| `document_type`   | string (enum)  | Luôn là `"invoice"`                                                   |
| `supplier_name`   | string \| null | Đơn vị bán hàng hoặc tên cửa hàng                                     |
| `customer_name`   | string \| null | Tên người mua hàng                                                    |
| `document_number` | string \| null | Số hóa đơn / Số phiếu tính tiền                                       |
| `date`            | string \| null | Ngày lập hóa đơn hoặc thanh toán (định dạng `DD/MM/YYYY` nếu rõ ràng) |
| `items`           | array          | Danh sách các dòng vật tư bán hàng chi tiết (xem bảng dưới)           |
| `grand_total`     | number \| null | Tổng tiền phải thanh toán cuối cùng trên hóa đơn (Dạng số)            |

##### Chi tiết cấu trúc dòng vật tư của Hóa đơn bán hàng (`invoice`)

| Tên trường     | Kiểu dữ liệu   | Mô tả                                                            |
| :------------- | :------------- | :--------------------------------------------------------------- |
| `product_name` | string \| null | Tên đầy đủ vật tư/sản phẩm (VD: `'Hữu cơ Nhật'`)                 |
| `product_code` | string \| null | Mã sản phẩm nếu có                                               |
| `lot_number`   | string \| null | Số lô sản xuất nếu có ghi trên dòng                              |
| `quantity`     | number \| null | Số lượng mua (VD: `4`)                                           |
| `unit`         | string \| null | Đơn vị tính (VD: `'bao'`, `'chai'`, `'kg'`)                      |
| `unit_price`   | number \| null | Đơn giá của sản phẩm (VD: `280000`)                              |
| `total_amount` | number \| null | Thành tiền của dòng đó (bằng Số lượng \* Đơn giá, VD: `1120000`) |

---

## 5. Ví dụ về API Response thành công (Dựa trên sampleResponse.json)

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất dữ liệu thành công",
      "metadata": {
        "overall_confidence": 0.98,
        "review_warnings": []
      },
      "data": {
        "document_count": 3,
        "documents": [
          {
            "document_type": "delivery_note",
            "supplier_name": "CÔNG TY CỔ PHẦN VIỆT - PHÁP SẢN XUẤT THỨC ĂN GIA SÚC - CHI NHÁNH PROCONCO CẦN THƠ",
            "customer_name": "Hợp Tác Xã Sản Xuất - Thương Mại Nhất Tâm",
            "document_number": "PCT/SO/260003579",
            "date": "31/03/2026",
            "license_plate": "65C15869",
            "items": [
              {
                "product_name": "CON CÒ C5001- Thức ăn cá giống 40% đạm, viên 0.5 mm bao PE 10kg",
                "product_code": "91C5001-00/0.5-PE10",
                "lot_number": "06032026-D5017001 (12/03/2026)",
                "net_content": 10,
                "net_unit": "kg",
                "bag_count": 100,
                "total_weight": 1000
              }
            ],
            "total_bags": 100,
            "total_weight_kg": 1000
          },
          {
            "document_type": "delivery_note",
            "supplier_name": "CÔNG TY CỔ PHẦN VIỆT - PHÁP SẢN XUẤT THỨC ĂN GIA SÚC - CHI NHÁNH PROCONCO CẦN THƠ",
            "customer_name": "Hợp Tác Xã Sản Xuất - Thương Mại Nhất Tâm",
            "document_number": "PCT/SO/260003580",
            "date": "31/03/2026",
            "license_plate": "65C15869",
            "items": [
              {
                "product_name": "CON CÒ C5004 - Thức ăn tra, basa 32% đạm, viên 1.0 mm bao PE 25kg",
                "product_code": "91C5004-00/1-PE25N",
                "lot_number": null,
                "net_content": 25,
                "net_unit": "kg",
                "bag_count": 40,
                "total_weight": 1000
              }
            ],
            "total_bags": 40,
            "total_weight_kg": 1000
          },
          {
            "document_type": "invoice",
            "supplier_name": "NGUYỆT PHÁT",
            "customer_name": "Chú 7 cồ (3 liên)",
            "document_number": "HD020308",
            "date": "04/05/2026",
            "items": [
              {
                "product_name": "Hữu cơ Nhật",
                "product_code": null,
                "lot_number": null,
                "quantity": 4,
                "unit": null,
                "unit_price": 280000,
                "total_amount": 1120000
              }
            ],
            "grand_total": 1120000
          }
        ]
      }
    },
    "totalImages": 2
  }
}
```
