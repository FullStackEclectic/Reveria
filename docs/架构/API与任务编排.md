# API 与任务编排

## 总体原则

Web 与桌面端都不直连第三方 AI，也不直连数据库。它们只调用业务分站 Go API；分站再携带站长 Key 请求 `12ZX-AI` 网关。

```text
Wails 桌面端 / Next.js 网页端
        │  HTTP（网页 Cookie / 桌面 Bearer）
        ▼
[ 业务分站 API ]  services/api  （Gin）
  权限、积分冻结、generation_tasks、素材落盘
        │  HTTP + 站长 Key
        ▼
[ 12ZX-AI 网关 ]
  中转、上游计费、熔断
```

桌面端是云端 API 的客户端，不在本机跑业务库，也不用 Wails 事件代替任务推送。任务状态由前端轮询 `/api/tasks/:id`。

---

## 实际路由

前缀均为 `/api`。公开文件：`GET /api/files/:file_name`。

### 认证（部分公开）

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/dev-login`（仅非生产且 `REVERIA_ENABLE_DEV_LOGIN=true`）
- `GET /auth/me`
- `POST /auth/logout`
- `GET /version`
- `GET /workspaces` / `POST /workspaces`
- `POST /workspaces/:workspace_id/invitations`
- `POST /invitations/accept`

网页端会话走 HttpOnly Cookie；桌面端把 Access / Refresh Token 写入操作系统凭据库，请求带 `Authorization: Bearer`。

### 客户、品牌、项目、画布、素材

- `/customers` CRUD
- `/brand-kits` CRUD
- `/projects` CRUD
- `GET|PUT /projects/:id/canvas`
- 项目评论、分享链接、精修协同 `/projects/:id/retouch-sync`
- `/retouch-presets` 列表 / 保存 / 删除
- `GET /assets`、`POST /assets`、`POST /assets/upload`、`DELETE /assets/:id`

### 任务与工作流

- `GET /tasks`、`POST /tasks`、`POST /tasks/estimate`
- `GET /tasks/:id`、`POST /tasks/:id/cancel`、`POST /tasks/:id/retry`
- 任务评论
- `POST /workflows/image-generation`（兼容旧入口，等同创建任务）
- `POST /workflows/brief-analysis`
- `POST /workflows/brand-style-extract`
- `POST /workflows/creative-directions`
- `POST /workflows/short-video-script-storyboard`
- `POST /workflows/xiaohongshu-cover-batch`
- `POST /workflows/magic-action`

公开只读：`GET /models`、`GET /template-categories`、`GET /prompt-templates`。

### 积分与订单

- `GET /credits/:workspace_id/balance`
- `GET /credits/:workspace_id/transactions`
- `GET /credits/:workspace_id/recharges`
- `GET /credits/:workspace_id/orders`
- `GET /billing/plans`
- `POST /billing/orders`

### 客户免登 Portal

- `GET /portal/shares/:token`
- `POST /portal/shares/:token/comments`
- `POST /portal/shares/:token/approve`
- 素材选片与评论

### 管理后台（需平台管理员，成员接口除外）

工作区成员：`/admin/workspace-members`（owner/admin）。

其余见 `services/api/router/admin.go`：系统设置、用户、补点、套餐、成本报表、服务商、模型、定价规则、工作流模板、提示词模板。

---

## 异步任务与双重扣费

```text
1. 客户端 POST /api/tasks
   -> 按 selected_model 与 pricing_rule 估算点数
   -> 事务锁定 workspace 额度并冻结积分，写入 credit_transaction
   -> 写入 generation_task（pending）
2. 分站调用 12ZX-AI
   -> 若上游返回 402：当前任务失败并退款，同时打开全站熔断，后续生成一律 402，直到站长在系统设置中恢复
   -> 若上游 401 或其他错误：仅失败当前任务并退款
   -> 成功则记录 upstream_task_id，状态 running
3. API 侧 Worker 轮询上游任务
   -> 成功后把结果下载到 REVERIA_STORAGE_DIR，写 asset，结算冻结积分
   -> 结算失败保持 settling 并自动重试，不会把已落盘成片当失败删掉
   -> 退款失败保持 refunding 并自动重试，成功后再标记 failed
4. 前端轮询 GET /api/tasks/:id 刷新画布 / 精修结果
```

SQLite 不支持 `SELECT ... FOR UPDATE`，相关路径已按引擎分支处理。正式环境切 PostgreSQL 后走行锁。

实时推送（Wails Events / WebSocket / Redis）未做，不要按旧设计实现。
