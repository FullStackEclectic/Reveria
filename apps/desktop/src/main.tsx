import React from "react";
import ReactDOM from "react-dom/client";
import { configureApiBase, configureDesktopAuthRuntime } from "@reveria/shared";
import { ClearAuthTokens, LoadAuthTokens, SaveAuthTokens } from "../wailsjs/go/main/App";
import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
const configuredApiBase = import.meta.env.VITE_REVERIA_API_BASE?.trim();
const apiBase = configuredApiBase || (import.meta.env.DEV ? "http://127.0.0.1:4100" : "");
const hasWailsRuntime = Boolean(
  (window as Window & { go?: { main?: { App?: unknown } } }).go?.main?.App,
);

async function startDesktopApp() {
  if (!apiBase) {
    root.render(
      <div style={{ padding: 32, fontFamily: "sans-serif", color: "#b91c1c" }}>
        桌面端尚未配置云端 API。请设置 VITE_REVERIA_API_BASE 后重新构建。
      </div>,
    );
    return;
  }
  configureApiBase(apiBase);
  // 只有 Wails 原生窗口使用系统凭据库；普通浏览器调试使用 HttpOnly Cookie。
  if (hasWailsRuntime) {
    const storedTokens: Record<string, string> = await LoadAuthTokens().catch(() => ({}));
    configureDesktopAuthRuntime({
      accessToken: storedTokens.access_token || "",
      refreshToken: storedTokens.refresh_token || "",
      saveTokens: SaveAuthTokens,
      clearTokens: ClearAuthTokens,
    });
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startDesktopApp();
