# Tài liệu Response Schema

Tài liệu này giải thích toàn bộ các trường trong API response trích xuất thông tin sản phẩm.
Bao gồm khung response chung và trường riêng cho:

- Thuốc bảo vệ thực vật/thuốc thủy sản (pesticide)
- Phân bón (fertilizer)
- Thức ăn thủy sản (fish_feed)
- Hạt giống (seed)

Lưu ý:

- Tất cả trường dưới đây có thể xuất hiện kể cả khi giá trị là null.
- Chuỗi văn bản được trả về đúng như trên nhãn (không tự động chuẩn hóa).

---

## 1. Thông tin API (API Endpoints)

### Trích xuất thông tin từ ảnh nhãn sản phẩm

**URL**: `POST http://localhost:5000/api/image/analyze`
thay đổi khi qua production

**Content-Type**: `multipart/form-data`

**Body**:

- `images`: Một hoặc nhiều file ảnh nhãn sản phẩm định dạng JPEG, PNG, GIF hoặc WebP. Tối đa 10 file, 10 MB/file; nội dung file được kiểm tra theo định dạng thực tế.

**Query Parameters**:

| Tham số       | Kiểu dữ liệu | Mô tả                                                                                                                                                             |
| :------------ | :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category`    | string       | Danh mục sản phẩm (`pesticide`, `fertilizer`, `fish_feed`, `seed`). Nếu không truyền, hệ thống mặc định `pesticide`.                                              |
| `parsed`      | boolean      | `true`: Trả về dữ liệu dạng JSON object. `false`: Trả về dữ liệu dạng chuỗi JSON stringized (mặc định).                                                           |
| `formatDates` | boolean      | `true`: Chuẩn hóa các trường ngày tháng (`mfg_date`, `exp_date`) về định dạng chuẩn `DD/MM/YYYY` nếu có thể.                                                      |
| `searchMode`  | string       | Chế độ tìm kiếm và làm giàu dữ liệu từ cơ sở dữ liệu chính phủ (`always`, `interactive`, `off`). Mặc định là `off`. (chỉ có ở danh mục `pesticide`, `fertilizer`) |

Nếu `category` không thuộc danh sách hỗ trợ, API trả HTTP 400 thay vì gửi request không hợp lệ tới model.

---

## 2. Khung Response Tổng (Top-level Response Wrapper)

### success (boolean)

Cho biết request tổng thể có xử lý thành công hay không.

### data (object)

Chứa kết quả trích xuất, dữ liệu thô, và thông tin làm giàu từ web.

#### data.response (object)

Kết quả trích xuất cuối cùng và trạng thái của sản phẩm. Đây là dữ liệu đã được đối soát và làm giàu (enriched) từ web nếu tìm kiếm thành công.

#### data.raw (object)

Dữ liệu trích xuất gốc trực tiếp từ ảnh (Vision AI) trước khi thực hiện bước làm giàu từ web. Cấu trúc bên trong tương tự như `data.response`, chỉ xuất hiện khi thực hiện tìm kiếm trực tuyến (khi `searchMode` là `always` hoặc `interactive` và được kích hoạt).

#### data.search_metadata (object)

Thông tin về kết quả tìm kiếm thông tin sản phẩm từ cơ sở dữ liệu chính phủ.

#### data.search_decision (object)

Quyết định tìm kiếm từ mô hình ngôn ngữ lớn (chỉ xuất hiện khi `searchMode` là `interactive`). Chứa thông tin về lý do mô hình quyết định có hoặc không thực hiện tìm kiếm trực tuyến.

#### data.totalImages (number)

Tổng số ảnh đã xử lý trong request.

---

## 3. Thông tin tìm kiếm (data.search_metadata)

### search_status (string enum)

Trạng thái của quá trình tìm kiếm và làm giàu dữ liệu:

- `enriched`: Tìm thấy sản phẩm trên web và đã hợp nhất dữ liệu thành công.
- `not_found`: Không tìm thấy sản phẩm tương ứng trong cơ sở dữ liệu web.
- `skipped`: Bỏ qua tìm kiếm do thiếu thông tin định danh (tên, số đăng ký).
- `failed`: Lỗi trong quá trình tìm kiếm hoặc hợp nhất dữ liệu.
- `unsupported_category`: Danh mục sản phẩm hiện chưa hỗ trợ tìm kiếm web.

### source_url (string | null)

Đường dẫn (URL) đến trang sản phẩm trên cổng thông tin chính phủ nếu tìm thấy.

### search_query (string | null)

Từ khóa đã được sử dụng để tìm kiếm trên web.

---

## 4. Đối tượng data.response (hoặc data.raw)

### success (boolean)

Cho biết việc trích xuất có thành công hay không.

### error_code (string enum)

Mã lỗi nếu trích xuất thất bại.
Giá trị có thể:

- NONE
- BLURRY_IMAGE
- WRONG_PRODUCT_CATEGORY
- TEXT_NOT_READABLE
- MISSING_LABEL
- UNKNOWN

### message (string)

Thông báo thân thiện cho UI.

### metadata (object | null)

Thông tin độ tin cậy và cảnh báo cần người kiểm tra. Để null nếu ảnh quá mờ
và không trích xuất được gì.

#### metadata.overall_confidence (number, 0..1)

Độ tin cậy tổng thể của OCR/trích xuất.

#### metadata.review_warnings (array)

Danh sách trường cần người xem lại. Mảng rỗng nếu không có vấn đề.

Mỗi phần tử trong review_warnings:

- field (string): Tên trường nghi ngờ.
- issue (string): Loại lỗi (ví dụ: TEXT_BLURRY, TABLE_UNCLEAR, AMBIGUOUS_VALUE, IMAGE_ROTATED).
- message (string): Mô tả bằng tiếng Việt cho người duyệt.

### data (object | null)

Dữ liệu sản phẩm đã trích xuất. Cấu trúc phụ thuộc danh mục.

---

## 5. Trường Chung Cho Tất Cả Danh Mục

Những trường này xuất hiện ở mọi danh mục sản phẩm.

### category (string enum)

Danh mục sản phẩm.
Giá trị có thể:

- fish_feed
- pesticide
- fertilizer
- seed
- unknown

### form_type (string enum | null)

Dạng vật lý của sản phẩm.
Giá trị có thể:

- bot
- nuoc
- vien
- hat
- cay
- khac

### registrant (string | null)

Tên công ty đăng ký hoặc nhà sản xuất.

### product_name (string | null)

Tên sản phẩm.

### net_content (string | null)

Giá trị định lượng (chỉ lấy số, dạng chuỗi).

### net_unit (string enum | null)

Đơn vị định lượng.
Giá trị có thể:

- gram
- kg
- lit
- m
- ml
- m2
- m3
- kwh

### package_type (string enum | null)

Quy cách đóng gói.
Giá trị có thể:

- bao
- bo
- cai
- cay
- con
- chai
- cuon
- goi
- hop
- lon
- can
- mieng
- ong
- tam
- thanh
- thung
- tui
- vien
- nguoi
- lan
- gio
- ngay
- thang
- nam

### uses (string | null)

Công dụng hoặc mục đích sử dụng.

### mfg_date (string | null)

Ngày sản xuất (NSX).

### exp_date (string | null)

Hạn sử dụng (HSD). Nếu nhãn chỉ ghi khoảng thời gian (ví dụ: "12 tháng") và không có ngày sản xuất cụ thể, thì đặt exp_date là chuỗi nguyên văn "12 tháng" và để mfg_date là null. Nếu có ngày sản xuất cụ thể và query param `formatDates` là `true` thì trích xuất ngày đó và tính hạn sử dụng dựa trên khoảng thời gian đã cho.

---

## 6. Trường Riêng Cho Thuốc BVTV/Thủy Sản (category = "pesticide")

### product_type (string | null)

Loại sản phẩm.
Giá trị có thể:

- hoa_hoc
- sinh_hoc

### registration_number (string | null)

Số đăng ký.

### ingredients (array | string | null)

Danh sách tất cả thành phần (hoạt chất, chất mang, phụ gia, độ ẩm...). Hoặc chuỗi văn bản nếu không tách được thành phần riêng lẻ.

Mỗi phần tử trong ingredients:

- name (string): Tên thành phần.
- content (string | null): Hàm lượng (ví dụ: 50%, 1kg, vừa đủ).

### dosage (array | string | null)

Liều lượng sử dụng.
Nếu có hướng dẫn theo từng đối tượng/mục đích thì là mảng đối tượng:

- target (string): Đối tượng/mục đích áp dụng.
- instruction (string): Hướng dẫn sử dụng.
  Nếu chỉ có liều chung thì là chuỗi.

### target_crops (array | null)

Danh sách cây trồng/loài thủy sản áp dụng.

### target_pests (array | null)

Danh sách bệnh/dịch hại cần xử lý.

### pre_harvest_interval_days (number | null)

Thời gian cách ly trước thu hoạch (tính bằng ngày).

---

## 7. Trường Riêng Cho Phân bón (category = "fertilizer")

### product_type (string | null)

Loại sản phẩm.
Giá trị có thể:

- vo_co
- huu_co

### registration_number (string | null)

Số đăng ký (Mã số phân bón).

### ingredients (array | string | null)

Danh sách tất cả thành phần (hoạt chất, chất mang, phụ gia, độ ẩm...). Hoặc chuỗi văn bản nếu không tách được thành phần riêng lẻ.

Mỗi phần tử trong ingredients:

- name (string): Tên thành phần.
- content (string | null): Hàm lượng (ví dụ: 50%, 1kg, vừa đủ).

### dosage (array | string | null)

Liều lượng sử dụng.
Nếu có hướng dẫn theo từng đối tượng/mục đích thì là mảng đối tượng:

- target (string): Đối tượng/mục đích áp dụng.
- instruction (string): Hướng dẫn sử dụng.
  Nếu chỉ có liều chung thì là chuỗi.

### target_crops (array | null)

Danh sách cây trồng áp dụng.

### pre_harvest_interval_days (number | null)

Thời gian cách ly trước thu hoạch (tính bằng ngày).

---

## 8. Trường Riêng Cho Thức Ăn Thủy Sản (category = "fish_feed")

### product_type (string | null)

Loại sản phẩm thức ăn.

### species (string | null)

Loài thủy sản áp dụng.

### ingredients (string | null)

Danh sách thành phần (chuỗi văn bản).

### variant_code (string | null)

Mã biến thể sản phẩm.

### nutrition_facts (array | null)

Thành phần dinh dưỡng cho biến thể được chọn.

Mỗi phần tử trong nutrition_facts:

- name (string): Tên chất dinh dưỡng (ưu tiên tiếng Việt, không tự dịch).
- value (string): Giá trị số (dạng chuỗi).
- unit (string | null): Đơn vị (g, mg, %, ...).

### feeding_guide (object | string | null)

Hướng dẫn cho ăn theo biến thể hoặc hướng dẫn chung.

Nếu là object (theo biến thể):

- code (string | null): Mã biến thể, phải trùng với variant_code nếu có.
- guide (array): Danh sách mục hướng dẫn.
  Mỗi phần tử:
  - name (string): Tên mục hướng dẫn.
  - value (string): Nội dung hướng dẫn.

Nếu là string: hướng dẫn chung cho sản phẩm.

---

## 9. Trường Riêng Cho Hạt Giống (category = "seed")

### cropping_season (array | null)

Danh sách vụ mùa trồng/áp dụng.

### growth_duration (string | null)

Thời gian sinh trưởng của giống cây.

### lot_number (string | null)

Mã số lô giống.

### manufacturer (string | null)

Nơi sản xuất / Trại nhân giống.

### origin (string | null)

Xuất xứ của giống cây.

### quality_criteria (array | null)

Danh sách các chỉ tiêu kỹ thuật/chất lượng hạt giống.

Mỗi phần tử trong quality_criteria:

- name (string): Tên chỉ tiêu chất lượng.
- value (string): Giá trị tiêu chuẩn/kết quả.
- unit (string | null): Đơn vị tính.

---

## 10. Ví Dụ JSON Và Giải Thích

### 10.1. Ví dụ Pesticide (Đã làm giàu từ web)

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thông tin sản phẩm thành công.",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": []
      },
      "data": {
        "category": "pesticide",
        "product_name": "GANCLEAR3979",
        "registrant": "CÔNG TY TNHH TM DV VINATOM 3979",
        "dosage": "1kg/2.000m²",
        "exp_date": "04/05/2028",
        "ingredients": [
          { "name": "Copper sulfate pentahydrate", "content": "50%" }
        ],
        "net_content": "1",
        "net_unit": "kg"
      }
    },
    "search_metadata": {
      "search_status": "enriched",
      "source_url": "http://danhmuc.thuocbvtv.com/...",
      "search_query": "GANCLEAR3979"
    },
    "totalImages": 1
  }
}
```

