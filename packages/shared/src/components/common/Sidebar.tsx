import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { navItems, AppView } from "../../types";
import "./Sidebar.css";

const isDesktop = () => typeof window !== "undefined" && !!(window as any).go;

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  setAdminMessage: (msg: string) => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
  categories: any[];
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  setSelectedSubCategoryId: (id: string) => void;
  setSelectedWorkflowType: (type: string) => void;
}

export function Sidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeView,
  setActiveView,
  setAdminMessage,
  setProjectsViewMode,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  setSelectedSubCategoryId,
  setSelectedWorkflowType,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
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

      {activeView === "square" && !isSidebarCollapsed && categories.filter(c => !c.parent_id).length > 0 && (
        <div className="side-menu-section" style={{ marginTop: "12px", borderTop: "1px solid rgba(28, 25, 23, 0.05)", paddingTop: "12px" }}>
          <div className="side-section-title" style={{ fontSize: "11px", fontWeight: 700, color: "#78716c", letterSpacing: "0.5px", marginBottom: "6px", paddingLeft: "12px" }}>
            模板大类分类
          </div>
          <ul className="side-menu-list flow-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {categories.filter(c => !c.parent_id).map((cat) => {
              let tagText = "图";
              let textColor = "#6366f1";
              let bgColor = "rgba(99, 102, 241, 0.1)";

              if (cat.workflow_type === "video-generation") {
                tagText = "视";
                textColor = "#a855f7";
                bgColor = "rgba(168, 85, 247, 0.1)";
              } else if (cat.workflow_type === "text-generation") {
                tagText = "文";
                textColor = "#f97316";
                bgColor = "rgba(249, 115, 22, 0.1)";
              }

              return (
                <li
                  key={cat.id}
                  className={selectedCategoryId === cat.id ? "active" : ""}
                  onClick={() => {
                    setSelectedWorkflowType("all");
                    setSelectedCategoryId(cat.id);
                    setSelectedSubCategoryId("all");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "550",
                    color: selectedCategoryId === cat.id ? "#6366f1" : "#57534e",
                    background: selectedCategoryId === cat.id ? "rgba(99, 102, 241, 0.08)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    marginBottom: "2px"
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "18px",
                      height: "18px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 800,
                      color: textColor,
                      backgroundColor: bgColor,
                      flexShrink: 0
                    }}
                  >
                    {tagText}
                  </span>
                  <span>{cat.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="sidebar-bottom-section">
        {!isSidebarCollapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-footer-grid">
              <a href="#" onClick={(e) => e.preventDefault()}>微信公众号</a>
              <a href="#" onClick={(e) => e.preventDefault()}>小红书</a>
              <a href="#" onClick={(e) => e.preventDefault()}>B站</a>
              <a href="#" onClick={(e) => e.preventDefault()}>抖音</a>
              <a href="#" onClick={(e) => e.preventDefault()}>TAMS</a>
              <a href="#" onClick={(e) => e.preventDefault()}>招聘</a>
              <a href="#" onClick={(e) => e.preventDefault()}>关于我们</a>
              <a href="#" onClick={(e) => e.preventDefault()}>反馈</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="full-width">Privacy Policy</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="full-width">Terms of Service</a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
