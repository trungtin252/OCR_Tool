# Trạng thái server và cách deploy

> Snapshot triển khai: 2026-09-03. Tài liệu chỉ ghi cấu hình vận hành, không
> chứa `GEMINI_API_KEY`, Cloudflare Tunnel token hay bất kỳ secret nào.

## 1. Kiến trúc đang chạy

```text
Người dùng
  ├─ https://ocrfe.o2n.ai.vn
  │    → Cloudflare Tunnel
  │    → cloudflared (system service trên host)
  │    → 127.0.0.1:3002
  │    → frontend Docker / Nginx :80
  │
  └─ FE gọi https://ocr.o2n.ai.vn
       → OCR backend Docker :5000
       → Gemini / dịch vụ tra cứu
       → archive filesystem trên host
```

## 2. Thành phần và trạng thái

| Thành phần               | Vị trí / image                                              | Cách truy cập                                                    | Ghi chú                                           |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| OCR backend              | `NhanDienNhan_v2/backend`, `nhan-dien-nhan-backend:local`   | Host port `5000`; health: `http://127.0.0.1:5000/health`         | Không dùng Docker Hub.                            |
| OCR frontend             | `NhanDienNhan_v2/frontend`, `nhan-dien-nhan-frontend:local` | `127.0.0.1:3002` trên host; public qua `https://ocrfe.o2n.ai.vn` | Port chỉ bind loopback, không public trực tiếp.   |
| Cloudflare connector     | `cloudflared` systemd service                               | `systemctl is-active cloudflared`                                | Đã xác nhận `active`; Tunnel publish hostname FE. |
| OCR archive              | Host: `/srv/ocr-data`                                       | Container backend: `/app/data/ocr-history`                       | Bind mount, không nằm trong image hay Git.        |
| AIChatAgent web          | Container `o2n-web`                                         | Host port `80`                                                   | Không bị sửa hoặc dùng để route frontend OCR.     |
| AIChatAgent backend, n8n | Các container hiện có trên server                           | Theo stack riêng                                                 | Không bị thay đổi bởi hệ OCR.                     |

## 3. Archive OCR

Backend tự lưu tất cả request OCR hợp lệ của Product, Receipt và giấy chứng
nhận vùng trồng. Mỗi interaction gồm file input gốc, SHA-256, metadata và các
file `interaction.json`, `ai-output.json`, `normalized.json`.

```text
/srv/ocr-data/
  2026/09/03/<timestamp>_<uuid>/
    interaction.json
    ai-output.json
    normalized.json
    files/
```

Biến runtime backend:

```env
OCR_ARCHIVE_ENABLED=true
OCR_ARCHIVE_DIR=/app/data/ocr-history
OCR_ARCHIVE_MIN_FREE_BYTES=1073741824
```

Khi archive không thể ghi hoặc dung lượng dưới ngưỡng, OCR vẫn trả response
bình thường; backend log `ARCHIVE_WRITE_FAILED`. Không expose `/srv/ocr-data`
qua Express, Nginx hay Cloudflare.

## 4. Deploy backend

```bash
cd ~/OCR/nhan-dien-nhan/NhanDienNhan_v2
git pull --ff-only

cd backend
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:5000/health
```

Backend dùng `.env` tại `backend/.env`. Không commit file này. Khi
`CORS_ORIGINS` là allowlist không rỗng, phải có `https://ocrfe.o2n.ai.vn` để
trình duyệt frontend gọi API được. Nếu để trống, backend giữ hành vi CORS
allow-all hiện tại.

## 5. Deploy frontend

```bash
cd ~/OCR/nhan-dien-nhan/NhanDienNhan_v2
git pull --ff-only

cd frontend
# Lần đầu: cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
curl http://127.0.0.1:3002/health
```

`frontend/.env.docker` không commit và dùng các giá trị sau:

```env
VITE_BACKEND_URL=https://ocr.o2n.ai.vn
OCR_TUNNEL_ORIGIN_PORT=3002
```

Nếu port `3002` đã được dùng, chọn một port loopback trống trong
`OCR_TUNNEL_ORIGIN_PORT`, rồi sửa cùng port đó ở service URL của Tunnel.

## 6. Cloudflare Tunnel

`cloudflared` chạy bằng systemd trên host và phải tiếp tục ở trạng thái active:

```bash
systemctl is-active cloudflared
```

Published application route cần có:

| Thuộc tính  | Giá trị                              |
| ----------- | ------------------------------------ |
| Hostname    | `ocrfe.o2n.ai.vn`                    |
| Service URL | `http://127.0.0.1:3002`              |
| Tunnel      | Tunnel hiện có, trạng thái `Healthy` |

Với remotely managed Tunnel, cấu hình ở Cloudflare Dashboard:
**Networking > Tunnels > [Tunnel] > Routes > Add route > Published
application**.

Không cần mở firewall inbound cho port 3002, thêm Nginx virtual-host, hoặc dùng
port suffix trên URL. Không đưa token Tunnel vào Git hay gửi qua chat.

## 7. Kiểm tra nhanh và xử lý sự cố

```bash
# Backend
curl http://127.0.0.1:5000/health
docker compose -f ~/OCR/nhan-dien-nhan/NhanDienNhan_v2/backend/docker-compose.yml logs --tail=100 backend

# Frontend origin nội bộ
curl http://127.0.0.1:3002/health
docker compose -f ~/OCR/nhan-dien-nhan/NhanDienNhan_v2/frontend/docker-compose.yml \
  --env-file ~/OCR/nhan-dien-nhan/NhanDienNhan_v2/frontend/.env.docker \
  logs --tail=100 frontend

# Tunnel và public domain
systemctl is-active cloudflared
curl -I https://ocrfe.o2n.ai.vn
```

- `502/1033` tại domain: kiểm tra `cloudflared`, Published route và
  `curl http://127.0.0.1:3002/health`.
- FE hiện nhưng `Failed to fetch`: kiểm tra `VITE_BACKEND_URL`, backend health
  và `CORS_ORIGINS`.
- Không thấy archive mới: kiểm tra quyền ghi/dung lượng `/srv/ocr-data` và log
  `ARCHIVE_WRITE_FAILED`.
- Không tự xóa archive; cần backup `/srv/ocr-data` và theo dõi dung lượng host.
