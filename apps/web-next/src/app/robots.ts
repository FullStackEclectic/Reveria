import type { MetadataRoute } from "next";
import { fetchPublicSite } from "../lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await fetchPublicSite();
  const origin = site.public_origin.replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/app", "/admin"] },
    ],
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
