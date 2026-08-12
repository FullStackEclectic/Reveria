import React from "react";
import { CropOverlay, type CropRect } from "./CropOverlay";
import { FreeTransformOverlay } from "./FreeTransformOverlay";
import { HealingBrushOverlay } from "./HealingBrushOverlay";
import { CloneStampOverlay } from "./CloneStampOverlay";
import { LiquifyOverlay, type LiquifyTool } from "./LiquifyOverlay";
import { EraseOverlay, type EraseMaskCircle, type EraseMode } from "./EraseOverlay";
import { LocalMaskOverlay } from "./LocalMaskOverlay";
import { OverlayEditorOverlay } from "./OverlayEditorOverlay";
import { GuideOverlay, type GuideKind } from "./GuideOverlay";
import type { CanvasTool } from "./CanvasToolbar";
import type { RetouchSettings } from "./editorConstants";
import type { useLocalMasks } from "./useLocalMasks";
import type { useOverlays } from "./useOverlays";
import type { RetouchRendererHandle } from "./RetouchRenderer";

interface Props {
  settings: RetouchSettings;
  cropDraft: CropRect | null;
  setCropDraft: (value: CropRect | null) => void;
  commitGeometry: (changes: Partial<RetouchSettings>) => void;
  activeCanvasTool: CanvasTool;
  setActiveCanvasTool: (tool: CanvasTool) => void;
  setSettings: React.Dispatch<React.SetStateAction<RetouchSettings>>;
  settingsDirtyRef: React.MutableRefObject<boolean>;
  healingBrushSize: number;
  healingStrength: number;
  cloneSource: { x: number; y: number } | null;
  cloneSampling: boolean;
  setCloneSource: (value: { x: number; y: number } | null) => void;
  setCloneSampling: (value: boolean) => void;
  liquifyTool: LiquifyTool;
  liquifyBrushSize: number;
  liquifyStrength: number;
  eraseMode: EraseMode;
  eraseBrushSize: number;
  eraseMasks: EraseMaskCircle[];
  setEraseMasks: (value: EraseMaskCircle[]) => void;
  localMasks: ReturnType<typeof useLocalMasks>;
  overlays: ReturnType<typeof useOverlays>;
  rendererRef: React.RefObject<RetouchRendererHandle | null>;
  guide: GuideKind;
  onHealingCommit: (spots: RetouchSettings["healing_spots"]) => void;
  onCloneCommit: (stamps: RetouchSettings["clone_stamps"]) => void;
  onLiquifyCommit: (strokes: RetouchSettings["liquify_strokes"]) => void;
  onFreeTransformCommit: (points: RetouchSettings["free_transform_points"]) => void;
}

export function CanvasToolOverlays(props: Props) {
  const {
    settings, cropDraft, setCropDraft, commitGeometry, activeCanvasTool, setActiveCanvasTool,
    setSettings, settingsDirtyRef, healingBrushSize, healingStrength, cloneSource, cloneSampling,
    setCloneSource, setCloneSampling, liquifyTool, liquifyBrushSize, liquifyStrength,
    eraseMode, eraseBrushSize, eraseMasks, setEraseMasks, localMasks, overlays, rendererRef,
    guide, onHealingCommit, onCloneCommit, onLiquifyCommit, onFreeTransformCommit,
  } = props;

  return (
    <>
      {cropDraft && (
        <CropOverlay
          value={cropDraft}
          onChange={setCropDraft}
          onCancel={() => setCropDraft(null)}
          onApply={() => {
            commitGeometry({
              crop_x: cropDraft.x, crop_y: cropDraft.y,
              crop_width: cropDraft.width, crop_height: cropDraft.height,
            });
            setCropDraft(null);
          }}
        />
      )}
      {activeCanvasTool === "transform" && !cropDraft && (
        <FreeTransformOverlay
          points={settings.free_transform_points}
          onChange={(points) => {
            settingsDirtyRef.current = true;
            setSettings((current) => ({ ...current, free_transform_points: points }));
          }}
          onCommit={onFreeTransformCommit}
          onClose={() => setActiveCanvasTool("move")}
        />
      )}
      {activeCanvasTool === "healing" && !cropDraft && (
        <HealingBrushOverlay
          settings={settings} brushSize={healingBrushSize} strength={healingStrength}
          onChange={(spots) => {
            settingsDirtyRef.current = true;
            setSettings((current) => ({ ...current, healing_spots: spots }));
          }}
          onCommit={onHealingCommit}
        />
      )}
      {activeCanvasTool === "clone" && !cropDraft && (
        <CloneStampOverlay
          settings={settings} brushSize={healingBrushSize} strength={healingStrength}
          source={cloneSource} samplingSource={cloneSampling}
          onSourceChange={(source) => { setCloneSource(source); setCloneSampling(false); }}
          onChange={(stamps) => {
            settingsDirtyRef.current = true;
            setSettings((current) => ({ ...current, clone_stamps: stamps }));
          }}
          onCommit={onCloneCommit}
        />
      )}
      {activeCanvasTool === "liquify" && !cropDraft && (
        <LiquifyOverlay
          settings={settings} tool={liquifyTool} brushSize={liquifyBrushSize} strength={liquifyStrength}
          onChange={(strokes) => {
            settingsDirtyRef.current = true;
            setSettings((current) => ({ ...current, liquify_strokes: strokes }));
          }}
          onCommit={onLiquifyCommit}
        />
      )}
      {activeCanvasTool === "erase" && !cropDraft && (
        <EraseOverlay
          settings={settings} mode={eraseMode} brushSize={eraseBrushSize} masks={eraseMasks}
          onChange={setEraseMasks} onCommit={setEraseMasks}
        />
      )}
      {activeCanvasTool === "mask" && localMasks.selectedMask && !cropDraft && (
        <LocalMaskOverlay
          settings={settings} mask={localMasks.selectedMask}
          brushTool={localMasks.brushTool} brushSize={localMasks.brushSize} brushFlow={localMasks.brushFlow}
          sampleColor={(x, y) => rendererRef.current?.sampleColor(x, y) ?? null}
          onChange={localMasks.changeMask} onCommit={localMasks.commitMask}
        />
      )}
      {activeCanvasTool === "overlay" && overlays.selected && !cropDraft && (
        <OverlayEditorOverlay
          settings={settings} layer={overlays.selected}
          mode={overlays.editingMask ? "mask" : "move"}
          maskTool={overlays.maskTool} brushSize={overlays.brushSize}
          onChange={(layer) => overlays.update(layer)}
          onCommit={(layer) => overlays.update(layer, true)}
        />
      )}
      <GuideOverlay kind={guide} />
    </>
  );
}
