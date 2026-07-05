# Reveria 架构优化待办清单

> 基于 2026-07-05 架构评审生成，按优先级分组。
> 
> 最后更新：2026-07-05（阶段一至四已完成）

---

## P0 紧急 — 安全隐患

### 🔐 ~~实现真正的 JWT 鉴权体系~~ ✅ 已完成

**已实施内容**（2026-07-05）：
- [x] 引入 `golang-jwt/jwt/v5` 依赖
- [x] 创建 `handler/jwt.go`：实现 Token 签发和校验，支持 `JWT_SECRET` 环境变量
- [x] AuthMiddleware 改造为 JWT 校验，移除全零 UUID 放行和自动建用户
- [x] 所有登录/注册接口（Login、Register、DevLogin、BridgeLogin）改为签发 JWT
- [x] RefreshSession 改为签发新 JWT Token

---

## P1 高优先级 — 工程质量

### 📦 ~~拆分超大文件（违反 800 行规则）~~ ✅ 已完成

**已实施内容**（2026-07-05）：

#### task.go 拆分结果
- [x] `handler/task.go` (462 行) → 保留任务 CRUD 接口
- [x] `handler/task_upstream.go` (505 行) → 上游 API 调用、轮询回调
- [x] `handler/task_settlement.go` (231 行) → 任务成功/失败结算逻辑
- [x] `handler/task_comment.go` (89 行) → 任务评论接口

#### admin.go 拆分结果
- [x] `handler/admin.go` (437 行) → 核心管理接口（积分调额、成员管理、报表等）
- [x] `handler/admin_provider.go` (156 行) → 服务商 CRUD + 上游模型拉取
- [x] `handler/admin_model.go` (273 行) → 模型管理 CRUD + 批量导入

#### AppCore.tsx 拆分进度
- [x] `components/common/HeaderBar.tsx` — 全局头部导航栏组件（已创建）
- [x] `components/common/MainRouter.tsx` — 主视图路由分发组件（已创建）
- [ ] `AppCore.tsx` 集成使用上述组件（待下次迭代）

---

### 🏗️ 引入 Service / Repository 分层

**当前问题**：几乎所有 handler 直接 `database.DB.Where(...)` 做 CRUD，handler 同时承担请求解析、业务逻辑、数据访问三重职责，无法单元测试业务逻辑。

**目标分层**：
```
Handler (HTTP 请求/响应解析)
    ↓
Service (业务逻辑、事务编排)
    ↓
Repository (数据访问封装)
```

**实施要点**：
- [ ] 新建 `services/api/repository/` 目录，按领域实体建文件：
  - `repository/user.go` — 用户查询/创建
  - `repository/workspace.go` — 工作区及成员关系
  - `repository/project.go` — 项目 CRUD
  - `repository/asset.go` — 素材资产
  - `repository/task.go` — 生成任务
  - `repository/credit.go` — 积分流水与余额
- [ ] 扩展 `services/api/service/` 目录，将 handler 中的业务逻辑迁入：
  - `service/task_service.go` — 任务创建流程（估算→冻结→提交→轮询→结算）
  - `service/project_service.go` — 项目管理业务逻辑
  - `service/auth_service.go` — 认证与会话管理
- [ ] handler 层只做：参数绑定 → 调用 service → 组装 HTTP 响应
- [ ] 可先从最复杂的 `task.go` 开始试点重构，再推广到其他 handler

---

## P2 中优先级 — 架构改善

### 🗂️ ~~路由注册按领域拆分~~ ✅ 已完成

**已实施内容**（2026-07-05）：
- [x] 创建 `services/api/router/` 目录
- [x] 按业务域拆分路由注册文件：
  - `router/router.go` — 顶层注册入口
  - `router/auth.go` — 认证路由
  - `router/project.go` — 项目、画布、协作路由
  - `router/task.go` — AI 任务与工作流路由
  - `router/admin.go` — 管理员路由 + settings 路由
  - `router/portal.go` — 外部客户 Portal 路由
  - `router/credit.go` — 积分计费路由
- [x] `main.go` 瘦身至 101 行（数据库初始化 → CORS → 路由注册 → 启动监听）
- [x] `getClientSettings`、`updateClientSettings`、`getBuildVersion` 迁至 `handler/settings.go`

---

### 🧠 前端引入轻量全局状态管理

**当前问题**：`AppCore.tsx` 用大量 `useState` 在顶层管理全局状态（用户、工作区、项目列表、侧栏折叠等），通过 props 层层传递给 11 个子模块。

**实施要点**：
- [ ] 引入 Zustand 或 React Context + useReducer 方案
- [ ] 按领域拆分 Store：
  - `stores/authStore.ts` — 当前用户、Token、登录/登出
  - `stores/workspaceStore.ts` — 工作区列表、当前工作区、成员
  - `stores/projectStore.ts` — 项目列表、当前项目
  - `stores/uiStore.ts` — 侧栏折叠、弹窗状态、当前视图
- [ ] 子组件直接从 Store 读取状态，不再依赖 props 层层传递
- [ ] 注意 SSR 兼容性：Store 初始化时需判断 `typeof window !== "undefined"`

---

## P3 低优先级 — 技术债务清理

### 🔒 ~~TLS 证书校验可配置化~~ ✅ 已完成

**已实施内容**（2026-07-05）：
- [x] 通过环境变量 `REVERIA_INSECURE_SKIP_TLS` 控制是否跳过证书校验
- [x] 默认为 `false`（即默认开启证书校验），仅在 `REVERIA_INSECURE_SKIP_TLS=true` 时跳过
- [x] 启动时打印 TLS 安全配置状态警告提示

---

### 🗃️ ~~清理 SQLite 不兼容的 SQL 语法~~ ✅ 已完成

**已实施内容**（2026-07-05）：
- [x] 在 `database/database.go` 中导出 `IsSQLite` 标志
- [x] 创建 `handler/middleware.go` 中的 `forUpdate()` 辅助函数
- [x] 创建 `service/standalone_billing.go` 中的 `forUpdateSvc()` 辅助函数
- [x] 替换全部 9 处 `FOR UPDATE` 硬编码为条件化调用
- [x] SQLite 下依赖 `MaxOpenConns=1` 串行化保护，Postgres 下使用 `FOR UPDATE`

---

### 📝 其他待办

- [ ] 为核心业务接口补充单元测试（优先覆盖计费与任务流程）
- [ ] 为 API 接口补充 Swagger/OpenAPI 文档
- [ ] 前端 API 请求层增加统一错误处理和 Token 过期自动刷新
- [ ] 清理项目中残留的 `中文注释：已转为中文说明` 冗余标签（参见上次对话记录）
