import React from "react";
import { 
  Menu, Search, ClipboardList, 
  ChevronDown, History, Coins, Settings, LogOut 
} from "lucide-react";
import { AppView, UserSummary } from "../../types";
import { BrandMark } from "./BrandMark";
import { useSiteBrand } from "../../hooks/useSiteBrand";

interface HeaderBarProps {
  currentUser: UserSummary | null;
  activeView: AppView;
  projectsViewMode: "list" | "detail";
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (c: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  currentPlanLabel: string;
  formattedCredits: string;
  isHeaderUserDropdownOpen: boolean;
  setIsHeaderUserDropdownOpen: (open: boolean) => void;
  handleViewChange: (view: AppView) => void;
  handleLogout: () => Promise<void>;
  setIsLoginModalOpen: (open: boolean) => void;
  setLoginCallback: (cb: (() => void) | null) => void;
}

export function HeaderBar({
  currentUser,
  activeView,
  projectsViewMode,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  currentPlanLabel,
  formattedCredits,
  isHeaderUserDropdownOpen,
  setIsHeaderUserDropdownOpen,
  handleViewChange,
  handleLogout,
  setIsLoginModalOpen,
  setLoginCallback,
}: HeaderBarProps) {
  const site = useSiteBrand();
  const isNoSidebar = ((activeView === "projects" && projectsViewMode === "detail") || activeView === "admin") && currentUser !== null;

  return (
    <header className="rv-global-header">
      {/* 左侧：菜单开关 + Logo */}
      <div className="header-left">
        {!isNoSidebar && (
          <button 
            type="button" 
            className="rv-header-toggle-btn"
            onClick={() => {
              const nextState = !isSidebarCollapsed;
              setIsSidebarCollapsed(nextState);
              localStorage.setItem("reveria.sidebarCollapsed", String(nextState));
            }}
            title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <Menu size={18} />
          </button>
        )}
        
        <div 
          className="header-brand" 
          onClick={() => handleViewChange("square")}
        >
          <BrandMark site={site} />
        </div>
      </div>
      
      {/* 中间：全局搜索框 */}
      <div className="header-middle">
        <div className="header-search-bar">
          <span className="search-category-tag">模型</span>
          <div className="search-input-wrapper">
            <input 
              type="text" 
              placeholder="搜索模板、模型或标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => handleViewChange("square")}
            />
            <div className="search-action-icons">
              <Search size={16} className="search-icon" />
            </div>
          </div>
        </div>
      </div>
      
      {/* 右侧：动作与用户状态 */}
      <div className="header-right">
        {currentUser ? (
          <>
            <div className="header-icon-actions">
              <button
                type="button"
                className="icon-btn-item"
                title="生成历史"
                onClick={() => handleViewChange("history")}
              >
                <ClipboardList size={18} />
              </button>
            </div>
            
            {/* 用户头像与菜单（物理合并套餐等级与算力余额胶囊） */}
            <div className="user-profile-menu-container" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div 
                className="pro-credits-badge" 
                style={{ margin: 0, cursor: "pointer" }}
                onClick={() => handleViewChange("credits")}
                title="点击快捷进入点数与套餐充值中心"
              >
                <span className="pro-label">{currentPlanLabel}</span>
                <span className="credits-val">{formattedCredits} 积分</span>
              </div>
              <button
                type="button"
                className="user-profile-menu-trigger"
                onClick={() => setIsHeaderUserDropdownOpen(!isHeaderUserDropdownOpen)}
              >
                <div className="user-avatar-circle" style={{ margin: 0 }}>
                  {(currentUser.display_name || "U").slice(0, 1).toUpperCase()}
                </div>
                <span className="user-display-name">
                  {currentUser.display_name}
                </span>
                <ChevronDown size={14} style={{ color: "#a8a29e", transform: isHeaderUserDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {isHeaderUserDropdownOpen && (
                <div className="header-user-dropdown">
                  <div className="dropdown-header">
                    <strong>{currentUser.display_name}</strong>
                    <span>{currentUser.email || "开发用户"}</span>
                  </div>

                  <button
                    className="dropdown-item"
                    type="button"
                    onClick={() => {
                      setIsHeaderUserDropdownOpen(false);
                      handleViewChange("history");
                    }}
                  >
                    <History size={14} />
                    <span>生成历史</span>
                  </button>

                  <button
                    className="dropdown-item"
                    type="button"
                    onClick={() => {
                      setIsHeaderUserDropdownOpen(false);
                      handleViewChange("credits");
                    }}
                  >
                    <Coins size={14} />
                    <span>点数中心</span>
                  </button>

                  {currentUser.is_platform_admin && (
                    <button
                      className="dropdown-item admin"
                      type="button"
                      onClick={() => {
                        setIsHeaderUserDropdownOpen(false);
                        handleViewChange("admin");
                      }}
                    >
                      <Settings size={14} />
                      <span>后台管理</span>
                    </button>
                  )}

                  <div className="dropdown-divider" />

                  <button
                    className="dropdown-item logout"
                    type="button"
                    onClick={() => {
                      setIsHeaderUserDropdownOpen(false);
                      void handleLogout();
                    }}
                  >
                    <LogOut size={14} />
                    <span>退出登录</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 未登录时的登入按钮 */
          <button
            type="button"
            className="btn-login-entrance"
            onClick={() => {
              setLoginCallback(null);
              setIsLoginModalOpen(true);
            }}
          >
            登入
          </button>
        )}
      </div>
    </header>
  );
}
