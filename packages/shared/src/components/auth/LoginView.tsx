import React, { FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import "./LoginView.css";


interface LoginViewProps {
  loginForm: any;
  setLoginForm: (form: any) => void;
  loginMode: "login" | "register" | "dev";
  setLoginMode: (mode: "login" | "register" | "dev") => void;
  loginMessage: string;
  inviteToken: string | null;
  invitedClaims: any;
  isLoggingIn: boolean;
  handlePasswordAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDevLogin: () => Promise<void>;
}

export function LoginView({
  loginForm,
  setLoginForm,
  loginMode,
  setLoginMode,
  loginMessage,
  inviteToken,
  invitedClaims,
  isLoggingIn,
  handlePasswordAuth,
  handleDevLogin,
}: LoginViewProps) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>Reveria</h1>
            <p>创意交付工作台</p>
          </div>
        </div>
        <form className="login-form" onSubmit={handlePasswordAuth}>
          {loginMessage ? <div className="notice">{loginMessage}</div> : null}
          {inviteToken && invitedClaims ? (
            <div className="notice" style={{ borderColor: "#0284c7", color: "#0284c7", background: "#f0f9ff", padding: "10px", borderRadius: "6px", fontSize: "13px", lineHeight: "1.4" }}>
              您正通过邀请链接注册或登录，将加入工作区 <strong>{invitedClaims.workspace_name}</strong>。
            </div>
          ) : null}
          <div className="login-tabs">
            <button
              className={loginMode === "login" ? "active" : ""}
              type="button"
              onClick={() => setLoginMode("login")}
            >
              登录
            </button>
            <button
              className={loginMode === "register" ? "active" : ""}
              type="button"
              onClick={() => setLoginMode("register")}
            >
              注册
            </button>
          </div>
          {loginMode === "register" ? (
            <label>
              显示名称
              <input
                value={loginForm.displayName}
                onChange={(event) =>
                  setLoginForm({
                    ...loginForm,
                    displayName: event.target.value,
                  })
                }
              />
            </label>
          ) : null}
          <label>
            邮箱
            <input
              value={loginForm.email}
              disabled={!!inviteToken}
              onChange={(event) =>
                setLoginForm({
                  ...loginForm,
                  email: event.target.value,
                })
              }
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({
                  ...loginForm,
                  password: event.target.value,
                })
              }
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={
              isLoggingIn ||
              !loginForm.email ||
              loginForm.password.length < 8 ||
              (loginMode === "register" && !loginForm.displayName)
            }
          >
            {isLoggingIn ? (
              <Loader2 className="spin" size={18} aria-hidden="true" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {loginMode === "register" ? "注册并登录" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
