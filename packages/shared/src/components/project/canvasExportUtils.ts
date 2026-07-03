import { ProjectSummary, ProjectCanvasDocument, AssetSummary } from "../../types";
import { sanitizeDownloadName, downloadTextFile, assetUrl } from "../../utils";

export function getCardColorStyle(colorTheme?: string) {
  switch (colorTheme) {
    case "amber":
      return {
        background: "rgba(254, 243, 199, 0.85)",
        text: "hsl(30, 80%, 20%)",
        border: "rgba(252, 211, 77, 0.5)",
      };
    case "emerald":
      return {
        background: "rgba(209, 250, 229, 0.85)",
        text: "hsl(160, 80%, 15%)",
        border: "rgba(110, 231, 183, 0.5)",
      };
    case "blue":
      return {
        background: "rgba(219, 234, 254, 0.85)",
        text: "hsl(210, 80%, 20%)",
        border: "rgba(147, 197, 253, 0.5)",
      };
    case "rose":
      return {
        background: "rgba(252, 228, 236, 0.85)",
        text: "hsl(340, 80%, 20%)",
        border: "rgba(244, 143, 177, 0.5)",
      };
    case "slate":
      return {
        background: "rgba(241, 245, 249, 0.85)",
        text: "hsl(215, 25%, 20%)",
        border: "rgba(203, 213, 225, 0.5)",
      };
    case "default":
    default:
      return {
        background: "rgba(255, 255, 255, 0.95)",
        text: "var(--rv-color-text-main)",
        border: "var(--rv-color-border-thin)",
      };
  }
}

export function exportCanvasToSVG(
  projectCanvas: ProjectCanvasDocument,
  activeBoardId: string,
  selectedProject: ProjectSummary,
  assets: AssetSummary[]
) {
  const boards = projectCanvas.boards || [];
  const activeBoard = boards.find((b) => b.id === activeBoardId) || { id: "default", name: "主画板" };
  const visibleItems = projectCanvas.items.filter(
    (item) => (item.board_id || "default") === activeBoardId
  );

  if (visibleItems.length === 0) {
    alert("当前画板无内容，无法导出 SVG");
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  visibleItems.forEach((item) => {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.x + item.w > maxX) maxX = item.x + item.w;
    if (item.y + item.h > maxY) maxY = item.y + item.h;
  });

  minX -= 40;
  minY -= 40;
  maxX += 40;
  maxY += 40;
  const width = maxX - minX;
  const height = maxY - minY;

  const svgElements = visibleItems
    .map((item) => {
      const x = item.x - minX;
      const y = item.y - minY;
      const w = item.w;
      const h = item.h;
      const colors = getCardColorStyle(item.color);

      if (item.type === "note") {
        return `
    <g id="${item.id}" transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="12" fill="${colors.background}" stroke="${colors.border}" stroke-width="1.5" />
      <foreignObject width="${w}" height="${h}" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
        <div xmlns="http://www.w3.org/1999/xhtml" style="padding: 16px; font-family: sans-serif; font-size: ${item.fontSize === 'lg' ? '16px' : item.fontSize === 'sm' ? '12px' : '14px'}; color: ${colors.text}; line-height: 1.5; height: 100%; box-sizing: border-box; overflow: hidden;">
          <div style="font-weight: bold; margin-bottom: 8px; font-size: ${item.titleSize === 'lg' ? '18px' : item.titleSize === 'sm' ? '12px' : '14px'};">${item.title}</div>
          <div style="white-space: pre-wrap; word-break: break-all; opacity: 0.95;">${item.text || ""}</div>
        </div>
      </foreignObject>
    </g>`;
      } else {
        const asset = assets.find((a) => a.id === item.asset_id);
        const imageUrl = asset?.file_url || asset?.thumbnail_url;
        const assetImgSrc = imageUrl ? assetUrl(imageUrl) : "";
        const imageElement = assetImgSrc
          ? `
      <image href="${assetImgSrc}" x="10" y="10" width="${w - 20}" height="${h - 48}" preserveAspectRatio="xMidYMid slice" style="clip-path: inset(0px round 8px);"/>`
          : `
      <rect x="10" y="10" width="${w - 20}" height="${h - 48}" rx="8" fill="#e9e4da" stroke="#dcd9d0"/>
      <text x="${w / 2}" y="${(h - 48) / 2 + 15}" font-family="sans-serif" font-size="12" fill="#6b645d" font-weight="bold" text-anchor="middle">${asset?.asset_type || "asset"}</text>`;

        return `
    <g id="${item.id}" transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="12" fill="${colors.background}" stroke="${colors.border}" stroke-width="1.5" />
      ${imageElement}
      <text x="${w / 2}" y="${h - 18}" font-family="sans-serif" font-size="12" fill="${colors.text}" font-weight="bold" text-anchor="middle" clip-path="inset(0px 10px)">${item.title}</text>
    </g>`;
      }
    })
    .join("\n");

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fbfaf7" />
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(185, 178, 165, 0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
  
  <text x="30" y="40" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1c1d21">${selectedProject.name} - ${activeBoard.name}</text>
  <text x="30" y="65" font-family="sans-serif" font-size="12" fill="#736f6a">导出时间: ${new Date().toLocaleString("zh-CN")}</text>

  <g transform="translate(0, 40)">
    ${svgElements}
  </g>
</svg>`;

  const fileName = `${sanitizeDownloadName(selectedProject.name)}-${sanitizeDownloadName(activeBoard.name)}.svg`;
  downloadTextFile(fileName, svgContent, "image/svg+xml");
}
