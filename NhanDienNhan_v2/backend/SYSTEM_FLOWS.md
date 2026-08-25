# Bản đồ chức năng và luồng hệ thống

> Mục đích: tài liệu ngữ cảnh kỹ thuật để Agent tra cứu nhanh khi phân tích, sửa đổi hoặc mở rộng backend.
>
> Phạm vi rà soát: toàn bộ mã nguồn `src/`, cấu hình build/deploy, tài liệu response schema, feature spec và HTML mẫu trong repository. Hành vi mô tả dưới đây ưu tiên mã nguồn đang được import và thực thi trong `src/`.

## 1. Tổng quan hệ thống

Đây là backend Node.js/TypeScript dùng Express 5 để nhận ảnh hoặc PDF, gửi nội dung sang mô hình thị giác qua API tương thích OpenAI, ép kết quả về JSON theo Zod schema và trả dữ liệu có cấu trúc cho frontend.

Hệ thống có hai nhóm nghiệp vụ chính:

1. Nhận diện nhãn sản phẩm nông nghiệp:
   - Thuốc bảo vệ thực vật/thuốc thủy sản (`pesticide`).
   - Phân bón (`fertilizer`).
   - Thức ăn thủy sản (`fish_feed`).
   - Hạt giống (`seed`).
   - Riêng thuốc BVTV và phân bón có thể tra cứu web để làm giàu kết quả.
2. Nhận diện chứng từ:
   - Hóa đơn/phiếu bán hàng (`invoice`).
   - Phiếu xuất kho/phiếu giao hàng/phiếu cân (`delivery_note`).
   - Nhận cả ảnh và PDF, hỗ trợ nhiều chứng từ trong một lượt phân tích.

Core của hệ thống là chuỗi xử lý:

```text
Upload file
  -> kiểm tra loại/kích thước file
  -> chuẩn bị ảnh (PDF được đổi thành các trang PNG)
  -> chọn prompt + Zod schema + model theo nghiệp vụ
  -> gọi Vision LLM với structured output
  -> parse/chuẩn hóa kết quả
  -> hậu xử lý nghiệp vụ
  -> trả response cho client
```

Với thuốc BVTV/phân bón, chuỗi trên có thể nối thêm:

```text
Kết quả Vision LLM
  -> quyết định có tra cứu hay không
  -> scraper nguồn dữ liệu ngoài bằng Cheerio
  -> dữ liệu web đã chuẩn hóa
  -> Fusion LLM hợp nhất ảnh + web
  -> kết quả enriched + metadata nguồn tìm kiếm
```

## 2. Kiến trúc runtime

```mermaid
flowchart TD
    Client[Client / Frontend] --> App[Express app]
    App --> ImageRoute[/api/image]
    App --> ReceiptRoute[/api/receipt]

    ImageRoute --> UploadImage[Multer memory storage]
    UploadImage --> Prompt[Chọn prompt theo category]
    Prompt --> Vision[Vision LLM + Zod schema]
    Vision --> DateProcess[Chuẩn hóa ngày nếu được yêu cầu]
    DateProcess --> SearchGate{searchMode và category}
    SearchGate -->|không tra cứu| ProductResponse[Product response]
    SearchGate -->|có tra cứu| Orchestrator[Search orchestrator]
    Orchestrator --> Cache{In-memory TTL cache}
    Cache -->|hit| Fusion
    Cache -->|miss, pesticide| PesticideSite[danhmuc.thuocbvtv.com]
    Cache -->|miss, fertilizer| FertilizerSite[113.190.254.147/PhanBon]
    PesticideSite --> Fusion[Fusion LLM]
    FertilizerSite --> Fusion
    Fusion --> ProductResponse

    ReceiptRoute --> UploadDocument[Multer memory storage]
    UploadDocument --> PdfConvert[PDF -> PNG pages]
    PdfConvert --> ReceiptVision[Vision LLM + document schema]
    ReceiptVision --> Reconcile[Đối chiếu số học]
    Reconcile --> ReceiptResponse[Receipt response]

    ProductResponse --> Client
    ReceiptResponse --> Client
    App -. processing error .-> ErrorHandler[Central error middleware]
    ErrorHandler --> Client
```

## 3. Điểm vào, middleware và cấu hình chạy

### Điểm vào

