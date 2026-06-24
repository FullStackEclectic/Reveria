import { Sparkles, Plus } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetUrl, assetTitle } from "../../utils";

interface ProjectLibraryPanelProps {
  assets: AssetSummary[];
  setPreviewAsset: (asset: AssetSummary | null) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
}

export function ProjectLibraryPanel({
  assets,
  setPreviewAsset,
  addWorkflowResultToCanvas,
}: ProjectLibraryPanelProps) {
  const imageAssets = assets.filter((asset) => asset.asset_type === "image");
  const workflowAssets = assets.filter((asset) => asset.asset_type === "workflow_output");

  return (
    <div className="rv-right-drawer-scrollable" style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
      {/* 1. 本地库 */}
      <div>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <h3>项目素材库</h3>
          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>{imageAssets.length} 个图片</span>
        </div>
        {imageAssets.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {imageAssets.slice(0, 8).map((asset) => (
              <button
                className="image-strip-item"
                key={asset.id}
                type="button"
                title={assetTitle(asset)}
                onClick={() => setPreviewAsset(asset)}
              >
                {asset.thumbnail_url || asset.file_url ? (
                  <img alt="" src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} />
                ) : (
                  <Plus size={18} />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty" style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px" }}>
            <p style={{ fontSize: "11px", color: "#71717a", margin: 0 }}>素材库为空，请在下方工作流中生成或从素材页导入。</p>
          </div>
        )}
      </div>

      {/* 2. 生成历史 */}
      <div>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <h3>生成历史</h3>
          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>AI 创意产物</span>
        </div>
        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
          {!workflowAssets.length ? (
            <div className="empty-state compact-empty">
              <p>当前项目还没有生成历史。</p>
            </div>
          ) : (
            <div className="history-list">
              {workflowAssets.map((asset) => (
                <div className="history-row" key={asset.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{asset.metadata.title ?? asset.asset_type}</strong>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="mini-action-button"
                        onClick={() => addWorkflowResultToCanvas(asset.metadata.title ?? "生成历史", asset.metadata.output)}
                        style={{ minHeight: "26px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", padding: "0 8px" }}
                      >
                        <Sparkles size={12} /> Add to Canvas
                      </button>
                      <span>
                        {asset.metadata.task_type ?? asset.source} · {asset.asset_type}
                      </span>
                    </div>
                  </div>
                  <pre>{JSON.stringify(asset.metadata.output, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
