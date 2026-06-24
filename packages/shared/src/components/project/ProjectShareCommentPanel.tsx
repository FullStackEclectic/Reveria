import { FormEvent, useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { ProjectSummary, UserSummary, ProjectCommentSummary, ProjectShareSummary } from "../../types";
import { getJson, postJson, deleteJson } from "../../utils";

interface ProjectShareCommentPanelProps {
  selectedProject: ProjectSummary;
  currentUser: UserSummary | null;
}

export function ProjectShareCommentPanel({
  selectedProject,
  currentUser,
}: ProjectShareCommentPanelProps) {
  const [projectComments, setProjectComments] = useState<ProjectCommentSummary[]>([]);
  const [projectShares, setProjectShares] = useState<ProjectShareSummary[]>([]);
  const [newProjectCommentText, setNewProjectCommentText] = useState("");
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareExpiresInDays, setShareExpiresInDays] = useState(7);

  const selectedProjectId = selectedProject.id;

  // Load project comments and shares when active project changes
  useEffect(() => {
    if (selectedProjectId) {
      void loadProjectComments(selectedProjectId);
      void loadProjectShares(selectedProjectId);
    } else {
      setProjectComments([]);
      setProjectShares([]);
    }
  }, [selectedProjectId]);

  async function loadProjectComments(projectId: string) {
    try {
      const comments = await getJson<ProjectCommentSummary[]>(
        `/api/projects/${projectId}/comments`
      );
      setProjectComments(comments);
    } catch {
      setProjectComments([]);
    }
  }

  async function loadProjectShares(projectId: string) {
    try {
      const shares = await getJson<ProjectShareSummary[]>(
        `/api/projects/${projectId}/shares`
      );
      setProjectShares(shares);
    } catch {
      setProjectShares([]);
    }
  }

  async function handleSaveProjectComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newProjectCommentText.trim()) return;
    try {
      const comment = await postJson<ProjectCommentSummary>(
        `/api/projects/${selectedProject.id}/comments`,
        { content: newProjectCommentText }
      );
      setProjectComments((prev) => [...prev, comment]);
      setNewProjectCommentText("");
    } catch (err) {
      console.error("Failed to save project comment:", err);
    }
  }

  async function handleCreateProjectShare() {
    setIsCreatingShare(true);
    try {
      const share = await postJson<ProjectShareSummary>(
        `/api/projects/${selectedProjectId}/shares`,
        { expires_in_days: shareExpiresInDays > 0 ? shareExpiresInDays : null }
      );
      setProjectShares((prev) => [share, ...prev]);
    } catch (err) {
      console.error("Failed to create share link:", err);
      alert("生成分享链接失败");
    } finally {
      setIsCreatingShare(false);
    }
  }

  async function handleRevokeProjectShare(shareId: string) {
    try {
      await deleteJson(`/api/shares/${shareId}`);
      setProjectShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, status: "revoked" } : s))
      );
    } catch (err) {
      console.error("Failed to revoke share link:", err);
      alert("撤销分享链接失败");
    }
  }

  return (
    <div className="panel compact-panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Share link management */}
      <div>
        <div className="panel-header">
          <h3>一键交付与审批链接</h3>
          <span>生成免登录安全外链分享给客户</span>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#686155" }}>有效期:</span>
            <select
              value={shareExpiresInDays}
              onChange={(e) => setShareExpiresInDays(Number(e.target.value))}
              style={{ minHeight: "32px", padding: "0 6px" }}
            >
              <option value={1}>1 天</option>
              <option value={7}>7 天</option>
              <option value={30}>30 天</option>
              <option value={0}>永久有效</option>
            </select>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={isCreatingShare}
            onClick={handleCreateProjectShare}
          >
            {isCreatingShare ? "正在生成..." : "生成分享链接"}
          </button>
        </div>
        
        {projectShares.length > 0 && (
          <div className="project-list" style={{ marginTop: "10px", maxHeight: "120px", overflow: "auto" }}>
            {projectShares.map((share) => {
              const isRevoked = share.status === "revoked";
              const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
              const shareUrl = `${window.location.origin}/?share_token=${share.token}`;
              return (
                <div className="project-row" key={share.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                        {isRevoked ? "已撤销" : isExpired ? "已过期" : "活跃"}
                      </span>
                      {!isRevoked && !isExpired && (
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--rv-color-primary)" }}
                        >
                          打开链接 <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <span style={{ fontSize: "10px", color: "#8b7e66" }}>
                      到期时间: {share.expires_at ? new Date(share.expires_at).toLocaleDateString() : "永久"}
                    </span>
                  </div>
                  {!isRevoked && (
                    <button
                      type="button"
                      className="mini-action-button"
                      onClick={() => handleRevokeProjectShare(share.id)}
                      style={{ minHeight: "24px", color: "#b91c1c" }}
                    >
                      撤销
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comment comments list */}
      <div style={{ borderTop: "1px solid #e6e0d4", paddingTop: "12px" }}>
        <div className="panel-header">
          <h3>项目沟通协作（共 {projectComments.length} 条）</h3>
          <span>内部讨论与客户批注</span>
        </div>
        <div className="project-list" style={{ maxHeight: "140px", overflow: "auto", marginTop: "10px" }}>
          {projectComments.length ? (
            projectComments.map((comment) => (
              <div className="project-row" key={comment.id} style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "12px" }}>{comment.user_display_name}</strong>
                  <small style={{ color: "#8b7e66", fontSize: "10px" }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </small>
                </div>
                <p style={{ fontSize: "12px", margin: 0, whiteSpace: "pre-wrap" }}>{comment.content}</p>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty">
              <p style={{ fontSize: "12px" }}>暂无讨论，在下方留言发表意见。</p>
            </div>
          )}
        </div>
        <form onSubmit={handleSaveProjectComment} style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <input
            required
            placeholder="说点什么或回复客户的审批意见..."
            value={newProjectCommentText}
            onChange={(e) => setNewProjectCommentText(e.target.value)}
            style={{ flex: 1, minHeight: "32px" }}
          />
          <button type="submit" className="primary-button" style={{ minHeight: "32px", padding: "0 12px" }}>
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
