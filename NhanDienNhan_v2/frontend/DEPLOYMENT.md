# Deploy the OCR frontend at `ocrfe.o2n.ai.vn`

The frontend runs in a separate Nginx container. It does not publish a host
port, and does not restart or replace the existing `o2n-web` container that
serves `agent.o2n.ai.vn`. The existing Nginx proxies the hostname through a
shared Docker network.

## 1. Start the frontend

On the server, work only in the frontend directory:

```bash
cd ~/OCR/nhan-dien-nhan/NhanDienNhan_v2/frontend
cp .env.docker.example .env.docker
nano .env.docker
```

Set `OCR_INGRESS_NETWORK` to the actual network used by `o2n-web`. Discover it
with:

```bash
docker inspect o2n-web --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

For the current server that value is `aichatagent_default`. Keep the production
API URL unless the OCR backend is moved:

```text
VITE_BACKEND_URL=https://ocr.o2n.ai.vn
OCR_INGRESS_NETWORK=aichatagent_default
```

Build and start the frontend:

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

The container is reachable on the shared Docker network as `ocr-frontend`.
It does not expose a host port.

If the backend `CORS_ORIGINS` setting is a non-empty allowlist, include
`https://ocrfe.o2n.ai.vn` in that comma-separated value and recreate the
backend container. A blank value preserves the current allow-all behavior.

## 2. Route the domain in `o2n-web`

The OCR virtual-host configuration is
[`deploy/nginx/ocrfe.o2n.ai.vn.conf`](deploy/nginx/ocrfe.o2n.ai.vn.conf). Add
it to the Nginx source used to build `o2n-web`, then reload or rebuild only the
Nginx service in `/home/o2naiserver/AIChatAgent`.

Because `o2n-web` has no configuration mount, first find its source file before
editing it:

```bash
cd ~/AIChatAgent
find . -maxdepth 3 -type f \( -iname '*nginx*' -o -name 'Dockerfile*' -o -name 'docker-compose*.yml' \) -print
```

Do not overwrite the existing virtual host for `agent.o2n.ai.vn`.

## 3. Cloudflare

Point the Cloudflare DNS/proxy record for `ocrfe.o2n.ai.vn` to the same server
as `agent.o2n.ai.vn`. Visitors access:

```text
https://ocrfe.o2n.ai.vn
```

No port suffix is needed.
