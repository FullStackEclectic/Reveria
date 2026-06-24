# Reveria 规划与开发清单 (TODO)

## 📌 第一阶段：Go 算力底座与 Wails 桌面外壳 (已完成)
- [x] 物理移除所有过时的 Rust Cargo 依赖和 Tauri 客户端代码
- [x] 基于 Gin + GORM + SQLite（无 CGO）重构后端服务分站，实现 SQLite 零依赖迁移
- [x] 将桌面端视窗重构为以 Wails (Go) 为核心的渲染容器并完成联调
- [x] 完美补齐密码自适应升级（Argon2 -> Bcrypt）、 me 身份接口、任务克隆重试等全部兼容接口
- [x] 搭建 pnpm workspace Monorepo，成功将核心前端代码共享为 `@reveria/shared` 包
- [x] 支持 Next.js 独立商业管理后台路由 `/admin`，并彻底实现服务端预渲染（SSR）兼容防护

## 🚀 第二阶段：双端商业化部署与运营 (进行中)
- [ ] 针对 `apps/web-next` 管理后台进行精细化 RBAC 权限测试与防跨站 CSRF 安全拦截
- [ ] 部署 Go API 后端至公网云服务器环境，配置 Nginx 跨域反代 (CORS)
- [ ] 将网页端 Next.js 工程部署上线至云端 Node.js/Vercel 环境，并绑定 `reveria.12zx.net` 的 `/admin` 路由
- [ ] 完成桌面客户端在 Windows 平台上的正式打包发布，优化 Wails 独立运行包大小
