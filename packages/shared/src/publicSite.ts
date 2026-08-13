export type PublicSiteBrand = {
  site_title: string;
  site_tagline: string;
  site_description: string;
  site_announcement: string;
  public_origin: string;
  logo_url: string;
  favicon_url: string;
  brand_color: string;
  contact_email: string;
  allow_user_register: boolean;
};

export const DEFAULT_PUBLIC_SITE: PublicSiteBrand = {
  site_title: "Reveria",
  site_tagline: "创意交付工作台",
  site_description: "面向传媒工作室的 AI 创意生产、无限画布与图像精修平台。",
  site_announcement: "",
  public_origin: "",
  logo_url: "",
  favicon_url: "",
  brand_color: "",
  contact_email: "",
  allow_user_register: false,
};

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizePublicSite(raw: unknown): PublicSiteBrand {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    site_title: readString(data.site_title, DEFAULT_PUBLIC_SITE.site_title),
    site_tagline: readString(data.site_tagline, DEFAULT_PUBLIC_SITE.site_tagline),
    site_description: readString(data.site_description, DEFAULT_PUBLIC_SITE.site_description),
    site_announcement: typeof data.site_announcement === "string" ? data.site_announcement : "",
    public_origin: readString(data.public_origin, ""),
    logo_url: readString(data.logo_url, ""),
    favicon_url: readString(data.favicon_url, ""),
    brand_color: readString(data.brand_color, ""),
    contact_email: readString(data.contact_email, ""),
    allow_user_register: data.allow_user_register === true,
  };
}

