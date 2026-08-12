import { useState, useEffect } from "react";
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
  ModelSummary,
} from "../../types";
import {
  assetTitle,
  putJson,
  handleExportProject,
  uploadAsset,
} from "../../utils";
import { CanvasViewport } from "./CanvasViewport";
import { LeftAssetsDrawer } from "./LeftAssetsDrawer";
import { FloatingAssetLibrary } from "./FloatingAssetLibrary";
import { RightWorkflowDrawer } from "./RightWorkflowDrawer";
import { ProjectDetailTopbar } from "./ProjectDetailTopbar";
import { exportCanvasToSVG } from "./canvasExportUtils";
import { TemplateSelectModal } from "./TemplateSelectModal";
import { runTemplateGeneration } from "./templateWorkflowUtils";
import { useProjectCanvasState } from "./useProjectCanvasState";
import { AssetEditorWorkbench, type RetouchSettings } from "../asset/AssetEditorWorkbench";
import type { ExportImageOptions } from "../asset/EditorHeader";
import { FileText, FolderOpen, Link2, Maximize2, Settings, Sparkles, Trash2, Frame } from "lucide-react";
// AI 画布样式目前与客户门户共用这份历史样式表。
import "../portal/ClientPortalView.css";

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
  onEnterEditor: (asset: AssetSummary, initialSettings?: any) => void;
  onSaveSettings: (assetId: string, settings: any) => Promise<boolean>;
  onLoadSettings: (assetId: string) => Promise<RetouchSettings | undefined>;
  onExportImage: (
    assetId: string,
    settings: RetouchSettings,
    dataUrl: string,
    format: "jpeg" | "png" | "webp",
    options?: ExportImageOptions,
  ) => Promise<boolean>;
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
  onEnterEditor,
  onSaveSettings,
  onLoadSettings,
  onExportImage,
}: ProjectDetailViewProps) {
  // 左右独立抽屉状态
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"library" | "share" | "settings">("library");
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState(selectedProject.name);
  const [workflowRefAsset, setWorkflowRefAsset] = useState<AssetSummary | null>(null);
  const [currentRetouchAsset, setCurrentRetouchAsset] = useState<AssetSummary | null>(null);

  const projectSpecificAssets = assets.filter((asset) => asset.project_id === selectedProject.id);

  // Automatically select the first photo in retouch project if none is active
  useEffect(() => {
    if (selectedProject.project_type === "retouch") {
      const imagesOnly = projectSpecificAssets.filter((a) => a.asset_type === "image");
      if (imagesOnly.length > 0) {
        if (!currentRetouchAsset || !imagesOnly.some((a) => a.id === currentRetouchAsset.id)) {
          setCurrentRetouchAsset(imagesOnly[0]);
        }
      } else {
        setCurrentRetouchAsset(null);
      }
    }
  }, [assets, selectedProject.id, selectedProject.project_type]);

  // Synchronize temp name on selected project change
  useEffect(() => {
    setTempProjectName(selectedProject.name);
  }, [selectedProject.id, selectedProject.name]);

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
    if (tab === "library") {
      setIsAssetLibraryOpen((prev) => !prev);
      if (isLeftDrawerOpen && activeLeftTab === "library") {
        setIsLeftDrawerOpen(false);
      }
    } else {
      if (isLeftDrawerOpen && activeLeftTab === tab) {
        setIsLeftDrawerOpen(false);
      } else {
        setIsLeftDrawerOpen(true);
        setActiveLeftTab(tab);
      }
      setIsAssetLibraryOpen(false);
    }
  };

  const handleToggleRightTab = () => {
    setIsRightDrawerOpen(!isRightDrawerOpen);
  };

  // Extract canvas states and actions using useProjectCanvasState Hook
  const {
    panX,
    setPanX,
    panY,
    setPanY,
    zoom,
    setZoom,
    selectedItemId,
    setSelectedItemId,
    isSavingCanvas,
    toastMessage,
    showToast,
    canUndo,
    canRedo,
    activeBoardId,
    activeBoardsList,
    undo,
    redo,
    pushToHistory,
    addAssetToCanvas,
    addNoteToCanvas,
    addFrameToCanvas,
    removeCanvasItem,
    saveProjectCanvas,
    handleCreateBoard,
    addWorkflowResultToCanvas,
    handleSetActiveBoardId,
    handleRenameBoard,
    handleDeleteBoard,
    updateItemProperty,
    updateItemLayer,
  } = useProjectCanvasState({
    selectedProject,
    assets,
    setAssets,
    projectCanvas,
    setProjectCanvas,
    activeWorkspace,
  });

  function customerNameFor(customerId?: string | null) {
    if (!customerId) return "未绑定";
    return customers.find((c) => c.id === customerId)?.name ?? "未知客户";
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

  // 批量修图上传入口
  const handleUploadAndEdit = async (file: File) => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      alert("请先连接 API 并选择工作区");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_id", workspaceId);
      formData.append("project_id", selectedProject.id);
      formData.append("asset_type", "image");
      const asset = await uploadAsset(formData);
      setAssets((current) => [asset, ...current]);
      setCurrentRetouchAsset(asset);
      return asset;
    } catch (err) {
      alert("素材上传失败");
    }
  };

  return (
    <div className="rv-canvas-immersive-mode">
      {/* 顶部悬浮顶栏 */}
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

      {selectedProject.project_type !== "retouch" ? (
        <>
          {/* 1. 底层无限画布 */}
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

          {/* 2. 左侧悬浮资源抽屉 */}
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

          {/* 2.5 可拖拽悬浮资产管理器窗口 */}
          <FloatingAssetLibrary
            isOpen={isAssetLibraryOpen}
            onClose={() => setIsAssetLibraryOpen(false)}
            assets={projectSpecificAssets}
            setPreviewAsset={setPreviewAsset}
            addAssetToCanvas={addAssetToCanvas}
            addWorkflowResultToCanvas={addWorkflowResultToCanvas}
          />

          {/* 3. 右侧悬浮AI工坊抽屉 */}
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

          {/* 4. 底部中央悬浮工具栏 */}
          <div className="rv-floating-toolbar">
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
            <button
              className="rv-toolbar-btn"
              type="button"
              onClick={addFrameToCanvas}
              title="在画布上添加画框容器"
            >
              <Frame size={16} />
            </button>

            {selectedItemId && (
              <>
                <div className="rv-toolbar-divider" />
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

                {projectCanvas.items.find((i) => i.id === selectedItemId)?.type === "note" && (
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
                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>A</span>
                  </button>
                )}

                <button
                  className="rv-toolbar-btn"
                  type="button"
                  onClick={() => updateItemLayer(selectedItemId, "front")}
                  title="置于顶层"
                >
                  ▲
                </button>
                <button
                  className="rv-toolbar-btn"
                  type="button"
                  onClick={() => updateItemLayer(selectedItemId, "back")}
                  title="置于底层"
                >
                  ▼
                </button>

                <div className="rv-toolbar-divider" />

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
            <button
              className={`rv-utility-btn ${isAssetLibraryOpen ? "active" : ""}`}
              type="button"
              onClick={() => handleToggleLeftTab("library")}
              title="库与历史：查看项目素材与 AI 生成历史"
            >
              <FolderOpen size={15} />
            </button>
            <button
              className={`rv-utility-btn ${isLeftDrawerOpen && activeLeftTab === "share" ? "active" : ""}`}
              type="button"
              onClick={() => handleToggleLeftTab("share")}
              title="外链交付：生成交付链接、查看客户反馈与评论"
            >
              <Link2 size={15} />
            </button>
            <button
              className={`rv-utility-btn ${isLeftDrawerOpen && activeLeftTab === "settings" ? "active" : ""}`}
              type="button"
              onClick={() => handleToggleLeftTab("settings")}
              title="项目设置：管理项目属性、客户绑定及预算上限"
            >
              <Settings size={15} />
            </button>

            <div className="rv-utility-divider" />

            <button
              type="button"
              className="rv-utility-btn"
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              title="缩小"
            >
              -
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
              +
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
              <Maximize2 size={15} />
            </button>
          </div>
        </>
      ) : (
        /* 人像修图专业工作台模式 */
        <div style={{ flex: 1, height: "100%", width: "100%", overflow: "hidden" }}>
          <AssetEditorWorkbench
            asset={currentRetouchAsset || undefined}
            projectAssets={projectSpecificAssets}
            onClose={() => setProjectsViewMode("list")}
            onSaveSettings={onSaveSettings}
            onLoadSettings={onLoadSettings}
            onExportImage={onExportImage}
            initialSettings={undefined}
            onUpload={handleUploadAndEdit}
          />
        </div>
      )}

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
              createCanvasItemId: () => Math.random().toString(36).substring(2, 9),
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
