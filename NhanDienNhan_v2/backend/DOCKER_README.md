# Docker deployment

For the separate OCR frontend at `ocrfe.o2n.ai.vn`, see
[`../frontend/DEPLOYMENT.md`](../frontend/DEPLOYMENT.md).

## Build image local

Chạy trong thư mục backend:

```bash
docker build -t nhan-dien-nhan-backend:local .
docker compose up -d --build
```

## Lưu lịch sử OCR trên host

Backend lưu file upload và kết quả OCR vào `/app/data/ocr-history` trong
container. Phải bind mount thư mục này ra host để dữ liệu còn nguyên sau khi
recreate container:

```bash
sudo mkdir -p /srv/ocr-data
sudo chown -R 1000:1000 /srv/ocr-data
docker compose up -d --build
```

Nếu image đang chạy bằng UID khác, cấp quyền ghi `/srv/ocr-data` cho đúng UID
đó. Có thể đổi đường dẫn host trước khi chạy Compose:

```bash
export OCR_ARCHIVE_HOST_DIR=/mnt/storage/ocr-data
docker compose up -d
```

Ba biến runtime:

```text
OCR_ARCHIVE_ENABLED=true
OCR_ARCHIVE_DIR=/app/data/ocr-history
OCR_ARCHIVE_MIN_FREE_BYTES=1073741824
```

Khi dung lượng khả dụng sau file upload thấp hơn ngưỡng trên, backend bỏ qua
việc lưu lượt mới, ghi log `ARCHIVE_WRITE_FAILED`, nhưng OCR và response API vẫn
hoạt động bình thường. Không expose `/app/data` qua Express hoặc reverse proxy.

Dữ liệu không tự xóa. Cần theo dõi dung lượng và sao lưu `/srv/ocr-data` bằng
snapshot hoặc công cụ backup của host. Cấu hình này dành cho một backend
replica; nhiều replica phải dùng shared filesystem/NFS hoặc object storage.
