# Deploy the OCR frontend through the existing Cloudflare Tunnel

The server already runs `cloudflared` as a system service. The OCR frontend is
therefore exposed only on a host loopback port and Cloudflare Tunnel publishes
the domain. It does not use or modify `o2n-web`, does not publish a public
Docker port, and does not restart the OCR backend.

```text
ocrfe.o2n.ai.vn -> Cloudflare Tunnel -> cloudflared (host) -> 127.0.0.1:3002 -> frontend container:80
```

## 1. Start the frontend

On the server:

```bash
cd ~/OCR/nhan-dien-nhan/NhanDienNhan_v2/frontend
cp .env.docker.example .env.docker
nano .env.docker
```

Keep these production values unless the backend or a local port has moved:

```text
VITE_BACKEND_URL=https://ocr.o2n.ai.vn
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=use-a-distinct-strong-password-here
OCR_TUNNEL_ORIGIN_PORT=3002
```

`VITE_ADMIN_USERNAME` and `VITE_ADMIN_PASSWORD` are required when the image is
built. Keep their real values only in `.env.docker`, which must not be
committed. This frontend-only check is visible in the browser bundle and is
only an internal UI gate; it does not replace backend authentication.

Check that the selected loopback port is not occupied, then build and start:

```bash
sudo ss -ltnp '( sport = :3002 )'
docker compose --env-file .env.docker up -d --build
curl http://127.0.0.1:3002/health
```

The port is bound to `127.0.0.1`, so it cannot be reached directly from the
Internet. If port 3002 is occupied, select another unused value in
`.env.docker` and use that same value in the Cloudflare service URL below.

## 2. Add a published application route in Cloudflare

For a remotely managed tunnel in the Cloudflare Dashboard:

1. Go to **Networking > Tunnels** and select the currently healthy tunnel.
2. Open **Routes**, then choose **Add route > Published application**.
3. Enter subdomain `ocrfe`, domain `o2n.ai.vn`, and service URL
   `http://127.0.0.1:3002`.
4. Save with **Add route**.

Cloudflare creates or uses the tunnel DNS route and directs
`https://ocrfe.o2n.ai.vn` to the local service. No separate A record, Nginx
virtual host, or visible port suffix is required.

If the existing tunnel is locally managed with an `ingress` section in a
server-side `cloudflared` configuration file, add the equivalent rule there
instead and restart only `cloudflared`:

```yaml
ingress:
  - hostname: ocrfe.o2n.ai.vn
    service: http://127.0.0.1:3002
  # Keep the existing final catch-all rule after this entry.
```

Do not expose or commit any Tunnel token or `cloudflared` credentials.

## 3. Browser CORS check

If backend `CORS_ORIGINS` is a non-empty allowlist, add
`https://ocrfe.o2n.ai.vn` to its comma-separated value and recreate the
backend container. A blank value preserves the current allow-all behavior.
