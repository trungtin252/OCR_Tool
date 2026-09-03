# OCR chứng nhận vùng trồng

Module xử lý **Giấy xác nhận cấp mã số vùng trồng**. Đây là feature OCR độc lập; không tìm hoặc ghi trực tiếp bất kỳ DB ID nào.

## API

`POST /api/ga_certificate/analyze`

Response contract đầy đủ: [`GA_CERTIFICATE_RESPONSE_SCHEMA.md`](../../../GA_CERTIFICATE_RESPONSE_SCHEMA.md).

- `multipart/form-data`, field file: `images`.
- Nhận JPEG, PNG, GIF, WebP và PDF; kiểm tra MIME lẫn magic bytes.
- Tối đa 10 file, 10 MB mỗi file, tổng ảnh/trang PDF đã resolve tối đa 10.
- Một chứng nhận có thể gồm một hay nhiều trang. Input chứa nhiều chứng nhận độc lập trả lỗi OCR `MULTIPLE_DOCUMENTS_DETECTED`.
- HTTP response dùng wrapper giống Receipt: `data.response` là kết quả OCR theo `GrowingAreaCertificateResponseSchema`, `data.totalImages` là số ảnh/trang đã gửi cho model.

## Thành phần

- `gaCertificate.routes.ts`: upload middleware và `POST /analyze`.
- `gaCertificate.controller.ts`: HTTP response contract.
- `gaCertificate.service.ts`: magic-byte validation, PDF-to-PNG, structured OCR và schema validation.
- `gaCertificate.schema.ts`: Zod contract v2 tối giản, gồm dữ liệu cần nhập, page metadata, warnings và fatal error codes.
- `gaCertificate.prompts.ts`: prompt OCR đã khóa bởi regression hash test.

## Ràng buộc nghiệp vụ

- Chỉ trích xuất nội dung đọc rõ; không suy diễn, geocode hay đổi địa giới hành chính.
- Field không chắc chắn là `null`; danh sách không có item là `[]`; warning không chứa raw PII/địa chỉ/tọa độ.
- Không OCR/chứng thực dấu hoặc chữ ký viết tay.
- Không tự ghép trang từ hai chứng nhận khác nhau và không giới hạn chứng nhận ở hai trang.
- Chỉ trích xuất số/ngày cấp, hạn hiệu lực, đơn vị cấp, phạm vi, sản lượng, thông tin vùng trồng, ranh giới và các thành phần địa chỉ được yêu cầu.
- Metadata file chứng nhận do server lấy từ file upload, không cho model suy diễn từ tên file. `growing_area_images` để rỗng vì endpoint này chưa nhận ảnh thực địa riêng.
- Mã hành chính chỉ được điền nếu in trực tiếp trên giấy; việc mapping danh mục DB nằm ngoài OCR.

## Kiểm thử

Regression test khóa prompt/schema, controller contract, model registry, signature file và giới hạn trang. Cần bổ sung ảnh/PDF chứng nhận thực tế vào fixture trước khi chốt chất lượng OCR production.
