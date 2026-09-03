# Product OCR Response Schema

Tài liệu này mô tả hợp đồng đang chạy của endpoint OCR nhãn sản phẩm. Nguồn
quyền lực của cấu trúc dữ liệu là `src/modules/product/product.schema.ts` và
`src/shared/contracts/baseResponse.schema.ts`.

## Endpoint

`POST /api/image/analyze`

- Content type: `multipart/form-data`.
- Field file: `images`.
- Nhận JPEG, PNG, GIF, WebP; tối đa 10 file và 10 MB/file. PDF không được hỗ
  trợ ở endpoint này.

### Query

| Query         | Giá trị thực tế                                | Mặc định    | Ý nghĩa                                                                                                |
| ------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `category`    | `pesticide`, `fertilizer`, `fish_feed`, `seed` | `pesticide` | Danh mục OCR. Giá trị khác trả HTTP 400.                                                               |
| `parsed`      | chỉ chuỗi `true` là bật                        | `false`     | `true` trả `data.response` là object; các giá trị khác trả chuỗi JSON.                                 |
| `formatDates` | chỉ chuỗi `true` là bật                        | `false`     | Chuẩn hóa ngày hợp lệ về `DD/MM/YYYY`; có thể tính HSD khi có NSX và thời hạn.                         |
| `searchMode`  | `none`, `always`, `interactive`                | `none`      | Chế độ search cho `pesticide` và `fertilizer`. Mọi giá trị khác, kể cả `off`, đều được hiểu là `none`. |

## HTTP response wrapper

Khi request hợp lệ, API trả HTTP 200:

```json
{
  "success": true,
  "data": {
    "response": {},
    "totalImages": 1
  }
}
```

## Phụ lục: mẫu response baseline ban đầu

Các JSON dưới đây được khôi phục nguyên văn từ baseline trước khi rút gọn tài
liệu. Đây là mẫu kết quả thực tế để tham chiếu/test UI; contract đang chạy vẫn
được mô tả ở các phần phía dưới.

### Pesticide — đã làm giàu từ web

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

### Fertilizer — đã làm giàu từ web

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

### Fish Feed — thức ăn thủy sản

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

### Seed — giống cây trồng

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

Ghi chú từ baseline:

- `data.response` là kết quả cuối cùng, đã hợp nhất dữ liệu web nếu có.
- `data.raw` là kết quả Vision AI gốc, chỉ có khi search web được thực hiện.
- `data.search_metadata` chứa trạng thái và nguồn search.
- `registrant` là công ty đăng ký sản phẩm.
- `dosage.instruction` là hướng dẫn chi tiết.
- `pre_harvest_interval_days` là số ngày cách ly.
- `totalImages` là số ảnh của request gốc.

## HTTP response wrapper — chi tiết

- `data.response`: kết quả OCR cuối cùng. Kiểu là object khi `parsed=true`,
  nếu không là chuỗi JSON chứa object cùng cấu trúc.
- `data.totalImages`: số ảnh upload đã xử lý.
- `data.raw`: chỉ xuất hiện khi search được kích hoạt bởi search gate; là OCR
  gốc trước Fusion.
- `data.search_metadata`: chỉ xuất hiện khi search gate được kích hoạt.
- `data.search_decision`: chỉ xuất hiện ở `searchMode=interactive` khi model
  trả quyết định search.

Lỗi upload, thiếu `images` hoặc `category` không hợp lệ trả HTTP 400:

```json
{
  "success": false,
  "error": "...",
  "message": "..."
}
```

## Cấu trúc `data.response` khi `parsed=true`

```text
success: boolean
error_code: NONE | BLURRY_IMAGE | WRONG_PRODUCT_CATEGORY |
            TEXT_NOT_READABLE | MISSING_LABEL | UNKNOWN
message: string
metadata: { overall_confidence, review_warnings } | null
data: ProductData | null
search_decision: { needs_web_search, search_reason } | null
```

`search_decision` chỉ có trong response schema của `pesticide`/`fertilizer`
khi request dùng `searchMode=interactive`.

### Metadata

```text
metadata.overall_confidence: number từ 0 đến 1
metadata.review_warnings: ReviewWarning[]
ReviewWarning.field: string | null
ReviewWarning.issue: string
ReviewWarning.message: string
```

`metadata` có thể là `null`. `issue` không phải enum cố định; ví dụ phổ biến
là `TEXT_BLURRY`, `TABLE_UNCLEAR`, `AMBIGUOUS_VALUE`, `IMAGE_ROTATED` hoặc
`MATH_MISMATCH` khi có xử lý hậu kỳ phù hợp.

## Trường chung trong `data`

Các trường dưới đây có ở mọi category, ngoại trừ `form_type` của `seed` dùng
enum riêng.

| Field          | Kiểu           | Giá trị/ghi chú                                                                                                                                                                      |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `category`     | enum           | `pesticide`, `fertilizer`, `fish_feed`, `seed`, `unknown`; schema theo category thành công dùng literal tương ứng.                                                                   |
| `form_type`    | enum \| null   | Product thường: `bot`, `nuoc`, `vien`, `khac`. Seed: `hat`, `cay`, `khac`.                                                                                                           |
| `registrant`   | string \| null | Công ty/tổ chức đăng ký.                                                                                                                                                             |
| `product_name` | string \| null | Tên đầy đủ trên nhãn, gồm tên phụ/marketing nếu có.                                                                                                                                  |
| `net_content`  | string \| null | Phần giá trị định lượng.                                                                                                                                                             |
| `net_unit`     | enum \| null   | `gram`, `kg`, `lit`, `m`, `ml`, `m2`, `m3`, `kwh`.                                                                                                                                   |
| `package_type` | enum \| null   | `bao`, `bo`, `cai`, `cay`, `con`, `chai`, `cuon`, `goi`, `hop`, `lon`, `can`, `mieng`, `ong`, `tam`, `thanh`, `thung`, `tui`, `vien`, `nguoi`, `lan`, `gio`, `ngay`, `thang`, `nam`. |
| `mfg_date`     | string \| null | Ngày sản xuất.                                                                                                                                                                       |
| `exp_date`     | string \| null | Hạn sử dụng hoặc thời hạn nguyên văn. Khi `formatDates=true`, hệ thống chuẩn hóa/tính được nếu dữ liệu đủ rõ.                                                                        |