- `src/config/env.ts`: nạp `.env` một lần, parse/validate các biến cấu hình và áp dụng default an toàn.
- `src/index.ts`: import Express app và lắng nghe tại `appConfig.port` (mặc định `5000`).
- `src/app.ts`: khởi tạo app, middleware, route và error handler.
- `src/utils/llmModel.ts`: tạo một OpenAI SDK client nhưng trỏ `baseURL` sang Gemini OpenAI-compatible API.

### Middleware toàn cục

Thứ tự trong `src/app.ts`:

1. CORS hỗ trợ các method phổ biến, `credentials: true` và hai header `Content-Type`, `Authorization`. Mặc định cho mọi origin; khi có `CORS_ORIGINS`, chỉ các origin trong allowlist được chấp nhận.
2. `express.json()`.
3. `express.urlencoded({ extended: true })`.
4. Mount product routes tại `/api/image`.
5. Mount receipt routes tại `/api/receipt`.
6. Các endpoint gốc/health/test.
7. `errorHandler` ở cuối chuỗi middleware.

### Biến môi trường

| Biến                    | Mục đích                                                         | Giá trị mặc định |
| ----------------------- | ---------------------------------------------------------------- | ---------------- |
| `GEMINI_API_KEY`        | API key cho Gemini OpenAI-compatible endpoint                    | Không có         |
| `PORT`                  | Cổng HTTP của Express                                            | `5000`           |
| `CORS_ORIGINS`          | Allowlist origin phân tách bằng dấu phẩy; để trống giữ allow-all | Trống            |
| `ENABLE_TEST_ENDPOINTS` | Đặt `false` để tắt hai test endpoint                             | Bật              |
| `LLM_TIMEOUT_MS`        | Timeout cho mỗi request LLM SDK                                  | `60000`          |
| `SEARCH_CACHE_TTL_MS`   | TTL cache RAM cho kết quả tra cứu, tính bằng mili-giây           | `86400000`       |

Các biến trên đều có mẫu trong `.env.example`.

## 4. Danh sách API hiện có

