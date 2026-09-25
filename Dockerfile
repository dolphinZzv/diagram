# ---------- build stage ----------
FROM node:20-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /app
RUN apk add --no-cache git
COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download
COPY backend/ ./backend/
COPY --from=web /app/frontend/dist ./backend/dist
RUN cd backend && CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.version=docker -X main.commit=docker -X main.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o /diagram .

# ---------- runtime stage ----------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV DIAGRAM_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
COPY --from=backend /diagram /usr/local/bin/diagram
ENTRYPOINT ["diagram", "-addr", ":8080"]
