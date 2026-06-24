import React from "react";
import { LogOut, History, Coins, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { navItems, UserSummary, AppView } from "../../types";
import "./Sidebar.css";

const isDesktop = () => typeof window !== "undefined" && !!(window as any).go;

interface SidebarProps {
  currentUser: UserSummary | null;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  isUserDropdownOpen: boolean;
  setIsUserDropdownOpen: (open: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  setAdminMessage: (msg: string) => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
  handleLogout: () => Promise<void>;
  formattedCredits: string;
}

export function Sidebar({
  currentUser,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isUserDropdownOpen,
  setIsUserDropdownOpen,
  activeView,
  setActiveView,
  setAdminMessage,
  setProjectsViewMode,
  handleLogout,
  formattedCredits,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
      <div className="logo-section">
        <div className="logo-icon">R</div>
        <span className="logo-text">Reveria</span>
      </div>

      <div className="user-profile-section">
        <button
          className="user-profile-btn"
          type="button"
          onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
        >
          <div className="avatar-placeholder">
            {(currentUser?.display_name || "US").slice(0, 2).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="username">{currentUser?.display_name || "未登录"}</span>
            <span className="role">
              {currentUser?.is_platform_admin ? "超级管理员" : "工作区成员"}
            </span>
          </div>
        </button>

        {isUserDropdownOpen && currentUser && (
          <div className="user-dropdown-menu">
            <div className="user-dropdown-header">
              <strong>{currentUser.display_name}</strong>
              <span>{currentUser.email || "开发用户"}</span>
            </div>

            <button
              className="user-dropdown-item"
              type="button"
              onClick={() => {
                setIsUserDropdownOpen(false);
                setActiveView("history");
              }}
            >
              <History size={14} />
              <span>生成历史</span>
            </button>

            <button
              className="user-dropdown-item"
              type="button"
              onClick={() => {
                setIsUserDropdownOpen(false);
                setActiveView("credits");
              }}
            >
              <Coins size={14} />
              <span>点数中心</span>
            </button>

            {/* 商业版要求：仅在非桌面端（网页端）且当前用户为超级管理员时，才展现管理控制台入口 */}
            {!isDesktop() && currentUser.is_platform_admin && (
              <button
                className="user-dropdown-item"
                type="button"
                onClick={() => {
                  setIsUserDropdownOpen(false);
                  setAdminMessage("");
                  setActiveView("admin");
                }}
              >
                <Settings size={14} />
                <span>平台管理</span>
              </button>
            )}

            <div className="user-dropdown-divider" />

            <button
              className="user-dropdown-item logout"
              type="button"
              onClick={() => {
                setIsUserDropdownOpen(false);
                void handleLogout();
              }}
            >
              <LogOut size={14} />
              <span>退出登录</span>
            </button>
          </div>
        )}
      </div>

      <nav aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.view ? "nav-item active" : "nav-item"}
              key={item.view}
              type="button"
              onClick={() => {
                setActiveView(item.view);
                setAdminMessage("");
                if (item.view === "projects") {
                  setProjectsViewMode("list");
                }
              }}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-text">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        className="sidebar-toggle-btn"
        type="button"
        onClick={() => {
          const nextCollapsed = !isSidebarCollapsed;
          setIsSidebarCollapsed(nextCollapsed);
          localStorage.setItem("reveria.sidebarCollapsed", String(nextCollapsed));
        }}
      >
        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
