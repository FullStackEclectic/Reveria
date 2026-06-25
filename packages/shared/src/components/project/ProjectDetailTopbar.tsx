import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronDown, Download, Plus, Loader2, Save, Sparkles, Undo, Redo, LogOut, MessageSquare } from "lucide-react";
import { ProjectSummary, ProjectCanvasDocument, WorkspaceSummary, UserSummary } from "../../types";
import { postJson } from "../../utils";

interface ProjectDetailTopbarProps {
  selectedProject: ProjectSummary;
  tempProjectName: string;
  setTempProjectName: (name: string) => void;
  isEditingName: boolean;
  setIsEditingName: (editing: boolean) => void;
  handleSaveProjectName: () => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
  projectCanvas: ProjectCanvasDocument;
  activeBoardId: string;
  handleSetActiveBoardId: (boardId: string) => void;
  handleRenameBoard: (boardId: string) => void;
  handleDeleteBoard: (boardId: string) => void;
  handleCreateBoard: () => void;
  isBoardMenuOpen: boolean;
  setIsBoardMenuOpen: (open: boolean) => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (open: boolean) => void;
  exportCurrentProject: (format: "json" | "markdown") => void;
  exportCanvasToSVG: () => void;
  activeWorkspace?: WorkspaceSummary;
  isSavingCanvas: boolean;
  saveProjectCanvas: () => void;

  // Drawer Control props
  isLeftDrawerOpen: boolean;
  isRightDrawerOpen: boolean;
  handleToggleRightTab: () => void;

  // 撤销重做属性
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // 当前登录用户
  currentUser: UserSummary | null;
}

