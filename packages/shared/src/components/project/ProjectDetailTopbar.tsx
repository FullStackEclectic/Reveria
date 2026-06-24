import { ArrowLeft, ChevronDown, Download, Plus, Loader2, Save, Sparkles, Undo, Redo } from "lucide-react";
import { ProjectSummary, ProjectCanvasDocument, WorkspaceSummary } from "../../types";

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
}: ProjectDetailTopbarProps) {
  const boards = projectCanvas.boards || [];
  const activeBoard = boards.find((b) => b.id === activeBoardId) || { id: "default", name: "主画板" };

  const openClass = 
    isLeftDrawerOpen && isRightDrawerOpen ? "drawer-open-both" :
    isLeftDrawerOpen ? "drawer-open-left" :
    isRightDrawerOpen ? "drawer-open-right" : "";

  return (
    <header className={`rv-floating-topbar ${openClass}`}>
      {/* 左侧：返回、项目名编辑、画板下拉 */}
      <div className="rv-topbar-section">
        <button
          className="rv-topbar-btn"
          type="button"
          onClick={() => setProjectsViewMode("list")}
          title="返回项目列表"
          style={{ width: "32px", padding: 0 }}
        >
          <ArrowLeft size={16} />
        </button>

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
      <div className="rv-topbar-section">
        {/* 点数胶囊 */}
        <span className="rv-topbar-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
          🪙 {activeWorkspace?.credit_balance ?? 0} 点
        </span>

        {/* 状态徽章 */}
        <span
          className="rv-topbar-badge"
          style={{
            background: "rgba(15, 118, 110, 0.15)",
            color: "#2dd4bf"
          }}
        >
          {selectedProject.status === "draft" ? "草稿" :
           selectedProject.status === "active" ? "进行中" :
           selectedProject.status === "reviewing" ? "评审中" :
           selectedProject.status === "delivered" ? "已交付" : "已归档"}
        </span>

        {/* 保存画布 */}
        <button
          className="rv-topbar-btn primary"
          type="button"
          disabled={isSavingCanvas}
          onClick={saveProjectCanvas}
        >
          {isSavingCanvas ? (
            <Loader2 className="spin" size={14} />
          ) : (
            <Save size={14} />
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
          >
            <Download size={14} />
            <span>导出</span>
            <ChevronDown size={12} />
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

        {/* AI 创意工坊快捷开关 */}
        <button
          className={`rv-topbar-btn ${isRightDrawerOpen ? "active" : ""}`}
          type="button"
          onClick={handleToggleRightTab}
          title="AI工坊：运行创意生成工作流"
          style={{
            background: isRightDrawerOpen ? "var(--rv-color-primary)" : "transparent",
            color: isRightDrawerOpen ? "#ffffff" : "var(--rv-color-primary)",
            borderColor: "var(--rv-color-primary)",
            marginLeft: "4px"
          }}
        >
          <Sparkles size={14} />
          <span>AI工坊</span>
        </button>
      </div>
    </header>
  );
}
