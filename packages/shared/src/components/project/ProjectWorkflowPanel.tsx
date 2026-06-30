import { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  Sparkles,
  ChevronDown,
  X,
  Zap,
  Image
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
  AISession,
} from "../../types";
import { getJson, postJson, assetUrl, assetTitle, uploadAsset } from "../../utils";
import { WorkflowHistoryFeed } from "./WorkflowHistoryFeed";
import {
  quickTasks,
  isWorkflowRunnable,
  getWorkflowIcon,
  getRatioBoxStyle,
  getQualityLabel,
} from "./workflowUtils";
import { WorkflowParamPopup } from "./WorkflowParamPopup";
import { SessionHeader } from "./SessionHeader";
import { WorkflowPromptConsole } from "./WorkflowPromptConsole";



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
  onClose?: () => void;
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
  onClose,
}: ProjectWorkflowPanelProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>("image-generation");
  const [workflowInput, setWorkflowInput] = useState("");
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);

  // 控制台专属状态
  const [isParamPopupOpen, setIsParamPopupOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isRefSelectorOpen, setIsRefSelectorOpen] = useState(false);
  const [isRefMenuOpen, setIsRefMenuOpen] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [activeProgress, setActiveProgress] = useState(0);
  
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
  const refMenuTriggerRef = useRef<HTMLDivElement>(null);
  const fileRefInputRef = useRef<HTMLInputElement>(null);

  // 多会话管理状态
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);

  // 任务管理状态
  const [localTasks, setLocalTasks] = useState<GenerationTaskSummary[]>([]);

  // 1. 根据项目物理隔离加载/同步 sessions
  useEffect(() => {
    const key = `reveria_sessions_${selectedProjectId}`;
    const stored = localStorage.getItem(key);
    let parsed: AISession[] = [];
    if (stored) {
      try {
        parsed = JSON.parse(stored);
      } catch (e) {
        console.error("解析本地会话缓存失败:", e);
      }
    }
    
    if (parsed.length === 0) {
      const defaultSession: AISession = {
        id: `session_${Date.now()}`,
        title: "默认对话",
        createdAt: Date.now(),
        assetIds: []
      };
      parsed = [defaultSession];
      localStorage.setItem(key, JSON.stringify(parsed));
    }
    
    setSessions(parsed);
    
    const activeKey = `reveria_active_session_${selectedProjectId}`;
    const storedActiveId = localStorage.getItem(activeKey);
    if (storedActiveId && parsed.some(s => s.id === storedActiveId)) {
      setCurrentSessionId(storedActiveId);
    } else {
      setCurrentSessionId(parsed[0].id);
      localStorage.setItem(activeKey, parsed[0].id);
    }
  }, [selectedProjectId]);

  const saveSessions = (updatedSessions: AISession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem(`reveria_sessions_${selectedProjectId}`, JSON.stringify(updatedSessions));
  };

  const handleCreateNewSession = () => {
    const newSession: AISession = {
      id: `session_${Date.now()}`,
      title: "新对话",
      createdAt: Date.now(),
      assetIds: []
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
    localStorage.setItem(`reveria_active_session_${selectedProjectId}`, newSession.id);
    setWorkflowInput("");
    setRefAsset(null);
  };

  const handleRemoveSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这个会话吗？")) return;
    
    const updated = sessions.filter(s => s.id !== sessionId);
    if (updated.length === 0) {
      const defaultSession: AISession = {
        id: `session_${Date.now()}`,
        title: "默认对话",
        createdAt: Date.now(),
        assetIds: []
      };
      saveSessions([defaultSession]);
      setCurrentSessionId(defaultSession.id);
      localStorage.setItem(`reveria_active_session_${selectedProjectId}`, defaultSession.id);
    } else {
      saveSessions(updated);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(updated[0].id);
        localStorage.setItem(`reveria_active_session_${selectedProjectId}`, updated[0].id);
      }
    }
  };

  // 引用弹窗点击外部关闭
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
      if (
        refMenuTriggerRef.current &&
        !refMenuTriggerRef.current.contains(event.target as Node)
      ) {
        setIsRefMenuOpen(false);
      }
      if (
        sessionDropdownRef.current &&
        !sessionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSessionDropdownOpen(false);
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

  // 动态输入框 rows 自适应
  useEffect(() => {
    if (!workflowInput) {
      setInputRows(4);
      return;
    }
    const lines = workflowInput.split("\n");
    let calculatedRows = 0;
    lines.forEach((line) => {
      calculatedRows += Math.max(1, Math.ceil(line.length / 28));
    });
    
    const nextRows = Math.min(8, Math.max(4, calculatedRows));
    setInputRows(nextRows);
  }, [workflowInput]);

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
      if (filtered.length > 0) return filtered;
      return [
        { id: "gpt-image-2", name: "gpt-image-2", display_name: "GPT Image 2" },
        { id: "dall-e-3", name: "dall-e-3", display_name: "DALL-E 3" },
        { id: "midjourney-v6", name: "midjourney-v6", display_name: "Midjourney v6" },
      ];
    } else if (selectedWorkflow === "video-generation") {
      const filtered = models
        .filter((m) => m.enabled && isVideoModel(m))
        .map((m) => ({ id: m.id, name: m.name, display_name: m.display_name || m.name }));
      if (filtered.length > 0) return filtered;
      return [
        { id: "luma-video", name: "luma-video", display_name: "Luma Video" },
        { id: "runway-gen3", name: "runway-gen3", display_name: "Runway Gen-3" },
      ];
    } else {
      const filtered = models
        .filter((m) => m.enabled && !isImageModel(m) && !isVideoModel(m))
        .map((m) => ({ id: m.id, name: m.name, display_name: m.display_name || m.name }));
      if (filtered.length > 0) return filtered;
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

  // 轮询生成进度 useEffect
  const currentActiveTask = localTasks.find(
    (t) => t.status === "pending" || t.status === "running" || t.status === "queue" || t.status === "processing"
  );

  useEffect(() => {
    if (!currentActiveTask) {
      setActiveProgress((prev) => {
        if (prev > 0 && prev < 100) {
          setTimeout(() => {
            setActiveProgress(0);
          }, 800);
          return 100;
        }
        return 0;
      });
      return;
    }

    if (currentActiveTask.status === "pending" || currentActiveTask.status === "queue") {
      setActiveProgress(0);
    }

    const pollTimer = setInterval(async () => {
      try {
        const assetsRes = await getJson<AssetSummary[]>(
          `/api/assets?project_id=${encodeURIComponent(selectedProjectId)}`
        );
        if (assetsRes && Array.isArray(assetsRes)) {
          setAssets(assetsRes);
        }

        const tasksRes = await getJson<GenerationTaskSummary[]>("/api/tasks");
        if (tasksRes && Array.isArray(tasksRes)) {
          const projectTasks = tasksRes.filter((t) => t.project_id === selectedProjectId);
          setLocalTasks(projectTasks);
          setTasks(projectTasks);
        }
      } catch (err) {
        console.error("Failed to poll task status:", err);
      }
    }, 3000);

    let progressTimer: any = null;
    if (currentActiveTask.status === "running" || currentActiveTask.status === "processing") {
      progressTimer = setInterval(() => {
        setActiveProgress((prev) => {
          if (prev >= 98) return 98;
          return prev + 1;
        });
      }, 250);
    }

    return () => {
      clearInterval(pollTimer);
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [currentActiveTask, selectedProjectId, setAssets, setTasks]);

  // 比例参数关联
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

  // 二进制上传参考图
  const handleUploadRefImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingRef(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_id", workspaceIdForAssetUpload());
      formData.append("project_id", selectedProjectId);
      formData.append("asset_type", "image");
      const res = await uploadAsset(formData);
      if (res && res.id) {
        const assetsRes = await getJson<AssetSummary[]>(
          `/api/assets?project_id=${encodeURIComponent(selectedProjectId)}`
        );
        if (assetsRes && Array.isArray(assetsRes)) {
          setAssets(assetsRes);
          const uploaded = assetsRes.find((a) => a.id === res.id);
          if (uploaded) setRefAsset(uploaded);
        }
      }
    } catch (err) {
      console.error("Failed to upload reference image:", err);
      alert("上传参考图失败，请检查服务连接");
    } finally {
      setIsUploadingRef(false);
    }
  };

  const workspaceIdForAssetUpload = () => {
    return activeWorkspace?.id || selectedProject.workspace_id || "";
  };

  // 发动任务
  async function runWorkflow() {
    if (!selectedWorkflow) return;
    setIsRunningWorkflow(true);

    const payload = buildWorkflowPayload(selectedWorkflow);
    try {
      const res = await postJson<{ success: boolean; data: { task_id: string; asset_id: string } }>(
        "/api/tasks",
        payload
      );

      if (res && res.success && res.data) {
        setWorkflowInput("");
        setRefAsset(null); // 发送完毕立即清理控制台垫图
        
        const tasksRes = await getJson<GenerationTaskSummary[]>("/api/tasks");
        if (tasksRes && Array.isArray(tasksRes)) {
          const projectTasks = tasksRes.filter((t) => t.project_id === selectedProjectId);
          setLocalTasks(projectTasks);
          setTasks(projectTasks);
        }

        // 会话物理隔离数据绑定与智能自动标题
        const activeSess = sessions.find(s => s.id === currentSessionId);
        if (activeSess) {
          const updatedSessions = sessions.map(s => {
            if (s.id === currentSessionId) {
              const newTitle = s.title === "新对话" || s.title === "默认对话"
                ? (payload.prompt.trim().substring(0, 8) || "AI 对话")
                : s.title;
              return {
                ...s,
                title: newTitle,
                assetIds: [...s.assetIds, res.data.asset_id]
              };
            }
            return s;
          });
          saveSessions(updatedSessions);
        }
      } else {
        alert("提交任务失败，请稍后重试");
      }
    } catch (err) {
      console.error("Failed to run workflow:", err);
      alert("执行工作流发生异常错误");
    } finally {
      setIsRunningWorkflow(false);
    }
  }

  function buildWorkflowPayload(workflow: WorkflowType) {
    const base = {
      project_id: selectedProjectId,
      model_id: selectedModel,
      prompt: workflowInput,
      negative_prompt: "",
    };

    if (workflow === "image-generation") {
      return {
        ...base,
        task_type: "image_generation",
        image_params: {
          width,
          height,
          quality,
          num_images: imageCount,
        },
        input_payload: {
          prompt: workflowInput,
          size: `${width}x${height}`,
          ref_image_url: refAsset ? (refAsset.file_url ?? refAsset.thumbnail_url ?? "") : null
        }
      };
    }

    if (workflow === "video-generation") {
      return {
        ...base,
        task_type: "video_generation",
        video_params: {
          width,
          height,
          duration: 4,
        },
        input_payload: {
          prompt: workflowInput,
          size: `${width}x${height}`,
          ref_image_url: refAsset ? (refAsset.file_url ?? refAsset.thumbnail_url ?? "") : null
        }
      };
    }

    return {
      ...base,
      task_type: "text_generation",
      text_params: {
        max_tokens: 1024,
        temperature: 0.7,
      },
      input_payload: {
        prompt: workflowInput
      }
    };
  }

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

  // 历史重新编辑与回填
  const handleReedit = (promptText?: string, refImageUrl?: string) => {
    if (promptText) {
      setWorkflowInput(promptText);
    }
    if (refImageUrl) {
      const matched = assets.find(a => a.file_url === refImageUrl || a.thumbnail_url === refImageUrl);
      if (matched) setRefAsset(matched);
    }
  };

  const handleRegenerate = (promptText?: string, type?: string, refImageUrl?: string) => {
    if (type) {
      setSelectedWorkflow(type as WorkflowType);
    }
    if (promptText) {
      setWorkflowInput(promptText);
    }
    if (refImageUrl) {
      const matched = assets.find(a => a.file_url === refImageUrl || a.thumbnail_url === refImageUrl);
      if (matched) setRefAsset(matched);
    }
  };

  const imageAssets = assets.filter((a) => a.asset_type === "image" && (a.thumbnail_url || a.file_url));
  const activeSession = sessions.find((s) => s.id === currentSessionId) || null;
  const currentSessionAssetIds = new Set(activeSession?.assetIds || []);
  const aiAssets = assets
    .filter((a) => currentSessionAssetIds.has(a.id))
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
      <SessionHeader
        activeSession={activeSession}
        sessions={sessions}
        currentSessionId={currentSessionId}
        setCurrentSessionId={setCurrentSessionId}
        isSessionDropdownOpen={isSessionDropdownOpen}
        setIsSessionDropdownOpen={setIsSessionDropdownOpen}
        sessionDropdownRef={sessionDropdownRef}
        handleRemoveSession={handleRemoveSession}
        handleCreateNewSession={handleCreateNewSession}
        onClose={onClose}
      />
      
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
        activeTask={currentActiveTask}
        activeProgress={activeProgress}
        workflowResult={workflowResult}
        setPreviewAsset={setPreviewAsset}
      />

      {/* 2. 底部固定区域（含控制台输入卡片） */}
      <WorkflowPromptConsole
        selectedWorkflow={selectedWorkflow}
        setSelectedWorkflow={setSelectedWorkflow}
        workflowInput={workflowInput}
        setWorkflowInput={setWorkflowInput}
        isRunningWorkflow={isRunningWorkflow}
        refAsset={refAsset}
        setRefAsset={setRefAsset}
        isUploadingRef={isUploadingRef}
        setIsUploadingRef={setIsUploadingRef}
        inputRows={inputRows}
        handleTextareaChange={handleTextareaChange}
        isModeDropdownOpen={isModeDropdownOpen}
        setIsModeDropdownOpen={setIsModeDropdownOpen}
        isParamPopupOpen={isParamPopupOpen}
        setIsParamPopupOpen={setIsParamPopupOpen}
        isRefMenuOpen={isRefMenuOpen}
        setIsRefMenuOpen={setIsRefMenuOpen}
        isRefSelectorOpen={isRefSelectorOpen}
        setIsRefSelectorOpen={setIsRefSelectorOpen}
        quality={quality}
        setQuality={setQuality}
        width={width}
        setWidth={setWidth}
        height={height}
        setHeight={setHeight}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        imageCount={imageCount}
        setImageCount={setImageCount}
        handlePresetRatio={handlePresetRatio}
        getRatioBoxStyle={getRatioBoxStyle}
        getQualityLabel={getQualityLabel}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        isModelDropdownOpen={isModelDropdownOpen}
        setIsModelDropdownOpen={setIsModelDropdownOpen}
        runWorkflow={runWorkflow}
        costPoints={costPoints}
        isRunnable={isRunnable}
        getAvailableModels={getAvailableModels}
        paramBadgeRef={paramBadgeRef}
        paramPopupRef={paramPopupRef}
        modelTriggerRef={modelTriggerRef}
        modelDropdownRef={modelDropdownRef}
        refMenuTriggerRef={refMenuTriggerRef}
        fileRefInputRef={fileRefInputRef}
        handleUploadRefImage={handleUploadRefImage}
        imageAssets={imageAssets}
        quickTasks={quickTasks}
        textareaRef={textareaRef}
      />
    </div>
  );
}
