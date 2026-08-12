"use client";

import { PRIVACY_POLICY } from "@reveria/shared";
import "@reveria/shared/src/styles.css";

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{PRIVACY_POLICY}</pre>
    </main>
  );
}