| Method | Endpoint               | Chức năng                                                                                        |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`  | `/`                    | Trả chuỗi chào mừng API.                                                                         |
| `GET`  | `/health`              | Health check, trả `{ status: "ok", message: "Server is running" }`.                              |
| `POST` | `/test-openai`         | Gọi prompt kiểm tra tới model; có thể tắt bằng biến môi trường.                                  |
| `POST` | `/api/image/analyze`   | Nhận 1-10 ảnh nhãn sản phẩm, trích xuất theo category, có thể chuẩn hóa ngày và làm giàu từ web. |
| `POST` | `/api/image/test`      | Nhận ảnh và dùng prompt raw-test hiện có, với model test được hard-code trong hàm test.          |
| `POST` | `/api/receipt/analyze` | Nhận 1-10 ảnh/PDF chứng từ, OCR đa chứng từ và đối chiếu số học.                                 |

## 5. Luồng nhận diện nhãn sản phẩm

### 5.1 Request contract

Endpoint: `POST /api/image/analyze`

- Content type: `multipart/form-data`.
- Field file: `images`.
- Tối đa 10 file.
- Tối đa 10 MB cho mỗi file.
- Route chấp nhận JPEG, PNG, GIF và WebP; MIME được chuẩn hóa và đối chiếu với magic bytes của file.
- File được giữ trong RAM qua `multer.memoryStorage()`.

Query parameters đang được đọc trực tiếp trong route:

| Query         | Cách diễn giải trong code                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `category`    | `pesticide`, `fertilizer`, `fish_feed` hoặc `seed`. Nếu bỏ trống, mặc định `pesticide`; giá trị khác trả HTTP 400. |
| `parsed`      | Chỉ là `true` khi chuỗi query bằng chính xác `"true"`; mặc định trả `response` dạng JSON string.                   |
| `formatDates` | Chỉ là `true` khi chuỗi query bằng chính xác `"true"`.                                                             |
| `searchMode`  | `always`, `interactive`; mọi giá trị khác được quy về `none`.                                                      |

### 5.2 Chuỗi xử lý

1. Multer kiểm tra số file, MIME và kích thước.
2. Route kiểm tra có ít nhất một file trong `req.files`.
3. `buildPrompt(category, searchMode === "interactive")` chọn prompt nghiệp vụ.
4. Buffer ảnh và MIME được chuyển thành hai mảng song song.
5. `processImagesWithOpenAI_chatCompletions(...)`:
   - Chuyển từng buffer sang Base64 data URL qua LLM gateway dùng chung.
   - Chọn model/schema qua LLM registry theo category và trạng thái interactive search.
   - Gửi một message gồm prompt và toàn bộ ảnh sang Chat Completions API.
   - Dùng `zodResponseFormat` để yêu cầu structured JSON.
   - Nếu model chính trả HTTP `429` hoặc `503`, gọi lại bằng model fallback.
   - Parse JSON khi `parsed=true`; nếu hậu kiểm Zod thất bại thì ghi warning nhưng vẫn trả output model để không biến response OCR thành HTTP 500.
   - Trả object nếu `parsed=true`, ngược lại giữ chuỗi JSON từ model.
   - Gọi bộ chuẩn hóa ngày nếu `formatDates=true`.
6. Route đánh giá nhánh search enrichment.
7. Nếu có enrichment, route thay `response` bằng kết quả hợp nhất và có thể trả thêm `raw`, `search_metadata`, `search_decision`.
8. Trả HTTP 200 với wrapper của API.

### 5.3 Mapping model và schema

| Category     | Model chính              | Zod response schema                              | Prompt                       |
| ------------ | ------------------------ | ------------------------------------------------ | ---------------------------- |
| `pesticide`  | `gemini-3.1-flash-lite`  | `PesticideResponseSchema` hoặc bản `WithSearch`  | `pesticide_prompt`           |
| `fertilizer` | `gemini-3.1-flash-lite`  | `FertilizerResponseSchema` hoặc bản `WithSearch` | `fertilizer_prompt`          |
| `fish_feed`  | `gemini-3-flash-preview` | `FishFeedResponseSchema`                         | `feed_prompt`                |
| `seed`       | `gemini-3.1-flash-lite`  | `SeedResponseSchema`                             | `seed_prompt`                |
| `receipt`    | `gemini-3.1-flash-lite`  | `DocumentResponseSchema`                         | Được truyền từ receipt route |

Model fallback dùng chung: `gemini-2.5-flash`.

### 5.4 Logic searchMode

#### `none`

- Không thêm search-decision instructions vào prompt.
- Không gọi nguồn web.
- Trả kết quả Vision LLM sau bước parse/format ngày.

#### `always`

- Chỉ kích hoạt thực tế cho `pesticide` và `fertilizer`.
- Luôn gọi `enrichWithSearch(...)` sau bước Vision LLM.

#### `interactive`

- Schema và prompt có thêm `search_decision` gồm:
  - `needs_web_search: boolean`.
  - `search_reason: string | null`.
- Route parse response để đọc quyết định và dữ liệu.
- Search được kích hoạt khi có ít nhất một điều kiện:
  - LLM đặt `needs_web_search = true`.
  - `ingredients` thiếu hoặc là mảng rỗng.
  - `pre_harvest_interval_days` là `null`/`undefined`.
- Chỉ `pesticide` và `fertilizer` đi vào search orchestrator.

### 5.5 Response wrapper

```json
{
  "success": true,
  "data": {
    "response": {},
    "raw": {},
    "totalImages": 1,
    "search_metadata": {},
    "search_decision": {}
  }
}
```

- `data.response`: kết quả cuối; là object khi `parsed=true`, ngược lại là JSON string.
- `data.raw`: kết quả trước fusion, chỉ xuất hiện khi enrichment thực sự được gọi.
- `data.totalImages`: số file ảnh đầu vào.
- `data.search_metadata`: chỉ xuất hiện khi đã gọi orchestrator.
- `data.search_decision`: chỉ được expose ở wrapper trong interactive mode khi model có trả quyết định.

## 6. Dữ liệu sản phẩm theo category

### 6.1 Wrapper chung do LLM trả về

Tất cả response schema mở rộng từ `BaseResponseSchema`:

| Trường       | Kiểu        | Ý nghĩa                                                                                            |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| `success`    | boolean     | Trích xuất nghiệp vụ có thành công hay không.                                                      |
| `error_code` | enum        | `NONE`, `BLURRY_IMAGE`, `WRONG_PRODUCT_CATEGORY`, `TEXT_NOT_READABLE`, `MISSING_LABEL`, `UNKNOWN`. |
| `message`    | string      | Thông báo dành cho UI.                                                                             |
| `metadata`   | object/null | Độ tin cậy và cảnh báo review.                                                                     |
| `data`       | object/null | Dữ liệu nghiệp vụ theo category.                                                                   |

`metadata` gồm:

- `overall_confidence`: số từ 0 đến 1.
- `review_warnings[]`: mỗi phần tử có `field`, `issue`, `message`.

### 6.2 Trường sản phẩm chung

Các schema sản phẩm dùng chung các trường:

- `category`.
- `form_type`.
- `registrant`.
- `product_name`.
- `net_content`.
- `net_unit`.
- `package_type`.
- `mfg_date`.
- `exp_date`.

### 6.3 Thuốc BVTV/thuốc thủy sản

Các trường riêng:

- `product_type`: `hoa_hoc` hoặc `sinh_hoc`.
- `registration_number`.
- `uses`.
- `ingredients[]`: `{ name, content }`.
- `dosage`: chuỗi chung hoặc mảng `{ target, instruction }`.
- `target_crops[]`.
- `target_pests[]`.
- `pre_harvest_interval_days`.

Khi không tìm thấy thời gian cách ly, schema hiện tại áp dụng giá trị mặc định là `7` ngày.

### 6.4 Phân bón

Các trường riêng:

- `product_type`: `vo_co` hoặc `huu_co`.
- `registration_number`.
- `uses`.
- `ingredients[]`: `{ name, content }`.
- `dosage`: chuỗi chung hoặc mảng `{ target, instruction }`.
- `target_crops[]`.
- `pre_harvest_interval_days`.

Khi nhãn không có hoặc thông tin này không áp dụng, schema hiện tại áp dụng giá trị mặc định là `7` ngày.

### 6.5 Thức ăn thủy sản

Các trường riêng:

- `product_type`.
- `species`.
- `uses`.
- `ingredients`: chuỗi nguyên liệu.
- `variant_code`.
- `nutrition_facts[]`: `{ name, value, unit }`.
- `feeding_guide`: chuỗi chung hoặc `{ code, guide: [{ name, value }] }`.

Prompt ưu tiên mã biến thể được đánh dấu trực quan và yêu cầu chỉ lấy bảng dinh dưỡng/hướng dẫn tương ứng mã đó.

### 6.6 Hạt giống

Các trường riêng:

- `form_type`: `hat`, `cay` hoặc `khac`.
- `cropping_season[]`.
- `growth_duration`.
- `lot_number`.
- `manufacturer`.
- `origin`.
- `quality_criteria[]`: `{ name, value, unit }`.

## 7. Luồng chuẩn hóa ngày

Luồng này chạy khi caller truyền `formatDates=true` vào image processor.

1. `formatDatesInResponse` parse chuỗi JSON nếu cần.
2. Nếu response có `data`, gọi `formatDatesInProductInfo(data)`.
3. Hàm xử lý:
   - Chuẩn hóa `mfg_date` về `DD/MM/YYYY` khi parse được.
   - Chuẩn hóa `purchase_date` khi có.
   - Với `exp_date`:
     - Nếu là thời lượng như tháng/năm/ngày/tuần và có `mfg_date`, tính ngày hết hạn.
     - Nếu giống ngày cụ thể, chuẩn hóa trực tiếp.
4. Sau đó giữ object hoặc stringify lại theo contract `parsed`.

Quy ước năm 2 chữ số: `00-40` thuộc 2000, `41-99` thuộc 1900. Ngày được kiểm tra theo lịch thực tế; phép cộng tháng cho HSD sẽ chặn ngày cuối tháng về ngày hợp lệ cuối cùng của tháng đích. Với chứng từ, `data.documents[].date` cũng được chuẩn hóa.

## 8. Luồng tra cứu và làm giàu dữ liệu web

### 8.1 Search orchestrator

`enrichWithSearch(imageExtractionResult, category)` điều phối toàn bộ nhánh:

1. Lấy `data.product_name` và `data.registration_number` từ kết quả ảnh.
2. Nếu cả hai không có giá trị sử dụng được, trả nguyên bản với trạng thái `skipped`.
3. Tạo cache key từ category, product name và registration number đã lowercase/trim.
4. Nếu cache hit, lấy dữ liệu web đã cache và fusion với kết quả ảnh của request hiện tại.
5. Chọn provider theo category.
6. Provider tìm và parse dữ liệu web thành internal model thống nhất.
7. Nếu không tìm thấy, trả nguyên bản với `not_found`.
8. Nếu tìm thấy, gọi `fuseResults(...)` để hợp nhất bằng LLM.
9. Chỉ cache search result trong 24 giờ; enriched result luôn được tạo riêng cho từng request.
10. Trả kết quả kèm `search_metadata`.

Mọi lỗi trong orchestrator được bắt lại; kết quả ảnh ban đầu được trả về với `search_status: "failed"`.

### 8.2 Trạng thái search metadata

| Trạng thái             | Ý nghĩa                                                |
| ---------------------- | ------------------------------------------------------ |
| `enriched`             | Tìm thấy dữ liệu và fusion thành công, hoặc cache hit. |
| `not_found`            | Đã tìm nhưng không có kết quả phù hợp.                 |
| `skipped`              | Không có tên/mã đăng ký để tìm.                        |
| `failed`               | Lỗi ở scraper hoặc fusion; trả dữ liệu ảnh nguyên bản. |
| `unsupported_category` | Có trong type dùng chung cho category chưa hỗ trợ.     |

Metadata có thể kèm `source_url` và `search_query`.

### 8.3 HTTP client dùng cho scraper

`fetchWithRetry` cung cấp:

- Timeout mặc định 8 giây cho mỗi lần thử.
- Tối đa 2 lần retry sau lần gọi đầu.
- Backoff 1 giây rồi 2 giây.
- Semaphore toàn tiến trình, tối đa 2 HTTP request tới nguồn ngoài chạy đồng thời.
- Header User-Agent, Accept và ngôn ngữ tiếng Việt.

### 8.4 Pesticide provider

Nguồn: `https://danhmuc.thuocbvtv.com`.

