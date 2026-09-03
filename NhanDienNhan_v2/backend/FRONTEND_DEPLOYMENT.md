# Deploy the OCR frontend at `ocrfe.o2n.ai.vn`

The OCR frontend runs in a separate Nginx container. It does not publish a new
host port and does not restart or replace the existing `o2n-web` container that
serves `agent.o2n.ai.vn`. The existing Nginx selects the frontend by hostname
and proxies it over a shared Docker network.

The frontend image definition is kept with the frontend source:
`frontend/Dockerfile`, `frontend/nginx.conf`, and `frontend/.dockerignore`.
The backend directory retains only the compose file and the outer Nginx virtual
host because those connect the frontend to the current server infrastructure.

## 1. Connect the new frontend to the current Nginx network

On the server, in `NhanDienNhan_v2/backend`, discover the actual network used
by `o2n-web`:

```bash
docker inspect o2n-web --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

Add the exact returned name to the server `.env`; do not guess it:

```text
VITE_BACKEND_URL=https://ocr.o2n.ai.vn
OCR_INGRESS_NETWORK=<network-used-by-o2n-web>
```

Build and start only the frontend service:

```bash
docker compose --env-file .env -f docker-compose.frontend.yml up -d --build
docker compose --env-file .env -f docker-compose.frontend.yml ps
```

The frontend is available to containers on that network under the hostname
`ocr-frontend`. It has no externally published port.

## 2. Add the hostname to the existing Nginx

Inspect the Nginx stack before editing it. This avoids overwriting the existing
host for `agent.o2n.ai.vn`:

```bash
docker inspect o2n-web --format '{{json .Mounts}}'
docker exec o2n-web nginx -T
```

Add [`deploy/nginx/ocrfe.o2n.ai.vn.conf`](deploy/nginx/ocrfe.o2n.ai.vn.conf)
to the configuration that is mounted or built into `o2n-web`, then reload or
recreate only the Nginx service in the `AIChatAgent` stack. The virtual host
proxies `ocrfe.o2n.ai.vn` to `ocr-frontend:80`.

Verify the host routing and the shared-network DNS after reload:

```bash
curl -I -H 'Host: ocrfe.o2n.ai.vn' http://127.0.0.1/
docker exec o2n-web getent hosts ocr-frontend
```

## 3. Cloudflare

Create or update the DNS/proxy record for `ocrfe.o2n.ai.vn` to the same server
as `agent.o2n.ai.vn`. Cloudflare gets the request to the server; the Nginx
virtual host above chooses the OCR frontend. Visitors access exactly:

```text
https://ocrfe.o2n.ai.vn
```

No `:3002` suffix is used or needed.

## Updating the frontend later

After pulling a new revision, rebuild only this frontend container:

```bash
docker compose --env-file .env -f docker-compose.frontend.yml up -d --build
```

The backend container and its OCR archive mount remain untouched.
