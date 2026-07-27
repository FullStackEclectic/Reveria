import { useEffect, useState } from "react";
import {
  MAX_LOCAL_MASKS,
  normalizeRetouchSettings,
  type LocalMask,
  type LocalMaskType,
  type RetouchSettings,
} from "./editorConstants";
import type { LocalMaskBrushTool } from "./LocalMaskOverlay";
import { createLocalMask } from "./retouch/localMasks";

interface Options {
  settings: RetouchSettings;
  onChange: (settings: RetouchSettings) => void;
  onCommit: (settings: RetouchSettings) => void;
  onActivate: () => void;
}

export function useLocalMasks({ settings, onChange, onCommit, onActivate }: Options) {
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [brushTool, setBrushTool] = useState<LocalMaskBrushTool>("paint");
  const [brushSize, setBrushSize] = useState(90);
  const [brushFlow, setBrushFlow] = useState(70);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (settings.local_masks.length === 0) {
      if (selectedMaskId !== null) setSelectedMaskId(null);
      return;
    }
    if (!settings.local_masks.some((mask) => mask.id === selectedMaskId)) {
      setSelectedMaskId(settings.local_masks[0].id);
    }
  }, [settings.local_masks, selectedMaskId]);

  const replaceMask = (mask: LocalMask): RetouchSettings => ({
    ...settings,
    local_masks: settings.local_masks.map((item) => item.id === mask.id ? mask : item),
  });

  const changeMask = (mask: LocalMask) => onChange(replaceMask(mask));
  const commitMask = (mask: LocalMask) => onCommit(normalizeRetouchSettings(replaceMask(mask)));

  const addMask = (type: LocalMaskType) => {
    if (settings.local_masks.length >= MAX_LOCAL_MASKS) return;
    const mask = createLocalMask(type, settings.local_masks.length + 1);
    const next = normalizeRetouchSettings({ ...settings, local_masks: [...settings.local_masks, mask] });
    setSelectedMaskId(mask.id);
    onActivate();
    onCommit(next);
  };

  const deleteMask = (id: string) => {
    const masks = settings.local_masks.filter((mask) => mask.id !== id);
    setSelectedMaskId(masks[0]?.id ?? null);
    onCommit(normalizeRetouchSettings({ ...settings, local_masks: masks }));
  };

  const selectedMask = settings.local_masks.find((mask) => mask.id === selectedMaskId) ?? null;

  return {
    selectedMask,
    selectedMaskId,
    setSelectedMaskId,
    brushTool,
    setBrushTool,
    brushSize,
    setBrushSize,
    brushFlow,
    setBrushFlow,
    showOverlay,
    setShowOverlay,
    changeMask,
    commitMask,
    addMask,
    deleteMask,
    resetSelection: () => setSelectedMaskId(null),
  };
}
