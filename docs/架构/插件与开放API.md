# 插件与开放API

## 定位

Reveria 后续可以开放插件和 API，让内部自动化、第三方工具或 AI Agent 调用 Reveria 的工作流模板。这个方向吸收了 LibTV Skill/API 的思路，但要围绕 Reveria 的项目、品牌库、积分和交付系统设计。

MVP 不需要实现完整插件系统，但数据模型和任务 API 应该提前预留。

## 开放对象

潜在调用方：

- Reveria 桌面端
- Reveria Admin Console
- 内部运营自动化
- 第三方插件
- 企业客户系统
- AI Agent
- 自动化平台

## 开放能力

第一阶段开放：

- 创建任务
- 查询任务状态
- 获取生成结果
- 查询工作流模板
- 查询点数余额

第二阶段开放：

- 上传素材
- 创建项目
- 读取品牌库
- 调用批量工作流
- 导出交付包

第三阶段开放：

- 注册插件
- 发布模板
- 接入外部素材库
- 接入外部发布渠道
- 调用本地 worker

## API Key

开放 API 需要独立的 Reveria API key，而不是上游模型 key。

要求：

- API key 绑定工作区。
- 支持权限范围。
- 支持额度限制。
- 支持过期时间。
- 支持撤销。
- 调用写入审计日志。

权限范围示例：

- task:create
- task:read
- project:read
- project:write
- asset:upload
- brand_kit:read
- credit:read

## Agent 调用流程

```text
External Agent
  -> Reveria Workflow API
  -> Auth / Permission
  -> Credit Estimate
  -> Task Orchestrator
  -> Model Gateway
  -> Result Assets
```

Agent 不直接调用模型，也不直接访问用户素材。所有访问都受工作区权限、模板输入 schema 和点数规则控制。

## 插件类型

### 素材插件

用途：

- 接入外部素材库。
- 导入客户素材。
- 同步本地文件夹。

### 发布插件

用途：

- 导出到社媒平台。
- 生成平台发布草稿。
- 对接客户审批系统。

### 工作流插件

用途：

- 增加新的行业模板。
- 增加特定平台模板。
- 增加广告投放模板。

### 模型插件

用途：

- 接入新的模型供应商。
- 接入私有模型。
- 接入本地 worker。

## 插件清单

插件应声明：

- plugin_id
- name
- version
- author
- permissions
- entrypoint
- supported_events
- config_schema

示例：

```json
{
  "plugin_id": "xiaohongshu-export",
  "name": "小红书导出插件",
  "version": "0.1.0",
  "permissions": ["project:read", "asset:read"],
  "supported_events": ["export.requested"]
}
```

## 事件系统

后续可支持事件驱动插件。

事件示例：

- project.created
- task.succeeded
- task.failed
- asset.created
- credits.low
- export.requested
- brand_kit.updated

## 风险

开放 API 和插件会带来风险：

- 滥用模型调用。
- 批量消耗点数。
- 访问客户敏感素材。
- 插件泄露数据。
- 任务重复提交。

控制方式：

- API key 权限范围。
- 工作区级额度。
- 幂等 key。
- 速率限制。
- 审计日志。
- 插件审核。

## MVP 预留

MVP 暂不做完整插件系统，但需要预留：

- workflow_template 表。
- task API。
- API key 数据模型。
- task_type 和 template_id。
- 输入输出 schema。
- 幂等 idempotency_key。
- 调用审计日志。
