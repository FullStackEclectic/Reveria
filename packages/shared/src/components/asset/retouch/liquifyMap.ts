import { LIQUIFY_MAP_SIZE, LIQUIFY_MAX_SHIFT, type LiquifyStroke } from "./settings";

/**
 * 把液化笔画烘焙成位移贴图。
 *
 * 相比把每条笔画作为 uniform 传入，位移贴图让笔画数量不受 uniform 上限约束，
 * 也把逐笔画的循环开销从 Shader 挪到了一次性的 CPU 烘焙上。
 * 编码：R = dx、G = dy，0.5 表示零位移，量程为 ±LIQUIFY_MAX_SHIFT。
 */
export function bakeLiquifyMap(strokes: LiquifyStroke[]): Uint8Array {
  const size = LIQUIFY_MAP_SIZE;
  const shift = new Float32Array(size * size * 2);

  for (const stroke of strokes) {
    const radius = stroke.radius;
    if (radius <= 0 || stroke.strength <= 0) continue;

    // 仅遍历笔画影响范围内的格子
    const minX = Math.max(0, Math.floor((stroke.x - radius) * size));
    const maxX = Math.min(size - 1, Math.ceil((stroke.x + radius) * size));
    const minY = Math.max(0, Math.floor((stroke.y - radius) * size));
    const maxY = Math.min(size - 1, Math.ceil((stroke.y + radius) * size));

    for (let gy = minY; gy <= maxY; gy++) {
      const py = (gy + 0.5) / size;
      for (let gx = minX; gx <= maxX; gx++) {
        const px = (gx + 0.5) / size;
        const dx = px - stroke.x;
        const dy = py - stroke.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= radius) continue;

        // 平滑衰减，笔画中心最强、边缘归零
        let falloff = 1 - dist / radius;
        falloff *= falloff;
        const amount = falloff * stroke.strength;
        const index = (gy * size + gx) * 2;

        if (stroke.mode === 0) {
          // 推拉：整片朝拖拽方向平移。逆映射需反向取样，故取负号。
          shift[index] -= stroke.dx * amount;
          shift[index + 1] -= stroke.dy * amount;
        } else {
          // 收缩：采样点外推，内容被压缩；膨胀反之。
          const sign = stroke.mode === 1 ? 1 : -1;
          shift[index] += dx * amount * sign * 0.5;
          shift[index + 1] += dy * amount * sign * 0.5;
        }
      }
    }
  }

  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const dx = Math.max(-LIQUIFY_MAX_SHIFT, Math.min(LIQUIFY_MAX_SHIFT, shift[i * 2]));
    const dy = Math.max(-LIQUIFY_MAX_SHIFT, Math.min(LIQUIFY_MAX_SHIFT, shift[i * 2 + 1]));
    pixels[i * 4] = Math.round((dx / (LIQUIFY_MAX_SHIFT * 2) + 0.5) * 255);
    pixels[i * 4 + 1] = Math.round((dy / (LIQUIFY_MAX_SHIFT * 2) + 0.5) * 255);
    pixels[i * 4 + 2] = 0;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
