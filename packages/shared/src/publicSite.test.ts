import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_SITE, normalizePublicSite } from "./publicSite";

describe("normalizePublicSite", () => {
  it("fills defaults and ignores unknown fields", () => {
    const site = normalizePublicSite({ site_title: "青橙", extra: true });
    expect(site.site_title).toBe("青橙");
    expect(site.site_tagline).toBe(DEFAULT_PUBLIC_SITE.site_tagline);
    expect(site.allow_user_register).toBe(false);
  });
});
