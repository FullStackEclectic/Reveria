"use client";

import { TERMS_OF_SERVICE } from "@reveria/shared";
import "@reveria/shared/src/styles.css";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{TERMS_OF_SERVICE}</pre>
    </main>
  );
}
