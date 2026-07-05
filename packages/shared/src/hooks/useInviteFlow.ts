import { useState, useEffect } from "react";
import { parseJwt, postJson } from "../utils";

interface UseInviteFlowProps {
  currentUser: any;
  refreshAll: () => Promise<void>;
  inviteToken: string | null;
  setInviteToken: (token: string | null) => void;
  invitedClaims: any;
  setInvitedClaims: (claims: any) => void;
}

export function useInviteFlow({
  currentUser,
  refreshAll,
  inviteToken,
  setInviteToken,
  invitedClaims,
  setInvitedClaims,
}: UseInviteFlowProps) {
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // 监听 URL 中带的邀请 token 胶囊
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        setInviteToken(token);
        try {
          const claims = parseJwt(token);
          setInvitedClaims(claims);
        } catch {
          setInviteError("邀请令牌解析失败");
        }
      }
    }
  }, [setInviteToken, setInvitedClaims]);

  async function handleAcceptInvitation() {
    if (!inviteToken) return;
    setIsAcceptingInvite(true);
    setInviteError(null);
    try {
      await postJson("/api/invitations/accept", { token: inviteToken });
      setInviteToken(null);
      setInvitedClaims(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + url.search);
      await refreshAll();
    } catch (err: any) {
      setInviteError(err.message || "接受邀请失败");
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  function handleCancelInvitation() {
    setInviteToken(null);
    setInvitedClaims(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }

  return {
    isAcceptingInvite,
    inviteError,
    handleAcceptInvitation,
    handleCancelInvitation,
  };
}
