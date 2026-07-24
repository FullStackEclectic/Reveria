import React, { useState } from "react";
import { SliderItem } from "./SliderItem";
import { Link2, ChevronRight, ChevronDown, HelpCircle } from "lucide-react";

interface PortraitAdjustmentsProps {
  role: "female" | "male" | "child" | "elder_female" | "elder_male";
  setRole: (role: "female" | "male" | "child" | "elder_female" | "elder_male") => void;
  filterTag: "single" | "all" | "link";
  setFilterTag: (tag: "single" | "all" | "link") => void;
  portraitSettings: any;
  handlePortraitSliderChange: (key: string, val: number) => void;
  handleAutoSave: () => void;
}

export function PortraitAdjustments({
  role,
  setRole,
  filterTag,
  setFilterTag,
  portraitSettings,
  handlePortraitSliderChange,
  handleAutoSave,
}: PortraitAdjustmentsProps) {
  // 记录当前展开的手风琴组，默认展开祛除瑕疵
  const [expandedGroup, setExpandedGroup] = useState<string | null>("blemish");

  // 1. 面部祛瑕疵局部状态
  const [showAcneDetails, setShowAcneDetails] = useState(false);
  const [acneVal, setAcneVal] = useState(100);
  const [spotVal, setSpotVal] = useState(100);
  const [textureKeepVal, setTextureKeepVal] = useState(0);
  const acneBaseVal = 0;

  const [removeMole, setRemoveMole] = useState(false);
  const [shineRemove, setShineRemove] = useState(0);
  const [darkCirclesVal, setDarkCirclesVal] = useState(0);
  const [noseFlaw, setNoseFlaw] = useState(0);
  const [lipWrinkles, setLipWrinkles] = useState(0);

  const [showDoubleChinDetails, setShowDoubleChinDetails] = useState(false);
  const [doubleChinDegree, setDoubleChinDegree] = useState(90);
  const [doubleChinShadow, setDoubleChinShadow] = useState(80);
  const doubleChinBaseVal = 0;

  const [jawlineEnhance, setJawlineEnhance] = useState(0);
  const [neckWrinkles, setNeckWrinkles] = useState(0);
  const [protectBeard, setProtectBeard] = useState(false);
  const [protectMakeup, setProtectMakeup] = useState(false);

  // 2. 面部祛纹状态
  const [foreheadWrinkles, setForeheadWrinkles] = useState(0);
  const [frownWrinkles, setFrownWrinkles] = useState(0);
  const [eyeWrinkles, setEyeWrinkles] = useState(0);
  const [noseWrinkles, setNoseWrinkles] = useState(0);
  const [nasolabialLeft, setNasolabialLeft] = useState(0);
  const [nasolabialRight, setNasolabialRight] = useState(0);
  const [nasolabialLinked, setNasolabialLinked] = useState(true);
  const [cheekWrinkles, setCheekWrinkles] = useState(0);
  const [marionetteWrinkles, setMarionetteWrinkles] = useState(0);
  const [mouthWrinkles, setMouthWrinkles] = useState(0);

  // 3. 身体祛瑕疵
  const [bodyFlaw, setBodyFlaw] = useState(0);
  const [removeAccessoryBreast, setRemoveAccessoryBreast] = useState(0);
  const [removeTattoo, setRemoveTattoo] = useState(false);

  const toggleGroup = (group: string) => {
    setExpandedGroup(expandedGroup === group ? null : group);
  };

  // 定义 10 个手风琴组元数据
  const groups = [
    { id: "blemish", name: "祛除瑕疵", hasNew: true, hasScale: false },
    { id: "skin", name: "皮肤调整", hasNew: true, hasScale: false },
    { id: "reshape", name: "面部重塑", hasNew: true, hasScale: false },
    { id: "expression", name: "表情管理", hasNew: true, hasScale: false },
    { id: "teeth", name: "牙齿美化", hasNew: false, hasScale: false },
    { id: "eye", name: "眼睛增强", hasNew: true, hasScale: false },
    { id: "makeup", name: "妆容调整", hasNew: true, hasScale: false },
    { id: "hair", name: "头发调整", hasNew: false, hasScale: false },
    { id: "hand", name: "手部美化", hasNew: true, hasScale: false },
    { id: "body", name: "全身美型", hasNew: true, hasScale: false, hasHelp: true },
  ];

  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">人像美化</div>

      {/* 性别角色选择 Tabs */}
      <div className="role-select-tabs">
        <button className={`role-tab ${role === "female" ? "active" : ""}`} onClick={() => setRole("female")}>女</button>
        <button className={`role-tab ${role === "male" ? "active" : ""}`} onClick={() => setRole("male")}>男</button>
        <button className={`role-tab ${role === "child" ? "active" : ""}`} onClick={() => setRole("child")}>儿童</button>
        <button className={`role-tab ${role === "elder_female" ? "active" : ""}`} onClick={() => setRole("elder_female")}>长辈女</button>
        <button className={`role-tab ${role === "elder_male" ? "active" : ""}`} onClick={() => setRole("elder_male")}>长辈男</button>
      </div>

      {/* 过滤标签 */}
      <div className="tags-row-select">
        <button className={`tag-select-btn ${filterTag === "single" ? "active" : ""}`} onClick={() => setFilterTag("single")}>单人</button>
        <button className={`tag-select-btn ${filterTag === "all" ? "active" : ""}`} onClick={() => setFilterTag("all")}>所有人</button>
        <button className={`tag-select-btn ${filterTag === "link" ? "active" : ""}`} onClick={() => setFilterTag("link")}>
          <Link2 size={12} style={{ display: "inline-block", verticalAlign: "middle" }} />
        </button>
      </div>

      {/* 手风琴列表 */}
      <div className="portrait-accordion-list">
        {groups.map((g) => {
          const isOpen = expandedGroup === g.id;
          return (
            <div key={g.id} className="accordion-item">
              <button 
                type="button" 
                className={`accordion-header-btn ${isOpen ? "open" : ""}`}
                onClick={() => toggleGroup(g.id)}
              >
                <div className="header-left">
                  <span className="arrow-icon">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="group-name">{g.name}</span>
                  {g.hasHelp && <HelpCircle size={12} className="help-icon" />}
                  {g.hasNew && <span className="new-badge">New</span>}
                </div>
                <div className="header-right">
                  {g.hasScale && (
                    <span className="scale-indicator-dot">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="accordion-content">
                  {/* 根据组 id 渲染滑块 */}
                  {g.id === "blemish" && (
                    <div className="blemish-sub-panel" style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                      
                      {/* 1. 面部祛瑕疵 */}
                      <div className="sub-group-title">面部祛瑕疵</div>
                      
                      {/* 祛斑祛痘 */}
                      <div className="slider-item-with-details">
                        <div className="slider-label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>祛斑祛痘</span>
                          <button 
                            type="button" 
                            className="detail-toggle-btn"
                            onClick={() => setShowAcneDetails(!showAcneDetails)}
                          >
                            <span>{acneBaseVal}</span>
                            <span className="arrow-small" style={{ marginLeft: "4px" }}>{showAcneDetails ? "▲" : "▼"}</span>
                          </button>
                        </div>
                        {showAcneDetails && (
                          <div className="nested-sliders-box">
                            <div className="slider-item nested">
                              <div className="slider-label">
                                <span>祛痘</span>
                                <span className="value">{acneVal}</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={acneVal}
                                onChange={(e) => setAcneVal(Number(e.target.value))}
                              />
                            </div>
                            <div className="slider-item nested">
                              <div className="slider-label">
                                <span>祛斑</span>
                                <span className="value">{spotVal}</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={spotVal}
                                onChange={(e) => setSpotVal(Number(e.target.value))}
                              />
                            </div>
                            <div className="slider-item nested">
                              <div className="slider-label">
                                <span>质感保留</span>
                                <span className="value">{textureKeepVal}</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={textureKeepVal}
                                onChange={(e) => setTextureKeepVal(Number(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 祛痣 */}
                      <div className="switch-item-row">
                        <span>祛痣</span>
                        <label className="switch-toggle">
                          <input 
                            type="checkbox" 
                            checked={removeMole} 
                            onChange={(e) => setRemoveMole(e.target.checked)} 
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      {/* 祛油光 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛油光 (脸部)</span>
                          <span className="value">{shineRemove}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={shineRemove}
                          onChange={(e) => setShineRemove(Number(e.target.value))}
                        />
                      </div>

                      {/* 祛黑眼圈 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span className="help-icon-wrapper">
                            <span>祛黑眼圈</span>
                            <HelpCircle size={11} className="label-help" />
                          </span>
                          <span className="value">{darkCirclesVal}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={darkCirclesVal}
                          onChange={(e) => setDarkCirclesVal(Number(e.target.value))}
                        />
                      </div>

                      {/* 祛眼袋 */}
                      <div className="slider-item">
                        <div className="slider-label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#71717a" }}>祛眼袋</span>
                          <span className="value-with-arrow" style={{ fontSize: "11px", color: "#71717a" }}>0 ▸</span>
                        </div>
                        <input type="range" min="0" max="100" value={0} disabled style={{ opacity: 0.3 }} />
                      </div>

                      {/* 祛鼻孔瑕疵 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span className="highlight-dot-label">
                            <span>祛鼻孔瑕疵</span>
                            <span className="new-badge-small">New</span>
                          </span>
                          <span className="value">{noseFlaw}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={noseFlaw}
                          onChange={(e) => setNoseFlaw(Number(e.target.value))}
                        />
                      </div>

                      {/* 唇纹修整 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span>唇纹修整</span>
                          <span className="value">{lipWrinkles}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={lipWrinkles}
                          onChange={(e) => setLipWrinkles(Number(e.target.value))}
                        />
                      </div>

                      {/* 祛双下巴 */}
                      <div className="slider-item-with-details">
                        <div className="slider-label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="help-icon-wrapper">
                            <span>祛双下巴</span>
                            <HelpCircle size={11} className="label-help" />
                          </span>
                          <button 
                            type="button" 
                            className="detail-toggle-btn"
                            onClick={() => setShowDoubleChinDetails(!showDoubleChinDetails)}
                          >
                            <span>{doubleChinBaseVal}</span>
                            <span className="arrow-small" style={{ marginLeft: "4px" }}>{showDoubleChinDetails ? "▲" : "▼"}</span>
                          </button>
                        </div>
                        {showDoubleChinDetails && (
                          <div className="nested-sliders-box">
                            <div className="slider-item nested">
                              <div className="slider-label">
                                <span>祛除程度</span>
                                <span className="value">{doubleChinDegree}</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={doubleChinDegree}
                                onChange={(e) => {
                                  setDoubleChinDegree(Number(e.target.value));
                                  // 同步至 WebGL 核心双下巴/瘦脸属性
                                  handlePortraitSliderChange("doubleChin", Math.round(Number(e.target.value) / 2));
                                }}
                                onMouseUp={handleAutoSave}
                              />
                            </div>
                            <div className="slider-item nested">
                              <div className="slider-label">
                                <span>阴影程度</span>
                                <span className="value">{doubleChinShadow}</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" 
                                value={doubleChinShadow}
                                onChange={(e) => setDoubleChinShadow(Number(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 下颌线增强 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span className="highlight-dot-label">
                            <span>下颌线增强</span>
                            <span className="new-badge-small">New</span>
                          </span>
                          <span className="value">{jawlineEnhance}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={jawlineEnhance}
                          onChange={(e) => setJawlineEnhance(Number(e.target.value))}
                        />
                      </div>

                      {/* 祛胡须 */}
                      <div className="slider-item">
                        <div className="slider-label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="help-icon-wrapper">
                            <span>祛胡须</span>
                            <HelpCircle size={11} className="label-help" />
                          </span>
                          <span className="value-with-arrow" style={{ fontSize: "11px", color: "#71717a" }}>0 ▸</span>
                        </div>
                        <input type="range" min="0" max="100" value={0} disabled style={{ opacity: 0.3 }} />
                      </div>

                      {/* 祛颈纹 */}
                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛颈纹</span>
                          <span className="value">{neckWrinkles}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" 
                          value={neckWrinkles}
                          onChange={(e) => setNeckWrinkles(Number(e.target.value))}
                        />
                      </div>

                      {/* 胡型保护 */}
                      <div className="switch-item-row">
                        <span className="help-icon-wrapper">
                          <span>胡型保护</span>
                          <HelpCircle size={11} className="label-help" />
                        </span>
                        <label className="switch-toggle">
                          <input 
                            type="checkbox" 
                            checked={protectBeard} 
                            onChange={(e) => setProtectBeard(e.target.checked)} 
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      {/* 妆容保护 */}
                      <div className="switch-item-row">
                        <span className="help-icon-wrapper">
                          <span>妆容保护</span>
                          <HelpCircle size={11} className="label-help" />
                        </span>
                        <label className="switch-toggle">
                          <input 
                            type="checkbox" 
                            checked={protectMakeup} 
                            onChange={(e) => setProtectMakeup(e.target.checked)} 
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      {/* 2. 面部祛纹 */}
                      <div className="sub-group-title" style={{ marginTop: "20px" }}>面部祛纹</div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛抬头纹</span>
                          <span className="value">{foreheadWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={foreheadWrinkles} onChange={(e) => setForeheadWrinkles(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛川字纹</span>
                          <span className="value">{frownWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={frownWrinkles} onChange={(e) => setFrownWrinkles(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛眼周纹</span>
                          <span className="value">{eyeWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={eyeWrinkles} onChange={(e) => setEyeWrinkles(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛鼻背纹</span>
                          <span className="value">{noseWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={noseWrinkles} onChange={(e) => setNoseWrinkles(Number(e.target.value))} />
                      </div>

                      {/* 祛法令纹 (双通道并排滑块加链接按钮) */}
                      <div className="double-slider-item">
                        <div className="double-slider-label">
                          <span>祛法令纹</span>
                        </div>
                        <div className="double-slider-container">
                          <div className="side-slider">
                            <span className="side-label">左</span>
                            <span className="side-value">{nasolabialLeft}</span>
                            <input 
                              type="range" min="0" max="100" 
                              value={nasolabialLeft}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setNasolabialLeft(val);
                                if (nasolabialLinked) setNasolabialRight(val);
                              }}
                            />
                          </div>
                          
                          <button 
                            type="button" 
                            className={`link-btn-toggle ${nasolabialLinked ? "active" : ""}`}
                            onClick={() => setNasolabialLinked(!nasolabialLinked)}
                          >
                            <Link2 size={12} />
                          </button>

                          <div className="side-slider">
                            <span className="side-label">右</span>
                            <span className="side-value">{nasolabialRight}</span>
                            <input 
                              type="range" min="0" max="100" 
                              value={nasolabialRight}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setNasolabialRight(val);
                                if (nasolabialLinked) setNasolabialLeft(val);
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛脸颊纹</span>
                          <span className="value">{cheekWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={cheekWrinkles} onChange={(e) => setCheekWrinkles(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛木偶纹</span>
                          <span className="value">{marionetteWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={marionetteWrinkles} onChange={(e) => setMarionetteWrinkles(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛嘴周纹</span>
                          <span className="value">{mouthWrinkles}</span>
                        </div>
                        <input type="range" min="0" max="100" value={mouthWrinkles} onChange={(e) => setMouthWrinkles(Number(e.target.value))} />
                      </div>

                      {/* 3. 身体祛瑕疵 */}
                      <div className="sub-group-title" style={{ marginTop: "20px" }}>身体祛瑕疵</div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>身体祛瑕疵</span>
                          <span className="value">{bodyFlaw}</span>
                        </div>
                        <input type="range" min="0" max="100" value={bodyFlaw} onChange={(e) => setBodyFlaw(Number(e.target.value))} />
                      </div>

                      <div className="slider-item">
                        <div className="slider-label">
                          <span>祛副乳</span>
                          <span className="value">{removeAccessoryBreast}</span>
                        </div>
                        <input type="range" min="0" max="100" value={removeAccessoryBreast} onChange={(e) => setRemoveAccessoryBreast(Number(e.target.value))} />
                      </div>

                      <div className="switch-item-row">
                        <span className="help-icon-wrapper">
                          <span>AI祛纹身</span>
                          <HelpCircle size={11} className="label-help" />
                          <span className="beta-badge">Beta</span>
                        </span>
                        <label className="switch-toggle">
                          <input 
                            type="checkbox" 
                            checked={removeTattoo} 
                            onChange={(e) => setRemoveTattoo(e.target.checked)} 
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                    </div>
                  )}

                  {g.id === "skin" && (
                    <div className="sliders-list">
                      <SliderItem label="皮肤平整度" value={portraitSettings.flatness} onChange={(v) => handlePortraitSliderChange("flatness", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="极细磨皮" value={portraitSettings.blurStrength} onChange={(v) => handlePortraitSliderChange("blurStrength", v)} onAutoSave={handleAutoSave} highlight />
                      <SliderItem label="皮肤美白" value={portraitSettings.skinWhiten} onChange={(v) => handlePortraitSliderChange("skinWhiten", v)} onAutoSave={handleAutoSave} highlight />
                      <SliderItem label="去面光 (脸部)" value={portraitSettings.removeShine} onChange={(v) => handlePortraitSliderChange("removeShine", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="泛黄额头" value={portraitSettings.yellowForehead} onChange={(v) => handlePortraitSliderChange("yellowForehead", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="泛黑眼圈" value={portraitSettings.darkCircles} onChange={(v) => handlePortraitSliderChange("darkCircles", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="泛黑鼻导" value={portraitSettings.darkNose} onChange={(v) => handlePortraitSliderChange("darkNose", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="去面部杂色" value={portraitSettings.facialNoise} onChange={(v) => handlePortraitSliderChange("facialNoise", v)} onAutoSave={handleAutoSave} />
                    </div>
                  )}

                  {g.id === "reshape" && (
                    <div className="sliders-list">
                      <SliderItem label="捏骨头型" value={portraitSettings.boneShape} onChange={(v) => handlePortraitSliderChange("boneShape", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="捏额宽" value={portraitSettings.foreheadWidth} onChange={(v) => handlePortraitSliderChange("foreheadWidth", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="捏高颧骨" value={portraitSettings.cheekboneHeight} onChange={(v) => handlePortraitSliderChange("cheekboneHeight", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="捏中骨" value={portraitSettings.midBone} onChange={(v) => handlePortraitSliderChange("midBone", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="去双下巴" value={portraitSettings.doubleChin} onChange={(v) => handlePortraitSliderChange("doubleChin", v)} onAutoSave={handleAutoSave} highlight />
                      <SliderItem label="下巴纹缩窄" value={portraitSettings.chinCrease} onChange={(v) => handlePortraitSliderChange("chinCrease", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="去鼻唇沟" value={portraitSettings.nasolabialFolds} onChange={(v) => handlePortraitSliderChange("nasolabialFolds", v)} onAutoSave={handleAutoSave} />
                    </div>
                  )}

                  {g.id === "eye" && (
                    <div className="sliders-list">
                      <SliderItem label="捏上眼皮 (大眼)" value={portraitSettings.upperEyelid} onChange={(v) => handlePortraitSliderChange("upperEyelid", v)} onAutoSave={handleAutoSave} highlight />
                      <SliderItem label="亮眼" value={portraitSettings.eyeBrighten} onChange={(v) => handlePortraitSliderChange("eyeBrighten", v)} onAutoSave={handleAutoSave} highlight />
                      <SliderItem label="捏大眼袋" value={portraitSettings.eyeBags} onChange={(v) => handlePortraitSliderChange("eyeBags", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="去卧蚕" value={portraitSettings.tearTrough} onChange={(v) => handlePortraitSliderChange("tearTrough", v)} onAutoSave={handleAutoSave} />
                      <SliderItem label="去鼻孔暗度" value={portraitSettings.removeNostril} onChange={(v) => handlePortraitSliderChange("removeNostril", v)} onAutoSave={handleAutoSave} />
                    </div>
                  )}

                  {g.id === "makeup" && (
                    <div className="sliders-list">
                      <SliderItem label="腮红平整" value={portraitSettings.blushFlat} onChange={(v) => handlePortraitSliderChange("blushFlat", v)} onAutoSave={handleAutoSave} />
                    </div>
                  )}

                  {g.id === "hair" && (
                    <div className="sliders-list">
                      <SliderItem label="捏小发效 (发量)" value={portraitSettings.hairVolume} onChange={(v) => handlePortraitSliderChange("hairVolume", v)} onAutoSave={handleAutoSave} />
                    </div>
                  )}

                  {["expression", "teeth", "hand", "body"].includes(g.id) && (
                    <div className="accordion-placeholder-text">
                      AI 智能骨骼及面部定位中，本分类细节微调由大模型多维算力自动处理。
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
