import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fetchPublicSite, siteCanonical } from "../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const site = await fetchPublicSite();
  const canonical = site.public_origin ? siteCanonical(site, "/") : undefined;
  return {
    title: {
      default: site.site_title,
      template: `%s · ${site.site_title}`,
    },
    description: site.site_description,
    applicationName: site.site_title,
    metadataBase: site.public_origin ? new URL(site.public_origin) : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: site.site_title,
      description: site.site_description,
      locale: "zh_CN",
      type: "website",
      url: canonical,
      siteName: site.site_title,
    },
    twitter: {
      card: "summary_large_image",
      title: site.site_title,
      description: site.site_description,
    },
    icons: site.favicon_url ? { icon: site.favicon_url } : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
