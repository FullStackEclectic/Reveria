import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Loader2,
  Save,
  FileText,
  Sparkles,
  Trash2,
  Eye,
  Settings,
  ArrowLeft,
  ChevronDown,
  Download,
  Layers,
  Type,
  Palette,
  Grid,
  Share2,
  History,
  FolderOpen,
  Folder,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import {
  ProjectSummary,
  CustomerSummary,
  BrandKitSummary,
  AssetSummary,
  ProjectCanvasDocument,
  WorkspaceSummary,
  UserSummary,
  CreditTransactionSummary,
  GenerationTaskSummary,
  GenerationTaskDetail,
  ProjectCanvasSummary,
  CanvasItem,
  ModelSummary,
} from "../../types";
import {
  normalizeCanvas,
  createCanvasItemId,
  assetTitle,
  assetUrl,
  sanitizeDownloadName,
  downloadTextFile,
  buildProjectMarkdown,
  putJson,
  handleExportProject,
} from "../../utils";
import { PageFrame } from "../common/PageFrame";
import { Metric } from "../common/Metric";
import { CanvasViewport } from "./CanvasViewport";

import { LeftAssetsDrawer } from "./LeftAssetsDrawer";
import { RightWorkflowDrawer } from "./RightWorkflowDrawer";
import { ProjectDetailTopbar } from "./ProjectDetailTopbar";
import { exportCanvasToSVG } from "./canvasExportUtils";
import { TemplateSelectModal } from "./TemplateSelectModal";
import { PromptTemplate } from "../../types";
import { runTemplateGeneration } from "./templateWorkflowUtils";

interface ProjectDetailViewProps {
  projects: ProjectSummary[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectSummary[]>>;
  selectedProject: ProjectSummary;
  setSelectedProjectId: (id: string) => void;
  loadProjectAssets: (id: string) => Promise<void>;
  loadProjectCanvas: (id: string) => Promise<void>;
  customers: CustomerSummary[];
  brandKits: BrandKitSummary[];
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  currentRole: string;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  transactions: CreditTransactionSummary[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  setSelectedTaskId: (id: string) => void;
  setTaskDetail: React.Dispatch<React.SetStateAction<GenerationTaskDetail | null>>;
  deletingAssetId: string;
  deleteAsset: (id: string) => Promise<void>;
  setPreviewAsset: (asset: AssetSummary | null) => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
  models: ModelSummary[];
}

export function ProjectDetailView({
  projects,
  setProjects,
  selectedProject,
  setSelectedProjectId,
  customers,
  brandKits,
  assets,
  setAssets,
  projectCanvas,
  setProjectCanvas,
  currentRole,
  activeWorkspace,
  currentUser,
  transactions,
  setTransactions,
  setTasks,
  setSelectedTaskId,
  setTaskDetail,
  setPreviewAsset,
  setProjectsViewMode,
  models,
}: ProjectDetailViewProps) {
  // 左右独立抽屉状态
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"library" | "share" | "settings">("library");
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState(selectedProject.name);
  const [workflowRefAsset, setWorkflowRefAsset] = useState<AssetSummary | null>(null);

  // Synchronize temp name
  useEffect(() => {
    setTempProjectName(selectedProject.name);
  }, [selectedProject.name]);

  async function handleSaveProjectName() {
    if (!tempProjectName.trim() || tempProjectName === selectedProject.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const updated = await putJson<ProjectSummary>(`/api/projects/${selectedProject.id}`, {
        ...selectedProject,
        name: tempProjectName.trim(),
      });
      setProjects((curr) => curr.map((p) => p.id === updated.id ? updated : p));
      setIsEditingName(false);
    } catch (err) {
      alert("修改项目名称失败");
    }
  }

  const handleToggleLeftTab = (tab: "library" | "share" | "settings") => {
    if (isLeftDrawerOpen && activeLeftTab === tab) {
      setIsLeftDrawerOpen(false);
    } else {
      setIsLeftDrawerOpen(true);
      setActiveLeftTab(tab);
    }
  };

  const handleToggleRightTab = () => {
    setIsRightDrawerOpen(!isRightDrawerOpen);
  };

  // Infinite Canvas Viewport States
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isSavingCanvas, setIsSavingCanvas] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg: string) => setToastMessage(msg);

