# Lovart竞品分析

## 定位

Lovart 的公开定位是 AI Design Agent。它不是单纯的生图工具，而是把自然语言、参考文件、Brand Kit、多模型路由、画布、AI 编辑和多格式导出组合成一个创意工作空间。

对 Reveria 来说，Lovart 是最重要的“设计 Agent”方向竞品。

## 核心能力

### 1. Design Agent

Lovart 强调用户像和设计师沟通一样描述目标，系统负责拆解任务、选择模型、生成资产并继续编辑。

启发：

- Reveria 的入口也应该是任务和结果，而不是模型和参数。
- 用户说的是“做一套客户提案”，不是“调用某个图像模型”。
- AI 需要能主动补全缺失信息，例如平台尺寸、品牌风格和交付格式。

### 2. ChatCanvas

Lovart 的 ChatCanvas 是聊天和画布结合的实时创作空间。用户可以在同一个画布里生成、编辑和组织图片、视频、音频、品牌资产和 3D 内容。

启发：

- Reveria 也需要画布，但画布应该优先服务项目交付。
- MVP 可以先做无限画布：结果对比、版本排列、批注和导出。
- 后续再加入无限画布、多尺寸画板和项目资产编排。

### 3. Brand Kit

Lovart 使用 Brand Kit 保持品牌一致性。用户可以输入 prompt、参考文件和 Brand Kit，让 Agent 在生成过程中继承品牌上下文。

启发：

- Reveria 的品牌库必须是核心资产，不是附属设置。
- 每个客户都应该有长期品牌记忆。
- 品牌库应该进入所有图文视频任务的默认上下文。

### 4. Skills / Custom Skills

Lovart 把常见创作任务封装成 Skills，例如品牌身份、商品图、社媒素材、视频广告等。用户不擅长 prompt 时，可以直接选择一键工作流。

启发：

- Reveria 需要工作流模板，而不是让用户从空白 prompt 开始。
- 成功项目流程可以沉淀为模板。
- 模板应由后台发布和版本管理，而不是写死在桌面端。

### 5. 多模型自动路由

Lovart 公开文档中强调会自动在多个图像和视频模型之间选择合适模型。用户不用学习不同模型的差异。

启发：

- Reveria 的模型选择应该由服务端路由完成。
- 管理后台需要配置模型能力、价格、fallback 和任务匹配规则。
- 用户只看到任务结果和点数消耗。

### 6. 多格式导出

Lovart 支持面向交付的多种格式，例如图片、视频、演示文稿、HTML、SVG、PSD 等。

启发：

- Reveria 必须把导出当成核心功能。
- 工作室用户最终需要交付包，而不是只看生成预览。
- 后续应支持 PNG、JPEG、MP4、PPTX、PSD、ZIP 交付包和客户预览链接。

## Lovart 的强项

- 零学习成本的自然语言创作。
- 设计 Agent 感强。
- 多模型编排隐藏得好。
- Brand Kit 和 Skills 方向正确。
- 画布适合视觉资产组织。
- 多格式导出贴近真实交付。

## Lovart 可能的空白

以下是基于公开资料的产品推断，不等同于确定缺陷：

- 更偏创作工具，未必深入工作室经营和项目毛利。
- 团队成员额度、客户项目预算、点数成本归因可能不是核心。
- 对中小传媒工作室的客户制、审批制、交付包管理还有差异化空间。
- 私有化、本地素材库、本地缓存和 BYOK 可以成为 Reveria 的机会。

## Reveria 应吸收的能力

- Design Agent 式任务入口。
- Chat + Canvas 的协作方式。
- Brand Kit 作为生成上下文。
- Skills 作为工作流模板。
- 多模型自动路由。
- 多格式导出。

## Reveria 不应照搬的地方

- 不把产品中心放在单次设计生成。
- 不只围绕个人创作者体验设计。
- 不忽略项目、客户、预算、团队和成本。
- 不把所有复杂度都藏起来，至少管理员要能控制模型、价格和风控。

## 对 Reveria 的结论

Lovart 把“AI 设计师”做得很清晰。Reveria 如果只做一个更像 Lovart 的桌面版，胜算不高。更好的打法是吸收 Lovart 的 Agent、画布、Brand Kit 和 Skills，但把产品中心放在传媒工作室的客户项目交付。

## 参考资料

- [Lovart: How Lovart Works](https://www.lovart.ai/pt/docs)
- [Lovart: ChatCanvas public launch](https://www.lovart.ai/en/news/lovart-design-agent-public-launch-chatcanvas)
- [Lovart: AI Video Agent](https://www.lovart.ai/features/ai-video-agent)
- [Lovart: Export Formats](https://www.lovart.ai/docs/export-formats)
