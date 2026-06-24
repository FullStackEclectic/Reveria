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
            <div className="username-row">
              <span className="username">{currentUser?.display_name || "未登录"}</span>
              {currentUser && (
                <span className="user-credits" title={`当前积分: ${formattedCredits}`}>
                  <Coins size={12} className="credits-icon" />
                  <span className="credits-text">{formattedCredits}</span>
                </span>
              )}
            </div>
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

            {/* 独立的管理后台通过 /admin 提供，此处工作台不需要集成的管理页面入口 */}

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
