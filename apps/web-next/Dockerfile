# Build stage
FROM node:20-alpine AS builder

RUN npm install -g pnpm@10.17.1

WORKDIR /app

# 复制整个项目到容器中，依赖于根目录构建上下文
COPY . .

# 安装依赖
RUN pnpm install

# 编译 Next.js 网页端
RUN pnpm --filter @reveria/web-next build

# Production stage
FROM node:20-alpine AS runner

RUN npm install -g pnpm@10.17.1

WORKDIR /app

# 将整个 workspace 的构建结果复制到运行阶段
COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000
CMD ["pnpm", "--filter", "@reveria/web-next", "start"]