### 10.2. Ví dụ Fertilizer (Phân bón - Đã làm giàu từ web)

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thành công",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": [
          {
            "field": "mfg_date",
            "issue": "AMBIGUOUS_VALUE",
            "message": "Ngày sản xuất được ghi là 'Xem trên bao bì' nhưng không thấy in ngày cụ thể"
          }
        ]
      },
      "data": {
        "category": "fertilizer",
        "form_type": "nuoc",
        "registrant": "Công ty TNHH MTV hóa chất quốc tế Âu Mỹ",
        "product_name": "Phân bón vi lượng AUMY-MICROTOP CHELATE MIX - PHỤ GIA LẤY NHỤY",
        "net_content": "500",
        "net_unit": "ml",
        "package_type": "chai",
        "uses": "Giúp mát cua sáng, bung bông cực mạnh, chống chịu đồng loạt, sáng bông, dưỡng bông, chống chịu thời tiết bất lợi, hạn chế hiện tượng khô đen. Hồi sinh nhụy, nhụy xanh mạnh, lấy nhiều nhụy. Tăng đậu trái tối đa, nuôi trái non.",
        "mfg_date": "Xem trên bao bì",
        "exp_date": "3 năm",
        "product_type": "vo_co",
        "registration_number": "02061",
        "ingredients": [
          {
            "name": "Kẽm (Zn)",
            "content": "500 ppm"
          },
          {
            "name": "Sắt (Fe)",
            "content": "50 ppm"
          },
          {
            "name": "Molipđen (Mo)",
            "content": "50 ppm"
          },
          {
            "name": "Bo (B)",
            "content": "2.000 ppm"
          },
          {
            "name": "Tỷ trọng",
            "content": "1,15"
          },
          {
            "name": "L-Amino Acid, K40 chuyên cho sâu riêng",
            "content": "bổ sung phụ gia đặc hiệu"
          }
        ],
        "dosage": [
          {
            "target": "Từ khi nhú mắt cua đến xổ nhụy",
            "instruction": "Pha 10-15ml / 8 lít nước. Trước và sau khi hoa nở khoảng 5 ngày: Pha 10ml / 8 lít nước"
          },
          {
            "target": "Khi sầu riêng tượng trái non",
            "instruction": "Pha 10ml / 8 lít nước. Phun ướt đều chùm bông, chùm trái non và cành lá mang chùm bông trái. Phun 2 lần cách nhau 5 ngày. Chai 500ml có thể pha được 2 phuy (440 lít nước)"
          }
        ],
        "target_crops": [
          "sầu riêng",
          "rau",
          "hoa kiểng",
          "cây ăn quả",
          "cây công nghiệp",
          "lúa",
          "ngô/bắp",
          "mè",
          "sắn",
          "cây họ đậu",
          "cây ăn củ"
        ],
        "pre_harvest_interval_days": 0
      }
    },
    "raw": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thành công",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": [
          {
            "field": "mfg_date",
            "issue": "AMBIGUOUS_VALUE",
            "message": "Ngày sản xuất được ghi là 'Xem trên bao bì' nhưng không thấy in ngày cụ thể"
          }
        ]
      },
      "data": {
        "category": "fertilizer",
        "form_type": "nuoc",
        "registrant": "CÔNG TY TNHH MTV HÓA CHẤT QUỐC TẾ ÂU MỸ",
        "product_name": "Microtop Chelated - PHỤ GIA LẤY NHỤY",
        "net_content": "500",
        "net_unit": "ml",
        "package_type": "chai",
        "uses": "Giúp mát cua sáng, bung bông cực mạnh, chống chịu đồng loạt, sáng bông, dưỡng bông, chống chịu thời tiết bất lợi, hạn chế hiện tượng khô đen. Hồi sinh nhụy, nhụy xanh mạnh, lấy nhiều nhụy. Tăng đậu trái tối đa, nuôi trái non.",
        "mfg_date": "Xem trên bao bì",
        "exp_date": "3 năm",
        "product_type": "vo_co",
        "registration_number": "02061",
        "ingredients": [
          {
            "name": "Bo (B)",
            "content": "2.000 ppm"
          },
          {
            "name": "Kẽm (Zn)",
            "content": "500 ppm"
          },
          {
            "name": "Molypden (Mo)",
            "content": "50 ppm"
          },
          {
            "name": "Sắt (Fe)",
            "content": "50 ppm"
          },
          {
            "name": "L-Amino Acid, K40 chuyên cho sâu riêng",
            "content": "bổ sung phụ gia đặc hiệu"
          }
        ],
        "dosage": [
          {
            "target": "Từ khi nhú mắt cua đến xổ nhụy",
            "instruction": "Pha 10-15ml / 8 lít nước. Trước và sau khi hoa nở khoảng 5 ngày: Pha 10ml / 8 lít nước"
          },
          {
            "target": "Khi sầu riêng tượng trái non",
            "instruction": "Pha 10ml / 8 lít nước. Phun ướt đều chùm bông, chùm trái non và cành lá mang chùm bông trái. Phun 2 lần cách nhau 5 ngày. Chai 500ml có thể pha được 2 phuy (440 lít nước)"
          }
        ],
        "target_crops": ["sầu riêng"],
        "pre_harvest_interval_days": 0
      }
    },
    "totalImages": 3,
    "search_metadata": {
      "search_status": "enriched",
      "source_url": "http://113.190.254.147/PhanBon/en/phanbonchungnhan?MaPhanBon=02061",
      "search_query": "Microtop Chelated - PHỤ GIA LẤY NHỤY"
    }
  }
}
```

### 10.3. Ví dụ Fish Feed (Thức ăn thủy sản)

```json
{
  "success": true,
  "data": {
    "response": {
      "data": {
        "category": "fish_feed",
        "exp_date": "",
        "feeding_guide": {
          "code": "D002SV",
          "guide": [
            {
              "name": "HÌNH DẠNG",
              "value": "VIÊN (Pellet)"
            },
            {
              "name": "KÍCH CỠ THỨC ĂN (mm)",
              "value": "0.8 - 1.2"
            },
            {
              "name": "TRỌNG LƯỢNG CƠ THỂ (g)",
              "value": "3 - 5"
            },
            {
              "name": "TỶ LỆ CHO ĂN (%)",
              "value": "8 - 10"
            },
            {
              "name": "SỐ LẦN CHO ĂN / NGÀY",
              "value": "5 - 6"
            }
          ]
        },
        "form_type": null,
        "ingredients": "Bột cá, Bột đậu nành, Bột mì, Dầu cá, Vitamin và Khoáng chất. Fish meal, Soybean meal, Wheat flour, Fish oil, Vitamins and Minerals.",
        "mfg_date": null,
        "net_content": "10",
        "net_unit": "kg",
        "nutrition_facts": [
          {
            "name": "ĐỘ ẨM TỐI ĐA",
            "unit": "%",
            "value": "11"
          },
          {
            "name": "PROTEIN THÔ TỐI THIỂU",
            "unit": "%",
            "value": "40"
          },
          {
            "name": "BÉO THÔ TỐI THIỂU (*)",
            "unit": "%",
            "value": "5"
          },
          {
            "name": " TRO TỐI ĐA",
            "unit": "%",
            "value": "14"
          },
          {
            "name": "XƠ THÔ TỐI ĐA",
            "unit": "%",
            "value": "6"
          },
          {
            "name": "PHOTPHO TỔNG TỐI THIỂU",
            "unit": "%",
            "value": "0.5"
          },
          {
            "name": "LYSINE TỔNG TỐI THIỂU",
            "unit": "%",
            "value": "1.8"
          },
          {
            "name": "ETHOXYQUIN TỐI ĐA",
            "unit": "mg/kg",
            "value": "150"
          },
          {
            "name": "BHA + BHT TỐI ĐA",
            "unit": "mg/kg",
            "value": "300"
          }
        ],
        "package_type": null,
        "product_name": "UP - THỨC ĂN HỖN HỢP CHO CÁ GIỐNG - FINGERLINGS FEED",
        "product_type": null,
        "registrant": "CÔNG TY TNHH UNI-PRESIDENT VIỆT NAM",
        "species": null,
        "uses": null,
        "variant_code": "D002SV"
      },
      "error_code": "NONE",
      "message": "Trích xuất thông tin thành công",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": []
      },
      "success": true
    },
    "raw": {
      "data": {
        "category": "fish_feed",
        "exp_date": "",
        "feeding_guide": {
          "code": "D002SV",
          "guide": [
            {
              "name": "HÌNH DẠNG",
              "value": "VIÊN (Pellet)"
            },
            {
              "name": "KÍCH CỠ THỨC ĂN (mm)",
              "value": "0.8 - 1.2"
            },
            {
              "name": "TRỌNG LƯỢNG CƠ THỂ (g)",
              "value": "3 - 5"
            },
            {
              "name": "TỶ LỆ CHO ĂN (%)",
              "value": "8 - 10"
            },
            {
              "name": "SỐ LẦN CHO ĂN / NGÀY",
              "value": "5 - 6"
            }
          ]
        },
        "form_type": null,
        "ingredients": "Bột cá, Bột đậu nành, Bột mì, Dầu cá, Vitamin và Khoáng chất. Fish meal, Soybean meal, Wheat flour, Fish oil, Vitamins and Minerals.",
        "mfg_date": null,
        "net_content": "10",
        "net_unit": "kg",
        "nutrition_facts": [
          {
            "name": "ĐỘ ẨM TỐI ĐA",
            "unit": "%",
            "value": "11"
          },
          {
            "name": "PROTEIN THÔ TỐI THIỂU",
            "unit": "%",
            "value": "40"
          },
          {
            "name": "BÉO THÔ TỐI THIỂU (*)",
            "unit": "%",
            "value": "5"
          },
          {
            "name": " TRO TỐI ĐA",
            "unit": "%",
            "value": "14"
          },
          {
            "name": "XƠ THÔ TỐI ĐA",
            "unit": "%",
            "value": "6"
          },
          {
            "name": "PHOTPHO TỔNG TỐI THIỂU",
            "unit": "%",
            "value": "0.5"
          },
          {
            "name": "LYSINE TỔNG TỐI THIỂU",
            "unit": "%",
            "value": "1.8"
          },
          {
            "name": "ETHOXYQUIN TỐI ĐA",
            "unit": "mg/kg",
            "value": "150"
          },
          {
            "name": "BHA + BHT TỐI ĐA",
            "unit": "mg/kg",
            "value": "300"
          }
        ],
        "package_type": null,
        "product_name": "UP - THỨC ĂN HỖN HỢP CHO CÁ GIỐNG - FINGERLINGS FEED",
        "product_type": null,
        "registrant": "CÔNG TY TNHH UNI-PRESIDENT VIỆT NAM",
        "species": null,
        "uses": null,
        "variant_code": "D002SV"
      },
      "error_code": "NONE",
      "message": "Trích xuất thông tin thành công",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": []
      },
      "success": true
    },
    "totalImages": 2
  }
}
```

### 10.4. Ví dụ Giống Cây Trồng (Seed)

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thành công",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": [
          {
            "field": "mfg_date",
            "issue": "AMBIGUOUS_VALUE",
            "message": "Ngày thu hoạch in mờ, chỉ đọc được phần năm 2025"
          }
        ]
      },
      "data": {
        "category": "Giống lúa",
        "form_type": "hat",
        "registrant": "DNTN TM-DV HỒ QUANG",
        "product_name": "GIỐNG LÚA ST25 CẤP XÁC NHẬN 1",
        "net_content": "50",
        "net_unit": "kg",
        "package_type": "bao",
        "mfg_date": "2025",
        "exp_date": "10 tháng kể từ ngày thu hoạch",
        "cropping_season": ["Vụ Thu Đông", "Vụ Đông Xuân", "Vụ Hè Thu"],
        "growth_duration": "Vụ Thu Đông và Đông Xuân 95-100 ngày - Vụ Hè Thu 100-105 ngày",
        "lot_number": "94.XN1.25.140",
        "manufacturer": "Trại Lúa Giống HỒ QUANG",
        "origin": "Sóc Trăng, Việt Nam",
        "quality_criteria": [
          {
            "name": "Độ sạch",
            "value": "≥ 99,0",
            "unit": "%"
          },
          {
            "name": "Hạt khác giống",
            "value": "≤ 0,3",
            "unit": "%"
          },
          {
            "name": "Hạt cỏ dại",
            "value": "≤ 10",
            "unit": "hạt/kg"
          },
          {
            "name": "Tỉ lệ nảy mầm",
            "value": "≥ 80",
            "unit": "%"
          },
          {
            "name": "Độ ẩm",
            "value": "≤ 13,5",
            "unit": "%"
          }
        ]
      }
    },
    "totalImages": 2
  }
}
```

Giải thích nhanh:

- **data.response**: Kết quả cuối cùng (đã hợp nhất từ web nếu có).
- **data.raw**: Kết quả thô từ Vision AI (chỉ có khi search web được thực hiện).
- **data.search_metadata**: Trạng thái và nguồn dữ liệu tìm kiếm.
- **registrant**: Công ty đăng ký sản phẩm (thay thế cho manufacturer).
- **dosage.instruction**: Nội dung hướng dẫn chi tiết (thanh thế cho amount trong các schema cũ).
- **pre_harvest_interval_days**: Số ngày cách ly (số nguyên).
- **totalImages**: Số lượng ảnh trong request gốc.
