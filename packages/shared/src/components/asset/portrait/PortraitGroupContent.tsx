import React from "react";
import { PortraitParamControl, PortraitParamPair } from "./PortraitParamControl";
import {
  PORTRAIT_PARAMS,
  type PortraitGroupMeta,
  type PortraitParamKey,
  type PortraitParamMeta,
  type PortraitSettings,
} from "../retouch/portraitParams";

interface Props {
  group: PortraitGroupMeta;
  settings: PortraitSettings;
  faceDetected: boolean;
  linkedPairs: Record<string, boolean>;
  onToggleLink: (key: string) => void;
  onChange: (key: PortraitParamKey, value: number) => void;
  onCommit: () => void;
}

/**
 * 渲染一个手风琴分组内的全部参数。
 * 参数列表直接来自声明表，因此面板上出现的每一项都必然对应 Shader 中的真实实现。
 */
export function PortraitGroupContent({
  group, settings, faceDetected, linkedPairs, onToggleLink, onChange, onCommit,
}: Props) {
  const params = PORTRAIT_PARAMS.filter((param) => param.group === group.id) as unknown as PortraitParamMeta[];
  if (params.length === 0) return null;

  const rendered = new Set<string>();
  const nodes: React.ReactNode[] = [];
  let lastSection: string | undefined;

  for (const meta of params) {
    if (rendered.has(meta.key)) continue;

    if (meta.section && meta.section !== lastSection) {
      lastSection = meta.section;
      nodes.push(
        <div key={`section-${meta.section}`} className="sub-group-title">{meta.section}</div>,
      );
    }

    // 成对参数合并成一个左右联动控件
    const partner = meta.pairWith
      ? params.find((item) => item.key === meta.pairWith)
      : undefined;
    if (partner) {
      const pairId = [meta.key, partner.key].sort().join("|");
      rendered.add(meta.key);
      rendered.add(partner.key);
      nodes.push(
        <PortraitParamPair
          key={pairId}
          left={meta}
          right={partner}
          leftValue={settings[meta.key as PortraitParamKey]}
          rightValue={settings[partner.key as PortraitParamKey]}
          linked={linkedPairs[pairId] ?? true}
          onToggleLink={() => onToggleLink(pairId)}
          onChange={onChange}
          onCommit={onCommit}
        />,
      );
      continue;
    }

    rendered.add(meta.key);
    nodes.push(
      <PortraitParamControl
        key={meta.key}
        meta={meta}
        value={settings[meta.key as PortraitParamKey]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
  }

  return (
    <div className="sliders-list">
      {group.requiresFace && !faceDetected && (
        <div className="accordion-placeholder-text">
          未检出人脸，本组参数需要面部关键点才能定位，调节后不会生效。
        </div>
      )}
      {nodes}
    </div>
  );
}
