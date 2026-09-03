# GA Certificate OCR Response Schema

Tài liệu mô tả contract v2 của OCR **Giấy xác nhận cấp mã số vùng trồng**.
Nguồn quyền lực là `src/modules/ga_certificate/gaCertificate.schema.ts`.

## Endpoint

`POST /api/ga_certificate/analyze`

- Content type: `multipart/form-data`.
- Field file: `images`.
- Nhận JPEG, PNG, GIF, WebP hoặc PDF.
- Tối đa 10 file, 10 MB/file; tổng số ảnh/trang PDF sau khi resolve không quá 10.
- Một request chỉ chứa một chứng nhận, có thể gồm một hoặc nhiều trang.
- Không dùng query parameter.

Lỗi upload, file không hợp lệ, PDF không đọc được hoặc không có `images` trả HTTP 400:

```json
{
  "success": false,
  "error": "...",
  "message": "..."
}
```

## HTTP response wrapper

Request hợp lệ luôn trả HTTP 200, kể cả khi model xác định giấy sai loại:

```json
{
  "success": true,
  "data": {
    "response": {},
    "totalImages": 2
  }
}
```

- `data.response`: kết quả OCR theo contract bên dưới.
- `data.totalImages`: số ảnh/trang PDF thực tế đã gửi cho model.

## `data.response`

```text
success: boolean
error_code: null | FatalErrorCode
message: string
data: GaCertificateData | null
metadata: GaCertificateMetadata
```

### Nhánh thành công

Khi `success=true`:

- `error_code` luôn là `null`.
- `data` là object đầy đủ mọi key của `GaCertificateData`.
- Field OCR không đọc chắc chắn là `null`; danh sách không có dữ liệu là `[]`.
- `success=true` vẫn có thể kèm `review_warnings`.

### Nhánh lỗi nghiệp vụ OCR

Khi `success=false`, `data` luôn là `null` và `error_code` là một trong:

| Code                          | Ý nghĩa                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `NO_DOCUMENT_DETECTED`        | Không phát hiện tài liệu.                               |
| `WRONG_DOCUMENT_TYPE`         | Ảnh rõ nhưng không phải giấy xác nhận mã số vùng trồng. |
| `MULTIPLE_DOCUMENTS_DETECTED` | Có nhiều chứng nhận độc lập trong cùng request.         |
| `PAGE_SET_MISMATCH`           | Các trang không thuộc cùng một chứng nhận.              |
| `UNREADABLE_DOCUMENT`         | Không đủ rõ để xác định loại giấy.                      |
| `EXTRACTION_FAILED`           | Lỗi gọi hoặc nhận output từ model.                      |
| `SCHEMA_VALIDATION_FAILED`    | Output model không đúng contract v2.                    |

## `GaCertificateData`

### Thông tin chứng nhận

| Field                       | Kiểu                 | Mô tả                                                       |
| --------------------------- | -------------------- | ----------------------------------------------------------- |
| `certificate_number`        | string \| null       | Số chứng nhận/số văn bản.                                   |
| `issue_date`                | `YYYY-MM-DD` \| null | Ngày cấp; chỉ có khi đủ ngày-tháng-năm.                     |
| `expiry_date`               | `YYYY-MM-DD` \| null | Ngày hết hiệu lực; không tự tính từ ngày cấp.               |
| `issuing_authority`         | string \| null       | Cơ quan/đơn vị trực tiếp cấp.                               |
| `scope_note`                | string \| null       | Ghi chú về phạm vi áp dụng.                                 |
| `certified_production`      | number \| null       | Sản lượng được chứng nhận.                                  |
| `certified_production_unit` | string \| null       | Đơn vị sản lượng in trên giấy.                              |
| `certificate_files`         | `UploadedFile[]`     | Metadata file đã upload, do server gắn; model không tự tạo. |

### Vùng trồng

| Field                                 | Kiểu              | Mô tả                                                          |
| ------------------------------------- | ----------------- | -------------------------------------------------------------- |
| `growing_area_management_unit`        | string \| null    | Đơn vị quản lý vùng trồng.                                     |
| `growing_area_code`                   | string \| null    | Mã vùng trồng giữ nguyên ký tự trên giấy.                      |
| `growing_area_name`                   | string \| null    | Tên vùng trồng.                                                |
| `total_area_ha`                       | number \| null    | Tổng diện tích theo ha.                                        |
| `overall_boundary`                    | `BoundaryPoint[]` | Các điểm ranh giới/tọa độ nhìn thấy; không tự nối polygon.     |
| `growing_area_administrative_address` | string \| null    | Địa chỉ hành chính nguyên văn trên giấy.                       |
| `growing_area_images`                 | `UploadedFile[]`  | Luôn `[]` ở endpoint này vì chưa có upload ảnh thực địa riêng. |
| `note`                                | string \| null    | Ghi chú chung.                                                 |

### `address`

Mọi field dưới đây là `string | null`. Mã hành chính chỉ được điền khi in trực
tiếp trên chứng nhận; hệ thống không tự tra cứu hoặc chuyển đổi địa giới.

```text
house_number
street_name
neighborhood
hamlet_or_equivalent
commune_code
commune_name
former_district_code
former_district_name
province_code
province_name
full_display_address
address_notes
```

### Kiểu phụ

```text
UploadedFile = {
  file_name: string,
  mime_type: string,
  size_bytes: integer >= 0
}

BoundaryPoint = {
  point_label: string | null,
  latitude: number | null,   // -90 đến 90
  longitude: number | null   // -180 đến 180
}
```

## `GaCertificateMetadata`

```text
schema_version: "growing-area-certificate.v2"
document_type: "growing_area_code_certificate" | "unknown"
page_count_received: integer >= 0
document_count_detected: integer >= 0
pages: PageMetadata[]
review_required: boolean
review_warnings: ReviewWarning[]
```

`PageMetadata`:

```text
input_index: integer >= 1
printed_page_number: integer >= 1 | null
role: "main" | "continuation" | "unknown"
usable: boolean
```

`ReviewWarning`:

```text
code: LOW_IMAGE_QUALITY | BLUR | GLARE | CROPPED_DOCUMENT |
      ROTATED_INPUT | MISSING_PAGE | PAGE_ORDER_UNCERTAIN |
      DUPLICATE_PAGE | UNREADABLE_FIELD | AMBIGUOUS_FIELD |
      NUMERIC_FORMAT_AMBIGUOUS | COORDINATE_UNREADABLE |
      TEXT_LAYER_VISUAL_MISMATCH
field_path: string | null
page_index: integer >= 1 | null
message: string
```

Warning message không được chứa nội dung dữ liệu nhạy cảm trích xuất từ giấy.
