import React, { useState, useMemo } from "react";
import { Plus, FolderKanban, Search, Sparkles, Clock, Trash2 } from "lucide-react";
import "./ProjectsView.css";

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

  // Figma-like Cover SVG Templates
  const renderCanvasSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#fcfbfa" />
      <pattern id="grid-canvas-proj" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(185, 178, 165, 0.08)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-canvas-proj)" />
      
      {/* Node A */}
      <rect x="25" y="25" width="60" height="40" rx="4" fill="#ffffff" stroke="rgba(15, 118, 110, 0.25)" strokeWidth="1.5" />
      <rect x="33" y="33" width="44" height="6" rx="2" fill="rgba(15, 118, 110, 0.12)" />
      <rect x="33" y="44" width="30" height="4" rx="2" fill="rgba(115, 111, 106, 0.1)" />
      
      {/* Node B */}
      <rect x="145" y="45" width="70" height="45" rx="4" fill="#ffffff" stroke="rgba(15, 118, 110, 0.2)" strokeWidth="1.5" />
      <circle cx="180" cy="68" r="14" fill="rgba(15, 118, 110, 0.08)" />
      <path d="M 175 68 L 185 68 M 180 63 L 180 73" stroke="rgba(15, 118, 110, 0.4)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Curve Connection */}
      <path d="M 85 45 C 115 45, 115 67, 145 67" stroke="rgba(15, 118, 110, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
      
      {/* Selection outline */}
      <rect x="23" y="23" width="64" height="44" rx="2" fill="none" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="21" y="21" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="84" y="21" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="21" y="64" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="84" y="64" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
    </svg>
  );

  const renderImageSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#f9f8f6" />
      <pattern id="grid-img-proj" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(185, 178, 165, 0.06)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-img-proj)" />

      {/* Image box */}
      <rect x="75" y="15" width="90" height="90" rx="8" fill="#ffffff" stroke="rgba(185, 178, 165, 0.25)" strokeWidth="1" />
      <path d="M 85 95 L 115 65 C 120 60, 128 60, 133 65 L 155 87" stroke="rgba(185, 178, 165, 0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 125 95 L 140 80 C 143 77, 147 77, 150 80 L 158 88" stroke="rgba(185, 178, 165, 0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="105" cy="40" r="8" fill="rgba(234, 179, 8, 0.15)" stroke="rgba(234, 179, 8, 0.4)" strokeWidth="1" />

      {/* Sparkles */}
      <path d="M 190 20 L 193 26 L 199 29 L 193 32 L 190 38 L 187 32 L 181 29 L 187 26 Z" fill="rgba(15, 118, 110, 0.18)" stroke="rgba(15, 118, 110, 0.4)" strokeWidth="1" />
      <path d="M 50 70 L 52 74 L 56 76 L 52 78 L 50 82 L 48 78 L 44 76 L 48 74 Z" fill="rgba(15, 118, 110, 0.12)" stroke="rgba(15, 118, 110, 0.3)" strokeWidth="1" />
      
      {/* Prompt block */}
      <rect x="40" y="105" width="160" height="20" rx="10" fill="#ffffff" stroke="rgba(15, 118, 110, 0.2)" strokeWidth="1" />
      <circle cx="50" cy="115" r="3" fill="#0f766e" />
      <rect x="58" y="113" width="100" height="4" rx="2" fill="rgba(15, 118, 110, 0.15)" />
    </svg>
  );

  const renderVideoSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#fcfafa" />
      <pattern id="grid-vid-proj" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(185, 178, 165, 0.05)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-vid-proj)" />

      {/* Video film strip */}
      <rect x="25" y="20" width="55" height="75" rx="4" fill="#ffffff" stroke="rgba(185, 178, 165, 0.3)" strokeWidth="1" />
      <rect x="30" y="25" width="45" height="32" rx="2" fill="rgba(115, 111, 106, 0.05)" />
      <circle cx="52" cy="41" r="7" fill="rgba(115, 111, 106, 0.1)" />
      <polygon points="50,38 56,41 50,44" fill="rgba(115, 111, 106, 0.4)" />
      <rect x="30" y="65" width="45" height="5" rx="1.5" fill="rgba(185, 178, 165, 0.2)" />
      <rect x="30" y="75" width="30" height="4" rx="1" fill="rgba(185, 178, 165, 0.15)" />
      <rect x="30" y="83" width="40" height="4" rx="1" fill="rgba(185, 178, 165, 0.15)" />

      <rect x="92" y="20" width="55" height="75" rx="4" fill="#ffffff" stroke="rgba(185, 178, 165, 0.3)" strokeWidth="1" />
      <rect x="97" y="25" width="45" height="32" rx="2" fill="rgba(115, 111, 106, 0.05)" />
      <rect x="97" y="65" width="45" height="5" rx="1.5" fill="rgba(185, 178, 165, 0.2)" />
      <rect x="97" y="75" width="35" height="4" rx="1" fill="rgba(185, 178, 165, 0.15)" />

      <rect x="160" y="20" width="55" height="75" rx="4" fill="#ffffff" stroke="rgba(185, 178, 165, 0.3)" strokeWidth="1" />
      <rect x="165" y="25" width="45" height="32" rx="2" fill="rgba(115, 111, 106, 0.05)" />
      <rect x="165" y="65" width="45" height="5" rx="1.5" fill="rgba(185, 178, 165, 0.2)" />
      <rect x="165" y="75" width="25" height="4" rx="1" fill="rgba(185, 178, 165, 0.15)" />

      {/* Tracker */}
      <rect x="25" y="108" width="190" height="4" rx="2" fill="rgba(115, 111, 106, 0.1)" />
      <rect x="25" y="108" width="105" height="4" rx="2" fill="var(--rv-color-primary)" opacity="0.8" />
    </svg>
  );

  const renderThumbnailSVG = (projectId: string) => {
    let sum = 0;
    for (let i = 0; i < projectId.length; i++) {
      sum += projectId.charCodeAt(i);
    }
    const type = sum % 3;
    if (type === 0) return renderCanvasSVG();
    if (type === 1) return renderImageSVG();
    return renderVideoSVG();
  };

  const getIconBgColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "#10b981"; // green
      case "running":
      case "active":
        return "#0ea5e9"; // blue
      default:
        return "#f59e0b"; // amber
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "已交付";
      case "running":
      case "active":
        return "进行中";
      default:
        return "草稿";
    }
  };

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
      />
    );
  }

  // Otherwise, render the clean project card grid view
  return (
    <PageFrame
      eyebrow="项目"
      title="客户项目"
      status={`${projects.length} 个项目`}
      action={
        <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="project-search-bar" style={{ margin: 0 }}>
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
          {/* 最近修改/最新项目 */}
          {!searchQuery && recentProjects.length > 0 && (
            <div className="recent-projects-section" style={{ marginBottom: "32px" }}>
              <div className="panel-header" style={{ marginBottom: "12px" }}>
                <h4 style={{ fontSize: "15px", fontWeight: "bold", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                  <Clock size={16} style={{ color: "var(--rv-color-primary)" }} />
                  最近修改
                </h4>
              </div>
              <div className="project-cards-grid" style={{ marginTop: "12px" }}>
                {recentProjects.map((project) => {
                  const customerName = customerNameFor(project.customer_id);
                  return (
                    <div
                      className="project-card-figma"
                      key={`recent-${project.id}`}
                      onClick={() => handleProjectClick(project.id)}
                    >
                      {/* 上部：项目缩略图预览（Figma风） */}
                      <div className="thumbnail-area">
                        {renderThumbnailSVG(project.id)}
                        <button
                          className="project-delete-btn"
                          type="button"
                          title="删除项目"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteProject(project.id, project.name);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* 下部：项目基础信息及类型图标 */}
                      <div className="info-area">
                        <div
                          className="icon-wrapper"
                          style={{ backgroundColor: getIconBgColor(project.status) }}
                        >
                          <FolderKanban size={15} color="#ffffff" />
                        </div>
                        
                        <div className="text-wrapper">
                          <span className="title" title={project.name}>{project.name}</span>
                          <span className="metadata">
                            {customerName !== "未绑定" && customerName !== "未知客户" ? customerName : "个人项目"} · 已消耗 {project.consumed_credits} 点
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: "1px", background: "var(--rv-color-border-thin)", marginTop: "28px" }} />
            </div>
          )}

          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "var(--rv-color-text-main)", margin: 0 }}>项目列表</h3>
            <span style={{ fontSize: "13px", color: "#8b7e66", marginTop: "4px", display: "inline-block" }}>点击卡片进入详情与画布工作台</span>
          </div>
          {filteredProjects.length > 0 ? (
            <div className="project-cards-grid" style={{ marginTop: "20px" }}>
              {filteredProjects.map((project) => {
                const customerName = customerNameFor(project.customer_id);
                return (
                  <div
                    className="project-card-figma"
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                  >
                    {/* 上部：项目缩略图预览（Figma风） */}
                    <div className="thumbnail-area">
                      {renderThumbnailSVG(project.id)}
                      <button
                        className="project-delete-btn"
                        type="button"
                        title="删除项目"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteProject(project.id, project.name);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* 下部：项目基础信息及类型图标 */}
                    <div className="info-area">
                      <div
                        className="icon-wrapper"
                        style={{ backgroundColor: getIconBgColor(project.status) }}
                      >
                        <FolderKanban size={15} color="#ffffff" />
                      </div>
                      
                      <div className="text-wrapper">
                        <span className="title" title={project.name}>{project.name}</span>
                        <span className="metadata">
                          {customerName !== "未绑定" && customerName !== "未知客户" ? customerName : "个人项目"} · 已消耗 {project.consumed_credits} 点 · {getStatusText(project.status)}
                        </span>
                      </div>
                    </div>
                  </div>
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
