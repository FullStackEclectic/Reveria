import { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  Sparkles,
  FileText,
  Palette,
  Layers,
  Film,
  ArrowLeft,
  Image,
  ChevronRight,
  ChevronDown,
  X,
  Zap
} from "lucide-react";
import {
  ProjectSummary,
  UserSummary,
  WorkspaceSummary,
  WorkflowResult,
  WorkflowType,
  GenerationTaskSummary,
  GenerationTaskDetail,
  AssetSummary,
  ModelSummary,
} from "../../types";
import { postJson, assetUrl, assetTitle } from "../../utils";
import { WorkflowHistoryFeed } from "./WorkflowHistoryFeed";
import {
  quickTasks,
  isWorkflowRunnable,
  getWorkflowIcon,
  getWorkflowDesc,
  getRatioBoxStyle,
  getQualityLabel,
} from "./workflowUtils";

interface ProjectWorkflowPanelProps {
  selectedProject: ProjectSummary;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  setSelectedTaskId: (id: string) => void;
  setTaskDetail: React.Dispatch<React.SetStateAction<GenerationTaskDetail | null>>;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
  addAssetToCanvas?: (asset: AssetSummary) => void;
  models: ModelSummary[];
  workflowRefAsset: AssetSummary | null;
  setWorkflowRefAsset: (asset: AssetSummary | null) => void;
  setPreviewAsset: (asset: AssetSummary | null) => void;
}

