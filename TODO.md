# Reveria 待办清单

> 更新日期：2026-08-13
> 基准提交：`344ac5d` feat: 完成图像精修工作台 P0/P1 全阶段——假交互清理、人像美化重构、AI 智能消除与去水印
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
| `packages/native-engine`（Rust DLL） | 可用 | 已实现真实图片解码/编码、并行调色、肤色保护双边磨皮、中性灰磨皮、HSL/曲线/分离色调、几何裁剪与 `.cube` LUT；桌面端按能力自动走 Rust 全分辨率导出 |
| 图像精修工作台 | 主开发线 | 详见第二节 |

### 全局技术债

- [ ] **数据库与路线图不一致**：路线图定义云端主库为 PostgreSQL，当前实际运行在 SQLite（`services/api/reveria.db`）。需明确是保留 SQLite 作为单机形态、还是补齐 PostgreSQL 迁移路径
- [x] **Rust 原生引擎接入**：采用 JSON C ABI 避免 Windows x64 浮点调用约定问题；支持全局调色、肤色磨皮、HSL、曲线、分离色调、几何与 `.cube` LUT，桌面端对支持的设置从原始素材执行全分辨率导出，复杂 Face Mesh / 局部蒙版 / 背景合成自动回退 WebGL
- [x] **仓库清理**：已确认 `*.exe` 受 `.gitignore` 保护，并移除 `services/api` 下 `api.exe` / `main.exe` / `reveria_api.exe` / `test_bin.exe` 共约 180MB 编译产物；同时忽略 TypeScript 增量构建缓存
- [x] **调试文件收敛**：已删除位于 Go module 外且无法直接构建的根目录 `debug_db.go`，保留带 `//go:build ignore` 的 `services/api/debug_db.go` 作为按需诊断工具

---

## 二、图像精修工作台（当前主线）

### 2.1 已完成（无需再开工）

第一阶段「消除假交互 + 基础调色」与第二阶段「进阶调色 + Face Mesh 人像美化」已全部完成：

- 光影：曝光 / 对比度 / 高光 / 阴影 / 白色色阶 / 黑色色阶
- 色彩：饱和度 / 自然饱和度 / 色温 / 色调 / 去朦胧
- 细节：清晰度 / 锐化 / 亮度降噪 / 颜色降噪
- 人像：双边滤波磨皮、肤色区域美白、Face Mesh 驱动的大眼 / 瘦脸 / 亮眼
- 进阶调色：HSL 八通道、RGB 五点曲线（主 + 红绿蓝）、色调映射（阴影 / 高光着色 + 明暗平衡）
- 局部修复：污点修复画笔（上限 16 点）、仿制图章（上限 12 个）
- 工程能力：`RetouchRenderer` 纯渲染组件、Shader 缓存与增量 uniform、50 步撤销重做、9 款内置预设、自定义预设云端持久化 + 离线缓存、`advanced_json` 完整参数持久化、同步到选中图片、裁剪 / 旋转 / 翻转、JPEG / PNG 导出

### 2.2 P0 — 清理假交互与死按钮（最高优先级）

> AGENTS.md 明确「不允许使用硬编码数据和模拟数据」，文档也约定「`RetouchSettings` 是唯一真相来源」。以下项目当前违反该约定，属于必须优先偿还的债务。

- [x] **`PortraitAdjustments.tsx` 假交互清理**：已按方案 A 完成——全部参数由 `PORTRAIT_PARAMS` 声明表驱动，直接写入 `RetouchSettings` 并打包进 `u_portrait[]` uniform，面板无本地 state 持有参数值
- [x] **硬编码 `disabled` 滑块**：祛眼袋 / 祛胡须已纳入声明表，由 `PortraitParamControl` 统一渲染，不再存在 `disabled` 写死项
- [x] **`CanvasToolbar.tsx` 死按钮**：参考辅助线已接入构图辅助线下拉；高精液化 / 智能消除均已绑定 `onClick` 并激活对应画布工具与面板
- [x] **侧栏占位 Tab**：原占位入口已全部替换为真实功能 Tab（调色 / 修复 / 蒙版 / 人像 / 液化 / 消除 / 背景），顶部「RAW转片」「批量导出」死按钮加 `disabled` 属性并标注未开放提示
- [x] **`lut_file` 空字段**：`useLutLibrary` 实现内置 LUT 公式生成与 `.cube` 导入解析，`resolveLut` 供渲染器按 `settings.lut_file` 取用，已完整接通

### 2.3 P1 — 第三阶段收尾：智能消除

