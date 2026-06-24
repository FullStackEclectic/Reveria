"use client";

import { useEffect, useState } from "react";
import { AdminConsole } from "@reveria/shared";
import { UserSummary } from "@reveria/shared";
import { readCachedUser } from "@reveria/shared";
import "@reveria/shared/src/styles.css";

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const user = readCachedUser();
    setCurrentUser(user);
  }, []);

  // 避免 SSR 水合不匹配错误
  if (!isMounted) {
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
