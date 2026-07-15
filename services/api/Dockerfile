# Build stage
FROM golang:alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go mod tidy

# 编译 Go 后端应用，禁用 CGO
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "-s -w" -o reveria-api main.go

# Production stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /build/reveria-api /app/reveria-api

# 创建保存数据的目录
RUN mkdir -p /app/storage/uploads

EXPOSE 4100
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD wget -q -O - http://127.0.0.1:4100/ready >/dev/null || exit 1
ENTRYPOINT ["/app/reveria-api"]