  // --- 撤销与重做历史控制 ---
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const undoStack = useRef<ProjectCanvasDocument[]>([]);
  const redoStack = useRef<ProjectCanvasDocument[]>([]);

  const pushToHistory = (canvas: ProjectCanvasDocument) => {
    undoStack.current.push(JSON.parse(JSON.stringify(canvas)));
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;
    const currentCanvas = JSON.parse(JSON.stringify(projectCanvas));
    redoStack.current.push(currentCanvas);
    const prevCanvas = undoStack.current.pop()!;
    setProjectCanvas(prevCanvas);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const currentCanvas = JSON.parse(JSON.stringify(projectCanvas));
    undoStack.current.push(currentCanvas);
    const nextCanvas = redoStack.current.pop()!;
    setProjectCanvas(nextCanvas);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Boards
  const boards = projectCanvas.boards || [];
  const activeBoardsList = boards.length > 0 ? boards : [{ id: "default", name: "主画板" }];
  const activeBoardId = projectCanvas.activeBoardId || (boards[0]?.id || "default");

  const selectedProjectId = selectedProject.id;

  // Synchronize pan/zoom state with loaded canvas
  useEffect(() => {
    setPanX(projectCanvas.panX ?? 0);
    setPanY(projectCanvas.panY ?? 0);
    setZoom(projectCanvas.zoom ?? 1.0);
    setSelectedItemId("");
    // 切换项目清空撤销栈
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [selectedProjectId, projectCanvas.panX, projectCanvas.panY, projectCanvas.zoom]);

  // Keyboard shortcuts listener (Nudge, Delete, Copy, Paste, zoom reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo Ctrl + Z
      if (e.ctrlKey && e.key === "z") {
        const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
        if (isInput) return;
        undo();
        e.preventDefault();
        return;
      }

      // Redo Ctrl + Y
      if (e.ctrlKey && e.key === "y") {
        const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
        if (isInput) return;
        redo();
        e.preventDefault();
        return;
      }

      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (isInput) return;

      // Delete/Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedItemId) {
        removeCanvasItem(selectedItemId);
        setSelectedItemId("");
        e.preventDefault();
      }

      // Copy Ctrl + C
      if (e.ctrlKey && e.key === "c" && selectedItemId) {
        const itemToCopy = projectCanvas.items.find((i) => i.id === selectedItemId);
        if (itemToCopy) {
          localStorage.setItem("reveria.canvasClipboard", JSON.stringify(itemToCopy));
        }
      }

      // Paste Ctrl + V
      if (e.ctrlKey && e.key === "v") {
        const clipboardData = localStorage.getItem("reveria.canvasClipboard");
        if (clipboardData) {
          try {
            const copiedItem = JSON.parse(clipboardData) as CanvasItem;
            const newId = createCanvasItemId();
            const newItem: CanvasItem = {
              ...copiedItem,
              id: newId,
              x: copiedItem.x + 30,
              y: copiedItem.y + 30,
              board_id: activeBoardId,
            };
            pushToHistory(projectCanvas);
            setProjectCanvas((current) => ({
              ...current,
              items: [...current.items, newItem],
            }));
            setSelectedItemId(newId);
          } catch (err) {
            console.error("Paste canvas item error:", err);
          }
        }
      }

      // Arrow keys to nudge (1px or 10px with Shift)
      if (selectedItemId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const dist = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -dist;
        if (e.key === "ArrowDown") dy = dist;
        if (e.key === "ArrowLeft") dx = -dist;
        if (e.key === "ArrowRight") dx = dist;
        
        pushToHistory(projectCanvas);
        setProjectCanvas((current) => ({
          ...current,
          items: current.items.map((item) => {
            if (item.id !== selectedItemId) return item;
            return {
              ...item,
              x: item.x + dx,
              y: item.y + dy,
            };
          }),
        }));
        e.preventDefault();
      }

      // Ctrl + 0: reset zoom
      if (e.ctrlKey && e.key === "0") {
        setZoom(1.0);
        setPanX(0);
        setPanY(0);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, projectCanvas.items, activeBoardId, selectedProjectId]);

