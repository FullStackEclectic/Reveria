import React, { useState } from "react";
import { ChevronRight, ChevronDown, HelpCircle } from "lucide-react";
import { PortraitGroupContent } from "./portrait/PortraitGroupContent";
import {
  PORTRAIT_GROUPS,
  PORTRAIT_PARAMS,
  type PortraitParamKey,
  type PortraitSettings,
} from "./retouch/portraitParams";
import { ROLE_PRESETS, type PortraitRole } from "./retouch/rolePresets";

interface PortraitAdjustmentsProps {
  role: PortraitRole;
  /** 切换角色会套用该角色的基线参数 */
  onSelectRole: (role: PortraitRole) => void;
  settings: PortraitSettings;
  faceDetected: boolean;
  onParamChange: (key: PortraitParamKey, value: number) => void;
  onCommit: () => void;
}

/**
 * 人像美化面板。
 *
 * 面板不持有任何参数状态：所有滑块直接读写 `RetouchSettings`，
 * 列表由 `PORTRAIT_PARAMS` 声明表生成，因此不存在「动了但不生效」的控件。
 */
export function PortraitAdjustments({
  role,
  onSelectRole,
  settings,
  faceDetected,
  onParamChange,
  onCommit,
}: PortraitAdjustmentsProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>("blemish");
  const [linkedPairs, setLinkedPairs] = useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) => {
    setExpandedGroup(expandedGroup === group ? null : group);
  };

  const toggleLink = (pairId: string) => {
    setLinkedPairs((current) => ({ ...current, [pairId]: !(current[pairId] ?? true) }));
  };

  /** 该组是否已有非零调节，用于在标题上给出提示点 */
  const groupHasEdits = (groupId: string) =>
    PORTRAIT_PARAMS.some(
      (param) => param.group === groupId && settings[param.key as PortraitParamKey] !== 0,
    );

  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">人像美化</div>

      {/* 角色基线：点击即套用该人群的推荐起始参数 */}
      <div className="role-select-tabs">
        {ROLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`role-tab ${role === preset.id ? "active" : ""}`}
            onClick={() => onSelectRole(preset.id)}
            title={`${preset.description}（点击套用基线参数）`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="portrait-accordion-list">
        {PORTRAIT_GROUPS.map((group) => {
          const isOpen = expandedGroup === group.id;
          const edited = groupHasEdits(group.id);
          return (
            <div key={group.id} className="accordion-item">
              <button
                type="button"
                className={`accordion-header-btn ${isOpen ? "open" : ""}`}
                onClick={() => toggleGroup(group.id)}
              >
                <div className="header-left">
                  <span className="arrow-icon">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="group-name">{group.name}</span>
                  {group.requiresFace && !faceDetected && (
                    <HelpCircle size={12} className="help-icon" />
                  )}
                </div>
                <div className="header-right">
                  {edited && <span className="scale-indicator-dot" title="该组已有调节" />}
                </div>
              </button>

              {isOpen && (
                <div className="accordion-content">
                  <PortraitGroupContent
                    group={group}
                    settings={settings}
                    faceDetected={faceDetected}
                    linkedPairs={linkedPairs}
                    onToggleLink={toggleLink}
                    onChange={onParamChange}
                    onCommit={onCommit}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
