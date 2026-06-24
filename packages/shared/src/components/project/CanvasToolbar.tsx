import React from "react";
import { Plus, FileText, Eye, Loader2, Save, Settings, Trash2 } from "lucide-react";
import { ProjectCanvasDocument, AssetSummary, ProjectSummary } from "../../types";

export interface CanvasToolbarProps {
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  activeBoardId: string;
  setActiveBoardId: (id: string) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  assets: AssetSummary[];
  selectedProject: ProjectSummary | null;
  isSavingCanvas: boolean;
  saveProjectCanvas: () => Promise<void>;
  addFirstAssetToCanvas: () => void;
  addNoteToCanvas: () => void;
  exportCanvasToSVG: () => void;
  handleCreateBoard: () => void;
  handleRenameBoard: (id: string) => void;
  handleDeleteBoard: (id: string) => void;
  removeCanvasItem: (id: string) => void;
  visibleItemsCount: number;
}

export function CanvasToolbar({
  projectCanvas,
  setProjectCanvas,
  activeBoardId,
  setActiveBoardId,
  selectedItemId,
  setSelectedItemId,
  assets,
  selectedProject,
  isSavingCanvas,
  saveProjectCanvas,
  addFirstAssetToCanvas,
  addNoteToCanvas,
  exportCanvasToSVG,
  handleCreateBoard,
  handleRenameBoard,
  handleDeleteBoard,
  removeCanvasItem,
  visibleItemsCount,
}: CanvasToolbarProps) {
  const boards = projectCanvas.boards || [];
  const activeBoardsList = boards.length > 0 ? boards : [{ id: "default", name: "主画板" }];

  const canvasAssets = assets.filter((asset) => asset.project_id === selectedProject?.id);
  const selectedItem = projectCanvas.items.find((i) => i.id === selectedItemId);

  const updateItemColor = (itemId: string, color: string) => {
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, color };
      }),
    }));
  };

  const updateItemTitleSize = (itemId: string, titleSize: "sm" | "md" | "lg") => {
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, titleSize };
      }),
    }));
  };

  const updateItemFontSize = (itemId: string, fontSize: "sm" | "md" | "lg") => {
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, fontSize };
      }),
    }));
  };

  const updateItemLayer = (itemId: string, dir: "front" | "back") => {
    const list = [...projectCanvas.items];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const [target] = list.splice(idx, 1);
    if (dir === "front") {
      list.push(target);
    } else {
      list.unshift(target);
    }
    setProjectCanvas((current) => ({
      ...current,
      items: list,
    }));
  };

  return (
    <>
      <div className="panel-header">
        <h3>项目画布</h3>
        <span>
          {visibleItemsCount} 个画布元素 (
          {activeBoardsList.find((b) => b.id === activeBoardId)?.name})
        </span>
      </div>

      {/* Board navigation tabs */}
      <div className="canvas-boards-bar">
        <div className="canvas-boards-tabs">
          {activeBoardsList.map((board) => (
            <div
              key={board.id}
              className={`canvas-board-tab ${activeBoardId === board.id ? "active" : ""}`}
              onClick={() => setActiveBoardId(board.id)}
            >
              <span>{board.name}</span>
              {board.id !== "default" && (
                <span className="board-tab-actions">
                  <button
                    type="button"
                    title="重命名"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameBoard(board.id);
                    }}
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    type="button"
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(board.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            className="canvas-add-board-btn"
            onClick={handleCreateBoard}
            title="创建新画板"
          >
            <Plus size={14} />
            新建画板
          </button>
        </div>
      </div>

      <div className="canvas-toolbar">
        <button
          className="secondary-button"
          type="button"
          disabled={!canvasAssets.length}
          onClick={addFirstAssetToCanvas}
        >
          <Plus size={18} aria-hidden="true" />
          添加素材卡片
        </button>
        <button className="secondary-button" type="button" onClick={addNoteToCanvas}>
          <FileText size={18} aria-hidden="true" />
          添加备注
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={exportCanvasToSVG}
          title="导出为矢量SVG快照"
        >
          <Eye size={18} aria-hidden="true" />
          导出 SVG 快照
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!selectedProject || isSavingCanvas}
          onClick={saveProjectCanvas}
          style={{ marginLeft: "auto" }}
        >
          {isSavingCanvas ? (
            <Loader2 className="spin" size={18} aria-hidden="true" />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          保存画布
        </button>
      </div>

      {/* Selected card formatting bar */}
      {selectedItemId && selectedItem && (
        <div className="canvas-item-formatter-panel">
          <span className="formatter-label">已选中卡片样式:</span>

          {/* Color picker */}
          <div className="color-selectors">
            {(["default", "amber", "emerald", "blue", "rose", "slate"] as const).map((color) => (
              <button
                key={color}
                type="button"
                className={`color-dot color-dot-${color} ${
                  (selectedItem.color || "default") === color ? "active" : ""
                }`}
                onClick={() => updateItemColor(selectedItemId, color)}
                title={color}
              />
            ))}
          </div>

          <div className="formatter-divider" />

          {/* Sizing dropdowns for note */}
          {selectedItem.type === "note" && (
            <>
              <div className="size-selectors">
                <span className="formatter-sublabel">标题:</span>
                {(["sm", "md", "lg"] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`size-btn ${
                      (selectedItem.titleSize || "md") === sz ? "active" : ""
                    }`}
                    onClick={() => updateItemTitleSize(selectedItemId, sz)}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="formatter-divider" />

              <div className="size-selectors">
                <span className="formatter-sublabel">正文:</span>
                {(["sm", "md", "lg"] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`size-btn ${
                      (selectedItem.fontSize || "md") === sz ? "active" : ""
                    }`}
                    onClick={() => updateItemFontSize(selectedItemId, sz)}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="formatter-divider" />
            </>
          )}

          {/* Layer actions */}
          <div className="layer-actions">
            <button
              type="button"
              className="mini-action-button"
              onClick={() => updateItemLayer(selectedItemId, "front")}
              title="移至顶层"
            >
              置顶
            </button>
            <button
              type="button"
              className="mini-action-button"
              onClick={() => updateItemLayer(selectedItemId, "back")}
              title="移至底层"
            >
              置底
            </button>
            <button
              type="button"
              className="mini-action-button text-red"
              onClick={() => {
                removeCanvasItem(selectedItemId);
                setSelectedItemId("");
              }}
              title="删除卡片"
              style={{ color: "#b91c1c", borderColor: "#fca5a5" }}
            >
              删除
            </button>
          </div>
        </div>
      )}
    </>
  );
}