export function ProjectWorkflowPanel({
  selectedProject,
  activeWorkspace,
  currentUser,
  setTransactions,
  setTasks,
  assets,
  setAssets,
  setSelectedTaskId,
  setTaskDetail,
  addWorkflowResultToCanvas,
  addAssetToCanvas,
  models,
  workflowRefAsset,
  setWorkflowRefAsset,
  setPreviewAsset,
}: ProjectWorkflowPanelProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>("image-generation");
  const [workflowInput, setWorkflowInput] = useState("为一家新开咖啡店做小红书开业推广");
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);

  // 控制台专属状态
  const [isBannerOpen, setIsBannerOpen] = useState(true);
  const [isParamPopupOpen, setIsParamPopupOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isRefSelectorOpen, setIsRefSelectorOpen] = useState(false);
  
  // 聊天评价反馈与自动滚动
  const [feedbacks, setFeedbacks] = useState<Record<string, "up" | "down" | "">>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputRows, setInputRows] = useState<number>(4);
  
  // 生图参数状态
  const [quality, setQuality] = useState<"auto" | "high" | "medium" | "low">("medium");
  const [width, setWidth] = useState<number>(2048);
  const [height, setHeight] = useState<number>(1152);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9(2k)");
  const [imageCount, setImageCount] = useState<number>(1);
  
  const refAsset = workflowRefAsset;
  const setRefAsset = setWorkflowRefAsset;

  // 模型选择状态
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);

  const selectedProjectId = selectedProject.id;
  
  const selectedWorkflowLabel =
    quickTasks.find((task) => task.type === selectedWorkflow)?.label ?? "工作流";

  // 引用弹窗与菜单外部点击关闭
  const paramBadgeRef = useRef<HTMLButtonElement>(null);
  const paramPopupRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  function getAvailableModels() {
    const isImageModel = (m: ModelSummary) => {
      const n = (m.name || "").toLowerCase();
      const dn = (m.display_name || "").toLowerCase();
      return n.includes("image") || n.includes("dall") || n.includes("midjourney") || n.includes("flux") || n.includes("sd") || n.includes("diffusion") ||
             dn.includes("image") || dn.includes("dall") || dn.includes("midjourney") || dn.includes("flux") || dn.includes("sd") || dn.includes("diffusion") || dn.includes("图");
    };

    const isVideoModel = (m: ModelSummary) => {
      const n = (m.name || "").toLowerCase();
      const dn = (m.display_name || "").toLowerCase();
      return n.includes("video") || n.includes("luma") || n.includes("runway") || n.includes("sora") || n.includes("kling") || n.includes("cogvideo") ||
             dn.includes("video") || dn.includes("luma") || dn.includes("runway") || dn.includes("sora") || dn.includes("kling") || dn.includes("cogvideo") || dn.includes("视频");
    };

    if (selectedWorkflow === "image-generation") {
      const filtered = models
        .filter((m) => m.enabled && isImageModel(m))
        .map((m) => ({ id: m.id, name: m.name, display_name: m.display_name || m.name }));
      if (filtered.length > 0) {
        return filtered;
      }
      return [
        { id: "gpt-image-2", name: "gpt-image-2", display_name: "GPT Image 2" },
        { id: "dall-e-3", name: "dall-e-3", display_name: "DALL-E 3" },
        { id: "midjourney-v6", name: "midjourney-v6", display_name: "Midjourney v6" },
      ];
    } else if (selectedWorkflow === "video-generation") {
      const filtered = models
        .filter((m) => m.enabled && isVideoModel(m))
        .map((m) => ({ id: m.id, name: m.name, display_name: m.display_name || m.name }));
      if (filtered.length > 0) {
        return filtered;
      }
      return [
        { id: "luma-video", name: "luma-video", display_name: "Luma Video" },
        { id: "runway-gen3", name: "runway-gen3", display_name: "Runway Gen-3" },
      ];
    } else {
      const filtered = models
        .filter((m) => m.enabled && !isImageModel(m) && !isVideoModel(m))
        .map((m) => ({ id: m.id, name: m.name, display_name: m.display_name || m.name }));
      if (filtered.length > 0) {
        return filtered;
      }
      return [
        { id: "gpt-4o", name: "gpt-4o", display_name: "GPT-4o" },
        { id: "claude-3.5-sonnet", name: "claude-3.5-sonnet", display_name: "Claude 3.5 Sonnet" },
        { id: "deepseek-v3", name: "deepseek-v3", display_name: "DeepSeek-V3" },
      ];
    }
  }

  useEffect(() => {
    const available = getAvailableModels();
    if (!available.some((m) => m.id === selectedModel)) {
      setSelectedModel(available[0]?.id || "");
    }
  }, [selectedWorkflow, models]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        paramPopupRef.current &&
        !paramPopupRef.current.contains(event.target as Node) &&
        paramBadgeRef.current &&
        !paramBadgeRef.current.contains(event.target as Node)
      ) {
        setIsParamPopupOpen(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node) &&
        modelTriggerRef.current &&
        !modelTriggerRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedModel]);

  // Sync workflow input with selected project brief
  useEffect(() => {
    if (selectedProject.brief) {
      setWorkflowInput(selectedProject.brief);
    }
  }, [selectedProjectId, selectedProject.brief]);

  // 提示词输入框根据内容动态计算 rows (最小 4 行, 最大 8 行)
  useEffect(() => {
    if (!workflowInput) {
      setInputRows(4);
      return;
    }
    const lines = workflowInput.split("\n");
    let calculatedRows = 0;
    lines.forEach((line) => {
      // 侧边栏卡片输入宽度下，每 28 个字符大约折成一行
      calculatedRows += Math.max(1, Math.ceil(line.length / 28));
    });
    
    const nextRows = Math.min(8, Math.max(4, calculatedRows));
    setInputRows(nextRows);
  }, [workflowInput]);



  // 比例预设与尺寸关联
  function handlePresetRatio(ratio: string) {
    setAspectRatio(ratio);
    switch (ratio) {
      case "1:1":
        setWidth(1024); setHeight(1024); break;
      case "3:2":
        setWidth(1200); setHeight(800); break;
      case "2:3":
        setWidth(800); setHeight(1200); break;
      case "4:3":
        setWidth(1024); setHeight(768); break;
      case "3:4":
        setWidth(768); setHeight(1024); break;
      case "9:16":
        setWidth(576); setHeight(1024); break;
      case "1:1(2k)":
        setWidth(2048); setHeight(2048); break;
      case "16:9(2k)":
        setWidth(2048); setHeight(1152); break;
      case "9:16(2k)":
        setWidth(1152); setHeight(2048); break;
      case "16:9(4k)":
        setWidth(3840); setHeight(2160); break;
      case "9:16(4k)":
        setWidth(2160); setHeight(3840); break;
      case "auto":
        setWidth(1024); setHeight(1024); break;
      default:
        break;
    }
  }



  // Payload Builder for Workflows
  function buildWorkflowPayload(workflow: WorkflowType, workspaceId: string, projectId?: string) {
    if (workflow === "image-generation") {
      return {
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        task_type: "image_generation",
        selected_model: selectedModel || "gpt-image-2",
        input_payload: {
          prompt: workflowInput,
          size: `${width}x${height}`,
          quality: quality,
          image_count: imageCount,
          ref_image_url: refAsset ? (refAsset.thumbnail_url ?? refAsset.file_url) : null
        }
      };
    }

    if (workflow === "video-generation") {
      return {
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        task_type: "video_generation",
        selected_model: selectedModel || "luma-video",
        input_payload: {
          prompt: workflowInput,
          size: `${width}x${height}`,
          ref_image_url: refAsset ? (refAsset.thumbnail_url ?? refAsset.file_url) : null
        }
      };
    }

    // text-generation 文本大类
    return {
      workspace_id: workspaceId,
      project_id: projectId ?? null,
      task_type: "text",
      selected_model: selectedModel || "gpt-4o",
      input_payload: {
        prompt: workflowInput,
      }
    };
  }

  // Execute Workflow Runner
  async function runWorkflow() {
    if (!selectedWorkflow) return;
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setWorkflowResult({
        task: {
          task_type: selectedWorkflow,
          status: "failed",
          estimated_credits: 0,
          actual_credits: 0,
        },
        output: {
          message: "API 未连接或工作区不存在",
        },
      });
      return;
    }
    setIsRunningWorkflow(true);
    setWorkflowResult(null);

    try {
      const payload = buildWorkflowPayload(selectedWorkflow, workspaceId, selectedProjectId);
      const res = await postJson<{ success: boolean; message?: string; data: any }>(
        "/api/tasks",
        payload
      );
      
      if (!res.success && !res.data) {
        throw new Error(res.message || "提交生成任务失败");
      }

      const task = res.data;
      const data = {
        success: true,
        task: task,
        transactions: [] as any[],
        output: null,
      };

      setWorkflowResult(data);
      
      if (task) {
        const taskId = task.id ?? `${task.task_type}-${Date.now()}`;
        setTasks((current) => [
          {
            id: taskId,
            task_type: task.task_type,
            status: task.status || "pending",
            estimated_credits: task.estimated_credits || 0,
            actual_credits: task.actual_credits || 0,
          },
          ...current,
        ]);
        setSelectedTaskId(taskId);
        setTaskDetail({
          id: taskId,
          workspace_id: workspaceId,
          project_id: selectedProjectId,
          task_type: task.task_type,
          status: task.status || "pending",
          estimated_credits: task.estimated_credits || 0,
          frozen_credits: task.frozen_credits || 0,
          actual_credits: task.actual_credits || 0,
          input_payload: payload.input_payload,
          output_payload: null,
          error_code: null,
          error_message: null,
        });
        return;
      }
      setWorkflowResult({
        task: {
          task_type: selectedWorkflow,
          status: "failed",
          estimated_credits: 0,
          actual_credits: 0,
        },
        output: {
          message: "API 未连接或工作流执行失败",
        },
      });
    } catch (err: any) {
      setWorkflowResult({
        task: {
          task_type: selectedWorkflow,
          status: "failed",
          estimated_credits: 0,
          actual_credits: 0,
        },
        output: {
          message: err.message || "提交生成任务遇到错误",
        },
      });
    } finally {
      setIsRunningWorkflow(false);
    }
  }

  // --- 辅助动作处理 ---
  const handleReedit = (promptText?: string) => {
    if (promptText) {
      setWorkflowInput(promptText);
    }
  };

  const handleRegenerate = (promptText?: string, type?: string) => {
    if (!promptText) return;
    setWorkflowInput(promptText);
    if (type) {
      setSelectedWorkflow(type as WorkflowType);
    }
    setTimeout(() => {
      void runWorkflow();
    }, 100);
  };

  const handleFeedback = (assetId: string, type: "up" | "down") => {
    setFeedbacks((prev) => ({
      ...prev,
      [assetId]: prev[assetId] === type ? "" : type,
    }));
    alert(type === "up" ? "感谢您的肯定！" : "感谢您的反馈，我们会持续优化模型。");
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setWorkflowInput(e.target.value);
  };

  // 过滤出项目现有的图片资产（作为参考图）
  const imageAssets = assets.filter((a) => a.asset_type === "image" && (a.thumbnail_url || a.file_url));

  // 提取历史 AI 会话记录，并进行逆序让最新的显示在最下方
  const aiAssets = assets
    .filter(
      (a) =>
        a.project_id === selectedProjectId &&
        (a.source === "ai" || a.source === "generated" || a.asset_type === "workflow_output")
    )
    .slice()
    .reverse();

  const isRunnable = selectedWorkflow ? isWorkflowRunnable(selectedWorkflow) : false;
  const costPoints = selectedWorkflow === "image-generation"
    ? 12
    : selectedWorkflow === "video-generation"
    ? 30
    : 2;

  return (
    <div className="gen-chat-container">
      
      {/* 1. 会话流滚动区域 */}
      <WorkflowHistoryFeed
        aiAssets={aiAssets}
        currentUser={currentUser}
        selectedProjectId={selectedProjectId}
        feedbacks={feedbacks}
        handleFeedback={handleFeedback}
        handleReedit={handleReedit}
        handleRegenerate={handleRegenerate}
        addAssetToCanvas={addAssetToCanvas}
        addWorkflowResultToCanvas={addWorkflowResultToCanvas}
        isRunningWorkflow={isRunningWorkflow}
        workflowResult={workflowResult}
        setPreviewAsset={setPreviewAsset}
      />

      {/* 2. 底部固定区域（含促销横幅与控制台输入卡片） */}
      <div className="gen-sticky-bottom">
        {/* 促销横幅 */}
        {isBannerOpen && (
          <div className="gen-console-banner">
            <span>大促返场：升级会员最高立享 57% OFF!</span>
            <button 
              type="button" 
              onClick={() => setIsBannerOpen(false)}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontWeight: "bold", fontSize: "12px", marginLeft: "8px" }}
            >
              ×
            </button>
          </div>
        )}

        {/* AI 创意控制台 (Prompt Bar Card) */}
        <div className="gen-prompt-card">
          
          {/* 输入区 & 参考图 */}
          {/* 输入区 & 参考图：改用纵向布局，使参考图呈现在输入框上方 */}
          <div className="gen-prompt-top-row" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px 6px 12px" }}>
            {/* 图像和视频工作流共享：参考图模块 */}
            {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && (
              <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-start" }}>
                {refAsset ? (
                  <div className="gen-ref-image-preview">
                    <img 
                      src={assetUrl(refAsset.thumbnail_url ?? refAsset.file_url ?? "")} 
                      alt="Reference" 
                    />
                    <button
                      type="button"
                      className="gen-ref-image-remove"
                      onClick={() => setRefAsset(null)}
                      title="移除参考图"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="gen-ref-image-btn"
                    onClick={() => setIsRefSelectorOpen(true)}
                    title="添加参考图"
                  >
                    <Image size={15} />
                    <span style={{ fontSize: "9px", marginTop: "2px", fontWeight: "600" }}>参考图</span>
                  </button>
                )}
              </div>
            )}

            {/* 无边框 Textarea 提示词输入 */}
            <textarea
              ref={textareaRef}
              className="gen-prompt-textarea"
              rows={inputRows}
              placeholder={
                selectedWorkflow === "image-generation"
                  ? "今天我们要创作什么图像..."
                  : selectedWorkflow === "video-generation"
                  ? "今天我们要生成什么视频..."
                  : "输入任务提示词或创意大纲..."
              }
              value={workflowInput}
              onChange={handleTextareaChange}
              style={{ width: "100%", border: "none", resize: "none", outline: "none", fontSize: "12px", background: "transparent", color: "var(--rv-color-text-main)", padding: "2px 0", lineHeight: "1.4" }}
            />
          </div>

          {/* 底栏控制面板 */}
          <div className="gen-bottom-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="gen-actions-left" style={{ display: "flex", alignItems: "center" }}>
              {/* 工作流模式切换下拉 */}
              <div style={{ position: "relative" }} ref={modeDropdownRef}>
                <button
                  type="button"
                  className="gen-mode-dropdown-trigger"
                  onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                  style={{ border: "none", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                >
                  {getWorkflowIcon(selectedWorkflow || "image-generation", 12)}
                  <span style={{ fontSize: "11px" }}>{selectedWorkflowLabel}</span>
                  <ChevronDown size={10} />
                </button>

                {isModeDropdownOpen && (
                  <div className="gen-mode-dropdown-menu">
                    {quickTasks.map((t) => (
                      <button
                        key={t.type}
                        className={`gen-mode-dropdown-item ${selectedWorkflow === t.type ? "active" : ""}`}
                        type="button"
                        onClick={() => {
                          setSelectedWorkflow(t.type);
                          setIsModeDropdownOpen(false);
                          setWorkflowResult(null);
                          setIsParamPopupOpen(false);
                        }}
                      >
                        {getWorkflowIcon(t.type, 12)}
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 生图与视频工作流：参数设置徽章 */}
              {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && (
                <button
                  ref={paramBadgeRef}
                  type="button"
                  className="gen-param-badge"
                  onClick={() => setIsParamPopupOpen(!isParamPopupOpen)}
                  style={{ border: "none", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginLeft: "6px" }}
                >
                  <span>
                    {selectedWorkflow === "image-generation"
                      ? `${getQualityLabel(quality)} · ${aspectRatio} · ${imageCount}张`
                      : `比例：${aspectRatio}`}
                  </span>
                  <ChevronDown size={10} />
                </button>
              )}
            </div>

            {/* 点数启动按钮与左侧模型选择图标 */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, position: "relative" }}>
              <button
                ref={modelTriggerRef}
                className="gen-model-trigger"
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                title={`当前选择模型: ${getAvailableModels().find((m) => m.id === selectedModel)?.display_name || selectedModel}`}
              >
                🤖
              </button>

              {isModelDropdownOpen && (
                <div className="gen-model-dropdown-menu" ref={modelDropdownRef} onClick={(e) => e.stopPropagation()}>
                  <div className="gen-model-dropdown-title">选择模型</div>
                  {getAvailableModels().map((m) => (
                    <button
                      key={m.id}
                      className={`gen-model-dropdown-item ${selectedModel === m.id ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      <span className="gen-model-dot" />
                      <span>{m.display_name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                className="gen-submit-btn"
                type="button"
                disabled={isRunningWorkflow || !isRunnable || !workflowInput.trim()}
                onClick={runWorkflow}
                style={{ border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
              >
                {isRunningWorkflow ? (
                  <Loader2 className="spin" size={12} />
                ) : (
                  <Zap size={11} fill="currentColor" />
                )}
                <span>{isRunningWorkflow ? "生成中" : `${costPoints * imageCount}`}</span>
              </button>
            </div>
          </div>

          {/* 参数浮窗面板：图像/视频模式按需渲染对应字段 */}
          {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && isParamPopupOpen && (
            <div className="gen-param-popup" ref={paramPopupRef} onClick={(e) => e.stopPropagation()}>
              {/* 1. 质量 */}
              {selectedWorkflow === "image-generation" && (
                <div className="gen-param-section">
                  <span className="gen-param-section-title">质量</span>
                  <div className="gen-btn-group">
                    {(["auto", "high", "medium", "low"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`gen-selector-item ${quality === q ? "active" : ""}`}
                        onClick={() => setQuality(q)}
                      >
                        {getQualityLabel(q)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. 尺寸微调 */}
              <div className="gen-param-section">
                <span className="gen-param-section-title">尺寸微调 (PX)</span>
                <div className="gen-custom-dim-row">
                  <div className="gen-dim-input">
                    <span>W</span>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => {
                        setWidth(Number(e.target.value));
                        setAspectRatio("自定义");
                      }}
                    />
                  </div>
                  <span style={{ color: "rgba(185, 178, 165, 0.4)", fontWeight: "bold" }}>×</span>
                  <div className="gen-dim-input">
                    <span>H</span>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => {
                        setHeight(Number(e.target.value));
                        setAspectRatio("自定义");
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. 比例预设 */}
              <div className="gen-param-section">
                <span className="gen-param-section-title">比例预设</span>
                <div className="gen-preset-grid">
                  {(["1:1", "3:2", "2:3", "4:3", "3:4", "9:16", "1:1(2k)", "16:9(2k)", "9:16(2k)", "16:9(4k)", "9:16(4k)", "auto"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      className={`gen-preset-btn ${aspectRatio === ratio ? "active" : ""}`}
                      onClick={() => handlePresetRatio(ratio)}
                    >
                      <div className="gen-preset-ratio-box" style={getRatioBoxStyle(ratio)} />
                      <span className="gen-preset-ratio-text">{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. 图片张数 */}
              {selectedWorkflow === "image-generation" && (
                <div className="gen-param-section">
                  <span className="gen-param-section-title">生成数量 (当前消耗: {12 * imageCount} 点)</span>
                  <div className="gen-btn-group" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "2px" }}>
                    {([1, 2, 3, 4, 5] as const).map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`gen-selector-item ${imageCount === num ? "active" : ""}`}
                        onClick={() => setImageCount(num)}
                      >
                        {num} 张
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 覆盖层：项目内参考图选择器 */}
          {isRefSelectorOpen && (
            <div className="gen-ref-selector-overlay">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--rv-color-text-main)" }}>选择项目内的参考图</span>
                <button
                  type="button"
                  onClick={() => setIsRefSelectorOpen(false)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)", padding: "2px" }}
                >
                  <X size={14} />
                </button>
              </div>
              {imageAssets.length > 0 ? (
                <div className="gen-ref-selector-grid">
                  {imageAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="gen-ref-selector-item"
                      onClick={() => {
                        setRefAsset(asset);
                        setIsRefSelectorOpen(false);
                      }}
                      title={assetTitle(asset)}
                    >
                      <img src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} alt={assetTitle(asset)} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--rv-color-text-muted)", textAlign: "center" }}>
                  项目中无可用图片资产。<br />请先通过左侧“库与历史”或素材管理导入图片。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
