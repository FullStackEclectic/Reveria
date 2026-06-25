import { useState, useRef, useEffect } from "react";
import { ProjectSummary, UserSummary, WorkspaceSummary, GenerationTaskSummary, GenerationTaskDetail, AssetSummary, ModelSummary } from "../../types";
import { ProjectWorkflowPanel } from "./ProjectWorkflowPanel";

interface RightWorkflowDrawerProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
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
  addAssetToCanvas: (asset: AssetSummary) => void;
  models: ModelSummary[];
  workflowRefAsset: AssetSummary | null;
  setWorkflowRefAsset: (asset: AssetSummary | null) => void;
  setPreviewAsset: (asset: AssetSummary | null) => void;
}

export function RightWorkflowDrawer({
  isDrawerOpen,
  setIsDrawerOpen,
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
}: RightWorkflowDrawerProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rv-dialogue-drawer-width");
      if (saved) {
        const val = Number(saved);
        if (val >= 380 && val <= 513) return val;
      }
    }
    return 380;
  });

  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaX = startX - moveEvent.clientX; // 往左拉（clientX变小）则宽度增加
      let newWidth = startWidth + deltaX;
      if (newWidth < 380) newWidth = 380;
      if (newWidth > 513) newWidth = 513; // 380 * 1.35 = 513
      setWidth(newWidth);
      localStorage.setItem("rv-dialogue-drawer-width", String(newWidth));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  if (!isDrawerOpen) return null;

  return (
    <aside
      className="rv-assets-drawer align-right"
      style={{
        width: `${width}px`,
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="drawer-resizer-handle"
      />
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 16px 12px 16px",
          borderBottom: "1px solid var(--rv-color-border-thin)",
          margin: 0,
          background: "rgba(185, 178, 165, 0.05)",
        }}
      >
        <h3
          style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: "bold",
          color: "var(--rv-color-text-main)",
        }}
      >
        AI 对话
      </h3>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "16px",
            cursor: "pointer",
            color: "var(--rv-color-text-muted)",
            padding: "2px 6px",
          }}
          title="关闭面板"
        >
          ×
        </button>
      </div>

      <div
        className="rv-drawer-content"
        style={{
          padding: "0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ProjectWorkflowPanel
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
      </div>
    </aside>
  );
}
