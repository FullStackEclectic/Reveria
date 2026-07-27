import React from "react";
import { HelpCircle, Link2 } from "lucide-react";
import type { PortraitParamKey, PortraitParamMeta } from "../retouch/portraitParams";

interface BadgeProps {
  badge?: "new" | "beta";
}

function ParamBadge({ badge }: BadgeProps) {
  if (!badge) return null;
  return <span className={badge === "new" ? "new-badge-small" : "beta-badge"}>{badge === "new" ? "New" : "Beta"}</span>;
}

function ParamLabel({ meta }: { meta: PortraitParamMeta }) {
  return (
    <span className="help-icon-wrapper">
      <span>{meta.label}</span>
      {meta.help && <HelpCircle size={11} className="label-help" />}
      <ParamBadge badge={meta.badge} />
    </span>
  );
}

interface ControlProps {
  meta: PortraitParamMeta;
  value: number;
  onChange: (key: PortraitParamKey, value: number) => void;
  onCommit: () => void;
}

/** 开关型参数 */
function ParamSwitch({ meta, value, onChange, onCommit }: ControlProps) {
  return (
    <div className="switch-item-row" title={meta.help}>
      <ParamLabel meta={meta} />
      <label className="switch-toggle">
        <input
          type="checkbox"
          checked={value >= 0.5}
          onChange={(event) => {
            onChange(meta.key as PortraitParamKey, event.target.checked ? 1 : 0);
            onCommit();
          }}
        />
        <span className="switch-slider" />
      </label>
    </div>
  );
}

/** 滑块型参数，量程来自声明表 */
function ParamSlider({ meta, value, onChange, onCommit }: ControlProps) {
  return (
    <div className="slider-item" title={meta.help}>
      <div className="slider-label">
        <ParamLabel meta={meta} />
        <span className="value">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={meta.min}
        max={meta.max}
        value={value}
        onChange={(event) => onChange(meta.key as PortraitParamKey, Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
    </div>
  );
}

export function PortraitParamControl(props: ControlProps) {
  return props.meta.kind === "switch" ? <ParamSwitch {...props} /> : <ParamSlider {...props} />;
}

interface PairProps {
  left: PortraitParamMeta;
  right: PortraitParamMeta;
  leftValue: number;
  rightValue: number;
  linked: boolean;
  onToggleLink: () => void;
  onChange: (key: PortraitParamKey, value: number) => void;
  onCommit: () => void;
}

/**
 * 左右成对参数（如法令纹）。
 * 锁链按钮只影响「拖动一侧时是否同步另一侧」，两侧的值始终各自独立地存进设置。
 */
export function PortraitParamPair({
  left, right, leftValue, rightValue, linked, onToggleLink, onChange, onCommit,
}: PairProps) {
  const label = left.label.replace(/（.*）$/, "");
  const update = (key: PortraitParamKey, partner: PortraitParamKey, value: number) => {
    onChange(key, value);
    if (linked) onChange(partner, value);
  };

  return (
    <div className="double-slider-item" title={left.help}>
      <div className="double-slider-label">
        <span>{label}</span>
        <ParamBadge badge={left.badge} />
      </div>
      <div className="double-slider-container">
        <div className="side-slider">
          <span className="side-label">左</span>
          <span className="side-value">{Math.round(leftValue)}</span>
          <input
            type="range"
            min={left.min}
            max={left.max}
            value={leftValue}
            onChange={(event) => update(
              left.key as PortraitParamKey,
              right.key as PortraitParamKey,
              Number(event.target.value),
            )}
            onMouseUp={onCommit}
            onTouchEnd={onCommit}
          />
        </div>

        <button
          type="button"
          className={`link-btn-toggle ${linked ? "active" : ""}`}
          onClick={onToggleLink}
          title={linked ? "已联动：拖动一侧会同步另一侧" : "已解除联动：左右可独立调节"}
        >
          <Link2 size={12} />
        </button>

        <div className="side-slider">
          <span className="side-label">右</span>
          <span className="side-value">{Math.round(rightValue)}</span>
          <input
            type="range"
            min={right.min}
            max={right.max}
            value={rightValue}
            onChange={(event) => update(
              right.key as PortraitParamKey,
              left.key as PortraitParamKey,
              Number(event.target.value),
            )}
            onMouseUp={onCommit}
            onTouchEnd={onCommit}
          />
        </div>
      </div>
    </div>
  );
}