export function ProjectDetailTopbar({
  selectedProject,
  tempProjectName,
  setTempProjectName,
  isEditingName,
  setIsEditingName,
  handleSaveProjectName,
  setProjectsViewMode,
  projectCanvas,
  activeBoardId,
  handleSetActiveBoardId,
  handleRenameBoard,
  handleDeleteBoard,
  handleCreateBoard,
  isBoardMenuOpen,
  setIsBoardMenuOpen,
  isExportMenuOpen,
  setIsExportMenuOpen,
  exportCurrentProject,
  exportCanvasToSVG,
  activeWorkspace,
  isSavingCanvas,
  saveProjectCanvas,
  isLeftDrawerOpen,
  isRightDrawerOpen,
  handleToggleRightTab,
  undo,
  redo,
  canUndo,
  canRedo,
  currentUser,
}: ProjectDetailTopbarProps) {
  const boards = projectCanvas.boards || [];
  const activeBoard = boards.find((b) => b.id === activeBoardId) || { id: "default", name: "主画板" };

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openClass = 
    isLeftDrawerOpen && isRightDrawerOpen ? "drawer-open-both" :
    isLeftDrawerOpen ? "drawer-open-left" :
    isRightDrawerOpen ? "drawer-open-right" : "";

  return (
    <header className={`rv-floating-topbar ${openClass}`}>
      {/* 左侧：返回、项目名编辑、画板下拉 */}
      <div className="rv-topbar-section">
        {/* 用户头像下拉菜单（返回按钮集成在第一项） */}
        <div className="rv-topbar-menu-wrapper" ref={userMenuRef}>
          <button
            className="user-profile-menu-trigger"
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            title="用户菜单"
            style={{
              padding: "4px 8px 4px 4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "20px",
              border: "1px solid var(--rv-color-border-thin, rgba(28,25,23,0.08))",
              background: "rgba(255, 255, 255, 0.6)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              className="user-avatar-circle"
              style={{
                width: "24px",
                height: "24px",
                fontSize: "11px",
                margin: 0,
                boxShadow: "0 2px 4px rgba(99, 102, 241, 0.2)"
              }}
            >
              {(currentUser?.display_name || "U").slice(0, 1).toUpperCase()}
            </div>
            <ChevronDown
              size={12}
              style={{
                color: "#a8a29e",
                transform: isUserMenuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }}
            />
          </button>

          {isUserMenuOpen && (
            <div
              className="rv-topbar-dropdown"
              style={{
                left: 0,
                right: "auto",
                width: "180px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
              }}
            >
              <div
                className="dropdown-header"
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(28, 25, 23, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px"
                }}
              >
                <strong
                  style={{
                    fontSize: "12px",
                    color: "var(--rv-color-text-main, #1c1917)",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {currentUser?.display_name || "未登录"}
                </strong>
                {currentUser?.email && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#a8a29e",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {currentUser.email}
                  </span>
                )}
              </div>
              
              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  setProjectsViewMode("list");
                  setIsUserMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginTop: "4px"
                }}
              >
                <ArrowLeft size={14} />
                <span>返回项目列表</span>
              </button>

              <div
                style={{
                  height: "1px",
                  background: "rgba(28, 25, 23, 0.05)",
                  margin: "4px 0"
                }}
              />

              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={async () => {
                  setIsUserMenuOpen(false);
                  try {
                    await postJson("/api/auth/logout", {});
                  } catch {
                    // Quiet fail
                  } finally {
                    localStorage.removeItem("reveria.currentUser");
                    localStorage.removeItem("reveria.accessToken");
                    window.location.reload();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  color: "#ef4444"
                }}
              >
                <LogOut size={14} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>

        {/* 气泡项目名原位编辑 */}
        {isEditingName ? (
          <input
            type="text"
            className="rv-name-edit-input"
            value={tempProjectName}
            onChange={(e) => setTempProjectName(e.target.value)}
            onBlur={handleSaveProjectName}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveProjectName();
              if (e.key === "Escape") {
                setTempProjectName(selectedProject.name);
                setIsEditingName(false);
              }
            }}
            autoFocus
          />
        ) : (
          <div
            className="rv-project-name-badge"
            onClick={() => {
              setTempProjectName(selectedProject.name);
              setIsEditingName(true);
            }}
            title="点击重命名项目"
          >
            <h3>{selectedProject.name}</h3>
          </div>
        )}

        <div className="rv-utility-divider" style={{ margin: "0 4px" }} />

        {/* 画板切换下拉菜单 */}
        <div className="rv-topbar-menu-wrapper">
          <button
            className="rv-topbar-btn"
            type="button"
            onClick={() => setIsBoardMenuOpen(!isBoardMenuOpen)}
            title="切换当前画板"
          >
            <span>{activeBoard.name}</span>
            <ChevronDown size={14} />
          </button>

          {isBoardMenuOpen && (
            <div className="rv-topbar-dropdown" style={{ left: 0, right: "auto", width: "180px" }}>
              {[{ id: "default", name: "主画板" }, ...boards].map((board) => (
                <button
                  key={board.id}
                  className="rv-topbar-dropdown-item"
                  type="button"
                  style={{
                    fontWeight: activeBoardId === board.id ? "bold" : "normal",
                    color: activeBoardId === board.id ? "var(--rv-color-primary)" : "#d4d4d8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                  onClick={() => {
                    handleSetActiveBoardId(board.id);
                    setIsBoardMenuOpen(false);
                  }}
                >
                  <span>{board.name}</span>
                  {board.id !== "default" && (
                    <span style={{ fontSize: "10px", opacity: 0.6 }}>Pages</span>
                  )}
                </button>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "4px 0" }} />
              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  handleCreateBoard();
                  setIsBoardMenuOpen(false);
                }}
                style={{ color: "var(--rv-color-primary)" }}
              >
                ➕ 新建画板
              </button>
            </div>
          )}
        </div>

        <div className="rv-utility-divider" style={{ margin: "0 6px" }} />

        {/* 撤销 & 重做按钮 */}
        <button
          className="rv-topbar-btn"
          type="button"
          disabled={!canUndo}
          onClick={undo}
          title="撤销 (Ctrl+Z)"
          style={{ width: "32px", padding: 0, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? "pointer" : "not-allowed" }}
        >
          <Undo size={14} />
        </button>
        <button
          className="rv-topbar-btn"
          type="button"
          disabled={!canRedo}
          onClick={redo}
          title="重做 (Ctrl+Y)"
          style={{ width: "32px", padding: 0, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? "pointer" : "not-allowed" }}
        >
          <Redo size={14} />
        </button>
      </div>

      {/* 右侧：点数、状态、手动保存、导出下拉 */}
      <div className="rv-topbar-section" style={{ gap: "10px" }}>
        {/* PRO 算力额度 - 沿用首页设计样式 */}
        <div className="pro-credits-badge" style={{ height: "30px", marginLeft: "4px" }}>
          <span className="pro-label" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>PRO</span>
          <span className="credits-val">{activeWorkspace?.credit_balance ?? 0} 点</span>
        </div>

        {/* 状态徽章 - 精致磨砂边缘 */}
        <span
          className="rv-topbar-badge"
          style={{
            background: selectedProject.status === "draft" ? "rgba(120, 113, 108, 0.1)" : "rgba(15, 118, 110, 0.1)",
            color: selectedProject.status === "draft" ? "#78716c" : "var(--rv-color-primary)",
            border: "1px solid " + (selectedProject.status === "draft" ? "rgba(120, 113, 108, 0.15)" : "rgba(15, 118, 110, 0.15)"),
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "12px"
          }}
        >
          {selectedProject.status === "draft" ? "草稿" :
           selectedProject.status === "active" ? "进行中" :
           selectedProject.status === "reviewing" ? "评审中" :
           selectedProject.status === "delivered" ? "已交付" : "已归档"}
        </span>

        {/* 保存画布 */}
        <button
          className="rv-topbar-btn"
          type="button"
          disabled={isSavingCanvas}
          onClick={saveProjectCanvas}
          style={{
            background: "rgba(255, 255, 255, 0.8)",
            border: "1px solid var(--rv-color-border-thin)",
            color: "var(--rv-color-text-main)",
            boxShadow: "var(--rv-shadow-sm)",
            cursor: isSavingCanvas ? "not-allowed" : "pointer",
            fontWeight: 600
          }}
        >
          {isSavingCanvas ? (
            <Loader2 className="spin" size={14} />
          ) : (
            <Save size={14} style={{ color: "var(--rv-color-primary)" }} />
          )}
          <span>保存画布</span>
        </button>

        {/* 导出下拉菜单 */}
        <div className="rv-topbar-menu-wrapper">
          <button
            className="rv-topbar-btn"
            type="button"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title="导出项目数据"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              border: "1px solid var(--rv-color-border-thin)",
              color: "var(--rv-color-text-main)",
              boxShadow: "var(--rv-shadow-sm)",
              fontWeight: 600
            }}
          >
            <Download size={14} />
            <span>导出</span>
            <ChevronDown size={12} style={{ opacity: 0.7, marginLeft: "-2px" }} />
          </button>

          {isExportMenuOpen && (
            <div className="rv-topbar-dropdown">
              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  exportCurrentProject("json");
                  setIsExportMenuOpen(false);
                }}
              >
                导出 JSON 交付包
              </button>
              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  exportCurrentProject("markdown");
                  setIsExportMenuOpen(false);
                }}
              >
                导出 Markdown 简报
              </button>
              <button
                className="rv-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  exportCanvasToSVG();
                  setIsExportMenuOpen(false);
                }}
              >
                导出 SVG 矢量快照
              </button>
            </div>
          )}
        </div>

        {/* AI 对话快捷开关 - 炫彩渐变与悬浮触感 */}
        <button
          className="rv-topbar-btn"
          type="button"
          onClick={handleToggleRightTab}
          title="对话：运行创意生成工作流"
          style={{
            background: isRightDrawerOpen 
              ? "linear-gradient(135deg, #4f46e5 0%, #0891b2 100%)" 
              : "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
            color: "#ffffff",
            border: "none",
            boxShadow: isRightDrawerOpen 
              ? "0 2px 8px rgba(6, 182, 212, 0.2)" 
              : "0 4px 12px rgba(6, 182, 212, 0.25)",
            cursor: "pointer",
            fontWeight: 700,
            transition: "all 0.2s ease",
            marginLeft: "4px"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(6, 182, 212, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = isRightDrawerOpen 
              ? "0 2px 8px rgba(6, 182, 212, 0.2)" 
              : "0 4px 12px rgba(6, 182, 212, 0.25)";
          }}
        >
          <MessageSquare size={14} />
          <span>对话</span>
        </button>
      </div>
    </header>
  );
}
