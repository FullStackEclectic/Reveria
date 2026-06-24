import React, { useState, useMemo } from "react";
import { Sparkles, Search, FolderKanban, ArrowRight, CircleDot } from "lucide-react";
import "./DashboardView.css";

import {
  WorkspaceSummary,
  ProjectSummary,
  GenerationTaskSummary,
  CreditTransactionSummary,
  CustomerSummary,
  BrandKitSummary,
} from "../../types";

interface DashboardViewProps {
  activeWorkspace: WorkspaceSummary | undefined;
  isApiOnline: boolean;
  formattedCredits: string;
  projects: ProjectSummary[];
  tasks: GenerationTaskSummary[];
  transactions: CreditTransactionSummary[];
  customers: CustomerSummary[];
  brandKits: BrandKitSummary[];
  setIsNewProjectModalOpen: (open: boolean) => void;
  setSelectedProjectId: (id: string) => void;
  loadProjectAssets: (id: string) => Promise<void>;
  loadProjectCanvas: (id: string) => Promise<void>;
  setActiveView: (view: any) => void;
  setProjectsViewMode?: (mode: "list" | "detail") => void;
}

export function DashboardView({
  activeWorkspace,
  isApiOnline,
  formattedCredits,
  projects,
  tasks,
  transactions,
  customers,
  brandKits,
  setIsNewProjectModalOpen,
  setSelectedProjectId,
  loadProjectAssets,
  loadProjectCanvas,
  setActiveView,
  setProjectsViewMode,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  // 磨砂炫彩渐变色预览分类映射
  const getThumbnailClass = (projectId: string) => {
    let sum = 0;
    for (let i = 0; i < projectId.length; i++) {
      sum += projectId.charCodeAt(i);
    }
    const type = sum % 3;
    if (type === 0) return "thumb-gradient-purple";
    if (type === 1) return "thumb-gradient-sunset";
    return "thumb-gradient-ocean";
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

  return (
    <section className="workspace">
      {/* 新版双栏主布局 */}
      <div className="dashboard-grid" style={{ marginTop: "8px" }}>
        {/* 左栏：项目管理卡片网格 */}
        <div className="dashboard-main-col">
          <div className="project-section-header">
            <div className="title-area">
              <h3>
                <FolderKanban size={20} className="title-icon" />
                项目库
              </h3>
              <span className="count">共 {projects.length} 个项目</span>
            </div>

            <div className="project-actions-area" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* 搜索过滤条 */}
              <div className="project-search-bar">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="搜索项目名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                className="btn-create-project-black"
                type="button"
                onClick={() => setIsNewProjectModalOpen(true)}
              >
                <Sparkles size={14} />
                新建项目
              </button>
            </div>
          </div>

          {filteredProjects.length > 0 ? (
            <div className="project-cards-grid">
              {filteredProjects.map((project) => {
                const customer = customers.find((c) => c.id === project.customer_id);
                return (
                  <div
                    className="project-card-figma"
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      void loadProjectAssets(project.id);
                      void loadProjectCanvas(project.id);
                      setProjectsViewMode?.("detail");
                      setActiveView("projects");
                    }}
                  >
                    {/* 上部：项目缩略图预览（磨砂炫彩渐变色） */}
                    <div className="thumbnail-area">
                      <div className={`project-thumbnail-gradient ${getThumbnailClass(project.id)}`}>
                        <div className="glass-noise-overlay"></div>
                        <div className="project-thumbnail-center-badge">
                          <FolderKanban size={24} className="folder-icon" />
                        </div>
                      </div>
                    </div>

                    {/* 下部：项目基础信息及类型图标 */}
                    <div className="info-area">
                      <div className="text-wrapper">
                        <span className="project-title" title={project.name}>{project.name}</span>
                        <div className="project-meta-row">
                          <span className="meta-item">{customer ? customer.name : "个人项目"}</span>
                          <span className="meta-divider">·</span>
                          <span className="meta-item">已消耗 {project.consumed_credits} 点</span>
                        </div>
                      </div>
                      <span className={`status-badge status-${project.status.toLowerCase()}`}>
                        {getStatusText(project.status)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="project-empty-card">
              <FolderKanban size={48} className="empty-icon" />
              <h4>{searchQuery ? "未找到匹配的项目" : "开启您的第一个项目"}</h4>
              <p>{searchQuery ? "请尝试更改搜索关键字" : "项目制是创意生产的主轴，通过工作流串联资产与无限画布"}</p>
              {!searchQuery && (
                <button
                  className="btn-create-project-black"
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(true)}
                  style={{ width: "auto", margin: "16px auto 0 auto" }}
                >
                  <Sparkles size={14} /> 创建第一个项目
                </button>
              )}
            </div>
          )}
        </div>

        {/* 右栏：异步任务、点数流水与客户/品牌库卡片堆叠 */}
        <div className="dashboard-side-col">
          {/* 1. 异步任务队列 */}
          <div className="side-panel">
            <div className="side-panel-header">
              <h4>异步任务队列</h4>
              <span className="subtitle">最新执行监控</span>
            </div>
            {tasks.length > 0 ? (
              <div className="side-list">
                {tasks.slice(0, 4).map((task) => {
                  const displayName = task.task_type === "image-generation" ? "AI 生图" : task.task_type === "video-generation" ? "AI 视频" : task.task_type === "text-generation" ? "AI 写作" : "AI 任务";
                  const isWorking = task.status === "running" || task.status === "pending";
                  return (
                    <div className="side-list-item" key={task.id}>
                      <div className="item-left">
                        <strong className="title">{displayName}</strong>
                        <div className="status-container" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={`status-dot ${task.status}`}>
                            {isWorking && <span className="pulse-glow" />}
                          </span>
                          <span className="status-label" style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
                            {task.status === "running" ? "生成中" : task.status === "pending" ? "排队中" : task.status === "success" ? "已完成" : "失败"}
                          </span>
                        </div>
                      </div>
                      <small className="cost">{task.actual_credits || task.estimated_credits} 点</small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="side-empty-state">
                <p>暂无正在执行的任务</p>
              </div>
            )}
          </div>

          {/* 2. 最近点数流水 */}
          <div className="side-panel">
            <div className="side-panel-header">
              <h4>点数收支流水</h4>
              <span className="subtitle">成本与消耗透明</span>
            </div>
            {transactions.length > 0 ? (
              <div className="side-list">
                {transactions.slice(0, 4).map((transaction) => {
                  const isPositive = transaction.amount > 0;
                  return (
                    <div className="side-list-item" key={transaction.id}>
                      <div className="item-left">
                        <strong className="title">{transaction.transaction_type}</strong>
                        <span className="desc">{transaction.reason ?? "无备注"}</span>
                      </div>
                      <span className={`credit-pill ${isPositive ? "positive" : "negative"}`}>
                        {isPositive ? "+" : ""}
                        {transaction.amount} 点
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="side-empty-state">
                <p>暂无点数流水记录</p>
              </div>
            )}
          </div>

          {/* 3. 客户和品牌库 */}
          <div className="side-panel">
            <div className="side-panel-header">
              <h4>关联客户与品牌</h4>
              <span className="subtitle">工作区交付资产</span>
            </div>
            {customers.length > 0 || brandKits.length > 0 ? (
              <div className="side-list">
                {customers.slice(0, 2).map((customer) => (
                  <div className="side-list-item card-like-item" key={customer.id}>
                    <div className="item-avatar-box customer-avatar">
                      {(customer.name || "C").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="item-content-info">
                      <strong className="item-name">{customer.name}</strong>
                      <span className="item-desc">{customer.industry ?? "未填写行业"}</span>
                    </div>
                    <span className="side-tag customer-tag">客户</span>
                  </div>
                ))}
                {brandKits.slice(0, 2).map((brandKit) => (
                  <div className="side-list-item card-like-item" key={brandKit.id}>
                    <div className="item-avatar-box brand-avatar">
                      {(brandKit.name || "B").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="item-content-info">
                      <strong className="item-name">{brandKit.name}</strong>
                      <span className="item-desc">{brandKit.style_prompt ?? "未填写风格"}</span>
                    </div>
                    <span className="side-tag brand-tag">品牌库</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="side-empty-state">
                <p>暂无客户或品牌资产记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
