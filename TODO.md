# Reveria 待办清单

> 更新日期：2026-07-26
> 基准提交：`2f9a9fb` feat: 收敛自营算力接入并增强图像精修工作台（2026-07-24）
> 需求来源：`docs/产品/图像精修工作台.md`、`docs/架构/技术架构与路线图.md`

---

## 一、项目当前状态

### 已落地模块

| 模块 | 状态 | 说明 |
|------|------|------|
| `services/api`（Go / Gin） | 可用 | 认证与会话节流、项目、画布、素材、任务（上游中转 / 结算 / worker / 定价）、工作流、模板、积分、协作、工作区、品牌资产、管理后台（渠道 / 模型 / 服务商 / 系统设置），配套 15+ 单测 |
| `packages/shared`（React 共享层） | 可用 | admin / asset / auth / credits / customer / dashboard / history / portal / project / square 十个域，无限画布、工作流控制台、模型广场均已打通 |
| `apps/desktop`（Wails） | 可用 | 开发模式默认连本地 `http://localhost:4100`，生产构建需显式指定云端 API |
| `apps/web-next`（Next.js） | 可用 | Web 主站 + `/admin` 独立控制台 |
| `packages/native-engine`（Rust DLL） | 骨架 | `lib.rs` 仅 4KB，release DLL 已产出，尚未承载实际精修算法 |
| 图像精修工作台 | 主开发线 | 详见第二节 |

### 全局技术债

- [ ] **数据库与路线图不一致**：路线图定义云端主库为 PostgreSQL，当前实际运行在 SQLite（`services/api/reveria.db`）。需明确是保留 SQLite 作为单机形态、还是补齐 PostgreSQL 迁移路径
- [ ] **Rust 原生引擎空转**：高精度磨皮、批量导出等重算力任务仍在前端 WebGL / WASM 完成，`packages/native-engine` 未通过 syscall 承接任何生产逻辑
- [ ] **仓库清理**：`services/api` 下遗留 `api.exe` / `main.exe` / `reveria_api.exe` / `test_bin.exe` 共约 180MB 编译产物，应加入 `.gitignore` 并从工作区移除
- [ ] **调试文件收敛**：根目录 `debug_db.go` 与 `services/api/debug_db.go` 重复，确认是否保留

---

## 二、图像精修工作台（当前主线）

### 2.1 已完成（无需再开工）

第一阶段「消除假交互 + 基础调色」与第二阶段「进阶调色 + Face Mesh 人像美化」已全部完成：

- 光影：曝光 / 对比度 / 高光 / 阴影 / 白色色阶 / 黑色色阶
- 色彩：饱和度 / 自然饱和度 / 色温 / 色调 / 去朦胧
- 细节：清晰度 / 锐化
- 人像：双边滤波磨皮、肤色区域美白、Face Mesh 驱动的大眼 / 瘦脸 / 亮眼
- 进阶调色：HSL 八通道、RGB 五点曲线（主 + 红绿蓝）、色调映射（阴影 / 高光着色 + 明暗平衡）
- 局部修复：污点修复画笔（上限 16 点）、仿制图章（上限 12 个）
- 工程能力：`RetouchRenderer` 纯渲染组件、Shader 缓存与增量 uniform、50 步撤销重做、9 款内置预设、自定义预设云端持久化 + 离线缓存、`advanced_json` 完整参数持久化、同步到选中图片、裁剪 / 旋转 / 翻转、JPEG / PNG 导出

### 2.2 P0 — 清理假交互与死按钮（最高优先级）

> AGENTS.md 明确「不允许使用硬编码数据和模拟数据」，文档也约定「`RetouchSettings` 是唯一真相来源」。以下项目当前违反该约定，属于必须优先偿还的债务。

- [x] **`PortraitAdjustments.tsx` 假交互清理**：已按方案 A 完成——全部参数由 `PORTRAIT_PARAMS` 声明表驱动，直接写入 `RetouchSettings` 并打包进 `u_portrait[]` uniform，面板无本地 state 持有参数值
- [x] **硬编码 `disabled` 滑块**：祛眼袋 / 祛胡须已纳入声明表，由 `PortraitParamControl` 统一渲染，不再存在 `disabled` 写死项
- [x] **`CanvasToolbar.tsx` 死按钮**：参考辅助线已接入构图辅助线下拉；高精液化 / 智能消除均已绑定 `onClick` 并激活对应画布工具与面板
- [x] **侧栏占位 Tab**：原五个指向同一占位面板的图标已全部替换为真实功能 Tab（调色 / 局部 / 人像 / 液化 / 消除），顶部「RAW转片」「批量导出」死按钮加 `disabled` 属性并标注未开放提示；消除 Tab 新增 `EraseOverlay`（画笔蒙版采集）与 `ErasePanel`（模式切换 + 提交入口占位）
- [x] **`lut_file` 空字段**：`useLutLibrary` 实现内置 LUT 公式生成与 `.cube` 导入解析，`resolveLut` 供渲染器按 `settings.lut_file` 取用，已完整接通

### 2.3 P1 — 第三阶段收尾：智能消除

