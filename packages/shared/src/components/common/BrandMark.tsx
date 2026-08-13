import React from "react";
import { PublicSiteBrand } from "../../publicSite";

export function BrandMark({ site }: { site: PublicSiteBrand }) {
  const title = site.site_title || "Reveria";
  const letter = title.trim().charAt(0).toUpperCase() || "R";
  return (
    <>
      {site.logo_url ? (
        <img className="brand-logo-img" src={site.logo_url} alt="" />
      ) : (
        <div className="brand-logo-icon" style={site.brand_color ? { background: site.brand_color } : undefined}>
          {letter}
        </div>
      )}
      <span className="brand-logo-text">{title}</span>
    </>
  );
}
