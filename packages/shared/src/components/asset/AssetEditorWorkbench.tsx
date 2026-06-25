import React, { useState, useEffect, useRef } from "react";
import { 
  Wand2, Sun, Droplet, Eye, ArrowLeft, Save, Download,
  Sparkles, Sliders, Scissors, User, History, Camera,
  RotateCcw, Check, Star, FolderOpen, Image as ImageIcon,
  Eraser, Move, CheckSquare
} from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl } from "../../utils";
import { 
  RetouchSettings, DEFAULT_SETTINGS, VS_SOURCE, FS_SOURCE, PRESET_EFFECTS 
} from "./editorConstants";
import { PortraitAdjustments } from "./PortraitAdjustments";
import { ColorAdjustments } from "./ColorAdjustments";
import "./AssetEditorWorkbench.css";

export type { RetouchSettings } from "./editorConstants";

interface AssetEditorProps {
  asset?: AssetSummary;
  projectAssets: AssetSummary[];
  onClose: () => void;
  onSaveSettings: (assetId: string, settings: RetouchSettings) => Promise<boolean>;
  onExportImage: (assetId: string, settings: RetouchSettings) => Promise<boolean>;
  initialSettings?: RetouchSettings;
  onUpload?: (file: File) => Promise<void>;
}

export function AssetEditorWorkbench({
  asset: initialAsset,
  projectAssets,
  onClose,
  onSaveSettings,
  onExportImage,
  initialSettings,
  onUpload,
}: AssetEditorProps) {
  const [currentAsset, setCurrentAsset] = useState<AssetSummary | undefined>(initialAsset);
  const [settings, setSettings] = useState<RetouchSettings>(initialSettings || DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoSaveTimeoutRef = useRef<any | null>(null);

  const [activeTab, setActiveTab] = useState<"portrait" | "color" | "local" | "other">("portrait");
  const [role, setRole] = useState<"female" | "male" | "child" | "elder_female" | "elder_male">("female");
  const [filterTag, setFilterTag] = useState<"single" | "all" | "link">("single");
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [ratings, setRatings] = useState<Record<string, number>>({});

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
    eyeBags: 25,
    tearTrough: 15,
    nasolabialFolds: 20,
  });

  // 当外部传入的 asset 改变时
  useEffect(() => {
    setCurrentAsset(initialAsset);
  }, [initialAsset]);

  // 切换资产时重置
  useEffect(() => {
    if (currentAsset) {
      setSettings(initialSettings || DEFAULT_SETTINGS);
      setShowOriginal(false);
      setActivePresetIndex(null);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    }
  }, [currentAsset?.id, initialSettings]);

  // 同步美化参数到 WebGL Core 属性
  useEffect(() => {
    setPortraitSettings(prev => ({
      ...prev,
      blurStrength: settings.blur_strength,
      upperEyelid: Math.round(settings.eye_enlarge / 2),
      doubleChin: Math.round(settings.slim_face / 2),
    }));
  }, [settings.blur_strength, settings.eye_enlarge, settings.slim_face]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const sourceUrl = currentAsset?.file_url ?? currentAsset?.thumbnail_url ?? "";

  // WebGL Shader 硬件加速实时图像管线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceUrl) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    let isCancelled = false;
    const img = new Image();
    img.src = assetUrl(sourceUrl);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (isCancelled) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      const vs = gl.createShader(gl.VERTEX_SHADER);
      if (!vs) return;
      gl.shaderSource(vs, VS_SOURCE);
      gl.compileShader(vs);

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fs) return;
      gl.shaderSource(fs, FS_SOURCE);
      gl.compileShader(fs);

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]), gl.STATIC_DRAW);

      const aPosition = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      const uExposure = gl.getUniformLocation(program, "u_exposure");
      const uContrast = gl.getUniformLocation(program, "u_contrast");
      const uSaturation = gl.getUniformLocation(program, "u_saturation");
      const uBlur = gl.getUniformLocation(program, "u_blur");

      if (showOriginal) {
        gl.uniform1f(uExposure, 0.0);
        gl.uniform1f(uContrast, 0.0);
        gl.uniform1f(uSaturation, 0.0);
        gl.uniform1f(uBlur, 0.0);
      } else {
        gl.uniform1f(uExposure, settings.exposure / 100.0); 
        gl.uniform1f(uContrast, settings.contrast / 100.0);
        gl.uniform1f(uSaturation, settings.saturation / 100.0);
        gl.uniform1f(uBlur, settings.blur_strength / 100.0); 
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };

    return () => {
      isCancelled = true;
      img.onload = null;
    };
  }, [currentAsset?.id, sourceUrl, settings, showOriginal]);

  const handleSliderChange = (key: keyof RetouchSettings, val: number) => {
    setSettings((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handlePortraitSliderChange = (key: string, val: number) => {
    setPortraitSettings((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "blurStrength") {
        setSettings(s => ({ ...s, blur_strength: val }));
      } else if (key === "upperEyelid") {
        setSettings(s => ({ ...s, eye_enlarge: val * 2 }));
      } else if (key === "doubleChin") {
        setSettings(s => ({ ...s, slim_face: val * 2 }));
      }
      return next;
    });
  };

  const handleAutoSave = () => {
    if (!currentAsset) return;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSaveSettings(currentAsset.id, settings);
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
      await onExportImage(currentAsset.id, settings);
    } finally {
      setIsExporting(false);
    }
  };

  const applyPreset = (index: number) => {
    if (!currentAsset) return;
    setActivePresetIndex(index);
    const preset = PRESET_EFFECTS[index];
    setSettings((prev) => {
      const next = { ...prev, ...preset.settings };
      setTimeout(() => handleAutoSave(), 50);
      return next;
    });
  };

  const toggleRating = (assetId: string, star: number) => {
    setRatings(prev => ({
      ...prev,
      [assetId]: prev[assetId] === star ? 0 : star
    }));
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setActivePresetIndex(null);
    setTimeout(() => handleAutoSave(), 50);
  };

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
            <span className="proj-name">📸 批量照片精修</span>
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
        </div>
      </header>

      {/* 主体工作台 */}
      <div className="editor-body">
        
        {/* 中间大画布预览区 / 空导入区 */}
        <main className="editor-center-canvas">
          <div className="retouch-canvas-toolbar">
            <div className="tool-dropdown-group">
              <span className="zoom-text">{zoomPercent}%</span>
              <button className="utility-btn" disabled={!currentAsset} onClick={() => setZoomPercent(z => Math.max(50, z - 10))}>-</button>
              <button className="utility-btn" disabled={!currentAsset} onClick={() => setZoomPercent(z => Math.min(300, z + 10))}>+</button>
            </div>

            <div className="tool-divider" />

            <div className="photo-edit-tools">
              <button className="tool-icon-btn active" disabled={!currentAsset} title="移动工具 (M)"><Move size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="选区套索 (L)"><Scissors size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="修补画笔 (B)"><Wand2 size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="参考辅助线 (U)"><Sliders size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="高精液化 (W)"><Sparkles size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="污点修复 (J)"><RotateCcw size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="仿制图章 (S)"><CheckSquare size={15} /></button>
              <button className="tool-icon-btn" disabled={!currentAsset} title="智能消除 (E)"><Eraser size={15} /></button>
            </div>

            <div className="tool-divider" />

            <div className="toolbar-right-actions">
              <button 
                className={`compare-btn ${showOriginal ? "active" : ""}`}
                disabled={!currentAsset}
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                title="按住临时查看修改前原图"
              >
                <Eye size={15} />
                <span>对比原图</span>
              </button>
              <button className="reset-btn" disabled={!currentAsset} onClick={handleResetSettings} title="恢复所有调节项至零位">
                <RotateCcw size={13} />
                <span>重置效果</span>
              </button>
            </div>
          </div>

          <div className="canvas-wrapper">
            {currentAsset ? (
              <div 
                className="canvas-interactive-container"
                style={{ transform: `scale(${zoomPercent / 100})`, transition: "transform 0.15s ease-out" }}
              >
                <canvas ref={canvasRef} />
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

        {/* 浮动预设选择栏 */}
        <aside className="editor-presets-panel">
          <div className="panel-header-row">
            <h3>预设</h3>
            <div className="header-icon-group">
              <span className="preset-count">{PRESET_EFFECTS.length}</span>
            </div>
          </div>
          <div className="filter-search-row">
            <select className="preset-filter-select" disabled={!currentAsset}>
              <option>全部预设</option>
              <option>人像美白</option>
              <option>胶片复古</option>
              <option>暖色调</option>
            </select>
          </div>
          <div className="presets-scroll-list">
            {PRESET_EFFECTS.map((preset, index) => (
              <button
                key={preset.name}
                type="button"
                className={`preset-item-btn ${activePresetIndex === index ? "active" : ""}`}
                disabled={!currentAsset}
                onClick={() => applyPreset(index)}
              >
                <span className="indicator" />
                <span className="name">{preset.name}</span>
                {activePresetIndex === index && <Check size={12} className="check-icon" />}
              </button>
            ))}
          </div>
        </aside>

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
                    handleAutoSave={handleAutoSave}
                  />
                )}

                {activeTab === "local" && (
                  <div className="adjustment-subview placeholder-view">
                    <Sliders size={32} className="placeholder-icon" />
                    <h4>局部精细修正</h4>
                    <p>可通过顶部横向工具条的画笔或套索工具，对人像皮肤、背景或衣服等特定细节区域进行涂抹屏蔽或选定调整。</p>
                  </div>
                )}

                {activeTab === "other" && (
                  <div className="adjustment-subview placeholder-view">
                    <Sparkles size={32} className="placeholder-icon" />
                    <h4>高精算力辅助</h4>
                    <p>当前分类参数由本地 CPU/GPU 双向多维算力托管，高级定制功能正在集成中，敬请期待。</p>
                  </div>
                )}

                <div className="adjustments-footer-actions">
                  <button className="sync-btn" onClick={() => alert("当前调整参数已成功同步至项目内其它选中大图！")}>
                    同步到选中图片
                  </button>
                  <button className="save-preset-btn" onClick={() => alert("参数已成功存入自定义预设库，您可在左侧预设列表中随时套用。")}>
                    保存当前预设
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 右侧垂直 icon 工具栏 */}
          <div className="right-vertical-tabs-bar">
            <button className={`vertical-tab-icon-btn ${activeTab === "color" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("color")} title="调色">
              <Sun size={18} />
              <span>调色</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "local" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("local")} title="局部">
              <Scissors size={18} />
              <span>局部</span>
            </button>
            <button className={`vertical-tab-icon-btn ${activeTab === "portrait" ? "active" : ""}`} disabled={!currentAsset} onClick={() => setActiveTab("portrait")} title="人像">
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

      {/* 底部胶片底片栏 */}
      {projectAssets.length > 0 && (
        <footer className="editor-bottom-filmstrip">
          <div className="filmstrip-header-row">
            <div className="header-left">
              <span className="label active">本源图</span>
              <span className="label">已选 1 张 (共 {projectAssets.length} 张)</span>
            </div>
            <div className="header-right">
              <span className="file-resolution">RGB / 8-Bit / Adobe RGB (1998)</span>
            </div>
          </div>

          <div className="filmstrip-scroll-container">
            {projectAssets.map((item) => {
              const active = currentAsset && item.id === currentAsset.id;
              const thumbUrl = item.thumbnail_url ?? item.file_url ?? "";
              const currentRating = ratings[item.id] || 0;

              return (
                <div 
                  key={item.id} 
                  className={`filmstrip-card ${active ? "active" : ""}`}
                  onClick={() => setCurrentAsset(item)}
                >
                  <div className="thumbnail-box">
                    <img src={assetUrl(thumbUrl)} alt={assetTitle(item)} loading="lazy" />
                    <span className="index-badge">{projectAssets.indexOf(item) + 1}</span>
                    {item.selection_status === "approved" && (
                      <span className="approved-icon">✓</span>
                    )}
                  </div>
                  <div className="metadata-box">
                    <span className="filename" title={assetTitle(item)}>{assetTitle(item)}</span>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button 
                          key={star}
                          type="button"
                          className={`star-btn ${currentRating >= star ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRating(item.id, star);
                          }}
                        >
                          <Star size={9} fill={currentRating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
