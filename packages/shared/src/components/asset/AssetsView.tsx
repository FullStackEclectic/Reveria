import React, { FormEvent, useState, useMemo } from "react";
import {
  Loader2,
  Plus,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Sparkles,
  UploadCloud,
  Link2,
  X,
  Trash2,
  Eye,
  Video,
  FolderOpen
} from "lucide-react";
import { AssetSummary, ProjectSummary, WorkspaceSummary, UserSummary } from "../../types";
import { PageFrame } from "../common/PageFrame";
import { formatFileSize, assetTitle, assetMimeType, assetUrl, uploadAsset, postJson, assetTypeFromMime } from "../../utils";
import "./AssetsView.css";


interface AssetsViewProps {
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  selectedProject: ProjectSummary | undefined;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  setPreviewAsset: (asset: AssetSummary | null) => void;
  deleteAsset: (id: string) => Promise<void>;
  deletingAssetId: string;
}

export function AssetsView({
  assets,
  setAssets,
  selectedProject,
  activeWorkspace,
  currentUser,
  setPreviewAsset,
  deleteAsset,
  deletingAssetId,
}: AssetsViewProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "link">("upload");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isImportingAssets, setIsImportingAssets] = useState(false);
  const [assetLinkForm, setAssetLinkForm] = useState({
    title: "示例封面参考图",
    url: "https://example.com/demo-cover.png",
    mimeType: "image/png",
  });

  const filterTypes = [
    { label: "全部", value: "all" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "PDF/文档", value: "document" },
    { label: "其他", value: "other" }
  ];

  const filteredAssets = useMemo(() => {
    if (filterType === "all") return assets;
    if (filterType === "document") {
      return assets.filter(a => a.asset_type === "pdf" || a.asset_type === "document");
    }
    return assets.filter((a) => a.asset_type === filterType);
  }, [assets, filterType]);

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleImportAssets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !activeWorkspace || !selectedFiles.length) {
      return;
    }

    setIsImportingAssets(true);
    try {
      const importedAssets = await Promise.all(
        selectedFiles.map((file) => {
          const formData = new FormData();
          formData.append("workspace_id", activeWorkspace.id);
          formData.append("project_id", selectedProject.id);
          if (selectedProject.customer_id) {
            formData.append("customer_id", selectedProject.customer_id);
          }
          if (currentUser?.id) {
            formData.append("created_by", currentUser.id);
          }
          formData.append("file", file);
          return uploadAsset(formData);
        })
      );
      setAssets((current) => [...importedAssets, ...current]);
      setSelectedFiles([]);
    } catch (err: any) {
      alert(`导入素材失败: ${err.message || err}`);
    } finally {
      setIsImportingAssets(false);
    }
  }

  async function handleRegisterAssetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !activeWorkspace || !assetLinkForm.url) {
      return;
    }

    try {
      const assetType = assetTypeFromMime(assetLinkForm.mimeType);
      const asset = await postJson<AssetSummary>("/api/assets", {
        workspace_id: activeWorkspace.id,
        project_id: selectedProject.id,
        customer_id: selectedProject.customer_id ?? null,
        asset_type: assetType,
        source: "link",
        file_url: assetLinkForm.url,
        thumbnail_url: assetType === "image" ? assetLinkForm.url : null,
        metadata: {
          title: assetLinkForm.title || assetLinkForm.url,
          file_name: assetLinkForm.title || assetLinkForm.url,
          mime_type: assetLinkForm.mimeType || "application/octet-stream",
        },
        created_by: currentUser?.id ?? null,
      });
      setAssets((current) => [asset, ...current]);
      alert("已登记链接素材");
    } catch (err: any) {
      alert(`登记链接失败: ${err.message || err}`);
    }
  }

  function renderAssetFallback(assetType: string) {
    const iconProps = { size: 30, strokeWidth: 1.5 };
    switch (assetType) {
      case "video":
        return (
          <div className="asset-fallback-gradient video">
            <Video {...iconProps} />
            <span>视频资产</span>
          </div>
        );
      case "workflow_output":
        return (
          <div className="asset-fallback-gradient workflow_output">
            <Sparkles {...iconProps} />
            <span>生成结果</span>
          </div>
        );
      case "pdf":
      case "document":
        return (
          <div className="asset-fallback-gradient pdf">
            <FileText {...iconProps} />
            <span>PDF/文档</span>
          </div>
        );
      default:
        return (
          <div className="asset-fallback-gradient other">
            <FolderOpen {...iconProps} />
            <span>其它素材</span>
          </div>
        );
    }
  }

  function renderAssetPreview(asset: AssetSummary) {
    const title = assetTitle(asset);
    const sourceUrl = asset.thumbnail_url ?? asset.file_url;
    if (asset.asset_type === "image" && sourceUrl) {
      return <img alt={title} src={assetUrl(sourceUrl)} />;
    }
    return renderAssetFallback(asset.asset_type);
  }

  return (
    <PageFrame
      eyebrow="素材库"
      title="项目素材和生成资产"
      status={`${assets.length} 个当前项目资产 · ${selectedProject?.name ?? "未选择项目"}`}
    >
      <div className="assets-layout-grid">
        {/* 左栏：上传与登记控制面板 */}
        <div className="assets-control-panel">
          <div className="assets-tabs-wrapper">
            <button
              className={`assets-tab-btn ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
              type="button"
            >
              <UploadCloud size={14} />
              本地上传
            </button>
            <button
              className={`assets-tab-btn ${activeTab === "link" ? "active" : ""}`}
              onClick={() => setActiveTab("link")}
              type="button"
            >
              <Link2 size={14} />
              登记链接
            </button>
          </div>

          {activeTab === "upload" ? (
            <form className="assets-form-group" onSubmit={handleImportAssets}>
              <div className="panel-header" style={{ marginBottom: "8px", padding: 0 }}>
                <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>上传本地素材</h3>
                <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>将文件关联到当前创意项目</span>
              </div>

              <label className="assets-upload-dropzone">
                <input
                  multiple
                  type="file"
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files ?? []))
                  }
                />
                <UploadCloud size={28} className="dropzone-icon" />
                <span>选择本地文件</span>
                <p>支持图片、视频、PDF 或客户资料文件</p>
              </label>

              {selectedFiles.length > 0 && (
                <div className="assets-file-preview-list">
                  {selectedFiles.map((file, idx) => (
                    <div className="assets-file-preview-card" key={`${file.name}-${idx}`}>
                      <div className="file-info">
                        <strong>{file.name}</strong>
                        <span>
                          {file.type || "未知"} · {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        className="btn-remove"
                        onClick={() => handleRemoveSelectedFile(idx)}
                        type="button"
                        title="取消选择"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="primary-button"
                style={{ width: "100%", marginTop: "12px", minHeight: "36px" }}
                type="submit"
                disabled={!selectedProject || !selectedFiles.length || isImportingAssets}
              >
                {isImportingAssets ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                导入到项目素材
              </button>
            </form>
          ) : (
            <form className="assets-form-group" onSubmit={handleRegisterAssetLink}>
              <div className="panel-header" style={{ marginBottom: "8px", padding: 0 }}>
                <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>登记外链资产</h3>
                <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>登记网络参考图片、音视频等 URL</span>
              </div>

              <div className="assets-form-field">
                <label>资产名称</label>
                <input
                  value={assetLinkForm.title}
                  onChange={(event) =>
                    setAssetLinkForm({
                      ...assetLinkForm,
                      title: event.target.value,
                    })
                  }
                  placeholder="给资产起一个便于识别的标题"
                  required
                />
              </div>

              <div className="assets-form-field">
                <label>资源 URL</label>
                <input
                  value={assetLinkForm.url}
                  onChange={(event) =>
                    setAssetLinkForm({
                      ...assetLinkForm,
                      url: event.target.value,
                    })
                  }
                  placeholder="https://example.com/image.png"
                  required
                />
              </div>

              <div className="assets-form-field">
                <label>MIME 媒体类型</label>
                <input
                  value={assetLinkForm.mimeType}
                  onChange={(event) =>
                    setAssetLinkForm({
                      ...assetLinkForm,
                      mimeType: event.target.value,
                    })
                  }
                  placeholder="image/png 或 video/mp4 等"
                  required
                />
              </div>

              <button
                className="secondary-button"
                style={{ width: "100%", marginTop: "12px", minHeight: "36px" }}
                type="submit"
                disabled={!selectedProject || !assetLinkForm.url}
              >
                <Link2 size={14} />
                确认登记外链
              </button>
            </form>
          )}
        </div>

        {/* 右栏：项目资产展示面板 */}
        <div className="assets-content-panel">
          <div className="assets-filter-bar">
            {filterTypes.map((t) => (
              <button
                className={`assets-filter-btn ${filterType === t.value ? "active" : ""}`}
                key={t.value}
                onClick={() => setFilterType(t.value)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredAssets.length > 0 ? (
            <div className="assets-modern-grid">
              {filteredAssets.map((asset) => {
                const title = assetTitle(asset);
                const isLocal = asset.source !== "link";
                return (
                  <div className="asset-card-modern" key={asset.id}>
                    {/* 悬停操作浮层 */}
                    <div className="asset-overlay-hover">
                      <button
                        className="asset-overlay-btn"
                        onClick={() => setPreviewAsset(asset)}
                        title="查看大图预览"
                        type="button"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {asset.file_url && (
                        <a
                          className="asset-overlay-btn"
                          href={assetUrl(asset.file_url)}
                          rel="noreferrer"
                          target="_blank"
                          title="在新窗口下载/打开"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}

                      <button
                        className="asset-overlay-btn btn-delete"
                        disabled={deletingAssetId === asset.id}
                        onClick={() => void deleteAsset(asset.id)}
                        title="删除素材"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* 卡片预览容器 */}
                    <div className="asset-preview-container">
                      {renderAssetPreview(asset)}
                    </div>

                    {/* 卡片描述栏 */}
                    <div className="asset-card-info">
                      <strong className="name" title={title}>{title}</strong>
                      <div className="meta-row">
                        <span>
                          {assetMimeType(asset)}
                          {typeof asset.metadata.size === "number" && ` · ${formatFileSize(asset.metadata.size)}`}
                        </span>
                        <span className={`tag-source ${isLocal ? "local" : "link"}`}>
                          {isLocal ? "本地" : "外链"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="assets-empty-state" style={{ marginTop: "40px" }}>
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="48" fill="rgba(15, 118, 110, 0.03)" />
                <rect x="42" y="38" width="36" height="44" rx="4" fill="#ffffff" stroke="rgba(185, 178, 165, 0.35)" strokeWidth="1.5" />
                <line x1="50" y1="48" x2="70" y2="48" stroke="rgba(185, 178, 165, 0.25)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="50" y1="56" x2="66" y2="56" stroke="rgba(185, 178, 165, 0.25)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="75" cy="75" r="18" fill="#ffffff" stroke="rgba(15, 118, 110, 0.15)" strokeWidth="1.5" />
                <path d="M 71 75 L 79 75 M 75 71 L 75 79" stroke="var(--rv-color-primary)" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
              </svg>
              <h4>资产库空空如也</h4>
              <p>
                {filterType !== "all"
                  ? "当前分类下未找到任何资产，请切换类型过滤器"
                  : "当前项目尚未关联任何本地素材，请使用左侧控制面板进行导入"}
              </p>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
