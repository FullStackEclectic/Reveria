import React, { useState, useMemo } from "react";
import { Plus, FolderKanban, Search, Sparkles, Clock, Trash2 } from "lucide-react";
import "./ProjectsView.css";
import { ProjectCard } from "./ProjectCard";

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
import { PageFrame } from "../common/PageFrame";
import { ProjectDetailView } from "./ProjectDetailView";
import { deleteJson } from "../../utils";

interface ProjectsViewProps {
  projects: ProjectSummary[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectSummary[]>>;
  selectedProject: ProjectSummary | null;
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
  setIsNewProjectModalOpen: (open: boolean) => void;

  // View Router Props
  projectsViewMode: "list" | "detail";
  setProjectsViewMode: (mode: "list" | "detail") => void;
  models: ModelSummary[];
  onEnterEditor: (asset: AssetSummary, initialSettings?: any) => void;
  onSaveSettings: (assetId: string, settings: any) => Promise<boolean>;
  onExportImage: (assetId: string, settings: any) => Promise<boolean>;
}

export function ProjectsView({
  projects,
  setProjects,
  selectedProject,
  setSelectedProjectId,
  loadProjectAssets,
  loadProjectCanvas,
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
  deletingAssetId,
  deleteAsset,
  setPreviewAsset,
  setIsNewProjectModalOpen,
  projectsViewMode,
  setProjectsViewMode,
  models,
  onEnterEditor,
  onSaveSettings,
  onExportImage,
}: ProjectsViewProps) {

  const [searchQuery, setSearchQuery] = useState("");

  async function handleDeleteProject(projectId: string, projectName: string) {
    if (!window.confirm(`确定要删除项目 "${projectName}" 吗？\n删除后其绑定的画布和评论将被清除，关联资产和任务将不受影响。`)) {
      return;
    }
    try {
      await deleteJson(`/api/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProjectId("");
        setProjectsViewMode("list");
      }
      setRecentIds((prev) => {
        const updated = prev.filter((id) => id !== projectId);
        localStorage.setItem("reveria.recentProjects", JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      alert(`删除项目失败: ${err.message || err}`);
    }
  }
  const [filterType, setFilterType] = useState<"all" | "ai_canvas" | "retouch">("all");

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("reveria.recentProjects");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const recentProjects = useMemo(() => {
    const matched = recentIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is ProjectSummary => !!p);

    if (matched.length > 0) {
      return matched;
    }
    return projects.slice(0, 4);
  }, [projects, recentIds]);

  const displayedProjects = useMemo(() => {
    let list = filteredProjects;
    if (filterType !== "all") {
      list = list.filter((p) => p.project_type === filterType);
    }
    return list;
  }, [filteredProjects, filterType]);

  const displayedRecentProjects = useMemo(() => {
    let list = recentProjects;
    if (filterType !== "all") {
      list = list.filter((p) => p.project_type === filterType);
    }
    return list;
  }, [recentProjects, filterType]);

  const handleProjectClick = (projectId: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== projectId);
      const updated = [projectId, ...filtered].slice(0, 4);
      localStorage.setItem("reveria.recentProjects", JSON.stringify(updated));
      return updated;
    });

    setSelectedProjectId(projectId);
    void loadProjectAssets(projectId);
    void loadProjectCanvas(projectId);
    setProjectsViewMode("detail");
  };

  function customerNameFor(customerId?: string | null) {
    if (!customerId) return "未绑定";
    return customers.find((c) => c.id === customerId)?.name ?? "未知客户";
  }


  // If in detail mode and a project is selected, render the workbench
  if (projectsViewMode === "detail" && selectedProject) {
    return (
      <ProjectDetailView
        projects={projects}
        setProjects={setProjects}
        selectedProject={selectedProject}
        setSelectedProjectId={setSelectedProjectId}
        loadProjectAssets={loadProjectAssets}
        loadProjectCanvas={loadProjectCanvas}
        customers={customers}
        brandKits={brandKits}
        assets={assets}
        setAssets={setAssets}
        projectCanvas={projectCanvas}
        setProjectCanvas={setProjectCanvas}
        currentRole={currentRole}
        activeWorkspace={activeWorkspace}
        currentUser={currentUser}
        transactions={transactions}
        setTransactions={setTransactions}
        setTasks={setTasks}
        setSelectedTaskId={setSelectedTaskId}
        setTaskDetail={setTaskDetail}
        deletingAssetId={deletingAssetId}
        deleteAsset={deleteAsset}
        setPreviewAsset={setPreviewAsset}
        setProjectsViewMode={setProjectsViewMode}
        models={models}
        onEnterEditor={onEnterEditor}
        onSaveSettings={onSaveSettings}
        onExportImage={onExportImage}
      />
    );
  }

  // Otherwise, render the clean project card grid view
  return (
    <PageFrame
      title="客户项目"
      status={`${projects.length} 个项目`}
      action={
        <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="projects-view-search-bar">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="搜索项目名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />
            新建项目
          </button>
        </div>
      }
    >
      <section className="page-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel list-panel" style={{ width: "100%", background: "none", border: "none", boxShadow: "none", padding: 0 }}>
          {/* 项目类别筛选 Tab */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(28, 25, 23, 0.04)",
              padding: "3px",
              borderRadius: "10px",
              gap: "2px",
              border: "1px solid rgba(28, 25, 23, 0.05)",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => setFilterType("all")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                background: filterType === "all" ? "#ffffff" : "transparent",
                color: filterType === "all" ? "var(--rv-color-primary, #6366f1)" : "#78716c",
                boxShadow: filterType === "all" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              全部项目 ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("ai_canvas")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                background: filterType === "ai_canvas" ? "#ffffff" : "transparent",
                color: filterType === "ai_canvas" ? "#6366f1" : "#78716c",
                boxShadow: filterType === "ai_canvas" ? "0 2px 6px rgba(99, 102, 241, 0.08)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              🎨 AI创意画布 ({projects.filter(p => p.project_type !== "retouch").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("retouch")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                background: filterType === "retouch" ? "#ffffff" : "transparent",
                color: filterType === "retouch" ? "#06b6d4" : "#78716c",
                boxShadow: filterType === "retouch" ? "0 2px 6px rgba(6, 182, 212, 0.08)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              📸 批量照片精修 ({projects.filter(p => p.project_type === "retouch").length})
            </button>
          </div>

          {/* 最近修改/最新项目 */}
          {!searchQuery && displayedRecentProjects.length > 0 && (
            <div className="recent-projects-section" style={{ marginBottom: "32px" }}>
              <div className="panel-header" style={{ marginBottom: "12px" }}>
                <h4 style={{ fontSize: "15px", fontWeight: "bold", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                  <Clock size={16} style={{ color: "var(--rv-color-primary)" }} />
                  最近修改
                </h4>
              </div>
              <div className="project-cards-grid" style={{ marginTop: "12px" }}>
                {displayedRecentProjects.map((project) => {
                  const customerName = customerNameFor(project.customer_id);
                  return (
                    <ProjectCard
                      key={`recent-${project.id}`}
                      project={project}
                      customerName={customerName !== "未绑定" && customerName !== "未知客户" ? customerName : "个人项目"}
                      onClick={() => handleProjectClick(project.id)}
                      onDelete={() => void handleDeleteProject(project.id, project.name)}
                    />
                  );
                })}
              </div>
              <div style={{ height: "1px", background: "var(--rv-color-border-thin)", marginTop: "28px" }} />
            </div>
          )}

          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "var(--rv-color-text-main)", margin: 0 }}>项目列表</h3>
            <span style={{ fontSize: "13px", color: "#8b7e66", marginTop: "4px", display: "inline-block" }}>点击卡片进入详情与专属工作台</span>
          </div>
          {displayedProjects.length > 0 ? (
            <div className="project-cards-grid" style={{ marginTop: "20px" }}>
              {displayedProjects.map((project) => {
                const customerName = customerNameFor(project.customer_id);
                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    customerName={customerName !== "未绑定" && customerName !== "未知客户" ? customerName : "个人项目"}
                    onClick={() => handleProjectClick(project.id)}
                    onDelete={() => void handleDeleteProject(project.id, project.name)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="project-empty-card" style={{ marginTop: "20px" }}>
              <FolderKanban size={48} className="empty-icon" />
              <h4>{searchQuery ? "未找到匹配的项目" : "开启您的第一个项目"}</h4>
              <p>{searchQuery ? "请尝试更改搜索关键字" : "项目制是创意生产的主轴，通过工作流串联资产与无限画布"}</p>
              {!searchQuery && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(true)}
                >
                  <Sparkles size={16} /> 创建第一个项目
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </PageFrame>
  );
}
