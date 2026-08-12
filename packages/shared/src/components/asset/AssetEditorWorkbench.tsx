import React, { useState, useEffect, useRef } from "react";
import { RetouchRenderer, RetouchRendererHandle } from "./RetouchRenderer";
import { OverlayPreview } from "./OverlayPreview";
import { CanvasToolOverlays } from "./CanvasToolOverlays";
import { RawConvertPanel } from "./RawConvertPanel";
import { useOverlays } from "./useOverlays";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl } from "../../utils";
import { detectFacePoints, FacePoints } from "../../utils/faceMesh";
import {
  RetouchSettings, DEFAULT_SETTINGS, PRESET_EFFECTS, normalizeRetouchSettings,
  type CurveKey, type CurvePoints, type PortraitParamKey
} from "./editorConstants";
import { ROLE_PRESET_MAP, type PortraitRole } from "./retouch/rolePresets";
import { useRetouchPresets } from "./useRetouchPresets";
import { useLutLibrary } from "./useLutLibrary";
import { CropRect } from "./CropOverlay";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { type GuideKind } from "./GuideOverlay";
import { type LiquifyTool } from "./LiquifyOverlay";
import { type EraseMaskCircle, type EraseMode } from "./EraseOverlay";
import { type EraseIntent } from "./ErasePanel";
import { useBackgroundRemoval } from "./useBackgroundRemoval";
import { useEraseTask } from "./useEraseTask";
import { useLocalMasks } from "./useLocalMasks";
import { RetouchPresetPanel } from "./RetouchPresetPanel";
import { AssetFilmstrip } from "./AssetFilmstrip";
import { EditorHeader, type EditorCenterTab, type ExportFormat, type ExportImageOptions } from "./EditorHeader";
import { EmptyAssetImporter } from "./EmptyAssetImporter";
import { EditorTabBar, type EditorTab } from "./EditorTabBar";
import { WatermarkPreview } from "./WatermarkPreview";
import { EditorAdjustmentContent } from "./EditorAdjustmentContent";
import { preserveExifInJpeg } from "./retouch/exif";
import { downloadSettingsAsCube } from "./retouch/exportLut";
import { fitIdPhotoCrop, type IdPhotoColor, type IdPhotoSpec } from "./retouch/idPhoto";
import { resizeDataUrl } from "./retouch/batchExport";
import { BatchToolsContent } from "./BatchToolsContent";
import { BatchExportRunner } from "./BatchExportRunner";
import { useBatchExport } from "./useBatchExport";
import { useUpscaleTask } from "./useUpscaleTask";
import type { ImageHistogram } from "./retouch/histogram";
import "./AssetEditorWorkbench.css";

export type { RetouchSettings } from "./editorConstants";
export type { ExportFormat, ExportImageOptions } from "./EditorHeader";

interface AssetEditorProps {
  asset?: AssetSummary;
  projectAssets: AssetSummary[];
  onClose: () => void;
  onSaveSettings: (assetId: string, settings: RetouchSettings) => Promise<boolean>;
  onLoadSettings?: (assetId: string) => Promise<RetouchSettings | undefined>;
  onExportImage: (
    assetId: string,
    settings: RetouchSettings,
    dataUrl: string,
    format: ExportFormat,
    options?: ExportImageOptions,
  ) => Promise<boolean>;
  initialSettings?: RetouchSettings;
  onUpload?: (file: File) => Promise<AssetSummary | void>;
  onAssetsRefresh?: () => void;
}

