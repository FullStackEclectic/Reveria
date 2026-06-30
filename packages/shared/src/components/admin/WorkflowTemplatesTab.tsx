import React, { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { WorkflowTemplateSummary } from "../../types";
import { postJson, routeModelCount, mergePublishedWorkflowTemplate } from "../../utils";

interface WorkflowTemplatesTabProps {
  workflowTemplates: WorkflowTemplateSummary[];
  setWorkflowTemplates: React.Dispatch<React.SetStateAction<WorkflowTemplateSummary[]>>;
  setAdminMessage: (msg: string) => void;
}

export function WorkflowTemplatesTab({
  workflowTemplates,
  setWorkflowTemplates,
  setAdminMessage,
}: WorkflowTemplatesTabProps) {
  // Workflow Template Form State
  const [name, setName] = useState("客户 brief 分析 v1");
  const [taskType, setTaskType] = useState("brief_analysis");
  const [version, setVersion] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [inputSchema, setInputSchema] = useState(
    '{\n  "type": "object",\n  "required": ["brief"],\n  "properties": {\n    "brief": { "type": "string" }\n  }\n}'
  );
  const [outputSchema, setOutputSchema] = useState(
    '{\n  "type": "object",\n  "properties": {\n    "summary": { "type": "string" }\n  }\n}'
  );
  const [workflowSteps, setWorkflowSteps] = useState(
    '[\n  { "name": "分析 brief", "type": "text_generation" },\n  { "name": "结构化输出", "type": "json_normalize" }\n]'
  );
  const [defaultModelRoute, setDefaultModelRoute] = useState('{\n  "text_model_ids": []\n}');

  async function handleCreateWorkflowTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsedInput: any;
    let parsedOutput: any;
    let parsedSteps: any;
    let parsedRoute: any;
    try {
      parsedInput = JSON.parse(inputSchema);
      parsedOutput = JSON.parse(outputSchema);
      parsedSteps = JSON.parse(workflowSteps);
      parsedRoute = JSON.parse(defaultModelRoute);
    } catch {
      setAdminMessage("工作流模板保存失败：Schema、步骤或模型路由不是合法 JSON");
      return;
    }

    try {
      const template = await postJson<WorkflowTemplateSummary>(
        "/api/admin/workflow-templates",
        {
          name,
          task_type: taskType,
          version,
          input_schema: parsedInput,
          output_schema: parsedOutput,
          workflow_steps: parsedSteps,
          default_model_route: parsedRoute,
          enabled,
        }
      );
      setWorkflowTemplates((current) => mergePublishedWorkflowTemplate(current, template));
      setAdminMessage(
        template.enabled
          ? `已发布工作流模板：${template.name} v${template.version}`
          : `已添加工作流模板草稿：${template.name} v${template.version}`
      );
    } catch {
      setAdminMessage("发布工作流模板失败，请检查参数");
    }
  }

  async function updateWorkflowTemplateEnabled(template: WorkflowTemplateSummary, newEnabled: boolean) {
    try {
      const updated = newEnabled
        ? await postJson<WorkflowTemplateSummary>(
            `/api/admin/workflow-templates/${template.id}/publish`,
            {}
          )
        : await postJson<WorkflowTemplateSummary>(
            `/api/admin/workflow-templates/${template.id}/enabled`,
            { enabled: false }
          );
      setWorkflowTemplates((current) =>
        newEnabled
          ? mergePublishedWorkflowTemplate(current, updated)
          : current.map((item) => (item.id === updated.id ? updated : item))
      );
      setAdminMessage(`${updated.name} v${updated.version} 已${updated.enabled ? "发布" : "停用"}`);
    } catch {
      setAdminMessage("工作流模板发布失败：需要平台管理员权限和数据库连接");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "24px", alignItems: "start", height: "100%", minHeight: 0 }}>
      {/* 左栏：发布配置表单 */}
      <form onSubmit={handleCreateWorkflowTemplate} className="workflow-content-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", height: "100%", overflowY: "auto" }}>
        <div className="workflow-form-field">
          <label>模板名称</label>
          <input 
            className="workflow-form-input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="例如: 智能精修 v1" 
            required 
          />
        </div>

        <div className="workflow-form-field">
          <label>关联任务代码 (Task Type)</label>
          <input 
            className="workflow-form-input" 
            value={taskType} 
            onChange={(e) => setTaskType(e.target.value)} 
            placeholder="例如: retouch" 
            required 
          />
        </div>

        <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="workflow-form-field">
            <label>版本号 (Version)</label>
            <input 
              className="workflow-form-input" 
              type="number" 
              min="1" 
              value={version} 
              onChange={(e) => setVersion(Number(e.target.value))} 
              required 
            />
          </div>
          <div className="workflow-form-field">
            <label>状态</label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--rv-color-text-main)", cursor: "pointer", height: "42px", userSelect: "none" }}>
              <input 
                type="checkbox" 
                checked={enabled} 
                onChange={(e) => setEnabled(e.target.checked)} 
                style={{ width: "16px", height: "16px", accentColor: "var(--rv-color-primary)", cursor: "pointer" }} 
              />
              默认激活此模板
            </label>
          </div>
        </div>

        <div className="workflow-form-field" style={{ gridColumn: "span 2" }}>
          <label>输入参数校验规则 (Input Schema)</label>
          <textarea 
            className="workflow-form-textarea" 
            value={inputSchema} 
            onChange={(e) => setInputSchema(e.target.value)} 
            rows={3} 
            required 
          />
        </div>

        <div className="workflow-form-field" style={{ gridColumn: "span 2" }}>
          <label>输出结果归一化规则 (Output Schema)</label>
          <textarea 
            className="workflow-form-textarea" 
            value={outputSchema} 
            onChange={(e) => setOutputSchema(e.target.value)} 
            rows={3} 
            required 
          />
        </div>

        <div className="workflow-form-field" style={{ gridColumn: "span 2" }}>
          <label>工作流步骤配置 (Workflow Steps)</label>
          <textarea 
            className="workflow-form-textarea" 
            value={workflowSteps} 
            onChange={(e) => setWorkflowSteps(e.target.value)} 
            rows={3} 
            required 
          />
        </div>

        <div className="workflow-form-field" style={{ gridColumn: "span 2" }}>
          <label>缺省模型路由 (Model Route)</label>
          <textarea 
            className="workflow-form-textarea" 
            value={defaultModelRoute} 
            onChange={(e) => setDefaultModelRoute(e.target.value)} 
            rows={2} 
            required 
          />
        </div>

        <button className="workflow-primary-gradient-btn" type="submit" style={{ gridColumn: "span 2", marginTop: "8px" }}>
          <Plus size={16} />
          添加并发布工作流模板
        </button>
      </form>

      {/* 右栏：现行模板看板 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", minHeight: 0 }}>
        <span style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "var(--rv-color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 }}>
          现行工作流模板 ({workflowTemplates.length})
        </span>
        {workflowTemplates.length > 0 ? (
          <div style={{ display: "grid", gap: "10px", overflowY: "auto", height: "100%", paddingRight: "4px" }}>
            {workflowTemplates.map((template) => (
              <div key={template.id} className="workflow-item-card" style={{ height: "fit-content" }}>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)" }}>
                    {template.name}
                  </strong>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", marginTop: "3px" }}>
                    代码: <code style={{ background: "rgba(0,0,0,0.04)", padding: "1px 4px", borderRadius: "3px", fontSize: "10px" }}>{template.task_type}</code> · 路由: {routeModelCount(template.default_model_route)} 个模型 · v{template.version}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "10px", background: template.enabled ? "#ecfdf5" : "#fef2f2", color: template.enabled ? "#10b981" : "#ef4444", padding: "3px 8px", borderRadius: "20px", fontWeight: "800" }}>
                    {template.enabled ? "已启用" : "草稿"}
                  </span>
                  <button
                    onClick={() => void updateWorkflowTemplateEnabled(template, !template.enabled)}
                    style={{ border: "1px solid var(--rv-color-border-thin)", background: "#ffffff", padding: "4px 10px", fontSize: "11px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                    type="button"
                  >
                    {template.enabled ? "停用" : "发布"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="workflow-content-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--rv-color-text-muted)" }}>
            暂无工作流模板记录
          </div>
        )}
      </div>
    </div>
  );
}
