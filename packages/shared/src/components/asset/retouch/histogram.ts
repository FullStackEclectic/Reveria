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
