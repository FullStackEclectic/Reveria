import React from "react";

export const metadata = {
  title: "Reveria Web Console",
  description: "Next.js Web Portal for Reveria Creative Canvas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
