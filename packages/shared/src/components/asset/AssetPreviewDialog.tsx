import React, { useState, useEffect } from "react";
import { ExternalLink, Download } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl, assetMimeType, formatFileSize } from "../../utils";

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Download image error:", error);
    // 降级使用新标签页打开
    window.open(url, "_blank");
  }
}

interface AssetPreviewDialogProps {
  asset: AssetSummary;
  setPreviewAsset: (asset: AssetSummary | null) => void;
}

export function AssetPreviewDialog({
  asset,
  setPreviewAsset,
}: AssetPreviewDialogProps) {
  const [resolution, setResolution] = useState<string>("");
  const title = assetTitle(asset);
  const sourceUrl = asset.file_url ?? asset.thumbnail_url ?? "";

  useEffect(() => {
    if (asset.asset_type !== "image" || !sourceUrl) {
      setResolution("");
      return;
    }

    // 尝试从元数据中快速初始化
    let initialRes = "";
    const meta = asset.metadata as any;
    if (meta) {
      if (typeof meta.width === "number" && typeof meta.height === "number") {
        initialRes = `${meta.width} x ${meta.height}`;
      } else if (typeof meta.size === "string" && meta.size.includes("x")) {
        initialRes = meta.size;
      }
    }
    setResolution(initialRes);

    // 异步加载原图获取真实的物理分辨率
    const img = new Image();
    img.src = assetUrl(sourceUrl);
    img.onload = () => {
      setResolution(`${img.naturalWidth} x ${img.naturalHeight}`);
    };
  }, [asset.id, sourceUrl]);

  function renderAssetPreview(asset: AssetSummary) {
    const sourceUrl = asset.thumbnail_url ?? asset.file_url;
    if (asset.asset_type === "image" && sourceUrl) {
      return <img alt={title} src={assetUrl(sourceUrl)} />;
    }
    const typeClass = `asset-fallback ${asset.asset_type}`;
    let iconLabel = "文件";
    if (asset.asset_type === "video") {
      iconLabel = "视频";
    } else if (asset.asset_type === "workflow_output") {
      iconLabel = "生成结果";
    }
    return <div className={typeClass} style={{ width: "100%", height: "280px" }}>{iconLabel}</div>;
  }

  return (
    <div
      className="asset-dialog-backdrop"
      role="presentation"
      onClick={() => setPreviewAsset(null)}
    >
      <section
        aria-label="素材预览"
        className="asset-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <h3>{title}</h3>
          <span>{asset.source} · {asset.asset_type}</span>
        </div>
        <div className="asset-dialog-preview">
          {asset.asset_type === "image" && sourceUrl ? (
            <img alt={title} src={assetUrl(sourceUrl)} />
          ) : (
            renderAssetPreview(asset)
          )}
        </div>
        <div className="asset-dialog-meta">
          <span>{assetMimeType(asset)}</span>
          {resolution ? (
            <span>{resolution}</span>
          ) : null}
          {typeof asset.metadata.size === "number" ? (
            <span>{formatFileSize(asset.metadata.size)}</span>
          ) : null}
        </div>
        <div className="task-actions">
          {sourceUrl ? (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  const url = assetUrl(sourceUrl);
                  const filename = `${title || "download"}.png`;
                  downloadImage(url, filename);
                }}
              >
                <Download size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
                下载图片
              </button>
              <a
                className="secondary-button"
                href={assetUrl(sourceUrl)}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} aria-hidden="true" />
                打开原文件
              </a>
            </>
          ) : null}
          <button
            className="primary-button"
            type="button"
            onClick={() => setPreviewAsset(null)}
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}
