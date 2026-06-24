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

  // Figma-like Cover SVG Templates
  const renderCanvasSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#fcfbfa" />
      <pattern id="grid-canvas" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(185, 178, 165, 0.08)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-canvas)" />
      
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
      
      {/* Figma Selection borders */}
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
      <pattern id="grid-img" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(185, 178, 165, 0.06)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-img)" />

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
      <pattern id="grid-vid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(185, 178, 165, 0.05)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-vid)" />

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

  return (
    <section className="workspace">
      {/* 新版双栏主布局 */}
      <div className="dashboard-grid" style={{ marginTop: "8px" }}>
        {/* 左栏：项目管理卡片网格 */}
        <div className="dashboard-main-col">
          <div className="project-section-header">
            <div className="title-area">
              <h3>项目库</h3>
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
                className="primary-button"
                type="button"
                onClick={() => setIsNewProjectModalOpen(true)}
              >
                <Sparkles size={16} aria-hidden="true" />
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
                    {/* 上部：项目缩略图预览（Figma风） */}
                    <div className="thumbnail-area">
                      {renderThumbnailSVG(project.id)}
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
                          {customer ? customer.name : "个人项目"} · 已消耗 {project.consumed_credits} 点 · {getStatusText(project.status)}
                        </span>
                      </div>
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
                {tasks.slice(0, 4).map((task) => (
                  <div className="side-list-item" key={task.id}>
                    <div className="item-left">
                      <strong className="title">{task.task_type}</strong>
                      <span className={`status-dot ${task.status}`}>{task.status}</span>
                    </div>
                    <small className="cost">{task.actual_credits || task.estimated_credits} 点</small>
                  </div>
                ))}
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
                      <strong className={`amount ${isPositive ? "positive" : "negative"}`}>
                        {isPositive ? "+" : ""}
                        {transaction.amount} 点
                      </strong>
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
                  <div className="side-list-item" key={customer.id}>
                    <div className="item-left">
                      <strong className="title">{customer.name}</strong>
                      <span className="desc">{customer.industry ?? "未填写行业"}</span>
                    </div>
                    <span className="tag customer">客户</span>
                  </div>
                ))}
                {brandKits.slice(0, 2).map((brandKit) => (
                  <div className="side-list-item" key={brandKit.id}>
                    <div className="item-left">
                      <strong className="title">{brandKit.name}</strong>
                      <span className="desc">{brandKit.style_prompt ?? "未填写风格"}</span>
                    </div>
                    <span className="tag brand-kit">品牌库</span>
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
