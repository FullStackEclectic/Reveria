import type { Metadata } from "next";
import { TERMS_OF_SERVICE } from "@reveria/shared/src/legalTexts";
import "@reveria/shared/src/styles.css";

export const metadata: Metadata = {
  title: "用户协议",
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{TERMS_OF_SERVICE}</pre>
    </main>
  );
}