export function AssetEditorWorkbench({
  asset: initialAsset,
  projectAssets,
  onClose,
  onSaveSettings,
  onLoadSettings,
  onExportImage,
  initialSettings,
  onUpload,
  onAssetsRefresh,
}: AssetEditorProps) {
  const [currentAsset, setCurrentAsset] = useState<AssetSummary | undefined>(initialAsset);
  const [settings, setSettings] = useState<RetouchSettings>(normalizeRetouchSettings(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const autoSaveTimeoutRef = useRef<any | null>(null);
  const settingsDirtyRef = useRef(false);
  const explicitInitialAssetIdRef = useRef(initialAsset?.id);
  const explicitInitialConsumedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<EditorTab>("portrait");
  const [role, setRole] = useState<PortraitRole>("female");
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const { presets: customPresets, savePreset, deletePreset } = useRetouchPresets();
  const { entries: lutEntries, resolve: resolveLut, importLut, deleteLut } = useLutLibrary();
  const historyRef = useRef<RetouchSettings[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [facePoints, setFacePoints] = useState<FacePoints | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [centerTab, setCenterTab] = useState<EditorCenterTab>("retouch");
  const [idPhotoSpec, setIdPhotoSpec] = useState<IdPhotoSpec | null>(null);
  const [cropDraft, setCropDraft] = useState<CropRect | null>(null);
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>("move");
  const [healingBrushSize, setHealingBrushSize] = useState(32);
  const [healingStrength, setHealingStrength] = useState(80);
  const [guide, setGuide] = useState<GuideKind>("none");
  const [liquifyTool, setLiquifyTool] = useState<LiquifyTool>("push");
  const [liquifyBrushSize, setLiquifyBrushSize] = useState(90);
  const [liquifyStrength, setLiquifyStrength] = useState(45);
  const [eraseMasks, setEraseMasks] = useState<EraseMaskCircle[]>([]);
  const [eraseMode, setEraseMode] = useState<EraseMode>("mark");
  const [eraseBrushSize, setEraseBrushSize] = useState(60);
  const [eraseIntent, setEraseIntent] = useState<EraseIntent>("erase");
  const [cloneSource, setCloneSource] = useState<{ x: number; y: number } | null>(null);
  const [cloneSampling, setCloneSampling] = useState(true);
  const [histogram, setHistogram] = useState<ImageHistogram | null>(null);
  const rendererRef = useRef<RetouchRendererHandle>(null);

  // 当外部传入的 asset 改变时
  useEffect(() => {
    setCurrentAsset(initialAsset);
  }, [initialAsset]);

  // 切换资产时恢复该素材的服务端参数，并重置本地操作历史。
  useEffect(() => {
    if (currentAsset) {
      let cancelled = false;
      if (explicitInitialAssetIdRef.current !== initialAsset?.id) {
        explicitInitialAssetIdRef.current = initialAsset?.id;
        explicitInitialConsumedRef.current = false;
      }
      const explicitInitial = !explicitInitialConsumedRef.current
        && currentAsset.id === initialAsset?.id
        && initialSettings
        ? normalizeRetouchSettings(initialSettings)
        : undefined;
      if (explicitInitial) explicitInitialConsumedRef.current = true;
      const applyInitial = (initial: RetouchSettings) => {
        if (cancelled) return;
        setSettings(initial);
        historyRef.current = [initial];
        historyIndexRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
      };

      settingsDirtyRef.current = false;
      applyInitial(explicitInitial ?? DEFAULT_SETTINGS);
      setShowOriginal(false);
      setCropDraft(null);
      setActiveCanvasTool("move");
      setCloneSource(null);
      setCloneSampling(true);
      setActivePresetIndex(null);
      setIdPhotoSpec(null);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      if (!explicitInitial && onLoadSettings) {
        void onLoadSettings(currentAsset.id)
          .then((saved) => {
            if (saved && !settingsDirtyRef.current) {
              applyInitial(normalizeRetouchSettings(saved));
            }
          })
          .catch((error) => console.error("Load retouch settings failed:", error));
      }

      return () => {
        cancelled = true;
      };
    }
  }, [currentAsset?.id, initialAsset?.id, initialSettings, onLoadSettings]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [canUndo, canRedo]);

  const sourceUrl = assetUrl(currentAsset?.file_url ?? currentAsset?.thumbnail_url ?? "");

  // 图片变化时自动触发面部关键点检测
  useEffect(() => {
    if (!sourceUrl) { setFacePoints(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = sourceUrl;
    img.onload = async () => {
      if (cancelled) return;
      const fp = await detectFacePoints(img);
      if (!cancelled) setFacePoints(fp);
    };
    return () => { cancelled = true; };
  }, [sourceUrl]);

  const pushHistory = (s: RetouchSettings) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    history.push(s);
    if (history.length > 50) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const prev = historyRef.current[historyIndexRef.current];
    settingsDirtyRef.current = true;
    setSettings(prev);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current];
    settingsDirtyRef.current = true;
    setSettings(next);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const handleSelectLut = (id: string) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => ({ ...prev, lut_file: id }));
  };

  /** 导入成功后立即选中该 LUT，避免用户还要再点一次 */
  const handleImportLut = async (file: File) => {
    const id = await importLut(file);
    settingsDirtyRef.current = true;
    setSettings((prev) => {
      const next = { ...prev, lut_file: id };
      setTimeout(() => handleAutoSave(next), 50);
      return next;
    });
  };

  const handleSliderChange = (key: keyof RetouchSettings, val: number) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleProfessionalChange = (key: keyof RetouchSettings, value: number | string) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => normalizeRetouchSettings({ ...prev, [key]: value }));
  };

  const handleProfessionalPatch = (changes: Partial<RetouchSettings>) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => {
      const next = normalizeRetouchSettings({ ...prev, ...changes });
      setTimeout(() => handleAutoSave(next), 50);
      return next;
    });
  };

  const handleCurveChange = (key: CurveKey, val: CurvePoints) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleHealingCommit = (spots: RetouchSettings["healing_spots"]) => {
    const next = { ...settings, healing_spots: spots };
    settingsDirtyRef.current = true;
    setSettings(next);
    handleAutoSave(next);
  };

  const handleCloneCommit = (stamps: RetouchSettings["clone_stamps"]) => {
    const next = { ...settings, clone_stamps: stamps };
    settingsDirtyRef.current = true;
    setSettings(next);
    handleAutoSave(next);
  };

  const handleLiquifyCommit = (strokes: RetouchSettings["liquify_strokes"]) => {
    const next = { ...settings, liquify_strokes: strokes };
    settingsDirtyRef.current = true;
    setSettings(next);
    handleAutoSave(next);
  };

  const handleFreeTransformCommit = (points: RetouchSettings["free_transform_points"]) => {
    const next = normalizeRetouchSettings({ ...settings, free_transform_points: points });
    settingsDirtyRef.current = true;
    setSettings(next);
    handleAutoSave(next);
  };

  const handlePortraitParamChange = (key: PortraitParamKey, val: number) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  /** 切换角色即套用该人群的基线参数，随后仍可逐项微调 */
  const handleSelectRole = (nextRole: PortraitRole) => {
    setRole(nextRole);
    if (!currentAsset) return;
    settingsDirtyRef.current = true;
    setSettings((prev) => {
      const next = normalizeRetouchSettings({ ...prev, ...ROLE_PRESET_MAP[nextRole].baseline });
      setTimeout(() => handleAutoSave(next), 50);
      return next;
    });
  };

  const handleAutoSave = (snapshot?: RetouchSettings) => {
    if (!currentAsset) return;
    const s = snapshot ?? settings;
    pushHistory(s);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSaveSettings(currentAsset.id, s);
      } catch (e) {
        console.error("Auto save retouch settings failed:", e);
      }
    }, 300);
  };

  const handleExportLut = () => {
    downloadSettingsAsCube(settings, `${currentAsset ? assetTitle(currentAsset) : "reveria"}-lut.cube`);
  };

  const localMasks = useLocalMasks({
    settings,
    onChange: (next) => { settingsDirtyRef.current = true; setSettings(next); },
    onCommit: (next) => {
      settingsDirtyRef.current = true;
      setSettings(next);
      setTimeout(() => handleAutoSave(next), 50);
    },
    onActivate: () => setActiveCanvasTool("mask"),
  });
  const overlayState = useOverlays({
    settings,
    onChange: (next) => { settingsDirtyRef.current = true; setSettings(next); },
    onCommit: (next) => {
      settingsDirtyRef.current = true;
      setSettings(next);
      setTimeout(() => handleAutoSave(next), 50);
    },
    onActivate: () => { setActiveTab("overlay"); setActiveCanvasTool("overlay"); },
  });
  const [rawBusy, setRawBusy] = useState("");

  const commitBackground = (changes: Partial<RetouchSettings> = {}) => {
    const next = normalizeRetouchSettings({ ...settings, ...changes });
    settingsDirtyRef.current = true;
    setSettings(next);
    if (next.background_mode === "transparent") setExportFormat("png");
    setTimeout(() => handleAutoSave(next), 50);
  };

  const eraseTask = useEraseTask({
    asset: currentAsset,
    sourceUrl,
    masks: eraseMasks,
    intent: eraseIntent,
    onMasksClear: () => setEraseMasks([]),
    onAssetsRefresh,
  });
  const backgroundTask = useBackgroundRemoval({
    asset: currentAsset,
    settings,
    onCommit: commitBackground,
    onAssetsRefresh,
  });
  const upscaleTask = useUpscaleTask({ asset: currentAsset, onAssetsRefresh });
  const batch = useBatchExport({
    projectAssets, selectedAssetIds, settings, onSaveSettings, onLoadSettings, onExportImage,
    resolveLut,
  });

  const handleSave = async () => {
    if (!currentAsset) return;
    setIsSaving(true);
    try {
      await onSaveSettings(currentAsset.id, settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!currentAsset) return;
    setIsExporting(true);
    try {
      let dataUrl = await rendererRef.current?.exportImage(exportFormat, exportFormat === "png" ? undefined : 0.95);
      if (!dataUrl) throw new Error("无法读取渲染结果");
      if (exportFormat === "jpeg" && settings.preserve_exif) {
        try {
          dataUrl = await preserveExifInJpeg(sourceUrl, dataUrl);
        } catch (error) {
          console.warn("保留 EXIF 失败，将导出不含 EXIF 的成片:", error);
        }
      }
      if (idPhotoSpec) {
        dataUrl = await resizeDataUrl(dataUrl, {
          width: idPhotoSpec.widthPx, height: idPhotoSpec.heightPx, format: exportFormat, quality: 0.95,
        });
      }
      await onExportImage(currentAsset.id, settings, dataUrl, exportFormat);
    } finally {
      setIsExporting(false);
    }
  };

  const applyPreset = (index: number) => {
    if (!currentAsset) return;
    setActivePresetIndex(index);
    settingsDirtyRef.current = true;
    const preset = PRESET_EFFECTS[index];
    setSettings((prev) => {
      const next = { ...prev, ...preset.settings };
      setTimeout(() => handleAutoSave(next), 50);
      return next;
    });
  };

  const toggleRating = (assetId: string, star: number) => {
    setRatings(prev => ({
      ...prev,
      [assetId]: prev[assetId] === star ? 0 : star
    }));
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleSyncToSelected = async () => {
    if (await batch.applyCurrentToSelected()) setSelectedAssetIds(new Set());
  };

  const handleApplyIdPhoto = (spec: IdPhotoSpec, color: IdPhotoColor) => {
    if (!sourceUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      commitBackground({
        ...fitIdPhotoCrop(image.naturalWidth, image.naturalHeight, spec),
        background_mode: "solid",
        background_color: color.color,
      });
      setIdPhotoSpec(spec);
      setExportFormat("jpeg");
    };
    image.src = sourceUrl;
  };

  const handleRawImport = async (files: File[], applyCurrent: boolean) => {
    if (!onUpload || files.length === 0) return;
    setRawBusy(`正在转换 0/${files.length}`);
    try {
      for (let index = 0; index < files.length; index += 1) {
        setRawBusy(`正在转换 ${index + 1}/${files.length}`);
        const asset = await onUpload(files[index]);
        if (applyCurrent && asset?.id) await onSaveSettings(asset.id, settings);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "RAW 转换失败");
    } finally {
      setRawBusy("");
    }
  };

  const handleSavePreset = async () => {
    const name = window.prompt("请输入预设名称:");
    if (!name || !name.trim()) return;
    const synced = await savePreset(name.trim(), { ...settings });
    alert(synced ? `预设"${name.trim()}"已同步到账号` : `预设"${name.trim()}"已保存到本地，联网后将自动同步`);
  };

  const handleDeletePreset = async (preset: (typeof customPresets)[number]) => {
    if (!window.confirm(`确定删除预设"${preset.name}"吗？`)) return;
    try {
      await deletePreset(preset);
    } catch (error) {
      console.error("删除自定义预设失败:", error);
      alert("删除预设失败，请检查网络后重试");
    }
  };

  const handleResetSettings = () => {
    settingsDirtyRef.current = true;
    setCropDraft(null);
    setSettings(DEFAULT_SETTINGS);
    setActivePresetIndex(null);
    setTimeout(() => handleAutoSave(DEFAULT_SETTINGS), 50);
  };

  const commitGeometry = (changes: Partial<RetouchSettings>) => {
    const next = normalizeRetouchSettings({ ...settings, ...changes });
    settingsDirtyRef.current = true;
    setSettings(next);
    setTimeout(() => handleAutoSave(next), 50);
  };

  const handleRotate = () => commitGeometry({
    rotation: (Math.round(settings.rotation) + 1) % 4,
    crop_x: 0, crop_y: 0, crop_width: 1, crop_height: 1,
  });

  const handleFlipHorizontal = () => commitGeometry({
    flip_horizontal: settings.flip_horizontal ? 0 : 1,
    crop_x: 1 - settings.crop_x - settings.crop_width,
  });

  const handleFlipVertical = () => commitGeometry({
    flip_vertical: settings.flip_vertical ? 0 : 1,
    crop_y: 1 - settings.crop_y - settings.crop_height,
  });

  const renderSettings = cropDraft
    ? normalizeRetouchSettings({ ...settings, crop_x: 0, crop_y: 0, crop_width: 1, crop_height: 1 })
    : settings;

  const activeLut = resolveLut(settings.lut_file);

  useEffect(() => {
    if (activeTab !== "professional" || !currentAsset) return;
    const timer = window.setTimeout(() => setHistogram(rendererRef.current?.getHistogram() ?? null), 80);
    return () => window.clearTimeout(timer);
  }, [activeTab, currentAsset?.id, settings, showOriginal]);

  const title = currentAsset ? assetTitle(currentAsset) : "";

  return (
    <div className="asset-editor-workbench professional-dark-workspace">
      <EditorHeader
        title={title}
        hasAsset={Boolean(currentAsset)}
        isSaving={isSaving}
        isExporting={isExporting || batch.running}
        exportFormat={exportFormat}
        centerTab={centerTab}
        onCenterTabChange={(tab) => { if (!batch.running) setCenterTab(tab); }}
        onClose={onClose}
        onSave={handleSave}
        onExport={handleExport}
        onExportFormatChange={setExportFormat}
      />

      <div className="editor-body">
        <main className="editor-center-canvas">
          <CanvasToolbar
            hasAsset={Boolean(currentAsset)}
            zoomPercent={zoomPercent}
            setZoomPercent={setZoomPercent}
            settings={settings}
            cropDraft={cropDraft}
            setCropDraft={setCropDraft}
            activeCanvasTool={activeCanvasTool}
            setActiveCanvasTool={setActiveCanvasTool}
            cloneSource={cloneSource}
            setCloneSampling={setCloneSampling}
            setActiveTab={setActiveTab}
            guide={guide}
            setGuide={setGuide}
            onRotate={handleRotate}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            showOriginal={showOriginal}
            setShowOriginal={setShowOriginal}
            onReset={handleResetSettings}
          />

          {renderError && (
            <div className="canvas-render-error" role="alert">{renderError}</div>
          )}

          <div className="canvas-wrapper">
            {currentAsset ? (
              <div 
                className="canvas-interactive-container"
                style={{ transform: `scale(${zoomPercent / 100})`, transition: "transform 0.15s ease-out" }}
              >
                <RetouchRenderer
                  ref={rendererRef}
                  imageUrl={sourceUrl}
                  settings={renderSettings}
                  showOriginal={showOriginal}
                  facePoints={facePoints}
                  lut={activeLut}
                  cutoutUrl={assetUrl(settings.background_cutout_url)}
                  backgroundImageUrl={assetUrl(settings.background_image_url)}
                  selectedLocalMaskId={localMasks.selectedMaskId}
                  showLocalMaskOverlay={activeTab === "mask" && localMasks.showOverlay}
                  className={settings.background_mode === "transparent" ? "transparent-background" : undefined}
                  onError={setRenderError}
                />
                <WatermarkPreview settings={settings} hidden={showOriginal} />
                <OverlayPreview settings={settings} hidden={showOriginal} />
                <CanvasToolOverlays
                  settings={settings} cropDraft={cropDraft} setCropDraft={setCropDraft}
                  commitGeometry={commitGeometry} activeCanvasTool={activeCanvasTool}
                  setActiveCanvasTool={setActiveCanvasTool} setSettings={setSettings}
                  settingsDirtyRef={settingsDirtyRef} healingBrushSize={healingBrushSize}
                  healingStrength={healingStrength} cloneSource={cloneSource} cloneSampling={cloneSampling}
                  setCloneSource={setCloneSource} setCloneSampling={setCloneSampling}
                  liquifyTool={liquifyTool} liquifyBrushSize={liquifyBrushSize}
                  liquifyStrength={liquifyStrength} eraseMode={eraseMode} eraseBrushSize={eraseBrushSize}
                  eraseMasks={eraseMasks} setEraseMasks={setEraseMasks} localMasks={localMasks}
                  overlays={overlayState} rendererRef={rendererRef} guide={guide}
                  onHealingCommit={handleHealingCommit} onCloneCommit={handleCloneCommit}
                  onLiquifyCommit={handleLiquifyCommit} onFreeTransformCommit={handleFreeTransformCommit}
                />
              </div>
            ) : <EmptyAssetImporter onUpload={onUpload} />}
          </div>
          {batch.currentJob && (
            <BatchExportRunner
              job={batch.currentJob}
              format={batch.format}
              onComplete={batch.handleJobComplete}
              onError={batch.handleJobError}
            />
          )}
        </main>

        {centerTab === "retouch" && (
        <RetouchPresetPanel
          disabled={!currentAsset}
          activePresetIndex={activePresetIndex}
          customPresets={customPresets}
          onApplyBuiltIn={applyPreset}
          onApplyCustom={(preset) => {
            const next = normalizeRetouchSettings(preset.settings);
            settingsDirtyRef.current = true;
            setSettings(next);
            setActivePresetIndex(null);
            setTimeout(() => handleAutoSave(next), 50);
          }}
          onDeleteCustom={(preset) => void handleDeletePreset(preset)}
        />
        )}

        <aside className="editor-right-adjustments">
          <div className="adjustments-container">
            {centerTab === "raw" ? (
              <RawConvertPanel converting={Boolean(rawBusy)} progressLabel={rawBusy || "转换中…"}
                onImport={(files, applyCurrent) => { void handleRawImport(files, applyCurrent); }} />
            ) : !currentAsset ? (
              <div className="adjustments-empty-state">
                <p>请先导入照片以调节美化参数</p>
              </div>
            ) : centerTab === "batch" ? (
              <BatchToolsContent
                batch={batch} totalCount={projectAssets.length}
                hasCutout={Boolean(settings.background_cutout_url)} upscale={upscaleTask}
                onApplyIdPhoto={handleApplyIdPhoto}
                onRequestCutout={() => {
                  setCenterTab("retouch");
                  setActiveTab("background");
                  void backgroundTask.submit();
                }}
              />
            ) : (
              <>
                <EditorAdjustmentContent
                  activeTab={activeTab} asset={currentAsset} sourceUrl={sourceUrl} settings={settings}
                  facePoints={facePoints} role={role} onSelectRole={handleSelectRole}
                  onPortraitParamChange={handlePortraitParamChange} onSliderChange={handleSliderChange}
                  onCurveChange={handleCurveChange} onProfessionalChange={handleProfessionalChange}
                  onProfessionalPatch={handleProfessionalPatch}
                  onCommit={handleAutoSave} lutEntries={lutEntries} onSelectLut={handleSelectLut}
                  onImportLut={handleImportLut} onDeleteLut={deleteLut} activeCanvasTool={activeCanvasTool}
                  healingBrushSize={healingBrushSize} healingStrength={healingStrength}
                  cloneSource={cloneSource} cloneSampling={cloneSampling}
                  onHealingBrushSizeChange={setHealingBrushSize} onHealingStrengthChange={setHealingStrength}
                  onCloneSamplingChange={setCloneSampling} onHealingClear={() => handleHealingCommit([])}
                  onCloneClear={() => handleCloneCommit([])} liquifyTool={liquifyTool}
                  liquifyBrushSize={liquifyBrushSize} liquifyStrength={liquifyStrength}
                  onLiquifyToolChange={setLiquifyTool} onLiquifyBrushSizeChange={setLiquifyBrushSize}
                  onLiquifyStrengthChange={setLiquifyStrength} onLiquifyClear={() => handleLiquifyCommit([])}
                  localMasks={localMasks} onActivateMask={() => setActiveCanvasTool("mask")}
                  eraseMode={eraseMode} eraseBrushSize={eraseBrushSize} eraseIntent={eraseIntent}
                  eraseMaskCount={eraseMasks.length} onEraseModeChange={setEraseMode}
                  onEraseBrushSizeChange={setEraseBrushSize} onEraseIntentChange={setEraseIntent}
                  onEraseClear={() => { setEraseMasks([]); eraseTask.setTaskStatus(null); }} eraseTask={eraseTask}
                  backgroundTask={backgroundTask} onBackgroundChange={(changes) => {
                    settingsDirtyRef.current = true;
                    setSettings((current) => normalizeRetouchSettings({ ...current, ...changes }));
                  }} onBackgroundCommit={commitBackground} histogram={histogram}
                  onExportLut={handleExportLut} overlayState={overlayState}
                />

                <div className="adjustments-footer-actions">
                  <button className="sync-btn" disabled={!currentAsset || selectedAssetIds.size === 0} onClick={handleSyncToSelected}>
                    同步到选中图片 ({selectedAssetIds.size})
                  </button>
                  <button className="save-preset-btn" disabled={!currentAsset} onClick={handleSavePreset}>
                    保存当前预设
                  </button>
                </div>
              </>
            )}
          </div>

          {centerTab === "retouch" && (
          <EditorTabBar
            activeTab={activeTab}
            disabled={!currentAsset}
            onSelect={(tab, tool) => {
              setActiveTab(tab);
              setCropDraft(null);
              setActiveCanvasTool(tool);
            }}
          />
          )}
        </aside>
      </div>

      <AssetFilmstrip
        assets={projectAssets}
        currentAsset={currentAsset}
        selectedAssetIds={selectedAssetIds}
        ratings={ratings}
        onSelectAsset={setCurrentAsset}
        onToggleSelection={toggleAssetSelection}
        onRate={toggleRating}
      />
    </div>
  );
}
