import React, { useState, useEffect, useRef } from "react";
import { RetouchRenderer, RetouchRendererHandle } from "./RetouchRenderer";
import {
  Wand2, Sun, Droplet, Eye, ArrowLeft, Save, Download,
  Sparkles, Sliders, Scissors, User, History, Camera,
  RotateCcw, FolderOpen, Image as ImageIcon,
  Eraser, Move, CheckSquare
} from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl } from "../../utils";
import { detectFacePoints, FacePoints } from "../../utils/faceMesh";
import {
  RetouchSettings, DEFAULT_SETTINGS, PRESET_EFFECTS, normalizeRetouchSettings,
  type CurveKey, type CurvePoints
} from "./editorConstants";
import { PortraitAdjustments } from "./PortraitAdjustments";
import { ColorAdjustments } from "./ColorAdjustments";
import { useRetouchPresets } from "./useRetouchPresets";
import { CropOverlay, CropRect } from "./CropOverlay";
import { CanvasToolbar } from "./CanvasToolbar";
import { RetouchPresetPanel } from "./RetouchPresetPanel";
import { HealingBrushOverlay } from "./HealingBrushOverlay";
import { LocalHealingPanel } from "./LocalHealingPanel";
import { CloneStampOverlay } from "./CloneStampOverlay";
import { CloneStampPanel } from "./CloneStampPanel";
import { AssetFilmstrip } from "./AssetFilmstrip";
import "./AssetEditorWorkbench.css";