Thứ tự tìm:

1. `registration_number`, nếu có.
2. `product_name`, nếu có.

Mỗi query:

1. Gọi `/thuoc/search?q=<query>`.
2. Parse bảng `.data-table` để lấy tên, hoạt chất tóm tắt, công ty và detail URL.
3. Chọn kết quả:
   - Với tên: exact match, normalized match bỏ dấu hoặc containment; nếu nhiều ứng viên vẫn mơ hồ thì không chọn tùy ý phần tử đầu.
   - Với số đăng ký: ưu tiên URL chứa số đăng ký đã normalize, sau đó xác minh lại số đăng ký trên trang detail; ứng viên không khớp bị bỏ qua.
4. Gọi detail URL.
5. Parse:
   - Tên sản phẩm.
   - Công ty đăng ký.
   - Số đăng ký.
   - Hoạt chất/hàm lượng.
   - Cây trồng, dịch hại.
   - Liều lượng, thời gian cách ly, cách dùng.
6. Trả `PesticideSearchResult` kèm `source_url`.

### 8.5 Fertilizer provider

Nguồn: `http://113.190.254.147/PhanBon/en/phanbonchungnhan`.

Thứ tự tìm:

1. `MaPhanBon=<registration_number>`, nếu có.
2. `TenPhanBon=<product_name>`, nếu có.

