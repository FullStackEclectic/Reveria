# Reveria - AI 创意生产交付工作台

Reveria 是一个面向中小型传媒工作室的跨平台 AI 创意生产桌面端与协作平台。它不是单纯的 AI 作图或视频工具，而是围绕客户项目、品牌资产、图文视频生成、团队协作和积分计费构建的 AI 创意交付工作台。

Reveria 的核心判断是：基础大模型由 Google、OpenAI、Anthropic、xAI 等主流供应商持续竞争，我们不自研基础模型，而是把最强模型编排进真实的传媒工作室生产流程里。


---

## 🏛️ 系统架构 (Go / Web 大一统)

本项目采用了高性能、极速轻量的 **Go 语言生态** 与 **pnpm workspace Monorepo 前端共享架构**：

1. **后端 API 分站 (`services/api`)**：
   * 基于 **Gin (Go)** 构建的高并发 REST API 服务。
   * 采用 **纯 Go 版本 SQLite (`github.com/glebarez/sqlite`)** 作为本地关系数据库，消除对 CGO 和 GCC 编译链的硬性依赖，支持开箱即用。
2. **桌面视窗容器 (`apps/desktop`)**：
   * 基于 **Wails (Go)** 构建的轻量级云端客户端，通过系统原生 WebView2 渲染 React 前端。
   * 项目、任务、账户与协作数据统一访问云端 API；本机仅保存素材缓存、导出文件和确有必要的离线元数据。
   * 登录令牌保存于操作系统安全凭据库，不写入浏览器 localStorage。
3. **网页端与商业版控制台 (`apps/web-next`)**：
   * 基于 **Next.js (React)** 开发的 Web 主站与商业版独立管理后台。
   * 完美的 **SEO 搜索引擎优化**支持与 **服务端渲染 (SSR)** 兼容性保障。
4. **共享前端组件库 (`packages/shared`)**：
   * 统一托管画板（Canvas）、通用 UI、API 请求与类型。
   * 通过 Vite/Next.js 转译，实现双端 100% 的业务代码重用，并支持开发模式下的即时热重载（HMR）。
5. **原生图像处理引擎 (`packages/native-engine`)**：
   * 基于 **Rust** 构建的高性能图像算法引擎，负责高精磨皮、调色等核心图像处理算法。
   * 已实现 JPEG / PNG / WebP 解码编码、Rayon 并行调色、肤色保护双边磨皮、中性灰磨皮、HSL、曲线、分离色调、裁剪旋转与 `.cube` LUT。
   * 编译后以动态链接库（如 Windows 下的 DLL）的形式存在，由 Go 桌面端通过 JSON C ABI 动态加载。桌面端对受支持设置执行原始分辨率导出，依赖 Face Mesh 或画笔纹理的复杂效果自动回退 WebGL 成品导出。

---

## 📂 项目目录结构

```bash
reveria/
├── apps/
│   ├── desktop/          # Wails 桌面端（Wails 视窗配置与开发入口）
│   └── web-next/         # Next.js 网页端与商业版独立管理后台（支持 SSR / SEO）
├── packages/
│   ├── shared/           # 共享前端核心库（React 画板、状态、API 请求与样式）
│   └── native-engine/    # Rust 原生图像算法引擎（磨皮、调色，编译为动态链接库）
├── services/
│   └── api/              # Go 后端 Gin 服务分站（含 API 逻辑、GORM 迁移与路由组）
├── docs/                 # 系统设计、运营与开发文档目录
├── package.json          # Monorepo 根依赖配置
└── pnpm-workspace.yaml   # 声明 pnpm 工作区包范围
```

---

## 🚀 快速本地开发联调

在开始开发前，请确保本地已准备好 **Go (1.21+)**、**Node.js (18+)** 并且全局安装了 **pnpm**。若需要重新编译底层原生图像处理引擎，还需要准备好 **Rust (Cargo)** 编译环境。

### 1. 初始化本地开发环境
在项目根目录下直接运行以下命令，脚本会自动校验系统环境依赖，生成 `.env` 配置文件，并下载安装全部前端依赖：
```powershell
pnpm env:init
```
*(注：如果需要手动检查当前系统的依赖健康度，可以运行 `pnpm env:check`)*

### 2. 一键启动所有开发服务
在项目根目录下运行一键启动脚本，它会开启新终端窗口并自动并发运行：**Go 后端 API、Next.js 网页端主站、以及 Wails 桌面客户端开发视窗**：
```powershell
pnpm dev:all
```
启动脚本会增量构建 Rust release DLL；未安装 Cargo 时桌面端仍可启动，但图像导出会回退到 WebGL。
* **后端 API**：默认监听在 `http://127.0.0.1:4100`。首次启动会自动生成 SQLite 本地关系数据库 `reveria.db` 并完成表结构迁移。
* **网页端与商业管理后台**：可通过浏览器访问主页 `http://localhost:3000` 以及超级管理员独立控制台 `http://localhost:3000/admin`。
* **Wails 桌面端**：桌面上会自动弹出应用视窗，其对应的热重载调试地址为 `http://localhost:1420`。
* **桌面端本地 API**：`wails dev` / `pnpm dev:all` 在未设置 `VITE_REVERIA_API_BASE` 时会自动连接 `http://localhost:4100`，与 Vite 开发页保持同站以正确携带认证 Cookie；生产构建仍必须显式设置云端 API 地址。

*(注：如果需要手动分步调试，也可以直接运行 `pnpm web:dev` 启动网页端；或者在 `apps/desktop` 下执行 `wails dev` 拉起桌面端)*

---

## 🧪 生产环境打包发布

可单独验证或构建原生引擎：
```powershell
pnpm native:test
pnpm native:build
```

* **打包桌面端可执行程序 (Reveria.exe)**：
  ```powershell
  # 必须先配置桌面端连接的云端 API 地址
  $env:VITE_REVERIA_API_BASE="https://api.example.com"
  # 在根目录下直接通过命令打包：
  pnpm desktop:build
  # 或者进入 apps/desktop 目录下通过 Wails 工具链打包：
  cd apps/desktop
  wails build
  # 打包完成后，将在 apps/desktop/build/bin 下产出单体 EXE 运行文件
  ```
  推荐发布时运行 `pnpm smoke:build`。脚本会先测试并构建 Rust 引擎，再生成 Wails 程序，并将 `native_engine.dll` 放到 `Reveria.exe` 同目录；发布时两者必须一起分发。
* **打包网页端静态资源**：
  ```powershell
  pnpm web:build
  ```

---

## 📄 开源协议 (License)

本项目采用 **Apache License 2.0 附加 Commons Clause 1.0 (Apache 2.0 + Commons Clause)** 协议进行托管。
* **免费使用与修改**：您可以在非商业用途下免费获取、修改和运行本软件源码（受 Apache 2.0 协议条款保护）。
* **禁止商业转售与服务化**：**禁止任何形式的商业销售、分发或提供基于本软件的收费服务（包括但不限于 SaaS 托管、有偿技术咨询或支持服务）**。
* **商业授权**：任何不符合上述非商业条件的商业使用或商业部署，**必须获得作者的明确书面授权许可**。更多细则请参阅根目录下的 [LICENSE](file:///d:/Code/Go/Reveria/LICENSE) 文件。
