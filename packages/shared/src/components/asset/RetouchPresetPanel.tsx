import { Check, Trash2 } from "lucide-react";
import { PRESET_EFFECTS } from "./editorConstants";
import { CustomRetouchPreset } from "./useRetouchPresets";

interface Props {
  disabled: boolean;
  activePresetIndex: number | null;
  customPresets: CustomRetouchPreset[];
  onApplyBuiltIn: (index: number) => void;
  onApplyCustom: (preset: CustomRetouchPreset) => void;
  onDeleteCustom: (preset: CustomRetouchPreset) => void;
}

export function RetouchPresetPanel({
  disabled,
  activePresetIndex,
  customPresets,
  onApplyBuiltIn,
  onApplyCustom,
  onDeleteCustom,
}: Props) {
  return (
    <aside className="editor-presets-panel">
      <div className="panel-header-row">
        <h3>预设</h3>
        <div className="header-icon-group"><span className="preset-count">{PRESET_EFFECTS.length}</span></div>
      </div>
      <div className="presets-scroll-list">
        {PRESET_EFFECTS.map((preset, index) => (
          <button
            key={preset.name}
            type="button"
            className={`preset-item-btn ${activePresetIndex === index ? "active" : ""}`}
            disabled={disabled}
            onClick={() => onApplyBuiltIn(index)}
          >
            <span className="indicator" />
            <span className="name">{preset.name}</span>
            {activePresetIndex === index && <Check size={12} className="check-icon" />}
          </button>
        ))}
        {customPresets.length > 0 && <div className="presets-divider">自定义</div>}
        {customPresets.map((preset) => (
          <div className="custom-preset-row" key={preset.id}>
            <button type="button" className="preset-item-btn custom" disabled={disabled} onClick={() => onApplyCustom(preset)}>
              <span className="indicator custom" />
              <span className="name">{preset.name}</span>
            </button>
            <button type="button" className="delete-preset-btn" onClick={() => onDeleteCustom(preset)} title={`删除预设 ${preset.name}`}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
