import React, { useEffect, useRef } from "react";
import type { OverlayLayer, RetouchSettings } from "./editorConstants";
import { CANVAS_BLEND, overlayHasContent } from "./retouch/overlays";
import { renderOverlayLayer } from "./retouch/overlayComposite";

function OverlayPreviewLayer({ layer }: { layer: OverlayLayer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const width = Math.max(1, Math.round(parent.clientWidth));
    const height = Math.max(1, Math.round(parent.clientHeight));
    canvas.width = width;
    canvas.height = height;
    const rendered = renderOverlayLayer(layer, width, height);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(rendered, 0, 0);
  }, [layer]);

  return (
    <canvas
      ref={canvasRef}
      className="overlay-preview-layer"
      style={{
        opacity: layer.opacity / 100,
        mixBlendMode: (layer.kind === "duotone" ? "color" : CANVAS_BLEND[layer.blend]) as React.CSSProperties["mixBlendMode"],
      }}
    />
  );
}

export function OverlayPreview({ settings, hidden }: { settings: RetouchSettings; hidden: boolean }) {
  const layers = settings.overlays.filter(overlayHasContent);
  if (hidden || layers.length === 0) return null;
  return (
    <div className="overlay-preview-stack" aria-hidden>
      {layers.map((layer) => <OverlayPreviewLayer key={layer.id} layer={layer} />)}
    </div>
  );
}
