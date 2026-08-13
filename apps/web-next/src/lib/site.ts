import { DEFAULT_PUBLIC_SITE, PublicSiteBrand, normalizePublicSite } from "@reveria/shared/src/publicSite";

function apiOrigin() {
  return (process.env.API_INTERNAL_URL || "http://127.0.0.1:4100").replace(/\/$/, "");
}

export async function fetchPublicSite(): Promise<PublicSiteBrand> {
  try {
    const response = await fetch(`${apiOrigin()}/api/site`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return DEFAULT_PUBLIC_SITE;
    }
    const payload = (await response.json()) as { data?: unknown };
    return normalizePublicSite(payload.data ?? payload);
  } catch {
    return DEFAULT_PUBLIC_SITE;
  }
}

export function siteCanonical(site: PublicSiteBrand, path = "/") {
  const origin = site.public_origin.replace(/\/$/, "");
  if (!origin) {
    return path;
  }
  return `${origin}${path === "/" ? "" : path}`;
}
