import { useEffect, useRef, useState } from "react";
import {
  MAX_OVERLAYS,
  normalizeRetouchSettings,
  type OverlayLayer,
  type RetouchSettings,
} from "./editorConstants";
import { createOverlayLayer, type OverlayKind } from "./retouch/overlays";

interface Options {
  settings: RetouchSettings;
  onChange: (settings: RetouchSettings) => void;
  onCommit: (settings: RetouchSettings) => void;
  onActivate: () => void;
}

export function useOverlays({ settings, onChange, onCommit, onActivate }: Options) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [maskTool, setMaskTool] = useState<"paint" | "erase">("erase");
  const [brushSize, setBrushSize] = useState(70);
  const [editingMask, setEditingMask] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (settings.overlays.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !settings.overlays.some((layer) => layer.id === selectedId)) {
      setSelectedId(settings.overlays[settings.overlays.length - 1].id);
    }
  }, [settings.overlays, selectedId]);

  const selected = settings.overlays.find((layer) => layer.id === selectedId) ?? null;

  const replace = (layers: OverlayLayer[], commit: boolean) => {
    const next = normalizeRetouchSettings({ ...settingsRef.current, overlays: layers });
    settingsRef.current = next;
    if (commit) onCommit(next);
    else onChange(next);
  };

  const add = (kind: OverlayKind) => {
    if (settings.overlays.length >= MAX_OVERLAYS) return;
    const layer = createOverlayLayer(kind, settingsRef.current.overlays.length + 1);
    setSelectedId(layer.id);
    onActivate();
    replace([...settingsRef.current.overlays, layer], true);
  };

  const update = (layer: OverlayLayer, commit = false) => {
    replace(settingsRef.current.overlays.map((item) => item.id === layer.id ? layer : item), commit);
  };

  const remove = (id: string) => {
    replace(settingsRef.current.overlays.filter((item) => item.id !== id), true);
  };

  const commitCurrent = () => onCommit(settingsRef.current);

  return {
    selected, selectedId, setSelectedId, maskTool, setMaskTool, brushSize, setBrushSize,
    editingMask, setEditingMask, add, update, remove, commitCurrent,
  };
}
