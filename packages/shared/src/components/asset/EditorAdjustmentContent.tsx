import React from "react";
import type { AssetSummary } from "../../types";
import type { FacePoints } from "../../utils/faceMesh";
import { BackgroundPanel } from "./BackgroundPanel";
import type { CanvasTool } from "./CanvasToolbar";
import { CloneStampPanel } from "./CloneStampPanel";
import { ColorAdjustments } from "./ColorAdjustments";
import { ErasePanel, type EraseIntent } from "./ErasePanel";
import type { EraseMode } from "./EraseOverlay";
import type { EditorTab } from "./EditorTabBar";
import { LocalHealingPanel } from "./LocalHealingPanel";
import { LocalMaskPanel } from "./LocalMaskPanel";
import { LiquifyPanel } from "./LiquifyPanel";
import type { LiquifyTool } from "./LiquifyOverlay";
import { PortraitAdjustments } from "./PortraitAdjustments";
import { ProfessionalAdjustments } from "./ProfessionalAdjustments";
import type { CurveKey, CurvePoints, PortraitParamKey, RetouchSettings } from "./editorConstants";
import type { ImageHistogram } from "./retouch/histogram";
import type { PortraitRole } from "./retouch/rolePresets";
import type { useBackgroundRemoval } from "./useBackgroundRemoval";
import type { useEraseTask } from "./useEraseTask";
import type { useLocalMasks } from "./useLocalMasks";
import { OverlayPanel } from "./OverlayPanel";
import type { useOverlays } from "./useOverlays";
import type { LutEntry } from "./useLutLibrary";

interface Props {
  activeTab: EditorTab;
  asset: AssetSummary;
  sourceUrl: string;
  settings: RetouchSettings;
  facePoints: FacePoints | null;
  role: PortraitRole;
  onSelectRole: (role: PortraitRole) => void;
  onPortraitParamChange: (key: PortraitParamKey, value: number) => void;
  onSliderChange: (key: keyof RetouchSettings, value: number) => void;
  onCurveChange: (key: CurveKey, value: CurvePoints) => void;
  onProfessionalChange: (key: keyof RetouchSettings, value: number | string) => void;
  onProfessionalPatch: (changes: Partial<RetouchSettings>) => void;
  onCommit: (snapshot?: RetouchSettings) => void;
  lutEntries: LutEntry[];
  onSelectLut: (id: string) => void;
  onImportLut: (file: File) => Promise<void>;
  onDeleteLut: (id: string) => void;
  activeCanvasTool: CanvasTool;
  healingBrushSize: number;
  healingStrength: number;
  cloneSource: { x: number; y: number } | null;
  cloneSampling: boolean;
  onHealingBrushSizeChange: (value: number) => void;
  onHealingStrengthChange: (value: number) => void;
  onCloneSamplingChange: (value: boolean) => void;
  onHealingClear: () => void;
  onCloneClear: () => void;
  liquifyTool: LiquifyTool;
  liquifyBrushSize: number;
  liquifyStrength: number;
  onLiquifyToolChange: (tool: LiquifyTool) => void;
  onLiquifyBrushSizeChange: (value: number) => void;
  onLiquifyStrengthChange: (value: number) => void;
  onLiquifyClear: () => void;
  localMasks: ReturnType<typeof useLocalMasks>;
  onActivateMask: () => void;
  eraseMode: EraseMode;
  eraseBrushSize: number;
  eraseIntent: EraseIntent;
  eraseMaskCount: number;
  onEraseModeChange: (mode: EraseMode) => void;
  onEraseBrushSizeChange: (value: number) => void;
  onEraseIntentChange: (intent: EraseIntent) => void;
  onEraseClear: () => void;
  eraseTask: ReturnType<typeof useEraseTask>;
  backgroundTask: ReturnType<typeof useBackgroundRemoval>;
  onBackgroundChange: (changes: Partial<RetouchSettings>) => void;
  onBackgroundCommit: (changes?: Partial<RetouchSettings>) => void;
  histogram: ImageHistogram | null;
  onExportLut?: () => void;
  overlayState: ReturnType<typeof useOverlays>;
}