Trang search đồng thời là trang detail. Provider parse:

- Tên phân bón.
- Mã số phân bón.
- Tổ chức/cá nhân đăng ký.
- Thành phần và hàm lượng dinh dưỡng.
- Hướng dẫn sử dụng.
- Một số thông tin chung dùng làm nội dung dosage dự phòng.
- `source_url`.

### 8.6 Fusion LLM

`fuseResults(...)` nhận:

```json
{
  "imageExtraction": {},
  "webSearchResult": {}
}
```

Model fusion: `gemini-3.1-flash-lite`.

Nguyên tắc prompt fusion hiện tại:

- Xác nhận hai nguồn nói về cùng sản phẩm.
- Trường định danh tĩnh ưu tiên dữ liệu web chính thức khi có.
- Trường hướng dẫn sử dụng được so sánh về crop, giai đoạn, liều, cách dùng và độ chi tiết.
- Giữ hướng dẫn cụ thể trên nhãn khi dữ liệu web mang tính tổng quát hoặc khác đáng kể.
- Khi không chắc chắn, ưu tiên dữ liệu ảnh.
- Giữ `overall_confidence`; cập nhật `review_warnings` theo output cuối.
- Giữ `success`, `error_code`, `message` của kết quả ảnh.
- Output bị ép theo schema pesticide/fertilizer tương ứng.

