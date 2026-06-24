import { FormEvent, useState, useEffect } from "react";
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink, Save } from "lucide-react";
import { PortalProjectDetails, AssetSummary } from "../../types";
import { assetUrl, assetMimeType, formatFileSize, getJson, postJson, API_BASE } from "../../utils";
import "./ClientPortalView.css";


interface ClientPortalViewProps {
  shareToken: string;
  setShareToken: (token: string | null) => void;
  setPreviewAsset: (asset: AssetSummary | null) => void;
}

export function ClientPortalView({
  shareToken,
  setShareToken,
  setPreviewAsset,
}: ClientPortalViewProps) {
  const [portalDetails, setPortalDetails] = useState<PortalProjectDetails | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [clientCommentName, setClientCommentName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reveria.clientName") || "";
    }
    return "";
  });
  const [clientCommentText, setClientCommentText] = useState("");
  const [isAddingPortalComment, setIsAddingPortalComment] = useState(false);
  const [isApprovingPortalProject, setIsApprovingPortalProject] = useState(false);
  const [portalApproveMessage, setPortalApproveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (shareToken) {
      void fetchPortalProjectDetails(shareToken);
    }
  }, [shareToken]);

  async function fetchPortalProjectDetails(token: string) {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const details = await getJson<PortalProjectDetails>(`/api/portal/shares/${token}`);
      setPortalDetails(details);
    } catch (err: any) {
      setPortalError(err?.message || "加载门户详情失败，可能是链接已过期");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSavePortalComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareToken || !clientCommentName.trim() || !clientCommentText.trim()) return;
    setIsAddingPortalComment(true);
    try {
      await postJson(`/api/portal/shares/${shareToken}/comments`, {
        author_name: clientCommentName.trim(),
        content: clientCommentText.trim(),
      });
      setClientCommentText("");
      localStorage.setItem("reveria.clientName", clientCommentName.trim());
      await fetchPortalProjectDetails(shareToken);
    } catch (err: any) {
      alert(`提交意见失败: ${err?.message || err}`);
    } finally {
      setIsAddingPortalComment(false);
    }
  }

  async function handleApprovePortalProject() {
    if (!shareToken || !clientCommentName.trim()) return;
    setIsApprovingPortalProject(true);
    setPortalApproveMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/portal/shares/${shareToken}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: clientCommentName.trim() }),
      });
      if (!response.ok) {
        throw new Error(`一键审批失败: status ${response.status}`);
      }
      await fetchPortalProjectDetails(shareToken);
      setPortalApproveMessage("项目已一键审批通过并交付！感谢您的反馈！");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "审批失败");
    } finally {
      setIsApprovingPortalProject(false);
    }
  }

  if (portalLoading) {
    return (
      <div className="portal-loading">
        <Loader2 className="spin" size={36} />
        <p>正在加载客户审批门户...</p>
      </div>
    );
  }

  if (portalError || !portalDetails) {
    return (
      <div className="portal-error-page">
        <AlertTriangle size={48} />
        <h2>访问受限或链接无效</h2>
        <p>{portalError || "该分享链接不存在、已过期或已被撤销。"}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setShareToken(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("share_token");
            window.history.replaceState({}, document.title, url.pathname + url.search);
          }}
        >
          返回首页
        </button>
      </div>
    );
  }

  const { project, canvas, assets, comments } = portalDetails;
  const isDelivered = project.status === "delivered";

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <div className="portal-logo">R</div>
          <div>
            <h2>{project.name}</h2>
            <span className="portal-subtitle">客户审批与交付外部门户</span>
          </div>
        </div>

        <div className="portal-actions">
          {isDelivered ? (
            <div className="portal-approved-badge">
              <CheckCircle2 size={18} className="approved-icon" />
              <span>项目已通过审批并交付</span>
            </div>
          ) : (
            <div className="portal-approve-form">
              <input
                type="text"
                placeholder="输入您的姓名以确认审批..."
                value={clientCommentName}
                onChange={(e) => setClientCommentName(e.target.value)}
                className="portal-name-input"
              />
              <button
                type="button"
                onClick={handleApprovePortalProject}
                disabled={!clientCommentName.trim() || isApprovingPortalProject}
                className="portal-approve-button"
              >
                {isApprovingPortalProject ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                一键通过项目
              </button>
            </div>
          )}

          <button
            type="button"
            className="portal-exit-button"
            onClick={() => {
              setShareToken(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("share_token");
              window.history.replaceState({}, document.title, url.pathname + url.search);
            }}
          >
            退出
          </button>
        </div>
      </header>

      {portalApproveMessage && (
        <div className="portal-toast-message">
          <CheckCircle2 size={18} />
          <span>{portalApproveMessage}</span>
        </div>
      )}

      <div className="portal-body">
        <main className="portal-main">
          <section className="portal-section">
            <div className="section-title">
              <h3>交付看板</h3>
              <span>项目交付物与画布展示</span>
            </div>

            <div className="portal-canvas-board-wrapper">
              <div className="portal-canvas-board">
                {canvas.items.length ? (
                  canvas.items.map((item) => {
                    const asset = item.asset_id
                      ? assets.find((a) => a.id === item.asset_id)
                      : null;
                    return (
                      <div
                        className={`portal-canvas-item ${item.type}`}
                        key={item.id}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: item.w,
                          height: item.h,
                        }}
                      >
                        {item.type === "asset" && asset ? (
                          <>
                            {asset.thumbnail_url || asset.file_url ? (
                              <img
                                alt=""
                                src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")}
                                onClick={() => setPreviewAsset(asset)}
                              />
                            ) : (
                              <div className="canvas-item-fallback">{asset.asset_type}</div>
                            )}
                            <strong className="portal-item-title">{item.title}</strong>
                          </>
                        ) : (
                          <div className="portal-canvas-note">
                            {item.text}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="canvas-empty">工作区成员尚未在画布上添加内容。</div>
                )}
              </div>
            </div>
          </section>

          <section className="portal-section" style={{ marginTop: "24px" }}>
            <div className="section-title">
              <h3>素材与生成文件</h3>
              <span>共 {assets.length} 个交付资产文件</span>
            </div>

            {assets.length ? (
              <div className="portal-assets-grid">
                {assets.map((asset) => (
                  <div key={asset.id} className="portal-asset-card">
                    <div className="portal-asset-preview">
                      {asset.thumbnail_url || asset.file_url ? (
                        <img
                          alt={asset.metadata.title || "资产图片"}
                          src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")}
                          onClick={() => setPreviewAsset(asset)}
                        />
                      ) : (
                        <div className="fallback">{asset.asset_type}</div>
                      )}
                    </div>
                    <div className="portal-asset-info">
                      <strong>{asset.metadata.title || `未命名${asset.asset_type}`}</strong>
                      <div className="actions">
                        {asset.file_url && (
                          <a
                            href={assetUrl(asset.file_url)}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="download-link"
                          >
                            <ExternalLink size={12} />
                            下载文件
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <p>无素材或生成文件。</p>
              </div>
            )}
          </section>
        </main>

        <aside className="portal-sidebar">
          <div className="portal-sidebar-title">
            <h3>反馈与意见交流</h3>
            <span>当前有 {comments.length} 条意见</span>
          </div>

          <div className="portal-comments-list">
            {comments.length ? (
              comments.map((comment) => {
                const isSystem = comment.user_id === null && comment.user_display_name === "系统";
                return (
                  <div
                    key={comment.id}
                    className={`portal-comment-card ${isSystem ? "system-comment" : ""}`}
                  >
                    <div className="comment-header">
                      <strong>{comment.user_display_name}</strong>
                      <span className="time">
                        {new Date(comment.created_at * 1000).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="comment-content">{comment.content}</p>
                  </div>
                );
              })
            ) : (
              <div className="comments-empty">
                <p>暂无意见反馈。请在下方填写您的反馈。</p>
              </div>
            )}
          </div>

          <form className="portal-comment-form" onSubmit={handleSavePortalComment}>
            <h4>添加反馈意见</h4>
            <div className="form-group">
              <label>您的姓名</label>
              <input
                type="text"
                required
                placeholder="填写您的姓名..."
                value={clientCommentName}
                onChange={(e) => setClientCommentName(e.target.value)}
                className="portal-name-input-field"
              />
            </div>
            <div className="form-group">
              <label>意见内容</label>
              <textarea
                required
                rows={4}
                placeholder="填写您的修改意见或审批意见..."
                value={clientCommentText}
                onChange={(e) => setClientCommentText(e.target.value)}
                className="portal-comment-textarea"
              />
            </div>
            <button
              type="submit"
              disabled={!clientCommentName.trim() || !clientCommentText.trim() || isAddingPortalComment}
              className="portal-comment-submit-button"
            >
              {isAddingPortalComment ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              提交意见
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