export function EditorAdjustmentContent(props: Props) {
  const {
    activeTab, asset, sourceUrl, settings, facePoints, role, onSelectRole,
    onPortraitParamChange, onSliderChange, onCurveChange, onProfessionalChange, onProfessionalPatch, onCommit,
    lutEntries, onSelectLut, onImportLut, onDeleteLut, activeCanvasTool,
    healingBrushSize, healingStrength, cloneSource, cloneSampling,
    onHealingBrushSizeChange, onHealingStrengthChange, onCloneSamplingChange,
    onHealingClear, onCloneClear, liquifyTool, liquifyBrushSize, liquifyStrength,
    onLiquifyToolChange, onLiquifyBrushSizeChange, onLiquifyStrengthChange, onLiquifyClear,
    localMasks, onActivateMask, eraseMode, eraseBrushSize, eraseIntent, eraseMaskCount,
    onEraseModeChange, onEraseBrushSizeChange, onEraseIntentChange, onEraseClear,
    eraseTask, backgroundTask, onBackgroundChange, onBackgroundCommit, histogram, onExportLut,
    overlayState,
  } = props;

  if (activeTab === "portrait") return (
    <PortraitAdjustments role={role} onSelectRole={onSelectRole} settings={settings}
      faceDetected={facePoints !== null} onParamChange={onPortraitParamChange} onCommit={() => onCommit()} />
  );
  if (activeTab === "color") return (
    <ColorAdjustments settings={settings} handleSliderChange={onSliderChange}
      handleCurveChange={onCurveChange} handleAutoSave={onCommit} lutEntries={lutEntries}
      onSelectLut={onSelectLut} onImportLut={onImportLut} onDeleteLut={onDeleteLut}
      onExportLut={onExportLut} />
  );
  if (activeTab === "professional") return (
    <ProfessionalAdjustments asset={asset} sourceUrl={sourceUrl} settings={settings}
      histogram={histogram} onChange={onProfessionalChange} onPatch={onProfessionalPatch}
      onCommit={() => onCommit()}
      onExportLut={onExportLut} />
  );
  if (activeTab === "local") return activeCanvasTool === "clone" ? (
    <CloneStampPanel brushSize={healingBrushSize} strength={healingStrength}
      stampCount={settings.clone_stamps.length} hasSource={cloneSource !== null} samplingSource={cloneSampling}
      onBrushSizeChange={onHealingBrushSizeChange} onStrengthChange={onHealingStrengthChange}
      onSample={() => onCloneSamplingChange(true)} onClear={onCloneClear} />
  ) : (
    <LocalHealingPanel brushSize={healingBrushSize} strength={healingStrength}
      spotCount={settings.healing_spots.length} onBrushSizeChange={onHealingBrushSizeChange}
      onStrengthChange={onHealingStrengthChange} onClear={onHealingClear} />
  );
  if (activeTab === "liquify") return (
    <LiquifyPanel tool={liquifyTool} brushSize={liquifyBrushSize} strength={liquifyStrength}
      strokeCount={settings.liquify_strokes.length} onToolChange={onLiquifyToolChange}
      onBrushSizeChange={onLiquifyBrushSizeChange} onStrengthChange={onLiquifyStrengthChange}
      onClear={onLiquifyClear} settings={settings} onBodyChange={onProfessionalChange}
      onBodyCommit={() => onCommit()} />
  );
  if (activeTab === "mask") return (
    <LocalMaskPanel masks={settings.local_masks} selectedMaskId={localMasks.selectedMaskId}
      brushTool={localMasks.brushTool} brushSize={localMasks.brushSize} brushFlow={localMasks.brushFlow}
      showOverlay={localMasks.showOverlay} onAdd={localMasks.addMask}
      onSelect={(id) => { localMasks.setSelectedMaskId(id); onActivateMask(); }}
      onChange={localMasks.changeMask} onCommit={localMasks.commitMask} onDelete={localMasks.deleteMask}
      onBrushToolChange={localMasks.setBrushTool} onBrushSizeChange={localMasks.setBrushSize}
      onBrushFlowChange={localMasks.setBrushFlow} onShowOverlayChange={localMasks.setShowOverlay} />
  );
  if (activeTab === "erase") return (
    <ErasePanel mode={eraseMode} brushSize={eraseBrushSize} maskCount={eraseMaskCount} intent={eraseIntent}
      onModeChange={onEraseModeChange} onBrushSizeChange={onEraseBrushSizeChange}
      onIntentChange={onEraseIntentChange} onClear={onEraseClear} onSubmit={eraseTask.submit}
      isSubmitting={eraseTask.isSubmitting} taskStatus={eraseTask.taskStatus} />
  );
  if (activeTab === "background") return (
    <BackgroundPanel settings={settings} taskStatus={backgroundTask.taskStatus}
      errorMessage={backgroundTask.errorMessage} isSubmitting={backgroundTask.isSubmitting}
      isUploading={backgroundTask.isUploading} onSubmit={backgroundTask.submit}
      onUpload={backgroundTask.uploadBackground} onChange={onBackgroundChange}
      onCommit={onBackgroundCommit} onClear={() => onBackgroundCommit({ background_mode: "original" })} />
  );
  if (activeTab === "overlay") return (
    <OverlayPanel overlays={settings.overlays} overlayState={overlayState} />
  );
  return null;
}