## 9. Luồng nhận diện chứng từ

### 9.1 Request contract

Endpoint: `POST /api/receipt/analyze`

- Content type: `multipart/form-data`.
- Field file: `images`.
- Tối đa 10 file upload.
- Mỗi file tối đa 10 MB.
- Chấp nhận JPEG, PNG, GIF, WebP hoặc PDF và kiểm tra magic bytes tương ứng.
- File được lưu trong RAM.

### 9.2 Chuỗi xử lý

1. Multer nhận và kiểm tra file.
2. Với ảnh: đưa buffer và MIME vào danh sách xử lý.
3. Với PDF: đọc metadata để đếm trang trước, chưa render PNG ở bước kiểm tra.
4. Kiểm tra tổng số ảnh + trang PDF không vượt quá 10; chỉ sau khi hợp lệ mới render các trang PDF thành PNG tại `viewportScale: 1.0`.
5. Gọi `processImagesWithOpenAI_chatCompletions` với:
   - `receipt_prompt`.
   - `schemaType = "receipt"`.
   - `isParsed = true`.
   - `formatDates = true`.
   - `withSearchSchema = false`.
6. LLM phân loại và trích từng chứng từ trong toàn bộ tập ảnh.
7. `reconcileDocumentMath` kiểm tra các quan hệ số học và thêm `MATH_MISMATCH` vào `metadata.review_warnings` khi lệch.
8. Trả object JSON đã parse cùng tổng số ảnh/trang.

### 9.3 Document schema

`DocumentResponseSchema.data` gồm:

- `document_count`: tổng số chứng từ phát hiện.
- `documents[]`: discriminated union theo `document_type`.

#### `delivery_note`

Thông tin đầu phiếu:

- `supplier_name`, `customer_name`.
- `document_number`, `date`.
- `license_plate`.
- `total_bags`, `total_weight_kg`.

Mỗi item:

- `product_name`, `product_code`, `lot_number`.
- `net_content`, `net_unit`.
- `bag_count`, `total_weight`.

Đối chiếu số học:

- `net_content * bag_count == total_weight` cho từng dòng.
- Tổng `bag_count == total_bags`.
- Tổng `total_weight == total_weight_kg`.

#### `invoice`

Thông tin đầu phiếu:

- `supplier_name`, `customer_name`.
- `document_number`, `date`.
- `grand_total`.

Mỗi item:

- `product_name`, `product_code`, `lot_number`.
- `quantity`, `unit`.
- `unit_price`, `total_amount`.

Đối chiếu số học:

- `quantity * unit_price == total_amount` cho từng dòng.
- Tổng `total_amount == grand_total`.

Các phép so sánh tiền/khối lượng dùng sai số `0.01`; tổng số bao so sánh trực tiếp.

### 9.4 Response wrapper

```json
{
  "success": true,
  "data": {
    "response": {
      "success": true,
      "error_code": "NONE",
      "message": "...",
      "metadata": {
        "overall_confidence": 0.95,
        "review_warnings": []
      },
      "data": {
        "document_count": 1,
        "documents": []
      }
    },
    "totalImages": 1
  }
}
```

## 10. Error flow

### Upload error

Mỗi route có `handleMulterError` riêng:

- `LIMIT_FILE_SIZE` -> HTTP 400, thông báo vượt 10 MB.
- Multer error khác -> HTTP 400.
- MIME không hợp lệ hoặc upload error chung -> HTTP 400.

### Processing error

- Handler chính đặt message dự phòng rồi gọi `next(error)`.
- `errorHandler` chọn status theo thứ tự:
  1. `res.statusCode` nếu khác 200.
  2. `err.statusCode` nếu error mang kiểu `AppError`.
  3. `500`.
- Response lỗi tập trung:

```json
{
  "success": false,
  "message": "..."
}
```

