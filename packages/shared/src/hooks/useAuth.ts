import { useState, FormEvent, useEffect } from "react";
import { UserSummary, DevLoginResponse } from "../types";
import { 
  postJson, 
  CURRENT_USER_STORAGE_KEY, 
  ACCESS_TOKEN_STORAGE_KEY, 
  readCachedUser 
} from "../utils";

interface UseAuthProps {
  onAuthSuccess?: () => void | Promise<void>;
  onLogoutSuccess?: () => void | Promise<void>;
  inviteToken: string | null;
  setInviteToken: (token: string | null) => void;
  invitedClaims: any;
  setInvitedClaims: (claims: any) => void;
  refreshAll?: () => Promise<void>;
}

export function useAuth({
  onAuthSuccess,
  onLogoutSuccess,
  inviteToken,
  setInviteToken,
  invitedClaims,
  setInvitedClaims,
  refreshAll,
}: UseAuthProps) {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginCallback, setLoginCallback] = useState<(() => void) | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register" | "dev">("login");
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    displayName: "",
  });

  // 恢复登录态
  async function restoreCurrentUser() {
    const cached = readCachedUser();
    if (cached) {
      setCurrentUser(cached);
    }
  }

  // 退出登录
  async function handleLogout() {
    try {
      await postJson("/api/auth/logout", {});
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUser(null);
    if (onLogoutSuccess) {
      void onLogoutSuccess();
    }
  }

  // 密码/注册认证
  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage("");
    try {
      const response =
        loginMode === "register"
          ? await postJson<DevLoginResponse>("/api/auth/register", {
              display_name: loginForm.displayName,
              email: loginForm.email,
              password: loginForm.password,
            })
          : await postJson<DevLoginResponse>("/api/auth/login", {
              email: loginForm.email,
              password: loginForm.password,
            });
      if (response.access_token && typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      setCurrentUser(response.user);
      setIsLoginModalOpen(false);

      if (inviteToken && response.user.email?.toLowerCase() === invitedClaims?.sub?.toLowerCase()) {
        if (loginMode === "register") {
          try {
            await postJson("/api/invitations/accept", { token: inviteToken });
            setInviteToken(null);
            setInvitedClaims(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            window.history.replaceState({}, document.title, url.pathname + url.search);
            if (refreshAll) {
              await refreshAll();
            }
          } catch (err) {
            console.error("Auto-accept invitation failed:", err);
          }
        }
      }

      if (onAuthSuccess) {
        void onAuthSuccess();
      }
      if (loginCallback) {
        loginCallback();
        setLoginCallback(null);
      }
    } catch {
      setLoginMessage(
        loginMode === "register"
          ? "注册失败：邮箱可能已存在，密码至少 8 位"
          : "登录失败：请检查邮箱、密码以及数据库连接"
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  // 开发极速登录
  async function handleDevLogin() {
    setIsLoggingIn(true);
    setLoginMessage("");
    try {
      const email = inviteToken && invitedClaims ? invitedClaims.sub : (loginForm.email || null);
      const displayName = loginForm.displayName || "开发用户";
      const response = await postJson<DevLoginResponse>("/api/auth/dev-login", {
        display_name: displayName,
        email: email,
      });
      if (response.access_token && typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      setCurrentUser(response.user);
      setIsLoginModalOpen(false);

      if (inviteToken && response.user.email?.toLowerCase() === invitedClaims?.sub?.toLowerCase()) {
        try {
          await postJson("/api/invitations/accept", { token: inviteToken });
          setInviteToken(null);
          setInvitedClaims(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("token");
          window.history.replaceState({}, document.title, url.pathname + url.search);
          if (refreshAll) {
            await refreshAll();
          }
        } catch (err) {
          console.error("Auto-accept invitation failed:", err);
        }
      }

      if (onAuthSuccess) {
        void onAuthSuccess();
      }
      if (loginCallback) {
        loginCallback();
        setLoginCallback(null);
      }
    } catch {
      setLoginMessage("开发登录失败：请确认数据库已连接并完成迁移");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return {
    currentUser,
    setCurrentUser,
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginCallback,
    setLoginCallback,
    isLoggingIn,
    loginMessage,
    setLoginMessage,
    loginMode,
    setLoginMode,
    loginForm,
    setLoginForm,
    restoreCurrentUser,
    handleLogout,
    handlePasswordAuth,
    handleDevLogin,
  };
}
