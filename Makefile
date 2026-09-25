# ---- Diagram build helpers ----

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null | sed 's/^v//' || echo dev)
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo none)
DATE    ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS  = -s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(DATE)

.PHONY: help dev web backend build run clean tidy release-snapshot

help:
	@echo "make dev        - 同时启动后端(8080)与前端(5173)开发服务"
	@echo "make web        - 构建前端到 frontend/dist"
	@echo "make backend    - 构建后端二进制(内嵌前端, 需先 make web)"
	@echo "make build      - 构建完整可执行文件 bin/diagram"
	@echo "make run        - 构建并运行 (http://localhost:8080)"
	@echo "make clean      - 清理构建产物"

web:
	cd frontend && npm install && npm run build

backend: web
	rm -rf backend/dist && cp -r frontend/dist backend/dist
	cd backend && CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o ../bin/diagram .

build: backend
	@echo "built bin/diagram $(VERSION)"

run: build
	./bin/diagram

dev:
	@echo "后端: http://localhost:8080  前端: http://localhost:5173"
	@(cd backend && go run . &) ; cd frontend && npm run dev

clean:
	rm -rf bin frontend/dist backend/dist
	mkdir -p backend/dist && echo '<!doctype html><html><body>placeholder</body></html>' > backend/dist/index.html

tidy:
	cd backend && go mod tidy
	cd frontend && npm install