- [x] 后端：新增 AI Inpainting 任务类型，接入上游网关（复用 `handler/task_upstream.go` 现有中转与 `service/standalone_billing.go` 计费链路）
- [x] 前端：涂抹 / 框选蒙版采集，蒙版随任务上传（`EraseOverlay` + `generateMaskDataUrl` + `handleEraseSubmit` → POST `/api/tasks`）
- [x] 前端：任务队列状态回显（排队 / 处理中 / 失败重试），结果写回素材并进入历史（轮询 `/api/tasks/:id`，成功后调 `onAssetsRefresh`）
- [x] 计费：确认消除任务的散客扣点规则与站长上游扣额，补 `handler/task_pricing_test.go` 用例（`TestResolveEstimatedCreditsInpaintingUsesGenericRule` + `TestResolveEstimatedCreditsInpaintingRejectsMissingPricing`，全部通过）
- [x] 去水印场景复用同一能力，仅在 UI 上区分入口（`ErasePanel` 顶部意图切换：智能消除 vs 去水印；提交时 prompt 分别为 `""` 和 `"remove watermark"`）

### 2.4 P1 — 第四阶段：抠图与背景

- [x] 技术选型：采用上游 AI 抠图 API，复用任务网关、积分冻结 / 结算和素材归档；不引入 ONNX Runtime Web 与 u2net 大模型包体
- [x] 智能抠图：新增 `image_background_removal` 任务，要求上游返回带 alpha 的 PNG，并校验透明像素与源图宽高比
- [x] 背景移除并导出透明 PNG：WebGL 保留 alpha 通道，切换透明模式时自动选择 PNG 导出
- [x] 背景替换：纯色（颜色选择器 + WebGL alpha 合成）
- [x] 背景替换：模糊虚化（原图背景 5×5 采样虚化，前景保持清晰）
- [x] 背景替换：自定义图片（上传为真实素材，支持 50%～300% 缩放和水平 / 垂直定位）
- [x] 蒙版结果进入 `RetouchSettings` 持久化与撤销重做体系（透明前景 PNG 的 alpha 作为蒙版来源，背景模式与参数统一写入 `advanced_json`）

### 2.5 P2 — 第五阶段：局部蒙版调色

- [x] 蒙版数据结构设计：最多 6 个蒙版顺序叠加，每个蒙版保存独立曝光 / 对比度 / 饱和度 / 色温 / 色调参数并进入 `advanced_json`、预设和撤销重做
- [x] 画笔蒙版：固定图集烘焙，首笔颜色采样驱动边缘感知，支持流量、笔刷大小与擦除
- [x] 渐变蒙版：画布拖拽定义线性渐变起止点，支持羽化、反相和强度
- [x] 径向蒙版：画布拖拽定义椭圆中心与半径，支持旋转、羽化和反相
- [x] 颜色蒙版：点击画布取色，按色相范围与最低饱和度生成选区
- [x] 亮度蒙版：点击画布采样亮度，支持上下限和羽化范围
- [x] 蒙版可视化叠加显示与擦除：当前蒙版使用红色 Shader 覆盖层预览，画笔提供独立擦除模式

### 2.6 P2 — 人像精修进阶（对标像素蛋糕）

- [x] 中性灰磨皮模式（保留皮肤纹理的专业级磨皮），WebGL 实时预览与 Rust 全分辨率导出均已实现
- [x] 液化工具：推拉 / 收缩 / 膨胀 / 还原（`LiquifyOverlay` 采集笔画并烘焙位移贴图，参数随精修设置持久化）
- [x] 面部精调：皮肤色调 / 纹理 / 高光独立参数（`skin` group 已在 `PORTRAIT_PARAMS` 声明，`applyPortraitColor` shader 完整实现，Rust 管线对应 `skin_texture/whiten/highlight`）
- [x] 五官精调：下巴宽度、鼻子宽度与长度、嘴巴宽度（`reshape` group 已在 `PORTRAIT_PARAMS` 声明，`applyFaceWarp` shader 完整实现）
- [x] 牙齿美白（`teeth_whiten` 已在 `PORTRAIT_PARAMS` 的 `teeth` group 声明，`applyPortraitColor` shader 已实现）
- [x] 身体塑形：腰部收紧、腿部拉长（`LiquifyPanel` 已集成 7 个塑形滑块；`bodyWarp.ts` GLSL 完整实现高斯分区形变；已修复 shader 中 `applyBodyWarp` 调用顺序，现在在 `texture2D(u_image)` 采样前执行）

### 2.7 P2 — 特效与实用工具（对标泼辣修图）

