# Reveria - AI 创意生产交付工作台

Reveria 是一个面向中小型传媒工作室的跨平台 AI 创意生产桌面端与协作平台。它不是单纯的 AI 作图或视频工具，而是围绕客户项目、品牌资产、图文视频生成、团队协作和积分计费构建的 AI 创意交付工作台。

Reveria 的核心判断是：基础大模型由 Google、OpenAI、Anthropic、xAI 等主流供应商持续竞争，我们不自研基础模型，而是把最强模型编排进真实的传媒工作室生产流程里。


---

## 🏛️ 系统架构 (Go / Web 大一统)

项目已完全重构去 Rust 化，采用了高性能、极速轻量的 **Go 语言生态** 与 **pnpm workspace Monorepo 前端共享架构**：

1. **后端 API 分站 (`services/api`)**：
   * 基于 **Gin (Go)** 构建的高并发 REST API 服务。
   * 采用 **纯 Go 版本 SQLite (`github.com/glebarez/sqlite`)** 作为本地关系数据库，消除对 CGO 和 GCC 编译链的硬性依赖，支持开箱即用。
2. **桌面视窗容器 (`apps/desktop`)**：
   * 基于 **Wails (Go)** 构建的轻量级桌面客户端底座（替代 Tauri），通过系统原生 WebView2 渲染 React 前端。
3. **网页端与商业版控制台 (`apps/web-next`)**：
   * 基于 **Next.js (React)** 开发的 Web 主站与商业版独立管理后台。
   * 完美的 **SEO 搜索引擎优化**支持与 **服务端渲染 (SSR)** 兼容性保障。
4. **共享前端组件库 (`packages/shared`)**：
   * 统一托管画板（Canvas）、通用 UI、API 请求与类型。
   * 通过 Vite/Next.js 转译，实现双端 100% 的业务代码重用，并支持开发模式下的即时热重载（HMR）。

---

## 📂 项目目录结构

```bash
reveria/
├── apps/
│   ├── desktop/          # Wails 桌面端（Wails 视窗配置与开发入口）
│   └── web-next/         # Next.js 网页端与商业版独立管理后台（支持 SSR / SEO）
├── packages/
│   └── shared/           # 共享前端核心库（React 画板、状态、API 请求与样式）
├── services/
│   └── api/              # Go 后端 Gin 服务分站（含 API 逻辑、GORM 迁移与路由组）
├── docs/                 # 系统设计、运营与开发文档目录
├── package.json          # Monorepo 根依赖配置
└── pnpm-workspace.yaml   # 声明 pnpm 工作区包范围
```

---

## 🚀 快速本地开发联调

在开始之前，请确保本地已安装 **Go (1.21+)**、**Node.js (18+)** 且全局配置了 **pnpm**。

### 1. 运行 Go 后端 API 服务
进入后端目录，启动服务。服务会自动在本地连接 SQLite 数据库并完成数据表迁移：
```powershell
cd services/api
go run main.go
# 默认将在 127.0.0.1:4100 监听 HTTP 请求
```

### 2. 运行桌面端开发视窗 (Wails)
进入桌面端目录，拉起前端热重载并在桌面上弹出测试客户端：
```powershell
cd apps/desktop
wails dev
```
*(注：Wails 内部会代理 Vite 开发服务器，渲染地址为 http://localhost:1420)*

### 3. 运行网页端 Next.js（包含 /admin 商业后台）
进入网页端目录，拉起 Next.js 调试服务器：
```powershell
cd apps/web-next
pnpm dev
# 默认可通过浏览器访问 http://localhost:3000 和管理员后台 http://localhost:3000/admin
```

---

## 🧪 生产环境打包发布

* **打包桌面端可执行程序 (Reveria.exe)**：
  ```powershell
  cd apps/desktop
  wails build
  # 打包完成后，将在 apps/desktop/build/bin 下产出生产级单体 EXE 运行文件
  ```
* **打包网页端静态资源**：
  ```powershell
  cd apps/web-next
  pnpm build
  ```

---

## 📄 开源协议 (License)

本项目采用 **Apache License 2.0 附加 Commons Clause 1.0 (Apache 2.0 + Commons Clause)** 协议进行托管。
* **免费使用与修改**：您可以在非商业用途下免费获取、修改和运行本软件源码（受 Apache 2.0 协议条款保护）。
* **禁止商业转售与服务化**：**禁止任何形式的商业销售、分发或提供基于本软件的收费服务（包括但不限于 SaaS 托管、有偿技术咨询或支持服务）**。
* **商业授权**：任何不符合上述非商业条件的商业使用或商业部署，**必须获得作者的明确书面授权许可**。更多细则请参阅根目录下的 [LICENSE](file:///d:/Code/Go/Reveria/LICENSE) 文件。