- [x] 后端：新增 AI Inpainting 任务类型，接入上游网关（复用 `handler/task_upstream.go` 现有中转与 `service/standalone_billing.go` 计费链路）
- [x] 前端：涂抹 / 框选蒙版采集，蒙版随任务上传（`EraseOverlay` + `generateMaskDataUrl` + `handleEraseSubmit` → POST `/api/tasks`）
- [x] 前端：任务队列状态回显（排队 / 处理中 / 失败重试），结果写回素材并进入历史（轮询 `/api/tasks/:id`，成功后调 `onAssetsRefresh`）
- [x] 计费：确认消除任务的散客扣点规则与站长上游扣额，补 `handler/task_pricing_test.go` 用例（`TestResolveEstimatedCreditsInpaintingUsesGenericRule` + `TestResolveEstimatedCreditsInpaintingRejectsMissingPricing`，全部通过）
- [x] 去水印场景复用同一能力，仅在 UI 上区分入口（`ErasePanel` 顶部意图切换：智能消除 vs 去水印；提交时 prompt 分别为 `""` 和 `"remove watermark"`）

### 2.4 P1 — 第四阶段：抠图与背景

- [ ] 技术选型决策：上游 AI 抠图 API vs 前端 ONNX Runtime Web（u2net）离线抠图。离线方案不消耗积分但增加包体，需先定
- [ ] 智能抠图（人像 / 主体自动分割，目标发丝级边缘）
- [ ] 背景移除并导出透明 PNG（导出管线目前只走 JPEG/PNG 不透明分支，需支持 alpha 通道）
- [ ] 背景替换：纯色
- [ ] 背景替换：模糊虚化
- [ ] 背景替换：自定义图片（含缩放与定位）
- [ ] 蒙版结果进入 `RetouchSettings` 持久化与撤销重做体系

### 2.5 P2 — 第五阶段：局部蒙版调色

- [ ] 蒙版数据结构设计（多蒙版叠加、每蒙版独立参数组、与现有 uniform 管线的整合方式）
- [ ] 画笔蒙版（边缘感知涂抹）
- [ ] 渐变蒙版（线性）
- [ ] 径向蒙版（椭圆）
- [ ] 颜色蒙版（按色相范围选区）
- [ ] 亮度蒙版
- [ ] 蒙版可视化叠加显示与擦除

### 2.6 P2 — 人像精修进阶（对标像素蛋糕）

- [ ] 中性灰磨皮模式（保留皮肤纹理的专业级磨皮），评估是否下沉到 `packages/native-engine`
- [ ] 液化工具：推拉 / 收缩 / 膨胀 / 还原（对应工具栏「高精液化」按钮）
- [ ] 面部精调：皮肤色调 / 纹理 / 高光独立参数
- [ ] 五官精调：下巴宽度、鼻子宽度与长度、嘴巴宽度
- [ ] 牙齿美白
- [ ] 身体塑形：腰部收紧、腿部拉长

### 2.7 P2 — 特效与实用工具（对标泼辣修图）

- [ ] 胶片颗粒（数量 / 高光 / 大小 / 粗糙度）
- [ ] 暗角（数量 / 高光 / 圆度 / 羽化）
- [ ] 色散（Fringing）
- [ ] 镜头畸变矫正
- [ ] 自由变形（8 点透视校正）
- [ ] 三通道直方图实时显示
- [ ] EXIF 查看器
- [ ] 水印（位置 / 大小 / 自定义资产）
- [ ] 边框（智能自动配色）
- [ ] WebP 导出（文档规划已含，当前仅 JPEG / PNG）
- [ ] 3D LUT 导入 / 导出

### 2.8 P3 — 批量处理与叠加层

- [ ] 批量应用预设并导出
- [ ] 批量应用美化参数（统一风格）
- [ ] 批量调整尺寸与重命名
- [ ] RAW 批量转换与调色
- [ ] 文字图层（字体 / 格式 / 变形 / 混合模式）
- [ ] 预设叠加层：光漏 / 耀花 / 天空替换 / 云层 / 尘埃
- [ ] 色调叠加：渐变、双色调
- [ ] 12 种混合模式与蒙版擦除
- [ ] 证件照制作（换底色 + 标准尺寸）
- [ ] AI 变清晰（超分辨率，走上游 API 与任务队列）

### 2.9 工程质量

- [ ] `AssetEditorWorkbench.tsx`（738 行）、`PortraitAdjustments.tsx`（601 行）、`editorConstants.ts`（557 行）已接近 800 行红线，新增功能前先按域拆分
- [ ] 补精修参数序列化 / 反序列化的单元测试（`normalizeCurve` 等归一化逻辑目前无覆盖）
- [ ] 补 `handler/retouch_preset.go` 的并发同名更新与离线预设同步冲突用例
- [ ] 移动端预研：`apps/mobile`（Capacitor 包装 web-next）可行性验证，确认 WebGL 管线在 iOS WKWebView 下的表现

---

## 三、其他模块待办

- [ ] 桌面端生产打包流程验证（`VITE_REVERIA_API_BASE` 未设置时的报错提示）
- [ ] 网页端 SEO / SSR 实测（当前 `apps/web-next` 主要承载控制台，营销页尚未验证）
- [ ] 分销 OEM 贴牌能力：站长自定义品牌、域名与主站 API Key 配置的端到端联调
- [ ] 欠费熔断链路验证：上游返回 402 时分站拦截散客请求的完整回归
