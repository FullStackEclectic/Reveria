import type { MetadataRoute } from "next";
import { fetchPublicSite, siteCanonical } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await fetchPublicSite();
  if (!site.public_origin) {
    return [];
  }
  const lastModified = new Date();
  return [
    { url: siteCanonical(site, "/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: siteCanonical(site, "/legal/terms"), lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: siteCanonical(site, "/legal/privacy"), lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
