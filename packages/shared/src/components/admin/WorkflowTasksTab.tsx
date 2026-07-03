import React, { useState, FormEvent } from "react";
import { AlertTriangle, RotateCcw, MessageSquare, Play } from "lucide-react";
import { GenerationTaskSummary, GenerationTaskDetail, TaskCommentSummary, UserSummary } from "../../types";
import { postJson, getJson, canCancelTask, API_BASE } from "../../utils";

interface WorkflowTasksTabProps {
  tasks: GenerationTaskSummary[];
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setAdminMessage: (msg: string) => void;
  currentUser: UserSummary | null;
}

function formatFloatCredits(val?: number): string {
  if (val === undefined || val === null) return "0";
  return val % 1 === 0 ? val.toString() : val.toFixed(6).replace(/\.?0+$/, "");
}

function getActualCredits(task: any): string {
  if (task.output_payload) {
    const { parsedObj } = tryParseAndFormat(task.output_payload);
    if (parsedObj && typeof parsedObj.actual_credits === "number") {
      return formatFloatCredits(parsedObj.actual_credits);
    }
  }
  return formatFloatCredits(task.actual_credits);
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

export function WorkflowTasksTab({
  tasks,
  setTasks,
  setTransactions,
  setAdminMessage,
  currentUser,
}: WorkflowTasksTabProps) {
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
    "text": "AI 文本生成 (Text Gen)",
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
    if (filterTime !== "all" && task.created_at) {
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={displayName}>
                        {displayName}
                      </strong>
                      <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)", flexShrink: 0 }}>
                        {task.status === "succeeded" 
                          ? getActualCredits(task) 
                          : formatFloatCredits(task.actual_credits || task.estimated_credits)} 点
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
                  <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{formatFloatCredits(taskDetail.estimated_credits)} 点</strong>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>实际核算扣除</span>
                  <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{getActualCredits(taskDetail)} 点</strong>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.03)", borderRadius: "8px", padding: "8px 12px" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>安全冻结锁定</span>
                  <strong style={{ fontSize: "13px", color: "var(--rv-color-text-main)", display: "block", marginTop: "4px", fontWeight: "750" }}>{formatFloatCredits(taskDetail.frozen_credits)} 点</strong>
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

              {/* 极客 JSON 看板 */}
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

              {/* 渲染产物可视化预览 */}
              {outputImages.length > 0 && (
                <div style={{ background: "#f8fafc", border: "1px dashed rgba(15, 118, 110, 0.2)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--rv-color-primary)", display: "block" }}>
                    渲染产物可视化预览 ({outputImages.length} 个资源)
                  </span>
                  <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
                    {outputImages.map((imgUrl, idx) => {
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
              <span style={{ display: "block", fontSize: "12px", marginTop: "6px", color: "var(--rv-color-text-muted)", maxWidth: "320px", lineHeight: 1.5 }}>
                请在左侧队列中选择一个任务以调阅其详细的输入输出 Payload 与执行日志报告
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
