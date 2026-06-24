import React from "react";
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { UserSummary } from "../../types";

interface InvitationModalProps {
  inviteToken: string | null;
  invitedClaims: any;
  currentUser: UserSummary | null;
  inviteError: string | null;
  isAcceptingInvite: boolean;
  handleAcceptInvitation: () => Promise<void>;
  handleCancelInvitation: () => void;
}

export function InvitationModal({
  inviteToken,
  invitedClaims,
  currentUser,
  inviteError,
  isAcceptingInvite,
  handleAcceptInvitation,
  handleCancelInvitation,
}: InvitationModalProps) {
  if (!inviteToken || !invitedClaims) return null;

  const isEmailMatch = currentUser && currentUser.email?.toLowerCase() === invitedClaims.sub?.toLowerCase();

  return (
    <div className="asset-dialog-backdrop" style={{ zIndex: 100 }}>
      <div className="asset-dialog" style={{ maxWidth: "480px", padding: "32px", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: isEmailMatch ? "#e0f2fe" : "#fee2e2",
            color: isEmailMatch ? "#0284c7" : "#dc2626",
            display: "grid",
            placeItems: "center"
          }}>
            {isEmailMatch ? (
              <Sparkles size={28} />
            ) : (
              <AlertTriangle size={28} />
            )}
          </div>

          {isEmailMatch ? (
            <>
              <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#1c1917", margin: 0 }}>
                加入工作区邀请
              </h3>
              <p style={{ fontSize: "14px", color: "#686155", margin: 0, lineHeight: 1.5 }}>
                您已被邀请加入工作区 <strong style={{ color: "#1c1917" }}>{invitedClaims.workspace_name}</strong>
                ，角色为 <strong style={{ color: "#1c1917" }}>{invitedClaims.role === "admin" ? "管理员" : "成员"}</strong>。
              </p>
              {inviteError ? (
                <div style={{ color: "#b91c1c", fontSize: "12px", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px", width: "100%" }}>
                  {inviteError}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "8px" }}>
                <button
                  className="secondary-button"
                  style={{ flex: 1 }}
                  type="button"
                  disabled={isAcceptingInvite}
                  onClick={handleCancelInvitation}
                >
                  忽略
                </button>
                <button
                  className="primary-button"
                  style={{ flex: 1 }}
                  type="button"
                  disabled={isAcceptingInvite}
                  onClick={() => void handleAcceptInvitation()}
                >
                  {isAcceptingInvite ? (
                    <Loader2 className="spin" size={16} />
                  ) : "接受并加入"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#b91c1c", margin: 0 }}>
                账号不匹配
              </h3>
              <p style={{ fontSize: "14px", color: "#686155", margin: 0, lineHeight: 1.5 }}>
                该邀请链接发给的是 <strong style={{ color: "#1c1917" }}>{invitedClaims.sub}</strong>，
                而您当前登录的账号为 <strong style={{ color: "#1c1917" }}>{currentUser?.email}</strong>。
                请先登出并使用目标邮箱注册或登录后再接受邀请。
              </p>
              <button
                className="secondary-button"
                style={{ width: "100%", marginTop: "8px" }}
                type="button"
                onClick={handleCancelInvitation}
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
