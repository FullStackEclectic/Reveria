import { describe, expect, it } from "vitest";
import {
  createOverlayLayer,
  hasActiveOverlays,
  normalizeOverlayLayers,
  overlayHasContent,
} from "./overlays";

describe("overlay layers", () => {
  it("创建文字图层并在归一化后保留混合模式与变形", () => {
    const layer = createOverlayLayer("text");
    layer.blend = "multiply";
    layer.warp = 40;
    layer.text = "工作室";
    const restored = normalizeOverlayLayers([layer]);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ kind: "text", blend: "multiply", warp: 40, text: "工作室" });
    expect(overlayHasContent(restored[0])).toBe(true);
  });

  it("空文字与关闭的图层不视为有效叠加", () => {
    const empty = createOverlayLayer("text");
    empty.text = "  ";
    const disabled = createOverlayLayer("preset");
    disabled.enabled = false;
    expect(hasActiveOverlays(normalizeOverlayLayers([empty, disabled]))).toBe(false);
  });

  it("丢弃非法混合模式并限制图层数量", () => {
    const layers = Array.from({ length: 10 }, (_, index) => {
      const layer = createOverlayLayer("gradient", index + 1);
      layer.blend = "unknown" as never;
      return layer;
    });
    const restored = normalizeOverlayLayers(layers);
    expect(restored).toHaveLength(8);
    expect(restored[0].blend).toBe("screen");
  });
});
