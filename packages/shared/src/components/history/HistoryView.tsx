import React from "react";
import { AssetSummary, ProjectSummary } from "../../types";
import { PageFrame } from "../common/PageFrame";
import "./HistoryView.css";


interface HistoryViewProps {
  assets: AssetSummary[];
  selectedProject: ProjectSummary | undefined;
  exportCurrentProject: (format: "json" | "markdown") => void;
}

export function HistoryList({ assets }: { assets: AssetSummary[] }) {
  const workflowAssets = assets.filter(
    (asset) => asset.asset_type === "workflow_output",
  );

  if (!workflowAssets.length) {
    return (
      <div className="empty-state compact-empty">
        <p>当前项目还没有生成历史。</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {workflowAssets.map((asset) => (
        <div className="history-row" key={asset.id}>
          <div>
            <strong>{asset.metadata.title ?? asset.asset_type}</strong>
            <span>
              {asset.metadata.task_type ?? asset.source} · {asset.asset_type}
            </span>
          </div>
          <pre style={{
            minHeight: "96px",
            border: "1px solid #e6e0d4",
            borderRadius: "8px",
            background: "#fbfaf7",
            color: "#111827",
            margin: "0",
            padding: "12px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}>{JSON.stringify(asset.metadata.output, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

export function HistoryView({
  assets,
  selectedProject,
  exportCurrentProject,
}: HistoryViewProps) {
  return (
    <PageFrame
      eyebrow="生成历史"
      title="项目生成记录"
      status={`${assets.length} 条当前项目历史 · 来源于工作流输出`}
      action={
        <div className="topbar-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedProject}
            onClick={() => exportCurrentProject("json")}
          >
            导出 JSON
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedProject}
            onClick={() => exportCurrentProject("markdown")}
          >
            导出 Markdown
          </button>
        </div>
      }
    >
      <section className="page-grid">
        <div className="panel detail-panel">
          <div className="panel-header">
            <h3>{selectedProject?.name ?? "项目生成历史"}</h3>
            <span>workflow_output</span>
          </div>
          <HistoryList assets={assets} />
        </div>
      </section>
    </PageFrame>
  );
}