### Quy ước đơn vị và mẫu response

`net_unit` là **mã enum trả về**, không phải đơn vị nguyên văn trên nhãn và
không được xử lý bằng regex ở backend. Schema gửi cho model buộc trường này
chỉ nhận một trong các mã sau; giá trị khác làm response của model không qua
được validation.

| Mã trả về `net_unit` | Đơn vị được mô tả cho model |
| -------------------- | --------------------------- |
| `gram`               | Gram                        |
| `kg`                 | Kg                          |
| `lit`                | Lít                         |
| `m`                  | Mét                         |
| `ml`                 | ml                          |
| `m2`                 | M^2                         |
| `m3`                 | M^3                         |
| `kwh`                | KWh                         |

Các mẫu response dưới đây ghi lại quy ước đang áp dụng. Chúng là mẫu dữ liệu
cho UI/test; schema đầy đủ vẫn được quyết định bởi category tương ứng ở các
phần sau.

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thông tin sản phẩm thành công.",
      "metadata": { "overall_confidence": 0.95, "review_warnings": [] },
      "data": {
        "category": "pesticide",
        "product_name": "GANCLEAR3979",
        "net_content": "1",
        "net_unit": "kg",
        "package_type": "goi"
      }
    },
    "totalImages": 1
  }
}
```

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thông tin sản phẩm thành công.",
      "metadata": { "overall_confidence": 0.95, "review_warnings": [] },
      "data": {
        "category": "fertilizer",
        "product_name": "Microtop Chelated - PHỤ GIA LẤY NHỤY",
        "net_content": "500",
        "net_unit": "ml",
        "package_type": "chai"
      }
    },
    "totalImages": 3
  }
}
```

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thông tin thành công.",
      "metadata": { "overall_confidence": 0.95, "review_warnings": [] },
      "data": {
        "category": "fish_feed",
        "product_name": "UP - THỨC ĂN HỖN HỢP CHO CÁ GIỐNG",
        "net_content": "10",
        "net_unit": "kg",
        "package_type": "bao"
      }
    },
    "totalImages": 2
  }
}
```

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "Trích xuất thành công.",
      "metadata": { "overall_confidence": 0.95, "review_warnings": [] },
      "data": {
        "category": "seed",
        "product_name": "GIỐNG LÚA ST25 CẤP XÁC NHẬN 1",
        "net_content": "50",
        "net_unit": "kg",
        "package_type": "bao"
      }
    },
    "totalImages": 2
  }
}
```

## `pesticide`

Ngoài trường chung, `data` có:

| Field                       | Kiểu                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `product_type`              | `hoa_hoc` \| `sinh_hoc` \| null                               |
| `registration_number`       | string \| null                                                |
| `uses`                      | string \| null                                                |
| `ingredients`               | `{ name: string, content: string \| null }[] \| null`         |
| `dosage`                    | `{ target: string, instruction: string }[] \| string \| null` |
| `target_crops`              | string[] \| null                                              |
| `target_pests`              | string[] \| null                                              |
| `pre_harvest_interval_days` | integer; mặc định `7` nếu model không trả giá trị             |

## `fertilizer`

Ngoài trường chung, `data` có:

| Field                       | Kiểu                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `product_type`              | `vo_co` \| `huu_co` \| null                                   |
| `registration_number`       | string \| null                                                |
| `uses`                      | string \| null                                                |
| `ingredients`               | `{ name: string, content: string \| null }[] \| null`         |
| `dosage`                    | `{ target: string, instruction: string }[] \| string \| null` |
| `target_crops`              | string[] \| null                                              |
| `pre_harvest_interval_days` | integer; mặc định `7` nếu model không trả giá trị             |

## `fish_feed`

Ngoài trường chung, `data` có:

| Field             | Kiểu                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `product_type`    | string \| null                                                                         |
| `species`         | string \| null                                                                         |
| `uses`            | string \| null                                                                         |
| `ingredients`     | string \| null                                                                         |
| `variant_code`    | string \| null                                                                         |
| `nutrition_facts` | `{ name: string, value: string, unit: string \| null }[] \| null`                      |
| `feeding_guide`   | `{ code: string \| null, guide: { name: string, value: string }[] } \| string \| null` |

## `seed`

Ngoài trường chung (với `form_type` là `hat`, `cay`, `khac`), `data` có:

| Field              | Kiểu                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `cropping_season`  | string[] \| null                                                  |
| `growth_duration`  | string \| null                                                    |
| `lot_number`       | string \| null                                                    |
| `manufacturer`     | string \| null                                                    |
| `origin`           | string \| null                                                    |
| `quality_criteria` | `{ name: string, value: string, unit: string \| null }[] \| null` |

## Search metadata

```text
search_status: enriched | not_found | skipped | failed | unsupported_category
source_url?: string
search_query?: string
```

`source_url` và `search_query` là optional: key bị bỏ khi không có giá trị,
không trả `null`. Search lỗi hoặc không tìm thấy không làm OCR chính thất bại.
