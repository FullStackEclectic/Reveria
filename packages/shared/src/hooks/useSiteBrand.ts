import { useEffect, useState } from "react";
import { DEFAULT_PUBLIC_SITE, PublicSiteBrand, normalizePublicSite } from "../publicSite";
import { getJson } from "../utils";

type SiteEnvelope = { success?: boolean; data?: unknown };

let cachedSite: PublicSiteBrand | null = null;
let inflight: Promise<PublicSiteBrand> | null = null;

export function clearPublicSiteCache() {
  cachedSite = null;
}

export async function loadPublicSite(): Promise<PublicSiteBrand> {
  if (cachedSite) {
    return cachedSite;
  }
  if (!inflight) {
    inflight = getJson<SiteEnvelope>("/api/site")
      .then((payload) => {
        cachedSite = normalizePublicSite(payload?.data ?? payload);
        return cachedSite;
      })
      .catch(() => DEFAULT_PUBLIC_SITE)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function applySiteBrandToDocument(site: PublicSiteBrand) {
  if (typeof document === "undefined") {
    return;
  }
  if (site.site_title) {
    document.title = site.site_title;
  }
  if (site.brand_color) {
    document.documentElement.style.setProperty("--rv-color-primary", site.brand_color);
  }
  if (site.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = site.favicon_url;
  }
}

export function useSiteBrand(): PublicSiteBrand {
  const [site, setSite] = useState<PublicSiteBrand>(cachedSite ?? DEFAULT_PUBLIC_SITE);
  useEffect(() => {
    void loadPublicSite().then((next) => {
      setSite(next);
      applySiteBrandToDocument(next);
    });
  }, []);
  return site;
}
