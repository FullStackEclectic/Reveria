import { useState, useEffect, useRef } from "react";
import {
  ProjectSummary,
  AssetSummary,
  ProjectCanvasDocument,
  WorkspaceSummary,
  ProjectCanvasSummary,
  CanvasItem,
} from "../../types";
import {
  normalizeCanvas,
  createCanvasItemId,
  assetTitle,
  assetUrl,
  putJson,
  CANVAS_ITEM_LIMIT,
} from "../../utils";

/** 撤销栈深度上限，与图像精修工作台保持一致，避免大画布下无限增长吃内存。 */
const HISTORY_LIMIT = 50;

interface UseProjectCanvasStateProps {
  selectedProject: ProjectSummary;
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  activeWorkspace?: WorkspaceSummary;
}

export function useProjectCanvasState({
  selectedProject,
  assets,
  setAssets,
  projectCanvas,
  setProjectCanvas,
  activeWorkspace,
}: UseProjectCanvasStateProps) {
  // Infinite Canvas Viewport States
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isSavingCanvas, setIsSavingCanvas] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => setToastMessage(msg);

  // --- 撤销与重做历史控制 ---
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const undoStack = useRef<ProjectCanvasDocument[]>([]);
  const redoStack = useRef<ProjectCanvasDocument[]>([]);

  const pushToHistory = (canvas: ProjectCanvasDocument) => {
    undoStack.current.push(JSON.parse(JSON.stringify(canvas)));
    if (undoStack.current.length > HISTORY_LIMIT) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  // 连续微调（方向键 keyrepeat）合并为一次撤销单元：
  // 会话开始时压一次栈，之后 400ms 内的连续按键不再压栈。
  const nudgeSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginNudgeSession = () => {
    if (nudgeSessionTimerRef.current === null) {
      pushToHistory(projectCanvas);
    } else {
      clearTimeout(nudgeSessionTimerRef.current);
    }
    nudgeSessionTimerRef.current = setTimeout(() => {
      nudgeSessionTimerRef.current = null;
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (nudgeSessionTimerRef.current) clearTimeout(nudgeSessionTimerRef.current);
    };
  }, []);

  const undo = () => {
    if (undoStack.current.length === 0) return;
    const currentCanvas = JSON.parse(JSON.stringify(projectCanvas));
    redoStack.current.push(currentCanvas);
    const prevCanvas = undoStack.current.pop()!;
    setProjectCanvas(prevCanvas);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const currentCanvas = JSON.parse(JSON.stringify(projectCanvas));
    undoStack.current.push(currentCanvas);
    const nextCanvas = redoStack.current.pop()!;
    setProjectCanvas(nextCanvas);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  };

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const boards = projectCanvas.boards || [];
  const activeBoardsList = boards.length > 0 ? boards : [{ id: "default", name: "主画板" }];
  const activeBoardId = projectCanvas.activeBoardId || (boards[0]?.id || "default");

  const selectedProjectId = selectedProject.id;

  // 仅在切换项目时清空撤销栈。
  // 保存成功后 normalizeCanvas 会回填 panX/panY/zoom，那不该连带清掉编辑历史。
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [selectedProjectId]);

  // Synchronize pan/zoom state with loaded canvas
  useEffect(() => {
    setPanX(projectCanvas.panX ?? 0);
    setPanY(projectCanvas.panY ?? 0);
    setZoom(projectCanvas.zoom ?? 1.0);
    setSelectedItemId("");
  }, [selectedProjectId, projectCanvas.panX, projectCanvas.panY, projectCanvas.zoom]);

  // Keyboard shortcuts listener (Nudge, Delete, Copy, Paste, zoom reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift 按下时 e.key 会是大写，统一转小写再比对。
      const shortcutKey = e.key.toLowerCase();

      // Undo Ctrl + Z / Redo Ctrl + Shift + Z
      if (e.ctrlKey && shortcutKey === "z") {
        const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
        if (isInput) return;
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
        return;
      }

      // Redo Ctrl + Y
      if (e.ctrlKey && shortcutKey === "y") {
        const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
        if (isInput) return;
        redo();
        e.preventDefault();
        return;
      }

      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (isInput) return;

      // Delete/Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedItemId) {
        removeCanvasItem(selectedItemId);
        setSelectedItemId("");
        e.preventDefault();
      }

      // Copy Ctrl + C
      if (e.ctrlKey && shortcutKey === "c" && selectedItemId) {
        const itemToCopy = projectCanvas.items.find((i) => i.id === selectedItemId);
        if (itemToCopy) {
          localStorage.setItem("reveria.canvasClipboard", JSON.stringify(itemToCopy));
        }
      }

      // Paste Ctrl + V
      if (e.ctrlKey && shortcutKey === "v") {
        const clipboardData = localStorage.getItem("reveria.canvasClipboard");
        if (clipboardData) {
          if (!ensureCapacity()) return;
          try {
            const copiedItem = JSON.parse(clipboardData) as CanvasItem;
            // 剪贴板是全局的，跨项目粘贴时 asset_id 指向另一个项目的素材，
            // 当前项目的 assets 里查不到，卡片会渲染成一张空白便签并被持久化成脏数据。
            if (
              copiedItem.type === "asset" &&
              copiedItem.asset_id &&
              !assets.some((asset) => asset.id === copiedItem.asset_id)
            ) {
              showToast("该素材不属于当前项目，无法粘贴");
              return;
            }
            const newId = createCanvasItemId();
            const newItem: CanvasItem = {
              ...copiedItem,
              id: newId,
              x: copiedItem.x + 30,
              y: copiedItem.y + 30,
              board_id: activeBoardId,
            };
            pushToHistory(projectCanvas);
            setProjectCanvas((current) => ({
              ...current,
              items: [...current.items, newItem],
            }));
            setSelectedItemId(newId);
          } catch (err) {
            console.error("Paste canvas item error:", err);
          }
        }
      }

      // Arrow keys to nudge (1px or 10px with Shift)
      if (selectedItemId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const dist = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -dist;
        if (e.key === "ArrowDown") dy = dist;
        if (e.key === "ArrowLeft") dx = -dist;
        if (e.key === "ArrowRight") dx = dist;

        // 连续微调合并成一条历史。
        // 否则按住方向键时每个 keyrepeat 都会压入同一个闭包快照，
        // 50 层历史瞬间被同一状态填满，一次 Ctrl+Z 直接跳回起点且真实历史被挤掉。
        beginNudgeSession();
        setProjectCanvas((current) => ({
          ...current,
          items: current.items.map((item) => {
            if (item.id !== selectedItemId) return item;
            return {
              ...item,
              x: item.x + dx,
              y: item.y + dy,
            };
          }),
        }));
        e.preventDefault();
      }

      // Ctrl + 0: reset zoom
      if (e.ctrlKey && e.key === "0") {
        setZoom(1.0);
        setPanX(0);
        setPanY(0);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, projectCanvas.items, activeBoardId, selectedProjectId]);

  /** 元素数量守卫：达到上限时明确提示，避免保存后被 normalizeCanvas 静默截断。 */
  function ensureCapacity() {
    if (projectCanvas.items.length >= CANVAS_ITEM_LIMIT) {
      showToast(`画布元素已达上限 ${CANVAS_ITEM_LIMIT} 个，请清理后再添加`);
      return false;
    }
    return true;
  }

  function addAssetToCanvas(asset: AssetSummary) {
    if (!ensureCapacity()) return;
    const insert = (w: number, h: number) => {
      pushToHistory(projectCanvas);
      setProjectCanvas((current) => ({
        ...current,
        version: 1,
        items: [
          ...current.items,
          {
            id: createCanvasItemId(),
            type: "asset",
            asset_id: asset.id,
            title: assetTitle(asset),
            x: Math.round(-panX + 50 + (current.items.length % 4) * 40),
            y: Math.round(-panY + 50 + (current.items.length % 5) * 30),
            w,
            h,
            board_id: activeBoardId,
          },
        ],
      }));
    };
    const fileUrlStr = asset.file_url;
    if (fileUrlStr) {
      const img = new window.Image();
      img.src = assetUrl(fileUrlStr);
      img.onload = () => {
        insert(img.naturalWidth || 180, img.naturalHeight || 160);
        showToast("已将图片添加至当前画板！");
      };
      img.onerror = () => {
        insert(180, 160);
        showToast("已将图片添加至当前画板！");
      };
    } else {
      insert(180, 160);
      showToast("已将图片添加至当前画板！");
    }
  }

  function addNoteToCanvas() {
    if (!ensureCapacity()) return;
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: [
        ...current.items,
        {
          id: createCanvasItemId(),
          type: "note",
          title: "备注",
          text: "写下交付思路、修改意见或客户反馈。",
          x: Math.round(-panX + 100 + (current.items.length % 4) * 40),
          y: Math.round(-panY + 100 + (current.items.length % 5) * 30),
          w: 220,
          h: 140,
          board_id: activeBoardId,
        },
      ],
    }));
  }

  function addFrameToCanvas() {
    if (!ensureCapacity()) return;
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: [
        ...current.items,
        {
          id: createCanvasItemId(),
          type: "frame",
          title: "新建画框",
          text: "",
          x: Math.round(-panX + 80 + (current.items.length % 4) * 40),
          y: Math.round(-panY + 80 + (current.items.length % 5) * 30),
          w: 480,
          h: 360,
          board_id: activeBoardId,
        },
      ],
    }));
  }

  function removeCanvasItem(itemId: string) {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: current.items.filter((item) => item.id !== itemId),
      connections: (current.connections || []).filter(
        (c) => c.fromItemId !== itemId && c.toItemId !== itemId
      ),
    }));
    if (selectedItemId === itemId) {
      setSelectedItemId("");
    }
  }

  async function saveProjectCanvas() {
    setIsSavingCanvas(true);
    try {
      const updatedCanvas: ProjectCanvasDocument = {
        ...projectCanvas,
        panX,
        panY,
        zoom,
        boards: projectCanvas.boards || boards,
        activeBoardId: activeBoardId,
      };

      const response = await putJson<ProjectCanvasSummary>(
        `/api/projects/${selectedProject.id}/canvas`,
        { canvas: updatedCanvas }
      );
      setProjectCanvas(normalizeCanvas(response.canvas));
      showToast("画布保存成功");
    } catch {
      showToast("画布保存失败：需要项目成员权限");
    } finally {
      setIsSavingCanvas(false);
    }
  }

  function handleCreateBoard() {
    const name = prompt("请输入画板名称：", `画板 ${activeBoardsList.length + 1}`);
    if (!name || !name.trim()) return;
    const boardId = `board-${Date.now()}`;
    const newBoard = { id: boardId, name: name.trim() };

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      boards: [...(current.boards || []), newBoard],
      activeBoardId: boardId,
    }));
  }

  function addWorkflowResultToCanvas(title: string, output: any) {
    if (!ensureCapacity()) return;
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      version: 1,
      items: [
        ...current.items,
        {
          id: createCanvasItemId(),
          type: "note",
          title: title,
          text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
          x: Math.round(-panX + 120 + (current.items.length % 4) * 40),
          y: Math.round(-panY + 120 + (current.items.length % 5) * 30),
          w: 300,
          h: 200,
          board_id: activeBoardId,
        },
      ],
    }));
    showToast("已将工作流输出添加至当前画板！");
  }

  function handleSetActiveBoardId(boardId: string) {
    setProjectCanvas((current) => ({
      ...current,
      activeBoardId: boardId,
    }));
    setSelectedItemId("");
  }

  function handleRenameBoard(boardId: string) {
    const currentBoard = activeBoardsList.find((b) => b.id === boardId);
    if (!currentBoard) return;
    const name = prompt("请输入新画板名称：", currentBoard.name);
    if (!name || !name.trim()) return;

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      boards: (current.boards || activeBoardsList).map((b) =>
        b.id === boardId ? { ...b, name: name.trim() } : b
      ),
    }));
  }

  function handleDeleteBoard(boardId: string) {
    if (boardId === "default") {
      alert("默认画板不能删除");
      return;
    }
    if (!confirm("确定要删除此画板吗？该画板下的所有卡片都将被清除。")) return;

    pushToHistory(projectCanvas);
    setProjectCanvas((current) => {
      const newBoards = (current.boards || []).filter((b) => b.id !== boardId);
      const newItems = current.items.filter(
        (item) => (item.board_id || "default") !== boardId
      );
      // 画板下的元素被清空后，指向它们的连线必须一并删除，否则会留下悬空连线。
      const remainingIds = new Set(newItems.map((item) => item.id));
      const newConnections = (current.connections || []).filter(
        (conn) => remainingIds.has(conn.fromItemId) && remainingIds.has(conn.toItemId)
      );
      const nextActive =
        current.activeBoardId === boardId
          ? newBoards[0]?.id || "default"
          : current.activeBoardId;
      return {
        ...current,
        boards: newBoards,
        items: newItems,
        connections: newConnections,
        activeBoardId: nextActive,
      };
    });
  }

  function updateItemProperty(itemId: string, properties: Partial<CanvasItem>) {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...properties } : item
      ),
    }));
  }

  function updateItemLayer(itemId: string, action: "front" | "back") {
    pushToHistory(projectCanvas);
    setProjectCanvas((current) => {
      const items = [...current.items];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return current;
      const [target] = items.splice(index, 1);
      if (action === "front") {
        items.push(target);
      } else {
        items.unshift(target);
      }
      return { ...current, items };
    });
  }

  return {
    panX,
    setPanX,
    panY,
    setPanY,
    zoom,
    setZoom,
    selectedItemId,
    setSelectedItemId,
    isSavingCanvas,
    toastMessage,
    showToast,
    canUndo,
    canRedo,
    activeBoardId,
    activeBoardsList,
    undo,
    redo,
    pushToHistory,
    addAssetToCanvas,
    addNoteToCanvas,
    addFrameToCanvas,
    removeCanvasItem,
    saveProjectCanvas,
    handleCreateBoard,
    addWorkflowResultToCanvas,
    handleSetActiveBoardId,
    handleRenameBoard,
    handleDeleteBoard,
    updateItemProperty,
    updateItemLayer,
  };
}
