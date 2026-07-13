import React, { useState, useEffect } from "react";
import { ExternalLink, Download, Wand2, X, Copy, Check, Bot } from "lucide-react";
import { AssetSummary } from "../../types";
import {
  assetTitle,
  assetUrl,
  assetMimeType,
  formatFileSize,
  isTextAsset,
  assetTextContent,
  textAssetTitle,
  getAssetMetadata,
} from "../../utils";

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
  onEnterEditor?: (asset: AssetSummary) => void; // 进入 AI 智能精修编辑器回调
}

export function AssetPreviewDialog({
  asset,
  setPreviewAsset,
  onEnterEditor,
}: AssetPreviewDialogProps) {
  const [resolution, setResolution] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const textAsset = isTextAsset(asset);
  const textContent = assetTextContent(asset);
  const meta = getAssetMetadata(asset);
  const title = textAsset ? textAssetTitle(asset) : assetTitle(asset);
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

  useEffect(() => {
    setCopied(false);
  }, [asset.id]);

  async function copyText() {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      alert(`复制文本失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function renderAssetPreview(asset: AssetSummary) {
    const sourceUrl = asset.file_url ?? asset.thumbnail_url;
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
        className="asset-dialog asset-preview-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="asset-preview-dialog-header">
          <div>
            <h3>{title}</h3>
            <span>{textAsset ? "AI 生成 · 文本内容" : `${asset.source} · ${asset.asset_type}`}</span>
          </div>
          <button
            type="button"
            className="asset-preview-icon-button"
            onClick={() => setPreviewAsset(null)}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className={`asset-dialog-preview ${textAsset ? "text-asset-dialog-preview" : ""}`}>
          {textAsset ? (
            <article className="text-asset-full-content">
              <div className="text-asset-full-label"><Bot size={15} />生成内容</div>
              <div>{textContent || "暂无文本内容"}</div>
            </article>
          ) : asset.asset_type === "image" && sourceUrl ? (
            <img alt={title} src={assetUrl(sourceUrl)} />
          ) : (
            renderAssetPreview(asset)
          )}
        </div>
        <div className="asset-dialog-meta">
          <span>{textAsset ? "AI 文本" : assetMimeType(asset)}</span>
          {textAsset && typeof meta.model === "string" ? <span>{meta.model}</span> : null}
          {textAsset && typeof meta.total_tokens === "number" ? <span>{meta.total_tokens} Tokens</span> : null}
          {asset.created_at ? <span>{new Date(asset.created_at).toLocaleString("zh-CN", { hour12: false })}</span> : null}
          {resolution ? (
            <span>{resolution}</span>
          ) : null}
          {typeof asset.metadata.size === "number" ? (
            <span>{formatFileSize(asset.metadata.size)}</span>
          ) : null}
        </div>
        <div className="asset-preview-dialog-actions">
          {textAsset ? (
            <button className="secondary-button" type="button" onClick={() => void copyText()} disabled={!textContent}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "已复制" : "复制全文"}
            </button>
          ) : null}
          {sourceUrl ? (
            <>
              {asset.asset_type === "image" && onEnterEditor && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    onEnterEditor(asset);
                    setPreviewAsset(null);
                  }}
                >
                  <Wand2 size={16} aria-hidden="true" />
                  AI 智能精修
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  const url = assetUrl(sourceUrl);
                  const filename = typeof asset.metadata.file_name === "string"
                    ? asset.metadata.file_name
                    : title || "download";
                  downloadImage(url, filename);
                }}
              >
                <Download size={16} aria-hidden="true" />
                {asset.asset_type === "image" ? "下载图片" : "下载文件"}
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
