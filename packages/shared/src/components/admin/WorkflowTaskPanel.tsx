import React, { FormEvent, useState } from "react";
import { Plus, Settings, BarChart3, Play, RotateCcw, AlertTriangle, MessageSquare } from "lucide-react";
import { WorkflowTemplateSummary, WorkspaceCostReportResponse, GenerationTaskSummary, GenerationTaskDetail, TaskCommentSummary, UserSummary } from "../../types";
import { postJson, getJson, routeModelCount, mergePublishedWorkflowTemplate, formatMicroCost, canCancelTask, API_BASE } from "../../utils";

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

// 辅助函数：安全尝试反序列化并优雅排版 JSON 字符串，解决双重转义问题
function tryParseAndFormat(payload: any): { isJson: boolean; formatted: string; parsedObj: any } {
  if (payload === null || payload === undefined) {
    return { isJson: false, formatted: "", parsedObj: null };
  }
  
  if (typeof payload === "object") {
    return { isJson: true, formatted: JSON.stringify(payload, null, 2), parsedObj: payload };
  }
  
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    try {
      const parsed = JSON.parse(trimmed);
      // 二次 parse（处理双重转义，去除外层引号和内部反斜杠）
      if (typeof parsed === "string") {
        try {
          const doubleParsed = JSON.parse(parsed);
          return { isJson: true, formatted: JSON.stringify(doubleParsed, null, 2), parsedObj: doubleParsed };
        } catch {
          return { isJson: false, formatted: parsed, parsedObj: null };
        }
      }
      return { isJson: true, formatted: JSON.stringify(parsed, null, 2), parsedObj: parsed };
    } catch {
      return { isJson: false, formatted: trimmed, parsedObj: null };
    }
  }
  
  return { isJson: false, formatted: String(payload), parsedObj: null };
}