  function customerNameFor(customerId?: string | null) {
    if (!customerId) return "未绑定";
    return customers.find((c) => c.id === customerId)?.name ?? "未知客户";
  }

  // Canvas Actions
  function addFirstAssetToCanvas() {
    const asset = assets.find((item) => item.project_id === selectedProject.id) ?? assets[0];
    if (asset) {
      addAssetToCanvas(asset);
    }
  }

  function addAssetToCanvas(asset: AssetSummary) {
    const insert = (w: number, h: number) => {
      pushToHistory(projectCanvas);
      setProjectCanvas((current) => ({
        ...current,
        version: 1,
        items: [
          ...current.items,
          {
            id: createCanvasItemId(),
            type: "asset",
            asset_id: asset.id,
            title: assetTitle(asset),
            x: Math.round(-panX + 50 + (current.items.length % 4) * 40),
            y: Math.round(-panY + 50 + (current.items.length % 5) * 30),
            w,
            h,
            board_id: activeBoardId,
          },
        ],
      }));
    };
    const fileUrlStr = asset.file_url;
    if (fileUrlStr) {
      const img = new window.Image();
      img.src = assetUrl(fileUrlStr);
      img.onload = () => {
        insert(img.naturalWidth || 180, img.naturalHeight || 160);
        showToast("已将图片添加至当前画板！");
      };
      img.onerror = () => {
        insert(180, 160);
        showToast("已将图片添加至当前画板！");
      };
    } else {
      insert(180, 160);
      showToast("已将图片添加至当前画板！");
    }
  }

