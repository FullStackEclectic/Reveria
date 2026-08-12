export interface ImageHistogram {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
}

export const HISTOGRAM_BIN_COUNT = 64;

export function createEmptyHistogram(): ImageHistogram {
  return {
    red: Array(HISTOGRAM_BIN_COUNT).fill(0),
    green: Array(HISTOGRAM_BIN_COUNT).fill(0),
    blue: Array(HISTOGRAM_BIN_COUNT).fill(0),
    luminance: Array(HISTOGRAM_BIN_COUNT).fill(0),
  };
}

export function calculateHistogram(pixels: Uint8Array | Uint8ClampedArray): ImageHistogram {
  const histogram = createEmptyHistogram();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
    histogram.red[Math.min(HISTOGRAM_BIN_COUNT - 1, red >> 2)] += 1;
    histogram.green[Math.min(HISTOGRAM_BIN_COUNT - 1, green >> 2)] += 1;
    histogram.blue[Math.min(HISTOGRAM_BIN_COUNT - 1, blue >> 2)] += 1;
    histogram.luminance[Math.min(HISTOGRAM_BIN_COUNT - 1, luminance >> 2)] += 1;
  }

  const peak = Math.max(1, ...histogram.red, ...histogram.green, ...histogram.blue, ...histogram.luminance);
  for (const channel of Object.values(histogram)) {
    for (let index = 0; index < channel.length; index += 1) channel[index] /= peak;
  }
  return histogram;
}

function channelWeightedAverage(channel: number[]): number {
  let sum = 0;
  let weight = 0;
  for (let index = 0; index < channel.length; index += 1) {
    const amount = channel[index];
    if (amount <= 0) continue;
    sum += ((index + 0.5) / channel.length) * 255 * amount;
    weight += amount;
  }
  return weight > 0 ? sum / weight : 128;
}

function toHexByte(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

/** 根据成片直方图估算边框色：保留画面色相，亮图压暗、暗图略提亮。 */
export function suggestBorderColor(histogram: ImageHistogram): string {
  const red = channelWeightedAverage(histogram.red);
  const green = channelWeightedAverage(histogram.green);
  const blue = channelWeightedAverage(histogram.blue);
  const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const target = luma >= 140 ? Math.max(36, luma * 0.42) : Math.min(210, Math.max(48, luma + 36));
  const scale = luma > 1 ? target / luma : 1;
  return `#${toHexByte(red * scale)}${toHexByte(green * scale)}${toHexByte(blue * scale)}`;
}
