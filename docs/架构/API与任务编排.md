# API与任务编排

## 总体原则

业务分站（Wails 客户端 / 网页端）不直连第三方 AI 厂商，而是作为客户代理，通过 HTTP 协议调用 `12ZX-AI` 网关。

```text
Wails 桌面端 / Web 网页端
        │
        ▼ 
[ 业务分站 API ] (Go Gin / Wails 宿主)
  - 权限、本地点数冻结、生成本地 task 记录
        │
        ▼ HTTP 请求 (携带站长 Key)
[ 12ZX-AI 网关 ] (中转、多维计费扣费、熔断 Fallback)
```

---

## 业务分站 API 路由设计 (Go)

### 1. 认证 API (`/api/auth`)
- `POST /auth/login` (网页端：支持微信扫码 / 手机号验证码)
- `POST /auth/logout`
- `GET /auth/me`

### 2. 项目与画布 API (`/api/projects`)
- `GET /projects` (获取当前工作区的项目列表)
- `POST /projects` (新建项目)
- `GET /projects/{id}` (获取项目详情及画布数据)
- `PATCH /projects/{id}` (更新画布节点 `project_canvases`、图层位置、卡片参数)
- `GET /projects/{id}/assets` (获取项目内的所有生成/上传素材)

### 3. 素材资产 API (`/api/assets`)
- `POST /assets/upload` (上传本地图片/视频参考图，支持写入 `asset` 表)
- `GET /assets/{id}`
- `DELETE /assets/{id}`

### 4. 生成任务 API (`/api/tasks`)
- `POST /tasks` (发起生成任务。支持文生图、图生视频等类型。校验并冻结本地积分，调用 12ZX-AI 网关，写入 `upstream_task_id`)
- `GET /tasks/{id}` (获取任务当前进度及下载地址)
- `POST /tasks/{id}/cancel` (取消任务)

### 5. 本地点数与订单 API (`/api/credits`)
- `GET /credits/balance` (查询当前用户的余额点数)
- `GET /credits/transactions` (积分消费与充值流水)
- `POST /credits/recharge` (分站在线充值订单创建，对接微信/支付宝/Stripe)
- `POST /credits/redeem` (卡密兑换)

### 6. 分站站长后台 API (`/api/admin`)
- `GET /admin/settings` (读取分站系统配置，如 12ZX-AI 网关地址及 Token)
- `POST /admin/settings` (更新网关地址、Token、加价倍率等)
- `GET /admin/orders` (查看全站用户的充值订单)
- `POST /admin/credits/adjust` (管理员手动为用户充值/扣减点数)
- `GET /admin/tasks` (全局审计大模型生成任务与成本核算)

---

## 异步任务编排流程 (双重扣费机制)

当散客在画布上点击“生成视频/图片”时，任务流转如下：

```text
1. 散客发起生成请求 
   -> 业务分站根据 selected_model 与 pricing_rule 计算估算点数
   -> Gorm 开启事务，SELECT FOR UPDATE 锁定 workspace 并扣除/冻结本地积分，写入 credit_transaction
   -> 业务分站生成本地 generation_task (状态: pending)
2. 业务分站调用 12ZX-AI 接口
   -> 发送请求至 12ZX-AI 的生成接口，携带站长的 API Key
   -> 若 12ZX-AI 返回 402/401 报错，分站立刻回滚 Gorm 事务，退回散客积分，将本地任务标记为 failed，停止后续逻辑
   -> 若 12ZX-AI 投递成功，返回 { "task_id": "upstream_task_123" }
3. 业务分站更新任务状态
   -> 本地 generation_task 更新 upstream_task_id，状态标记为 running
4. 业务分站异步轮询 (Go 协程)
   -> 启动独立的 Goroutine（桌面端通过 Wails 宿主协程，网页端通过后台 Worker 或 cron）
   -> 每隔 3-5 秒向 12ZX-AI 轮询任务结果 `/v1/tasks/upstream_task_123`
5. 任务产出与本地化持久化
   -> 12ZX-AI 返回任务成功，提供生成视频的临时 URL
   -> 业务分站 Go 后端通过 http 客户端将该视频下载至分站服务器本地 `/storage/uploads/` 目录
   -> 本地调用 ffmpeg 自动生成视频首帧缩略图
   -> 将生成的永久链接路径写入 asset 表
6. 结算与实时通知
   -> 结算冻结积分，正式标记为 consume
   -> 任务标记为 succeeded，更新 project_canvases
   -> 实时通知前端刷新：
      - 桌面端：直接调用 Wails 本地事件系统 `Runtime.EventsEmit(ctx, "task_done", taskData)`
      - 网页端：通过 WebSocket 或长轮询推送
```

---

## 实时通知设计

- **Wails 桌面端（零网络开销）**：
  - Wails 宿主程序运行在本地。Go 后端在完成任务更新后，可以直接调用 `wails.EventsEmit(ctx, "task:status", updatedTask)`。
  - 前端 React 监听 `wails.EventsOn("task:status", ...)`，即可在毫秒级获得本地任务状态变化，无需搭建复杂的 WebSocket 服务器。
- **网页运营分站（云端部署）**：
  - 前端与云端 Gin 后端建立标准的 WebSocket 连接。
  - 后端协程将状态变更推入 Redis 频道，由 WebSocket 服务器消费并向对应的客户端推送更新。
