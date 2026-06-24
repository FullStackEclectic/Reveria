import { ProjectSummary, UserSummary, WorkspaceSummary, AssetSummary, CustomerSummary, BrandKitSummary } from "../../types";
import { ProjectLibraryPanel } from "./ProjectLibraryPanel";
import { ProjectShareCommentPanel } from "./ProjectShareCommentPanel";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel";

interface LeftAssetsDrawerProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  activeDrawerTab: "library" | "share" | "settings";
  selectedProject: ProjectSummary;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  assets: AssetSummary[];
  setPreviewAsset: (asset: AssetSummary | null) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
  addAssetToCanvas: (asset: AssetSummary) => void;
  customers: CustomerSummary[];
  brandKits: BrandKitSummary[];
  currentRole: string;
  setProjects: React.Dispatch<React.SetStateAction<ProjectSummary[]>>;
  setSelectedProjectId: (id: string) => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
}

export function LeftAssetsDrawer({
  isDrawerOpen,
  setIsDrawerOpen,
  activeDrawerTab,
  selectedProject,
  activeWorkspace,
  currentUser,
  assets,
  setPreviewAsset,
  addWorkflowResultToCanvas,
  addAssetToCanvas,
  customers,
  brandKits,
  currentRole,
  setProjects,
  setSelectedProjectId,
  setProjectsViewMode,
}: LeftAssetsDrawerProps) {
  if (!isDrawerOpen) return null;

  return (
    <aside className="rv-assets-drawer align-left">
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
          {activeDrawerTab === "library"
            ? "项目资产与历史"
            : activeDrawerTab === "share"
            ? "交付与社交外链"
            : "项目工作台设置"}
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
          padding: "16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {activeDrawerTab === "library" && (
          <ProjectLibraryPanel
            assets={assets}
            setPreviewAsset={setPreviewAsset}
            addWorkflowResultToCanvas={addWorkflowResultToCanvas}
          />
        )}

        {activeDrawerTab === "share" && (
          <ProjectShareCommentPanel
            selectedProject={selectedProject}
            currentUser={currentUser}
          />
        )}

        {activeDrawerTab === "settings" && (
          <ProjectSettingsPanel
            selectedProject={selectedProject}
            customers={customers}
            brandKits={brandKits}
            currentRole={currentRole}
            setProjects={setProjects}
            setSelectedProjectId={setSelectedProjectId}
            setProjectsViewMode={setProjectsViewMode}
          />
        )}
      </div>
    </aside>
  );
}