Route không tồn tại trả HTTP 404 dạng JSON. Lỗi upload 400 giữ trường `error` hiện có và bổ sung `message` cùng nội dung.

### Search error

Search và fusion được cô lập trong orchestrator. Lỗi ở nhánh này không làm request OCR chính thất bại; API trả kết quả ảnh gốc với `search_status: "failed"`.

## 11. Bản đồ module và trách nhiệm

| File/thư mục                                | Trách nhiệm                                                          |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `src/index.ts`                              | Khởi động HTTP server.                                               |
| `src/app.ts`                                | Khởi tạo Express, middleware và mount route.                         |
| `src/routes/imageRoutes.ts`                 | HTTP contract và điều phối luồng nhận diện sản phẩm.                 |
| `src/routes/receiptRoutes.ts`               | HTTP contract, chuyển PDF và điều phối luồng chứng từ.               |
| `src/services/analyze/imageProcessor.ts`    | Điều phối OCR, parse và format ngày; giữ API hàm cũ cho các route.   |
| `src/services/analyze/llmRegistry.ts`       | Mapping model/schema/fallback dùng chung cho OCR, test và fusion.    |
| `src/services/analyze/llmGateway.ts`        | Tạo data URL và gọi Chat Completions có structured output/fallback.  |
| `src/utils/llmModel.ts`                     | Cấu hình SDK client và Gemini base URL.                              |
| `src/utils/prompts/productPrompts.ts`       | Prompt cho bốn loại sản phẩm và search decision.                     |
| `src/utils/prompts/receiptPrompt.ts`        | Prompt OCR đa chứng từ.                                              |
| `src/validation/baseSchema.ts`              | Response wrapper, error code, confidence, warnings, search decision. |
| `src/validation/productInfo.ts`             | Zod schema cho pesticide, fertilizer, fish feed, seed.               |
| `src/validation/receiptInfo.ts`             | Zod schema đa chứng từ đang hoạt động.                               |
| `src/utils/dateUtils.ts`                    | Parse ngày, thời hạn và tính ngày hết hạn.                           |
| `src/utils/dateProcessor.ts`                | Áp dụng date utilities lên response sản phẩm và ngày trong chứng từ. |
| `src/utils/documentReconciler.ts`           | Đối chiếu toán học invoice/delivery note.                            |
| `src/utils/requestValidation.ts`            | Parse/default/validate query parameters của product endpoint.        |
| `src/utils/uploadValidation.ts`             | Allowlist MIME, chuẩn hóa MIME và kiểm tra magic bytes upload.       |
| `src/config/env.ts`                         | Nạp, parse và chuẩn hóa cấu hình môi trường dùng chung.              |
| `src/services/search/searchOrchestrator.ts` | Điều phối provider, cache và fusion.                                 |
| `src/services/search/httpClient.ts`         | Fetch có timeout, retry, backoff, semaphore.                         |
| `src/services/search/searchCache.ts`        | Cache Map trong RAM, TTL 24 giờ, cleanup mỗi giờ.                    |
| `src/services/search/pesticideProvider.ts`  | Scrape search/detail trang thuốc BVTV.                               |
| `src/services/search/fertilizerProvider.ts` | Scrape trang chi tiết phân bón.                                      |
| `src/services/search/fusionService.ts`      | LLM hợp nhất kết quả ảnh và web.                                     |
| `src/services/search/types.ts`              | Internal search models và metadata types.                            |
| `src/middleware/error.middleware.ts`        | Error response tập trung.                                            |
| `src/utils/AppError.ts`                     | Error class có HTTP status.                                          |

## 12. Trạng thái và dữ liệu lưu trong tiến trình

- Backend không có database nội bộ.
- File upload chỉ tồn tại trong RAM trong vòng đời request.
- Search cache dùng singleton `Map`, không persist qua restart và không chia sẻ giữa nhiều instance.
- LLM và hai website tra cứu là các phụ thuộc runtime bên ngoài.

## 13. Build, chạy và deploy

### Scripts

