import React from "react";
import ReactDOM from "react-dom/client";
import { configureApiBase, configureDesktopAuthRuntime } from "@reveria/shared";
import { ClearAuthTokens, LoadAuthTokens, SaveAuthTokens } from "../wailsjs/go/main/App";
import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
const apiBase = import.meta.env.VITE_REVERIA_API_BASE?.trim();

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
  const storedTokens: Record<string, string> = await LoadAuthTokens().catch(() => ({}));
  configureDesktopAuthRuntime({
    accessToken: storedTokens.access_token || "",
    refreshToken: storedTokens.refresh_token || "",
    saveTokens: SaveAuthTokens,
    clearTokens: ClearAuthTokens,
  });
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startDesktopApp();
