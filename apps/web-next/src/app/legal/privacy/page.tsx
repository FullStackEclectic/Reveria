import type { Metadata } from "next";
import { PRIVACY_POLICY } from "@reveria/shared/src/legalTexts";
import "@reveria/shared/src/styles.css";

export const metadata: Metadata = {
  title: "隐私政策",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{PRIVACY_POLICY}</pre>
    </main>
  );
}
