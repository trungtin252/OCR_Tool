# Build context: NhanDienNhan_v2 (the parent directory of backend and frontend).
FROM node:22-alpine AS build

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_BACKEND_URL=https://ocr.o2n.ai.vn
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY backend/deploy/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/build /usr/share/nginx/html

EXPOSE 80