- [x] 胶片颗粒（数量 / 高光 / 大小 / 粗糙度，shader 管线末端噪声叠加，`ProfessionalAdjustments` 四滑块）
- [x] 暗角（数量 / 高光 / 中点 / 羽化 / 圆度，`ProfessionalAdjustments` 五滑块）
- [x] 色散（Fringing，`fringing_amount` 滑块 + 红蓝通道径向错位采样，桌面端非零时回退 WebGL 导出）
- [x] 镜头畸变矫正（桶形/枕形二阶径向校正，`ProfessionalAdjustments` 一滑块）
- [x] 水平 / 垂直透视（梯形校正，采样坐标按轴缩放）
- [x] 自由变形（8 点透视校正：四角 + 四边中点，`FreeTransformOverlay` 拖拽，shader 2×2 双线性求逆）
- [x] 三通道直方图实时显示（`HistogramPanel` + `histogram.ts`，64 bin R/G/B/亮度 SVG 折线图）
- [x] EXIF 查看器（`ExifPanel` + `exif.ts`，纯前端 DataView 解析，含保留 EXIF 开关）
- [x] 水印（文字 + 图片，`WatermarkPreview` 实时预览 + `outputDecorations.ts` 导出烧录，5 个位置/颜色/透明度/大小）
- [x] 边框（内嵌圆角 SDF，宽度/圆角/颜色 + 直方图智能自动配色）
- [x] WebP 导出（WebGL 导出、浏览器下载与 Wails 桌面保存链路均已支持）
- [x] 3D LUT 导入 / 导出（`LutPanel` 导入 `.cube`；当前光影/色彩/HSL/曲线/色调映射可导出为标准 `.cube`）

### 2.8 P3 — 批量处理与叠加层

- [x] 批量应用预设并导出
- [x] 批量应用美化参数（统一风格）
- [x] 批量调整尺寸与重命名
- [x] RAW 批量转换与调色（桌面端 `rawloader` 传感器显影：去马赛克 / 相机白平衡 / sRGB；网页与 API 提取 TIFF/CR3 最大预览 JPEG 兜底）
- [x] 文字图层（字体 / 格式 / 变形 / 混合模式）
- [x] 预设叠加层：光漏 / 耀花 / 天空替换 / 云层 / 尘埃
- [x] 色调叠加：渐变、双色调
- [x] 12 种混合模式与蒙版擦除
- [x] 证件照制作（换底色 + 标准尺寸）
- [x] AI 变清晰（超分辨率，走上游 API 与任务队列）

### 2.10 P3 收口 — 产品文档剩余精修项

- [x] 亮度降噪 / 颜色降噪（细节面板，采样邻域分离 luma/chroma 混合）
- [x] 水平 / 垂直透视滑块（镜头校正，采样坐标梯形变换）
- [x] 颗粒高光、暗角高光独立滑块
- [x] 边框智能自动配色（由成片直方图加权主色估算，禁止假数据）
- [x] 图片水印（用户上传图缩小为 PNG data URL 写入 `watermark_image_url`，预览与导出烧录）
- [x] RAW 高保真转片：桌面端 Bayer 去马赛克 + 相机白平衡 + sRGB；服务端改进 TIFF/CR3 预览提取

### 2.9 工程质量

- [x] 精修工作台按域拆分：`AssetEditorWorkbench.tsx` 已降至 800 行以内，顶部操作、空素材导入、人像参数声明、Shader / LUT 等均拆为独立组件或模块
- [x] 补精修参数序列化 / 反序列化单元测试：覆盖默认值、JSON 往返、曲线归一化、局部工具脏数据与人像参数量程
- [x] 补 `handler/retouch_preset.go` 的并发同名更新与离线预设同步冲突用例（后端改为原子 upsert，覆盖 12 路同名并发；前端覆盖离线覆盖、迁移缓存冲突与同步失败保留）
- [ ] 移动端预研：`apps/mobile`（Capacitor 包装 web-next）可行性验证，确认 WebGL 管线在 iOS WKWebView 下的表现

---

## 三、其他模块待办

- [x] 桌面端生产打包流程验证（已验证未设置 `VITE_REVERIA_API_BASE` 的生产包错误提示，并通过带显式 API 地址的 Wails Windows/amd64 完整打包）
- [ ] 网页端 SEO / SSR 实测（当前 `apps/web-next` 主要承载控制台，营销页尚未验证）
- [ ] 分销 OEM 贴牌能力：站长自定义品牌、域名与主站 API Key 配置的端到端联调
- [ ] 欠费熔断链路验证：上游返回 402 时分站拦截散客请求的完整回归
