import React, { FormEvent, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { API_BASE } from "../../utils";
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
  isModal?: boolean;
  onClose?: () => void;
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
  isModal = false,
  onClose,
}: LoginViewProps) {
  // 服务条款勾选状态（仿美图设计室大厂合规规范）
  const [agreementChecked, setAgreementChecked] = useState(false);

  const overlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <main className={isModal ? "login-modal-overlay" : "login-shell"} onClick={overlayClick}>
      <section className="login-card-container">
        
        {/* 左半侧：高颜值插画宣传板 */}
        <div className="login-visual-panel">
          {/* 装饰性网格背景 */}
          <div className="visual-grid-bg" />
          
          {/* 顶部 Logo 栏 */}
          <div className="visual-logo-row">
            <div className="visual-logo-mark">R</div>
            <div>
              <span className="visual-logo-text">Reveria</span>
              <span className="visual-logo-sub">创意交付工作台</span>
            </div>
          </div>
          
          {/* 立体层叠卡片堆 (仿美图设计室，倾斜 3D 浮雕交互) */}
          <div className="visual-cards-stack">
            <div className="visual-card-item card-under">
              <img src={`${API_BASE}/api/files/model_anime.png`} alt="Anime preset" onError={(e) => {
                // 防御本地无图片时裂图，静默展示淡色渐变
                e.currentTarget.style.display = "none";
              }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: "8px", fontSize: "10px", color: "#94a3b8" }}>
                ART PRESENCE
              </div>
              <span className="visual-card-pill pill-cyan">动漫插画渲染</span>
            </div>
            
            <div className="visual-card-item card-above">
              <img src={`${API_BASE}/api/files/model_portrait.png`} alt="Portrait preset" onError={(e) => {
                e.currentTarget.style.display = "none";
              }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: "8px", fontSize: "10px", color: "#94a3b8" }}>
                AI GENERATION
              </div>
              <span className="visual-card-pill pill-orange">智能电商海报</span>
            </div>
          </div>
          
          {/* 下方大厂口号 */}
          <div className="visual-slogan-box">
            <h3>电商物料智能渲染</h3>
            <p>爆款图配视频，更带货，更吸睛</p>
          </div>
        </div>
        
        {/* 右半侧：核心登录表单区 */}
        <div className="login-form-panel">
          {isModal && onClose && (
            <button
              type="button"
              className="login-card-close-btn"
              onClick={onClose}
              title="关闭"
            >
              <X size={20} />
            </button>
          )}
          
          <div className="form-inner-content">
            <h2 className="form-main-title">
              {loginMode === "register" ? "创建您的 Reveria 账号" : "欢迎登录 Reveria"}
            </h2>
            
            {/* 极简横线切换 TAB */}
            <div className="form-tabs-underlined">
              <button
                className={loginMode === "login" ? "active" : ""}
                type="button"
                onClick={() => setLoginMode("login")}
              >
                账号登录
              </button>
              <button
                className={loginMode === "register" ? "active" : ""}
                type="button"
                onClick={() => setLoginMode("register")}
              >
                快速注册
              </button>
            </div>
            
            <form onSubmit={handlePasswordAuth} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
              {loginMessage ? <div className="notice">{loginMessage}</div> : null}
              {inviteToken && invitedClaims ? (
                <div className="notice" style={{ borderColor: "#0284c7", color: "#0284c7", background: "#f0f9ff", padding: "10px", borderRadius: "6px", fontSize: "12px", lineHeight: "1.4" }}>
                  您正通过邀请链接注册或登录，将加入工作区 <strong>{invitedClaims.workspace_name}</strong>。
                </div>
              ) : null}
              
              {loginMode === "register" ? (
                <div className="form-floating-group">
                  <input
                    type="text"
                    name="displayName"
                    autoComplete="name"
                    required
                    placeholder="请输入显示名称"
                    className="form-classic-input"
                    value={loginForm.displayName}
                    onChange={(event) =>
                      setLoginForm({
                        ...loginForm,
                        displayName: event.target.value,
                      })
                    }
                  />
                </div>
              ) : null}

              <div className="form-floating-group">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="请输入电子邮箱"
                  className="form-classic-input"
                  value={loginForm.email}
                  disabled={!!inviteToken}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      email: event.target.value,
                    })
                  }
                />
              </div>

              <div className="form-floating-group">
                <input
                  type="password"
                  name="password"
                  autoComplete={loginMode === "register" ? "new-password" : "current-password"}
                  required
                  placeholder="请输入登录密码 (不少于8位)"
                  className="form-classic-input"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      password: event.target.value,
                    })
                  }
                />
              </div>
              
              {/* 条款勾选 */}
              <label className="form-agreement-label">
                <input 
                  type="checkbox" 
                  checked={agreementChecked} 
                  onChange={(e) => setAgreementChecked(e.target.checked)} 
                  style={{ width: "14px", height: "14px" }}
                />
                <span>
                  我已阅读并同意 <a href="#" onClick={(e) => { e.preventDefault(); alert("《Reveria用户协议》：在此为您提供安全合规的创意服务。"); }}>用户协议</a>、
                  <a href="#" onClick={(e) => { e.preventDefault(); alert("《Reveria隐私保护政策》：我们承诺保护您的账户隐私安全。"); }}>隐私政策</a> 和账号规则
                </span>
              </label>

              <button
                className="form-submit-pill-btn"
                type="submit"
                disabled={
                  isLoggingIn ||
                  !agreementChecked ||
                  !loginForm.email ||
                  loginForm.password.length < 8 ||
                  (loginMode === "register" && !loginForm.displayName)
                }
              >
                {isLoggingIn ? (
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                ) : (
                  <Sparkles size={16} aria-hidden="true" />
                )}
                {isLoggingIn ? "正在认证..." : loginMode === "register" ? "立即注册并登录" : "立即进入工作区"}
              </button>
            </form>
          </div>
        </div>
        
      </section>
    </main>
  );
}
