import React, { FormEvent, useState } from "react";
import { Plus, Settings, BarChart3, ShieldCheck, Play, RotateCcw, AlertTriangle, MessageSquare } from "lucide-react";
import { WorkflowTemplateSummary, WorkspaceCostReportResponse, GenerationTaskSummary, GenerationTaskDetail, TaskCommentSummary, UserSummary } from "../../types";
import { postJson, getJson, routeModelCount, mergePublishedWorkflowTemplate, formatMicroCost, canCancelTask } from "../../utils";

interface WorkflowTaskPanelProps {
  workflowTemplates: WorkflowTemplateSummary[];
  setWorkflowTemplates: React.Dispatch<React.SetStateAction<WorkflowTemplateSummary[]>>;
  costReport: WorkspaceCostReportResponse | null;
  tasks: GenerationTaskSummary[];
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  currentUser: UserSummary | null;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setAdminMessage: (msg: string) => void;
}

export function WorkflowTaskPanel({
  workflowTemplates,
  setWorkflowTemplates,
  costReport,
  tasks,
  setTasks,
  currentUser,
  setTransactions,
  setAdminMessage,
}: WorkflowTaskPanelProps) {
  const [subTab, setSubTab] = useState<"templates" | "costs" | "tasks">("templates");

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

  // Task Monitor State
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskDetail, setTaskDetail] = useState<GenerationTaskDetail | null>(null);
  const [taskComments, setTaskComments] = useState<TaskCommentSummary[]>([]);
  const [newTaskCommentText, setNewTaskCommentText] = useState("");
  const [isMutatingTask, setIsMutatingTask] = useState(false);

  // Workflow Template Handlers
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

  // Task Monitor Handlers
  async function loadTaskDetail(taskId: string) {
    setSelectedTaskId(taskId);
    try {
      const [detail, comments] = await Promise.all([
        getJson<GenerationTaskDetail>(`/api/tasks/${taskId}`),
        getJson<TaskCommentSummary[]>(`/api/tasks/${taskId}/comments`),
      ]);
      setTaskDetail(detail);
      setTaskComments(comments);
    } catch {
      setTaskDetail(null);
      setTaskComments([]);
    }
  }

  async function cancelSelectedTask() {
    if (!taskDetail) return;
    setIsMutatingTask(true);
    try {
      const result = await postJson<any>(
        `/api/tasks/${taskDetail.id}/cancel`,
        {}
      );
      setTasks((current) =>
        current.map((task) => (task.id === result.task.id ? result.task : task))
      );
      setTaskDetail((current) =>
        current
          ? {
              ...current,
              status: result.task.status,
              actual_credits: result.task.actual_credits,
            }
          : current
      );
      if (result.transactions.length) {
        setTransactions((current) => [...result.transactions, ...current]);
      }
      setAdminMessage("任务已取消，冻结点数已释放");
    } catch {
      setAdminMessage("取消任务失败");
    } finally {
      setIsMutatingTask(false);
    }
  }

  async function retrySelectedTask() {
    if (!taskDetail) return;
    setIsMutatingTask(true);
    try {
      const result = await postJson<any>(
        `/api/tasks/${taskDetail.id}/retry`,
        { user_id: currentUser?.id ?? null }
      );
      setTasks((current) => [result.task, ...current]);
      setTransactions((current) => [result.frozen_transaction, ...current]);
      setSelectedTaskId(result.task.id);
      await loadTaskDetail(result.task.id);
      setAdminMessage("已创建重试任务并冻结点数");
    } catch {
      setAdminMessage("重试任务失败");
    } finally {
      setIsMutatingTask(false);
    }
  }

  async function handleSaveTaskComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDetail || !newTaskCommentText.trim()) return;
    try {
      const comment = await postJson<TaskCommentSummary>(
        `/api/tasks/${taskDetail.id}/comments`,
        { content: newTaskCommentText }
      );
      setTaskComments((prev) => [...prev, comment]);
      setNewTaskCommentText("");
    } catch (err) {
      console.error("Failed to save task comment:", err);
    }
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "560px" }}>
      {/* 子导航栏 */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setSubTab("templates")}
            className={`assets-filter-btn ${subTab === "templates" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Settings size={13} />
            工作流引擎模板
          </button>
          <button
            onClick={() => setSubTab("costs")}
            className={`assets-filter-btn ${subTab === "costs" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <BarChart3 size={13} />
            成本利润归因报表
          </button>
          <button
            onClick={() => setSubTab("tasks")}
            className={`assets-filter-btn ${subTab === "tasks" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Play size={13} />
            任务队列执行监控
          </button>
        </div>
      </div>

      {/* 1. 工作流模板 */}
      {subTab === "templates" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "20px" }}>
          <form onSubmit={handleCreateWorkflowTemplate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px" }}>
            <div className="assets-form-field">
              <label>模板名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>关联任务代码 (Task Type)</label>
              <input value={taskType} onChange={(e) => setTaskType(e.target.value)} required />
            </div>

            <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="assets-form-field">
                <label>版本号 (Version)</label>
                <input type="number" min="1" value={version} onChange={(e) => setVersion(Number(e.target.value))} required />
              </div>
              <div className="assets-form-field">
                <label>状态</label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer", height: "36px" }}>
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "auto" }} />
                  默认激活此模板
                </label>
              </div>
            </div>

            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>输入参数校验规则 (Input Schema)</label>
              <textarea value={inputSchema} onChange={(e) => setInputSchema(e.target.value)} style={{ fontFamily: "monospace", fontSize: "11px" }} rows={3} required />
            </div>

            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>输出结果归一化规则 (Output Schema)</label>
              <textarea value={outputSchema} onChange={(e) => setOutputSchema(e.target.value)} style={{ fontFamily: "monospace", fontSize: "11px" }} rows={3} required />
            </div>

            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>工作流步骤配置 (Workflow Steps)</label>
              <textarea value={workflowSteps} onChange={(e) => setWorkflowSteps(e.target.value)} style={{ fontFamily: "monospace", fontSize: "11px" }} rows={3} required />
            </div>

            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>缺省模型路由 (Model Route)</label>
              <textarea value={defaultModelRoute} onChange={(e) => setDefaultModelRoute(e.target.value)} style={{ fontFamily: "monospace", fontSize: "11px" }} rows={3} required />
            </div>

            <button className="primary-button" type="submit" style={{ gridColumn: "span 2", minHeight: "36px", marginTop: "4px" }}>
              <Plus size={16} />
              添加并发布工作流
            </button>
          </form>

          <div>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>现行工作流模板 ({workflowTemplates.length})</span>
            {workflowTemplates.length > 0 ? (
              <div style={{ display: "grid", gap: "8px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                {workflowTemplates.map((template) => (
                  <div key={template.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{template.name} v{template.version}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px" }}>
                        代码: {template.task_type} · 路由: {routeModelCount(template.default_model_route)} 个模型
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "9px", background: template.enabled ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)", color: template.enabled ? "#10b981" : "#ef4444", padding: "2px 5px", borderRadius: "3px", fontWeight: "700" }}>
                        {template.enabled ? "已发布" : "草稿"}
                      </span>
                      <button
                        onClick={() => void updateWorkflowTemplateEnabled(template, !template.enabled)}
                        style={{ border: "1px solid var(--rv-color-border-thin)", background: "#ffffff", padding: "3px 8px", fontSize: "10px", borderRadius: "4px" }}
                        type="button"
                      >
                        {template.enabled ? "停用" : "发布"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
                <p>暂无工作流模板</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 成本利润归因报表 */}
      {subTab === "costs" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {costReport ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* 指标面板 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
                <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>总任务消耗点数</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--rv-color-primary)", marginTop: "4px" }}>{costReport.total_consumed_credits} 点</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>退款释放点数</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--rv-color-primary)", marginTop: "4px" }}>{costReport.total_refunded_credits} 点</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>失败任务数</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "#dc2626", marginTop: "4px" }}>{costReport.failed_model_call_count} 次</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>上游折算算力成本</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--rv-color-text-main)", marginTop: "4px" }}>{formatMicroCost(costReport.provider_cost_micro)}</strong>
                </div>
                <div style={{ background: "rgba(15, 118, 110, 0.04)", border: "1px solid rgba(15, 118, 110, 0.2)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-primary)", fontWeight: "700" }}>算力销售整体毛利</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--rv-color-primary)", marginTop: "4px" }}>{(costReport.margin_rate * 100).toFixed(2)}%</strong>
                </div>
              </div>

              {/* 剖析 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <h4 style={{ fontSize: "12px", fontWeight: "bold", margin: "0 0 10px 0", color: "var(--rv-color-text-main)" }}>项目算力归因排行</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                    {costReport.projects.map((proj) => (
                      <div key={proj.project_id} style={{ display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                        <div>
                          <strong>{proj.project_name}</strong>
                          <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "2px" }}>{proj.task_count} 次生成 · 预算 {proj.budget_credits ?? "不设限"}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ color: "var(--rv-color-primary)" }}>{proj.consumed_credits} 点</strong>
                          <div style={{ fontSize: "9px", color: proj.margin_rate >= 0 ? "#047857" : "#b91c1c", marginTop: "2px", fontWeight: "700" }}>{(proj.margin_rate * 100).toFixed(1)}% 毛利</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "12px", fontWeight: "bold", margin: "0 0 10px 0", color: "var(--rv-color-text-main)" }}>任务类型算力归因</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                    {costReport.task_types.map((type) => (
                      <div key={type.task_type} style={{ display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px 12px", fontSize: "12px" }}>
                        <div>
                          <strong>{type.task_type}</strong>
                          <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "2px" }}>{type.task_count} 次执行 · 预算预估 {type.estimated_credits}点</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ color: "var(--rv-color-primary)" }}>{type.actual_credits} 点</strong>
                          <div style={{ fontSize: "9px", color: type.margin_rate >= 0 ? "#047857" : "#b91c1c", marginTop: "2px", fontWeight: "700" }}>{(type.margin_rate * 100).toFixed(1)}% 毛利</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
              <p>暂无算力消耗报表，需要连接 API 后进行刷新归纳</p>
            </div>
          )}
        </div>
      )}

      {/* 3. 任务队列执行监控 */}
      {subTab === "tasks" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", alignItems: "start" }}>
          {/* 左列任务列表 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
            {tasks.length > 0 ? (
              tasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                const statusColor = task.status === "succeeded" ? "#10b981" : task.status === "failed" ? "#dc2626" : "#f59e0b";
                return (
                  <div
                    key={task.id}
                    onClick={() => void loadTaskDetail(task.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: isSelected ? "var(--rv-color-primary-light)" : "rgba(0,0,0,0.01)",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--rv-color-primary)" : "var(--rv-color-border-thin)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      cursor: "pointer",
                      transition: "var(--rv-transition-default)"
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-main)" }}>{task.task_type}</strong>
                      <span style={{ display: "inline-block", fontSize: "8px", fontWeight: "800", color: "#ffffff", background: statusColor, padding: "1px 4px", borderRadius: "3px", marginTop: "4px" }}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                    <strong style={{ fontSize: "11px", color: "var(--rv-color-text-main)" }}>
                      {task.actual_credits || task.estimated_credits} 点
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
                <p>暂无任务监控数据</p>
              </div>
            )}
          </div>

          {/* 右列任务明细及讨论 */}
          <div style={{ border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px", background: "#ffffff", minHeight: "360px" }}>
            {taskDetail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "var(--rv-color-text-main)" }}>任务执行报告</h4>
                    <span style={{ fontSize: "9px", color: "var(--rv-color-text-muted)" }}>ID: {taskDetail.id}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={cancelSelectedTask}
                      disabled={isMutatingTask || !canCancelTask(taskDetail.status)}
                      className="secondary-button"
                      style={{ padding: "4px 10px", fontSize: "11px", minHeight: "30px" }}
                      type="button"
                    >
                      <AlertTriangle size={12} />
                      取消任务
                    </button>
                    <button
                      onClick={retrySelectedTask}
                      disabled={isMutatingTask}
                      className="primary-button"
                      style={{ padding: "4px 10px", fontSize: "11px", minHeight: "30px" }}
                      type="button"
                    >
                      <RotateCcw size={12} />
                      重试任务
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  <div style={{ background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px" }}>
                    <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)" }}>预估扣除</span>
                    <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)" }}>{taskDetail.estimated_credits} 点</strong>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px" }}>
                    <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)" }}>实际扣除</span>
                    <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)" }}>{taskDetail.actual_credits} 点</strong>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px" }}>
                    <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)" }}>锁定冻结</span>
                    <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)" }}>{taskDetail.frozen_credits} 点</strong>
                  </div>
                </div>

                {taskDetail.error_message && (
                  <div style={{ background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px", padding: "10px", fontSize: "11px", color: "#b91c1c" }}>
                    <strong>错误 [{taskDetail.error_code}]:</strong> {taskDetail.error_message}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>输入 JSON</span>
                    <pre style={{ background: "#f8fafc", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "10px", maxHeight: "140px", overflowY: "auto", margin: "4px 0 0 0" }}>
                      {JSON.stringify(taskDetail.input_payload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>输出 JSON</span>
                    <pre style={{ background: "#f8fafc", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "10px", maxHeight: "140px", overflowY: "auto", margin: "4px 0 0 0" }}>
                      {JSON.stringify(taskDetail.output_payload, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* 协作讨论区 */}
                <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "14px", marginTop: "6px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)", marginBottom: "10px" }}>
                    <MessageSquare size={14} style={{ color: "var(--rv-color-primary)" }} />
                    批注与团队讨论 ({taskComments.length})
                  </span>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "140px", overflowY: "auto", marginBottom: "12px" }}>
                    {taskComments.length > 0 ? (
                      taskComments.map((c) => (
                        <div key={c.id} style={{ background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px 10px", fontSize: "11px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--rv-color-text-muted)", marginBottom: "4px" }}>
                            <strong>{c.user_display_name}</strong>
                            <span>{new Date(c.created_at * 1000).toLocaleString("zh-CN", { hour12: false })}</span>
                          </div>
                          <div style={{ color: "var(--rv-color-text-main)" }}>{c.content}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "11px", color: "var(--rv-color-text-muted)", padding: "12px" }}>暂无批注记录</div>
                    )}
                  </div>

                  <form onSubmit={handleSaveTaskComment} style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="写下修改意见或团队批注..."
                      value={newTaskCommentText}
                      onChange={(e) => setNewTaskCommentText(e.target.value)}
                      style={{ flex: 1, minHeight: "32px", fontSize: "11px" }}
                      required
                    />
                    <button className="primary-button" style={{ minHeight: "32px", padding: "0 12px", fontSize: "11px" }} type="submit">
                      发送
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--rv-color-text-muted)", fontSize: "12px", textAlign: "center" }}>
                请在左侧队列中选择一个生成任务<br />以查看详细执行日志报告和批注
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