  function addNoteToCanvas() {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: [
        ...current.items,
        {
          id: createCanvasItemId(),
          type: "note",
          title: "备注",
          text: "写下交付思路、修改意见或客户反馈。",
          x: Math.round(-panX + 100 + (current.items.length % 4) * 40),
          y: Math.round(-panY + 100 + (current.items.length % 5) * 30),
          w: 220,
          h: 140,
          board_id: activeBoardId,
        },
      ],
    }));
  }



  function removeCanvasItem(itemId: string) {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: current.items.filter((item) => item.id !== itemId),
    }));
    if (selectedItemId === itemId) {
      setSelectedItemId("");
    }
  }

  async function saveProjectCanvas() {
    setIsSavingCanvas(true);
    try {
      const updatedCanvas: ProjectCanvasDocument = {
        ...projectCanvas,
        panX,
        panY,
        zoom,
        boards: projectCanvas.boards || boards,
        activeBoardId: activeBoardId,
      };

      const response = await putJson<ProjectCanvasSummary>(
        `/api/projects/${selectedProject.id}/canvas`,
        { canvas: updatedCanvas }
      );
      setProjectCanvas(normalizeCanvas(response.canvas));
      showToast("画布保存成功");
    } catch {
      showToast("画布保存失败：需要项目成员权限");
    } finally {
      setIsSavingCanvas(false);
    }
  }

  // Board Helpers
  function handleCreateBoard() {
    const name = prompt("请输入画板名称：", `画板 ${activeBoardsList.length + 1}`);
    if (!name || !name.trim()) return;
    const boardId = `board-${Date.now()}`;
    const newBoard = { id: boardId, name: name.trim() };

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      boards: [...(current.boards || []), newBoard],
      activeBoardId: boardId,
    }));
  }

  // Add output card back to canvas
  function addWorkflowResultToCanvas(title: string, output: any) {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: [
        ...current.items,
        {
          id: createCanvasItemId(),
          type: "note",
          title: title,
          text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
          x: Math.round(-panX + 120 + (current.items.length % 4) * 40),
          y: Math.round(-panY + 120 + (current.items.length % 5) * 30),
          w: 300,
          h: 200,
          board_id: activeBoardId,
        },
      ],
    }));
    showToast("已将工作流输出添加至当前画板！");
  }

  function handleSetActiveBoardId(boardId: string) {
    setProjectCanvas((current) => ({
      ...current,
      activeBoardId: boardId,
    }));
    setSelectedItemId("");
  }

  function handleRenameBoard(boardId: string) {
    const currentBoard = activeBoardsList.find((b) => b.id === boardId);
    if (!currentBoard) return;
    const name = prompt("请输入新画板名称：", currentBoard.name);
    if (!name || !name.trim()) return;

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      boards: (current.boards || activeBoardsList).map((b) =>
        b.id === boardId ? { ...b, name: name.trim() } : b
      ),
    }));
  }

  function handleDeleteBoard(boardId: string) {
    if (boardId === "default") {
      alert("默认画板不能删除");
      return;
    }
    if (!confirm("确定要删除此画板吗？该画板下的所有卡片都将被清除。")) return;

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => {
      const newBoards = (current.boards || []).filter((b) => b.id !== boardId);
      const newItems = current.items.filter(
        (item) => (item.board_id || "default") !== boardId
      );
      const nextActive =
        current.activeBoardId === boardId
          ? newBoards[0]?.id || "default"
          : current.activeBoardId;
      return {
        ...current,
        boards: newBoards,
        items: newItems,
        activeBoardId: nextActive,
      };
    });
  }

  // Card Formatting Helpers
  function updateItemProperty(itemId: string, properties: Partial<CanvasItem>) {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...properties } : item
      ),
    }));
  }

  // Layer Actions
  function updateItemLayer(itemId: string, action: "front" | "back") {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => {
      const items = [...current.items];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return current;
      const [target] = items.splice(index, 1);
      if (action === "front") {
        items.push(target);
      } else {
        items.unshift(target);
      }
      return { ...current, items };
    });
  }



  function exportCurrentProject(format: "json" | "markdown") {
    handleExportProject(
      format,
      selectedProject,
      assets,
      activeWorkspace,
      customers,
      brandKits,
      transactions
    );
  }



  const canvasAssets = assets.filter((asset) => asset.project_id === selectedProject.id);
  const visibleItems = projectCanvas.items.filter(
    (item) => (item.board_id || "default") === activeBoardId
  );

  return (
    <div className="rv-canvas-immersive-mode">
      {/* 1. 真正的底层无限画布 */}
      <CanvasViewport
        projectCanvas={projectCanvas}
        setProjectCanvas={setProjectCanvas}
        activeBoardId={activeBoardId}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        assets={assets}
        setAssets={setAssets}
        panX={panX}
        setPanX={setPanX}
        panY={panY}
        setPanY={setPanY}
        zoom={zoom}
        setZoom={setZoom}
        removeCanvasItem={removeCanvasItem}
        setWorkflowRefAsset={setWorkflowRefAsset}
        setIsRightDrawerOpen={setIsRightDrawerOpen}
        workspaceId={activeWorkspace?.id || ""}
        projectId={selectedProject.id}
        pushToHistory={pushToHistory}
      />

      {/* 2. 顶部悬浮顶栏 */}
      <ProjectDetailTopbar
        selectedProject={selectedProject}
        tempProjectName={tempProjectName}
        setTempProjectName={setTempProjectName}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        handleSaveProjectName={handleSaveProjectName}
        setProjectsViewMode={setProjectsViewMode}
        projectCanvas={projectCanvas}
        activeBoardId={activeBoardId}
        handleSetActiveBoardId={handleSetActiveBoardId}
        handleRenameBoard={handleRenameBoard}
        handleDeleteBoard={handleDeleteBoard}
        handleCreateBoard={handleCreateBoard}
        isBoardMenuOpen={isBoardMenuOpen}
        setIsBoardMenuOpen={setIsBoardMenuOpen}
        isExportMenuOpen={isExportMenuOpen}
        setIsExportMenuOpen={setIsExportMenuOpen}
        exportCurrentProject={exportCurrentProject}
        exportCanvasToSVG={() => exportCanvasToSVG(projectCanvas, activeBoardId, selectedProject, assets)}
        activeWorkspace={activeWorkspace}
        isSavingCanvas={isSavingCanvas}
        saveProjectCanvas={saveProjectCanvas}
        isLeftDrawerOpen={isLeftDrawerOpen}
        isRightDrawerOpen={isRightDrawerOpen}
        handleToggleRightTab={handleToggleRightTab}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        currentUser={currentUser}
      />

      {/* 3. 左侧悬浮资源抽屉 */}
      <LeftAssetsDrawer
        isDrawerOpen={isLeftDrawerOpen}
        setIsDrawerOpen={setIsLeftDrawerOpen}
        activeDrawerTab={activeLeftTab}
        selectedProject={selectedProject}
        activeWorkspace={activeWorkspace}
        currentUser={currentUser}
        assets={assets}
        setPreviewAsset={setPreviewAsset}
        addWorkflowResultToCanvas={addWorkflowResultToCanvas}
        addAssetToCanvas={addAssetToCanvas}
        customers={customers}
        brandKits={brandKits}
        currentRole={currentRole}
        setProjects={setProjects}
        setSelectedProjectId={setSelectedProjectId}
        setProjectsViewMode={setProjectsViewMode}
      />

      {/* 4. 右侧悬浮AI工坊抽屉 */}
    <RightWorkflowDrawer
      isDrawerOpen={isRightDrawerOpen}
      setIsDrawerOpen={setIsRightDrawerOpen}
      selectedProject={selectedProject}
      activeWorkspace={activeWorkspace}
      currentUser={currentUser}
      setTransactions={setTransactions}
      setTasks={setTasks}
      assets={assets}
      setAssets={setAssets}
      setSelectedTaskId={setSelectedTaskId}
      setTaskDetail={setTaskDetail}
      addWorkflowResultToCanvas={addWorkflowResultToCanvas}
      addAssetToCanvas={addAssetToCanvas}
      models={models}
      workflowRefAsset={workflowRefAsset}
      setWorkflowRefAsset={setWorkflowRefAsset}
      setPreviewAsset={setPreviewAsset}
    />

      {/* 5. 底部中央悬浮工具栏 */}
      <div className="rv-floating-toolbar">
        {/* 通用工具 */}
        <button
          className="rv-toolbar-btn"
          type="button"
          onClick={() => setIsTemplateModalOpen(true)}
          title="从模板创建提示词卡片"
          style={{ color: "var(--rv-color-primary)" }}
        >
          <Sparkles size={16} />
        </button>
        <button
          className="rv-toolbar-btn"
          type="button"
          onClick={addNoteToCanvas}
          title="在画布上添加备注便签"
        >
          <FileText size={16} />
        </button>

        {/* 只有在选中画布卡片时，才展示高级样式操纵条 */}
        {selectedItemId && (
          <>
            <div className="rv-toolbar-divider" />
            
            {/* 调色盘 */}
            <div className="rv-color-bubble-panel" title="卡片主题色">
              {(["default", "amber", "emerald", "blue", "rose", "slate"] as const).map((color) => (
                <div
                  key={color}
                  className={`rv-color-bubble rv-color-bubble-${color} ${
                    (projectCanvas.items.find((i) => i.id === selectedItemId)?.color || "default") === color
                      ? "active"
                      : ""
                  }`}
                  onClick={() => updateItemProperty(selectedItemId, { color })}
                />
              ))}
            </div>

            <div className="rv-toolbar-divider" />

            {/* 如果是备注卡片，渲染字号快捷选择 */}
            {projectCanvas.items.find((i) => i.id === selectedItemId)?.type === "note" && (
              <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                {/* 标题与字号 */}
                <button
                  type="button"
                  className="rv-toolbar-btn"
                  onClick={() => {
                    const currentItem = projectCanvas.items.find((i) => i.id === selectedItemId);
                    const currentSz = currentItem?.titleSize || "md";
                    const nextSz = currentSz === "sm" ? "md" : currentSz === "md" ? "lg" : "sm";
                    updateItemProperty(selectedItemId, { titleSize: nextSz });
                  }}
                  title="切换标题字号大小"
                >
                  <Type size={14} />
                </button>
              </div>
            )}

            {/* 置顶/置底 */}
            <button
              className="rv-toolbar-btn"
              type="button"
              onClick={() => updateItemLayer(selectedItemId, "front")}
              title="置于顶层"
            >
              <Layers size={14} style={{ transform: "rotate(180deg)" }} />
            </button>
            <button
              className="rv-toolbar-btn"
              type="button"
              onClick={() => updateItemLayer(selectedItemId, "back")}
              title="置于底层"
            >
              <Layers size={14} />
            </button>

            <div className="rv-toolbar-divider" />

            {/* 一键删除 */}
            <button
              className="rv-toolbar-btn"
              type="button"
              onClick={() => {
                removeCanvasItem(selectedItemId);
                setSelectedItemId("");
              }}
              style={{ color: "#ef4444" }}
              title="删除卡片"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* 5. 左下角状态控制栏 */}
      <div className="rv-utility-bar">
        {/* 1. 资产与历史 */}
        <button
          className={`rv-utility-btn ${isLeftDrawerOpen && activeLeftTab === "library" ? "active" : ""}`}
          type="button"
          onClick={() => handleToggleLeftTab("library")}
          title="库与历史：查看项目素材与 AI 生成历史"
        >
          <FolderOpen size={14} />
        </button>

        {/* 2. 外链交付 */}
        <button
          className={`rv-utility-btn ${isLeftDrawerOpen && activeLeftTab === "share" ? "active" : ""}`}
          type="button"
          onClick={() => handleToggleLeftTab("share")}
          title="外链交付：生成交付链接、查看客户反馈与评论"
        >
          <Share2 size={14} />
        </button>

        {/* 4. 项目设置 */}
        <button
          className={`rv-utility-btn ${isLeftDrawerOpen && activeLeftTab === "settings" ? "active" : ""}`}
          type="button"
          onClick={() => handleToggleLeftTab("settings")}
          title="项目设置：管理项目属性、客户绑定及预算上限"
        >
          <Settings size={14} />
        </button>

        <div className="rv-utility-divider" />

        {/* 缩放比例控制组 */}
        <button
          type="button"
          className="rv-utility-btn"
          onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
          title="缩小"
        >
          <ZoomOut size={13} />
        </button>
        <span
          style={{ cursor: "pointer", color: "var(--rv-color-text-main)", padding: "0 2px", fontSize: "11px", fontWeight: "600" }}
          title="双击或点击复位缩放与平移"
          onClick={() => {
            setZoom(1.0);
            setPanX(0);
            setPanY(0);
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="rv-utility-btn"
          onClick={() => setZoom((z) => Math.min(3.0, z + 0.1))}
          title="放大"
        >
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          className="rv-utility-btn"
          onClick={() => {
            setZoom(1.0);
            setPanX(0);
            setPanY(0);
          }}
          title="适配屏幕并复位"
        >
          <Maximize2 size={12} />
        </button>
      </div>
      {/* 弱提示 Toast 通知 */}
      {toastMessage && (
        <div className="rv-toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {isTemplateModalOpen && (
        <TemplateSelectModal
          onClose={() => setIsTemplateModalOpen(false)}
          onGenerate={(template, payload) => {
            void runTemplateGeneration({
              template,
              payload,
              workspaceId: activeWorkspace?.id ?? "",
              projectId: selectedProject.id,
              customerId: selectedProject.customer_id,
              currentUserId: currentUser?.id,
              panX,
              panY,
              activeBoardId,
              itemsCount: projectCanvas.items.length,
              createCanvasItemId,
              setProjectCanvas,
              setAssets,
              showToast,
              pushToHistory,
              projectCanvas,
            });
            setIsTemplateModalOpen(false);
          }}
          workspaceId={activeWorkspace?.id ?? ""}
          projectId={selectedProject.id}
          customerId={selectedProject.customer_id}
          currentUserId={currentUser?.id}
        />
      )}
    </div>
  );
}