// 辅助函数：递归从 Payload 解析出的对象中，提取所有包含图片文件扩展名的 URL 地址
function extractImagesFromPayload(obj: any): string[] {
  if (!obj) return [];
  const imageUrls: string[] = [];
  
  function traverse(node: any) {
    if (!node) return;
    if (typeof node === "string") {
      const trimmed = node.trim();
      // 匹配本地 /api/files/ 或远程 http，包含常见图片后缀的字符串
      const isImgUrl = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(trimmed) || 
                       trimmed.startsWith("/api/files/") || 
                       trimmed.startsWith("data:image/");
      if (isImgUrl) {
        imageUrls.push(trimmed);
      }
    } else if (Array.isArray(node)) {
      node.forEach(item => traverse(item));
    } else if (typeof node === "object") {
      Object.keys(node).forEach(key => {
        traverse(node[key]);
      });
    }
  }
  
  traverse(obj);
  return imageUrls;
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

  // 筛选检索状态管理
  const [filterId, setFilterId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterTime, setFilterTime] = useState<string>("all"); // all, today, 3days, 7days
  const [filterMinCredits, setFilterMinCredits] = useState<string>("");

  // 任务类型中文标签字典
  const typeLabels: { [key: string]: string } = {
    "retouch": "人像智能精修 (Retouch)",
    "remove_bg": "自动主体抠图 (Matting)",
    "style_transfer": "画风与滤镜转换 (Style)",
    "txt2img": "大模型文生图 (Text2Img)",
    "img2img": "图生图局部重绘 (Img2Img)",
    "image_generation": "AI 绘图生成 (Image Gen)",
    "text_to_image": "文生图任务 (Text2Img)",
    "video_generation": "AI 视频生成 (Video Gen)",
    "text_generation": "AI 文本生成 (Text Gen)",
  };

  // 动态分析任务队列中包含的所有任务类型，以供下拉框过滤
  const allAvailableTaskTypes = Array.from(new Set(tasks.map(t => t.task_type)));

  // 联合过滤逻辑
  const filteredTasks = tasks.filter((task) => {
    // 1. ID/名称检索
    if (filterId.trim()) {
      const q = filterId.toLowerCase().trim();
      const matchId = task.id.toLowerCase().includes(q);
      const matchType = task.task_type.toLowerCase().includes(q);
      const matchChineseType = (typeLabels[task.task_type] || "").toLowerCase().includes(q);
      if (!matchId && !matchType && !matchChineseType) return false;
    }
    // 2. 状态检索
    if (filterStatus !== "all" && task.status !== filterStatus) {
      return false;
    }
    // 3. 任务类型检索
    if (filterType !== "all" && task.task_type !== filterType) {
      return false;
    }
    // 4. 用户 ID 检索
    if (filterUserId.trim() && task.user_id) {
      if (!task.user_id.toLowerCase().includes(filterUserId.toLowerCase().trim())) {
        return false;
      }
    }
    // 5. 消耗点数门槛
    if (filterMinCredits.trim()) {
      const minVal = parseFloat(filterMinCredits);
      if (!isNaN(minVal)) {
        const actual = task.actual_credits || task.estimated_credits || 0;
        if (actual < minVal) return false;
      }
    }
    // 6. 发生时间范围设定
    if (filterTime !== "all") {
      const taskTimeMs = new Date(task.created_at).getTime();
      const now = Date.now();
      const diffMs = now - taskTimeMs;
      if (filterTime === "today" && diffMs > 24 * 60 * 60 * 1000) return false;
      if (filterTime === "3days" && diffMs > 3 * 24 * 60 * 60 * 1000) return false;
      if (filterTime === "7days" && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  // 对选中的 taskDetail 的 input 与 output payload 进行智能双重反序列化和美化
  const inputParse = tryParseAndFormat(taskDetail?.input_payload);
  const outputParse = tryParseAndFormat(taskDetail?.output_payload);

  // 提取输出结果中的图像，以便提供直接的视觉预览
  const outputImages = extractImagesFromPayload(outputParse.parsedObj);

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
    <div className="workflow-panel-container">
      {/* 注入调度配置专属的高级 CSS 样式规则 */}
      <style dangerouslySetInnerHTML={{__html: `
        .workflow-panel-container {
          display: flex;
          flex-direction: column;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          /* 高度占满屏幕，并扣除顶部导航的高度 */
          height: calc(100vh - 165px);
          min-height: 520px;
          box-sizing: border-box;
        }
        
        /* 药丸状子 TAB 导航 */
        .workflow-tabs-wrapper {
          display: flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.03);
          border-radius: 12px;
          padding: 5px;
          align-self: flex-start;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.015);
          margin-bottom: 20px;
          flex-shrink: 0;
        }
        
        .workflow-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: transparent;
          color: var(--rv-color-text-muted);
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .workflow-tab-btn:hover {
          color: var(--rv-color-text-main);
          background: rgba(15, 23, 42, 0.02);
        }
        
        .workflow-tab-btn.active {
          background: #ffffff;
          color: var(--rv-color-primary);
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.08), 0 2px 4px rgba(0, 0, 0, 0.02);
        }
        
        /* 高级大卡片 */
        .workflow-content-card {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.03), 0 8px 12px -6px rgba(0, 0, 0, 0.02) !important;
          padding: 24px !important;
          box-sizing: border-box;
        }
        
        /* 扁平微调输入域 */
        .workflow-form-input, .workflow-form-textarea {
          width: 100%;
          background: #f8fafc !important;
          border: 1px solid rgba(15, 23, 42, 0.08) !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          font-size: 13px !important;
          color: var(--rv-color-text-main) !important;
          transition: all 0.2s ease-in-out !important;
          box-sizing: border-box;
          outline: none;
        }
        
        .workflow-form-input:focus, .workflow-form-textarea:focus {
          background: #ffffff !important;
          border-color: var(--rv-color-primary) !important;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12) !important;
        }
        
        .workflow-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .workflow-form-field label {
          font-size: 12px;
          font-weight: 700;
          color: var(--rv-color-text-muted);
          padding-left: 2px;
        }
        
        /* 渐变主按钮 */
        .workflow-primary-gradient-btn {
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%) !important;
          border: none !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          padding: 12px 20px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 4px 14px rgba(15, 118, 110, 0.25) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        
        .workflow-primary-gradient-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(15, 118, 110, 0.35) !important;
        }
        
        .workflow-primary-gradient-btn:active {
          transform: translateY(1px) !important;
        }
        
        /* 工作流看板卡片 */
        .workflow-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 14px 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.01);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .workflow-item-card:hover {
          border-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 6px 16px rgba(0,0,0,0.03);
          transform: translateX(3px);
        }
        
        /* 财务指标卡 */
        .workflow-cost-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
          transition: all 0.2s ease;
        }
        
        .workflow-cost-card:hover {
          border-color: rgba(15, 118, 110, 0.15);
          box-shadow: 0 6px 18px rgba(15, 118, 110, 0.04);
          transform: translateY(-1px);
        }
        
        /* 任务条目列 */
        .workflow-task-row {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }
        
        .workflow-task-row:hover {
          border-color: rgba(0, 0, 0, 0.08);
          background: #fafafa;
        }
        
        .workflow-task-row.selected {
          background: rgba(15, 118, 110, 0.05) !important;
          border-color: var(--rv-color-primary) !important;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.06) !important;
        }
        
        /* 协作批注气泡 */
        .workflow-comment-bubble {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.04);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.01);
        }
        
        /* 现代化极客 Pre 代码框 */
        .workflow-pre-console {
          background: #0f172a !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          border-radius: 10px !important;
          font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
          font-size: 11px !important;
          line-height: 1.5 !important;
          color: #38bdf8 !important;
          overflow-y: auto;
          margin: 6px 0 0 0 !important;
          white-space: pre-wrap;
          word-break: break-all;
        }

        /* 任务检索过滤面板 */
        .workflow-filter-bar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 10px 16px;
          margin-bottom: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.01);
          align-items: center;
          flex-shrink: 0;
        }
        
        .workflow-filter-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .workflow-filter-item label {
          font-size: 10px;
          font-weight: 800;
          color: var(--rv-color-text-muted);
          text-transform: uppercase;
        }
        
        .workflow-filter-select, .workflow-filter-input {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          color: var(--rv-color-text-main);
          outline: none;
          transition: border-color 0.2s;
        }
        
        .workflow-filter-select:focus, .workflow-filter-input:focus {
          border-color: var(--rv-color-primary);
          background: #ffffff;
        }
      `}} />

      {/* 现代化 Pill-like TAB 导航 */}
      <div className="workflow-tabs-wrapper">
        <button
          onClick={() => setSubTab("templates")}
          className={`workflow-tab-btn ${subTab === "templates" ? "active" : ""}`}
          type="button"
        >
          <Settings size={14} />
          工作流引擎模板
        </button>
        <button
          onClick={() => setSubTab("costs")}
          className={`workflow-tab-btn ${subTab === "costs" ? "active" : ""}`}
          type="button"
        >
          <BarChart3 size={14} />
          成本利润分析
        </button>
        <button
          onClick={() => setSubTab("tasks")}
          className={`workflow-tab-btn ${subTab === "tasks" ? "active" : ""}`}
          type="button"
        >
          <Play size={14} />
          任务队列监控
        </button>
      </div>

      {/* 1. 工作流模板 */}
      {subTab === "templates" && (
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
      )}

      {/* 2. 成本利润分析 */}
      {subTab === "costs" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {costReport ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", height: "100%", minHeight: 0 }}>
              {/* 指标面板 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", flexShrink: 0 }}>
                <div className="workflow-cost-card">
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>总任务消耗点数</span>
                  <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                    {(costReport.total_consumed_credits ?? (costReport as any).total_actual_credits ?? 0)} 点
                  </strong>
                </div>
                <div className="workflow-cost-card">
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>退款释放点数</span>
                  <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                    {(costReport.total_refunded_credits ?? 0)} 点
                  </strong>
                </div>
                <div className="workflow-cost-card">
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>失败任务数</span>
                  <strong style={{ display: "block", fontSize: "18px", color: "#dc2626", marginTop: "6px", fontWeight: "850" }}>
                    {(costReport.failed_model_call_count ?? 0)} 次
                  </strong>
                </div>
                <div className="workflow-cost-card">
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>上游折算算力成本</span>
                  <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-text-main)", marginTop: "6px", fontWeight: "850" }}>
                    {formatMicroCost(costReport.provider_cost_micro ?? (costReport as any).total_upstream_cost ?? 0)}
                  </strong>
                </div>
                <div className="workflow-cost-card" style={{ background: "rgba(15, 118, 110, 0.04)", border: "1px solid rgba(15, 118, 110, 0.15)" }}>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "700" }}>算力销售整体毛利</span>
                  <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                    {((costReport.margin_rate ?? 0) * 100).toFixed(2)}%
                  </strong>
                </div>
              </div>

              {/* 归因分析 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1, minHeight: 0 }}>
                <div className="workflow-content-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", margin: "0 0 16px 0", color: "var(--rv-color-text-main)", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px", flexShrink: 0 }}>
                    项目算力归因排行
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
                    {(costReport.projects || []).map((proj) => (
                      <div key={proj.project_id} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.04)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "var(--rv-color-text-main)" }}>{proj.project_name}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", marginTop: "3px" }}>
                            {proj.task_count} 次生成 · 预算 {proj.budget_credits ?? "不设限"}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ color: "var(--rv-color-primary)" }}>{proj.consumed_credits} 点</strong>
                          <div style={{ fontSize: "10px", color: proj.margin_rate >= 0 ? "#059669" : "#dc2626", marginTop: "3px", fontWeight: "800" }}>
                            {(proj.margin_rate * 100).toFixed(1)}% 毛利
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!costReport.projects || costReport.projects.length === 0) && (
                      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "13px" }}>
                        暂无项目算力归因数据
                      </div>
                    )}
                  </div>
                </div>

                <div className="workflow-content-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", margin: "0 0 16px 0", color: "var(--rv-color-text-main)", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px", flexShrink: 0 }}>
                    任务类型算力归因
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
                    {(costReport.task_types || []).map((type) => (
                      <div key={type.task_type} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.04)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "var(--rv-color-text-main)" }}>{type.task_type}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", marginTop: "3px" }}>
                            {type.task_count} 次执行 · 预算预估 {type.estimated_credits} 点
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ color: "var(--rv-color-primary)" }}>{type.actual_credits} 点</strong>
                          <div style={{ fontSize: "10px", color: type.margin_rate >= 0 ? "#059669" : "#dc2626", marginTop: "3px", fontWeight: "800" }}>
                            {(type.margin_rate * 100).toFixed(1)}% 毛利
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!costReport.task_types || costReport.task_types.length === 0) && (
                      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "13px" }}>
                        暂无任务类型算力归因数据
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="workflow-content-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--rv-color-text-muted)" }}>
              正在加载大盘成本与毛利报表...
            </div>
          )}
        </div>
      )}

      {/* 3. 任务队列监控 */}
      {subTab === "tasks" && (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* 顶置的专业多维高动态过滤控制条 */}
          <div className="workflow-filter-bar">
            <div className="workflow-filter-item">
              <label>任务检索</label>
              <input 
                type="text" 
                className="workflow-filter-input" 
                placeholder="ID 或 任务类型..." 
                value={filterId} 
                onChange={(e) => setFilterId(e.target.value)} 
              />
            </div>
            
            <div className="workflow-filter-item">
              <label>执行状态</label>
              <select 
                className="workflow-filter-select" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="pending">PENDING (排队中)</option>
                <option value="processing">PROCESSING (执行中)</option>
                <option value="succeeded">SUCCEEDED (成功)</option>
                <option value="failed">FAILED (失败)</option>
                <option value="cancelled">CANCELLED (已取消)</option>
              </select>
            </div>

            <div className="workflow-filter-item">
              <label>任务大类</label>
              <select 
                className="workflow-filter-select" 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">全部类型</option>
                {allAvailableTaskTypes.map(t => (
                  <option key={t} value={t}>{typeLabels[t] || t}</option>
                ))}
              </select>
            </div>

            <div className="workflow-filter-item">
              <label>发生时间范围</label>
              <select 
                className="workflow-filter-select" 
                value={filterTime} 
                onChange={(e) => setFilterTime(e.target.value)}
              >
                <option value="all">任意时间</option>
                <option value="today">最近 24 小时</option>
                <option value="3days">最近 3 天内</option>
                <option value="7days">最近 7 天内</option>
              </select>
            </div>

            <div className="workflow-filter-item">
              <label>用户检索 (ID)</label>
              <input 
                type="text" 
                className="workflow-filter-input" 
                placeholder="匹配 user_id..." 
                value={filterUserId} 
                onChange={(e) => setFilterUserId(e.target.value)} 
              />
            </div>

            <div className="workflow-filter-item">
              <label>起算额度 (点)</label>
              <input 
                type="number" 
                min="0" 
                className="workflow-filter-input" 
                placeholder="点数下限..." 
                value={filterMinCredits} 
                onChange={(e) => setFilterMinCredits(e.target.value)} 
              />
            </div>
          </div>

          {/* 下部左右分栏布局 */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", flex: 1, minHeight: 0 }}>
            {/* 左列：任务队列列表 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", height: "100%", paddingRight: "4px" }}>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  const statusColor = task.status === "succeeded" ? "#10b981" : task.status === "failed" ? "#dc2626" : "#f59e0b";
                  const statusBg = task.status === "succeeded" ? "#ecfdf5" : task.status === "failed" ? "#fef2f2" : "#fffbeb";
                  const displayName = typeLabels[task.task_type] || task.task_type;
                  const shortId = task.id.substring(0, 8);

                  return (
                    <div
                      key={task.id}
                      onClick={() => void loadTaskDetail(task.id)}
                      className={`workflow-task-row ${isSelected ? "selected" : ""}`}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", gap: "8px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={displayName}>
                            {displayName}
                          </strong>
                          <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)", flexShrink: 0 }}>
                            {task.actual_credits || task.estimated_credits} 点
                          </strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "9px", fontWeight: "800", color: statusColor, background: statusBg, padding: "1px 6px", borderRadius: "8px", flexShrink: 0 }}>
                            <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: statusColor, display: "inline-block" }} />
                            {task.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--rv-color-text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            ID: {shortId}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="workflow-content-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--rv-color-text-muted)" }}>
                  没有找到符合条件的数据
                </div>
              )}
            </div>

            {/* 右列：任务报告明细与协作讨论 */}
            <div className="workflow-content-card" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px !important", minHeight: 0 }}>
              {taskDetail ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%", minHeight: 0 }}>
                  {/* 报告头区 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px", flexShrink: 0 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "850", color: "var(--rv-color-text-main)" }}>任务执行报告</h4>
                      <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontFamily: "monospace", display: "block", marginTop: "2px" }}>ID: {taskDetail.id}</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={cancelSelectedTask}
                        disabled={isMutatingTask || !canCancelTask(taskDetail.status)}
                        className="secondary-button"
                        style={{ padding: "6px 12px", fontSize: "12px", minHeight: "32px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        type="button"
                      >
                        <AlertTriangle size={13} />
                        取消任务
                      </button>
                      <button
                        onClick={retrySelectedTask}
                        disabled={isMutatingTask}
                        className="primary-button"
                        style={{ padding: "6px 12px", fontSize: "12px", minHeight: "32px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        type="button"
                      >
                        <RotateCcw size={13} />
                        重试任务
                      </button>
                    </div>
                  </div>

                  {/* 指标归纳 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", flexShrink: 0 }}>
                    <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>预估算力点数</span>
                      <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{taskDetail.estimated_credits} 点</strong>
                    </div>
                    <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>实际核算扣除</span>
                      <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{taskDetail.actual_credits} 点</strong>
                    </div>
                    <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>安全冻结锁定</span>
                      <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{taskDetail.frozen_credits} 点</strong>
                    </div>
                    <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>关联发起用户</span>
                      <strong style={{ fontSize: "11px", color: "var(--rv-color-text-main)", display: "block", marginTop: "6px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={taskDetail.user_id || "系统/无"}>
                        {taskDetail.user_id ? taskDetail.user_id.substring(0, 8) + "..." : "系统/无"}
                      </strong>
                    </div>
                  </div>

                  {/* 错误提示框 */}
                  {taskDetail.error_message && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#b91c1c", display: "flex", gap: "8px", flexShrink: 0 }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                      <div>
                        <strong style={{ display: "block", marginBottom: "2px" }}>执行异常 [{taskDetail.error_code}]:</strong>
                        {taskDetail.error_message}
                      </div>
                    </div>
                  )}

                  {/* 极客 JSON 看板 (格式化后的代码显示，移除多重反斜杠转义) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", flex: 1, minHeight: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--rv-color-text-muted)", flexShrink: 0 }}>INPUT PAYLOAD (输入参数)</span>
                      <pre className="workflow-pre-console" style={{ flex: 1, margin: "4px 0 0 0 !important" }}>
                        {inputParse.formatted}
                      </pre>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--rv-color-text-muted)", flexShrink: 0 }}>OUTPUT PAYLOAD (输出结果)</span>
                      <pre className="workflow-pre-console" style={{ flex: 1, margin: "4px 0 0 0 !important" }}>
                        {outputParse.formatted}
                      </pre>
                    </div>
                  </div>

                  {/* 惊艳点：自动探测输出结果中的渲染图像，并直接提供可视化预览（拼接正确的后端服务 API_BASE） */}
                  {outputImages.length > 0 && (
                    <div style={{ background: "#f8fafc", border: "1px dashed rgba(15, 118, 110, 0.2)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--rv-color-primary)", display: "block" }}>
                        📸 渲染产物可视化预览 ({outputImages.length} 个资源)
                      </span>
                      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
                        {outputImages.map((imgUrl, idx) => {
                          // 核心修正：当图片路径是本地文件存储的相对 API url 时，自动拼装 API_BASE (如 4100 端口) 防止 3000 端口拿不到而裂图
                          const fullImgUrl = imgUrl.startsWith("/") ? `${API_BASE}${imgUrl}` : imgUrl;
                          return (
                            <div key={idx} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", background: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", flexShrink: 0 }}>
                              <img 
                                src={fullImgUrl} 
                                alt={`Output Preview ${idx}`} 
                                style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease", cursor: "pointer" }}
                                onClick={() => window.open(fullImgUrl, "_blank")}
                                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                title="点击在新窗口打开原图"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 批注协作区 */}
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", paddingTop: "12px", marginTop: "4px", flexShrink: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "800", color: "var(--rv-color-text-main)", marginBottom: "8px" }}>
                      <MessageSquare size={14} style={{ color: "var(--rv-color-primary)" }} />
                      批注与团队讨论 ({taskComments.length})
                    </span>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "100px", overflowY: "auto", marginBottom: "10px", paddingRight: "4px" }}>
                      {taskComments.length > 0 ? (
                        taskComments.map((c) => (
                          <div key={c.id} className="workflow-comment-bubble" style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--rv-color-text-muted)", marginBottom: "3px" }}>
                              <strong style={{ fontWeight: "700" }}>{c.user_display_name}</strong>
                              <span style={{ fontSize: "9px" }}>{new Date(c.created_at * 1000).toLocaleString("zh-CN", { hour12: false })}</span>
                            </div>
                            <div style={{ color: "var(--rv-color-text-main)", lineHeight: 1.3 }}>{c.content}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--rv-color-text-muted)", padding: "12px 0" }}>
                          暂无团队批注记录
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSaveTaskComment} style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        className="workflow-form-input"
                        placeholder="写下修改意见或团队批注..."
                        value={newTaskCommentText}
                        onChange={(e) => setNewTaskCommentText(e.target.value)}
                        style={{ flex: 1, minHeight: "34px", padding: "6px 12px !important", fontSize: "12px" }}
                        required
                      />
                      <button 
                        className="workflow-primary-gradient-btn" 
                        style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px" }} 
                        type="submit"
                      >
                        发送
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--rv-color-text-muted)", border: "2px dashed rgba(0,0,0,0.03)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(15, 118, 110, 0.05)", color: "var(--rv-color-primary)", display: "grid", placeItems: "center", marginBottom: "16px" }}>
                    <Play size={20} style={{ marginLeft: "2px" }} />
                  </div>
                  <strong style={{ fontSize: "14px", color: "var(--rv-color-text-main)", display: "block" }}>请选择生成任务</strong>
                  <span style={{ display: "block", fontSize: "12px", marginTop: "6px", color: "var(--rv-color-text-muted)", maxScale: "320px", lineHeight: 1.5 }}>
                    请在左侧队列中选择一个任务以调阅其详细的输入输出 Payload 与执行日志报告
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