export type { RetouchSettings } from "./editorConstants";

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
    format: "jpeg" | "png",
  ) => Promise<boolean>;
  initialSettings?: RetouchSettings;
  onUpload?: (file: File) => Promise<void>;
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
}: AssetEditorProps) {
  const [currentAsset, setCurrentAsset] = useState<AssetSummary | undefined>(initialAsset);
  const [settings, setSettings] = useState<RetouchSettings>(normalizeRetouchSettings(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const autoSaveTimeoutRef = useRef<any | null>(null);
  const settingsDirtyRef = useRef(false);
  const explicitInitialAssetIdRef = useRef(initialAsset?.id);
  const explicitInitialConsumedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<"portrait" | "color" | "local" | "other">("portrait");
  const [role, setRole] = useState<"female" | "male" | "child" | "elder_female" | "elder_male">("female");
  const [filterTag, setFilterTag] = useState<"single" | "all" | "link">("single");
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const { presets: customPresets, savePreset, deletePreset } = useRetouchPresets();
  const historyRef = useRef<RetouchSettings[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [facePoints, setFacePoints] = useState<FacePoints | null>(null);
  const [exportFormat, setExportFormat] = useState<"jpeg" | "png">("jpeg");
  const [cropDraft, setCropDraft] = useState<CropRect | null>(null);
  const [activeCanvasTool, setActiveCanvasTool] = useState<"move" | "healing" | "clone">("move");
  const [healingBrushSize, setHealingBrushSize] = useState(32);
  const [healingStrength, setHealingStrength] = useState(80);
  const [cloneSource, setCloneSource] = useState<{ x: number; y: number } | null>(null);
  const [cloneSampling, setCloneSampling] = useState(true);
  const rendererRef = useRef<RetouchRendererHandle>(null);

  const [portraitSettings, setPortraitSettings] = useState({
    flatness: 35,
    blurStrength: 50,
    texture: 40,
    removeShine: 20,
    yellowForehead: 10,
    darkCircles: 30,
    darkNose: 15,
    removeNostril: 5,
    blushFlat: 25,
    doubleChin: 15,
    chinCrease: 10,
    wrinkles: 20,
    neckLines: 25,
    facialNoise: 15,
    boneShape: 20,
    hairVolume: 30,
    foreheadWidth: 10,
    cheekboneHeight: 15,
    midBone: 10,
    upperEyelid: 20,
    eyeBrighten: 0,
    eyeBags: 25,
    tearTrough: 15,
    nasolabialFolds: 20,
    skinWhiten: 0,
  });

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
      setCloneSource(null);
      setCloneSampling(true);
      setActivePresetIndex(null);
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

  // 同步美化参数到 WebGL Core 属性
  useEffect(() => {
    setPortraitSettings(prev => ({
      ...prev,
      blurStrength: settings.blur_strength,
      upperEyelid: Math.round(settings.eye_enlarge / 2),
      eyeBrighten: settings.eye_brighten,
      doubleChin: Math.round(settings.slim_face / 2),
    }));
  }, [settings.blur_strength, settings.eye_enlarge, settings.eye_brighten, settings.slim_face]);

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

  const handleSliderChange = (key: keyof RetouchSettings, val: number) => {
    settingsDirtyRef.current = true;
    setSettings((prev) => ({
      ...prev,
      [key]: val,
    }));
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

  const handlePortraitSliderChange = (key: string, val: number) => {
    settingsDirtyRef.current = true;
    setPortraitSettings((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "blurStrength") {
        setSettings(s => ({ ...s, blur_strength: val }));
      } else if (key === "upperEyelid") {
        setSettings(s => ({ ...s, eye_enlarge: val * 2 }));
      } else if (key === "doubleChin") {
        setSettings(s => ({ ...s, slim_face: val * 2 }));
      } else if (key === "skinWhiten") {
        setSettings(s => ({ ...s, skin_whiten: val }));
      } else if (key === "eyeBrighten") {
        setSettings(s => ({ ...s, eye_brighten: val }));
      }
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
      const dataUrl = rendererRef.current?.exportImage(exportFormat, exportFormat === "jpeg" ? 0.95 : undefined);
      if (!dataUrl) throw new Error("无法读取渲染结果");
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
    if (!currentAsset || selectedAssetIds.size === 0) {
      alert("请先勾选需要同步的图片");
      return;
    }
    const confirmed = window.confirm(`确定将当前调整参数同步到已选中的 ${selectedAssetIds.size} 张图片吗？`);
    if (!confirmed) return;

    try {
      for (const assetId of selectedAssetIds) {
        await onSaveSettings(assetId, settings);
      }
      alert(`已成功同步参数到 ${selectedAssetIds.size} 张图片`);
      setSelectedAssetIds(new Set());
    } catch (e) {
      console.error("同步失败:", e);
      alert("同步失败，请重试");
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

  const title = currentAsset ? assetTitle(currentAsset) : "";

  return (
    <div className="asset-editor-workbench professional-dark-workspace">
      {/* 顶部专业工具条 */}
      <header className="editor-header">
        <div className="header-left-side">
          <button className="back-btn" onClick={onClose}>
            <ArrowLeft size={16} />
          </button>
          <div className="breadcrumb-path">
            <span className="proj-name">批量照片精修</span>
            <span className="separator">&gt;</span>
            <span className="file-name" title={title || "导入图片"}>{title || "未导入图片"}</span>
          </div>
        </div>

        <div className="header-center-tabs">
          <button className="center-tab active">图像精修</button>
          <button className="center-tab">RAW转片</button>
          <button className="center-tab">批量导出</button>
        </div>

        <div className="editor-action-area">
          <button className="btn-save" disabled={isSaving || !currentAsset} onClick={handleSave}>
            <Save size={14} />
            {isSaving ? "同步中..." : "保存参数"}
          </button>
          <button className="btn-export" disabled={isExporting || !currentAsset} onClick={handleExport}>
            <Download size={14} />
            {isExporting ? "导出中..." : "导出"}
          </button>
          <select
            className="export-format-select"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as "jpeg" | "png")}
            disabled={!currentAsset}
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
      </header>

      {/* 主体工作台 */}
      <div className="editor-body">
        
        {/* 中间大画布预览区 / 空导入区 */}
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
                />
                {cropDraft && (
                  <CropOverlay
                    value={cropDraft}
                    onChange={setCropDraft}
                    onCancel={() => setCropDraft(null)}
                    onApply={() => {
                      commitGeometry({
                        crop_x: cropDraft.x,
                        crop_y: cropDraft.y,
                        crop_width: cropDraft.width,
                        crop_height: cropDraft.height,
                      });
                      setCropDraft(null);
                    }}
                  />
                )}
                {activeCanvasTool === "healing" && !cropDraft && (
                  <HealingBrushOverlay
                    settings={settings}
                    brushSize={healingBrushSize}
                    strength={healingStrength}
                    onChange={(spots) => {
                      settingsDirtyRef.current = true;
                      setSettings((current) => ({ ...current, healing_spots: spots }));
                    }}
                    onCommit={handleHealingCommit}
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
                    onCommit={handleCloneCommit}
                  />
                )}
              </div>
            ) : (
              <div className="retouch-empty-import-container">
                <div className="import-cards-grid">
                  <div className="import-card" onClick={() => document.getElementById("file-import-input")?.click()}>
                    <div className="import-icon-container">
                      <ImageIcon size={48} className="import-icon" />
                    </div>
                    <span className="import-label">导入图片</span>
                    <input
                      type="file"
                      id="file-import-input"
                      multiple
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        if (e.target.files && onUpload) {
                          for (let i = 0; i < e.target.files.length; i++) {
                            await onUpload(e.target.files[i]);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="import-card" onClick={() => document.getElementById("folder-import-input")?.click()}>
                    <div className="import-icon-container">
                      <FolderOpen size={48} className="import-icon" />
                    </div>
                    <span className="import-label">导入整个目录</span>
                    <input
                      type="file"
                      id="folder-import-input"
                      {...({ webkitdirectory: "", directory: "" } as any)}
                      multiple
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        if (e.target.files && onUpload) {
                          for (let i = 0; i < e.target.files.length; i++) {
                            await onUpload(e.target.files[i]);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

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

        {/* 右侧边栏：参数调节 */}
        <aside className="editor-right-adjustments">
          <div className="adjustments-container">
            {!currentAsset ? (
              <div className="adjustments-empty-state">
                <p>请先导入照片以调节美化参数</p>
              </div>
            ) : (
              <>
                {activeTab === "portrait" && (
                  <PortraitAdjustments
                    role={role}
                    setRole={setRole}
                    filterTag={filterTag}
                    setFilterTag={setFilterTag}
                    portraitSettings={portraitSettings}
                    handlePortraitSliderChange={handlePortraitSliderChange}
                    handleAutoSave={handleAutoSave}
                  />
                )}

                {activeTab === "color" && (
                  <ColorAdjustments
                    settings={settings}
                    handleSliderChange={handleSliderChange}
                    handleCurveChange={handleCurveChange}
                    handleAutoSave={handleAutoSave}
                  />
                )}

                {activeTab === "local" && (
                  activeCanvasTool === "clone" ? (
                    <CloneStampPanel brushSize={healingBrushSize} strength={healingStrength}
                      stampCount={settings.clone_stamps.length} hasSource={cloneSource !== null} samplingSource={cloneSampling}
                      onBrushSizeChange={setHealingBrushSize} onStrengthChange={setHealingStrength}
                      onSample={() => setCloneSampling(true)} onClear={() => handleCloneCommit([])} />
                  ) : (
                    <LocalHealingPanel brushSize={healingBrushSize} strength={healingStrength}
                      spotCount={settings.healing_spots.length} onBrushSizeChange={setHealingBrushSize}
                      onStrengthChange={setHealingStrength} onClear={() => handleHealingCommit([])} />
                  )
                )}

                {activeTab === "other" && (
                  <div className="adjustment-subview placeholder-view">
                    <Sparkles size={32} className="placeholder-icon" />
                    <h4>高精算力辅助</h4>
                    <p>当前分类参数由本地 CPU/GPU 双向多维算力托管，高级定制功能正在集成中，敬请期待。</p>
                  </div>
                )}

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

          {/* 右侧垂直 icon 工具栏 */}
          <div className="right-vertical-tabs-bar">
            <button className={`vertical-tab-icon-btn ${activeTab === "color" ? "active" : ""}`} disabled={!currentAsset} onClick={() => { setActiveTab("color"); setActiveCanvasTool("move"); }} title="调色">
              <Sun size={18} />
              <span>调色</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "local" ? "active" : ""}`} disabled={!currentAsset} onClick={() => { setActiveTab("local"); setCropDraft(null); setActiveCanvasTool("healing"); }} title="局部">
              <Scissors size={18} />
              <span>局部</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "portrait" ? "active" : ""}`} disabled={!currentAsset} onClick={() => { setActiveTab("portrait"); setActiveCanvasTool("move"); }} title="人像">
              <User size={18} />
              <span>人像</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "other" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("other")} title="背景">
              <ImageIcon size={18} />
              <span>背景</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "other" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("other")} title="抠图">
              <Wand2 size={18} />
              <span>抠图</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "other" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("other")} title="衣物">
              <Sliders size={18} />
              <span>衣物</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "other" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("other")} title="历史">
              <History size={18} />
              <span>历史</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "other" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("other")} title="联机">
              <Camera size={18} />
              <span>联机</span>
            </button>
          </div>
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
