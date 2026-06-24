"use client";

import { useEffect, useState } from "react";
import { AdminConsole } from "@reveria/shared";
import { UserSummary } from "@reveria/shared";
import { readCachedUser } from "@reveria/shared";
import "@reveria/shared/src/styles.css";

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    const user = readCachedUser();
    setCurrentUser(user);
    setIsLoading(false);
  }, []);

  // 避免 SSR 水合不匹配错误及状态装载竞态
  if (!isMounted || isLoading) {
    return (
      <div 
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b"
        }}
      >
        正在装载 Reveria 控制台...
      </div>
    );
  }

  // 严格鉴权：未登录或不是超级管理员，自动重定向至首页强制登录
  if (!currentUser || !currentUser.is_platform_admin) {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return (
      <div 
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444"
        }}
      >
        未授权访问，正在跳转...
      </div>
    );
  }

  return (
    <AdminConsole
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      onBack={() => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }}
    />
  );
}