| Script                 | Tác dụng                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run dev`          | Chạy `tsx --watch src/index.ts` bằng dependency đã pin.                    |
| `npm run build`        | Bundle `src/index.ts` bằng esbuild sang `dist/`, CommonJS, target Node 22. |
| `npm run typecheck`    | Typecheck source và regression tests.                                      |
| `npm start`            | Chạy `dist/index.js` và preload dotenv config.                             |
| `npm run prettier`     | Kiểm tra format.                                                           |
| `npm run prettier:fix` | Ghi lại format.                                                            |
| `npm test`             | Chạy regression và endpoint contract tests bằng Node test runner + tsx.    |

### Docker

- Builder image: Node 22 Alpine.
- Builder chạy `npm ci` rồi `npm run build`.
- Runtime image: Node 22 Alpine; package yêu cầu Node `>=22.13.0` theo dependency PDF.
- Runtime chỉ cài production dependencies, copy `dist/`, expose port 5000 và chạy `npm start`.

### Thư viện chính

- HTTP: `express`, `cors`, `multer`.
- AI/structured output: `openai`, `zod`.
- HTML parsing: `cheerio`.
- PDF: `pdf-to-png-converter`.
- Build/runtime tooling được khai báo: `typescript`, `tsx`, `esbuild`, `dotenv`, `prettier`.

## 14. Artifact và mã không thuộc luồng production chính

- `dist/index.js` và `dist/index.js.map`: output bundle đã build; nguồn chỉnh sửa là `src/`.
- `src/validation/receiptInfo.old.ts`: receipt schema cũ, không được image processor sử dụng.
- `processImagesWithOpenAI`: hàm Responses API được đánh dấu deprecated và không được route production gọi.
- `src/utils/fastClassifier.ts`: tập keyword phân loại thử nghiệm, hiện không được import.
- `/api/image/test`, `processImagesTest`, `/test-openai`: luồng test/debug tách khỏi endpoint nghiệp vụ chính và có thể tắt bằng `ENABLE_TEST_ENDPOINTS=false`.
- `src/feature/done/FEATURE.md`: đặc tả lịch sử của tính năng online enrichment.
- `src/feature/done/HTML sample/`: snapshot HTML để xây và đối chiếu selector của hai scraper.
- `PRODUCT_RESPONSE_SCHEMA.md`, `RECEIPT_RESPONSE_SCHEMA.md`: tài liệu response hướng tới client.

## 15. Chỉ dẫn tra cứu nhanh cho Agent

Khi thay đổi hệ thống, định tuyến theo phạm vi sau:

| Nhu cầu                                | Điểm bắt đầu                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Thêm/sửa endpoint                      | `src/app.ts`, sau đó route tương ứng.                                        |
| Thay đổi upload/validation query       | `src/routes/imageRoutes.ts` hoặc `src/routes/receiptRoutes.ts`.              |
| Thay model/fallback/cách gửi ảnh       | `src/services/analyze/imageProcessor.ts`.                                    |
| Thay API key/base URL                  | `src/utils/llmModel.ts`.                                                     |
| Thay field output                      | Schema trong `src/validation/`, sau đó cập nhật prompt và tài liệu response. |
| Điều chỉnh cách OCR đọc nhãn           | `src/utils/prompts/productPrompts.ts`.                                       |
| Điều chỉnh cách OCR đọc chứng từ       | `src/utils/prompts/receiptPrompt.ts`.                                        |
| Điều chỉnh format ngày/HSD             | `src/utils/dateUtils.ts`, `src/utils/dateProcessor.ts`.                      |
| Điều chỉnh kiểm tra hóa đơn/phiếu giao | `src/utils/documentReconciler.ts`.                                           |
| Thêm nguồn tra cứu                     | Implement `SearchProvider<T>`, rồi đăng ký trong `searchOrchestrator.ts`.    |
| Sửa selector web                       | Provider tương ứng và HTML sample.                                           |
| Thay quy tắc hợp nhất ảnh/web          | `src/services/search/fusionService.ts`.                                      |
| Thay cache/retry/rate control          | `searchCache.ts`, `httpClient.ts`.                                           |
| Thay build/deploy                      | `esbuild.js`, `Dockerfile`, `package.json`.                                  |

Khi đổi contract dữ liệu, các điểm thường phải đồng bộ cùng nhau là:

```text
Zod schema
  <-> prompt trích xuất
  <-> logic hậu xử lý/search fusion
  <-> route response wrapper
  <-> PRODUCT_RESPONSE_SCHEMA.md hoặc RECEIPT_RESPONSE_SCHEMA.md
```
