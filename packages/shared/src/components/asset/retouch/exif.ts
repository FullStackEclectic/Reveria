export interface ExifEntry {
  label: string;
  value: string;
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function ascii(view: DataView, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const code = view.getUint8(offset + index);
    if (code === 0) break;
    value += String.fromCharCode(code);
  }
  return value.trim();
}

function findExifRange(buffer: ArrayBuffer): { start: number; end: number; tiff: number } | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2, false);
    if (length < 2 || offset + 2 + length > view.byteLength) break;
    if (marker === 0xe1 && length >= 8 && ascii(view, offset + 4, 6) === "Exif") {
      return { start: offset, end: offset + 2 + length, tiff: offset + 10 };
    }
    offset += 2 + length;
  }
  return null;
}

function readValue(
  view: DataView,
  tiff: number,
  entry: number,
  littleEndian: boolean,
): string | number | undefined {
  const type = view.getUint16(entry + 2, littleEndian);
  const count = view.getUint32(entry + 4, littleEndian);
  const byteLength = (TYPE_SIZE[type] ?? 0) * count;
  if (!byteLength) return undefined;
  const valueOffset = byteLength <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + byteLength > view.byteLength) return undefined;
  if (type === 2) return ascii(view, valueOffset, count);
  if (type === 3) return count === 1 ? view.getUint16(valueOffset, littleEndian) : undefined;
  if (type === 4) return count === 1 ? view.getUint32(valueOffset, littleEndian) : undefined;
  if (type === 9) return count === 1 ? view.getInt32(valueOffset, littleEndian) : undefined;
  if ((type === 5 || type === 10) && count === 1) {
    const numerator = type === 5 ? view.getUint32(valueOffset, littleEndian) : view.getInt32(valueOffset, littleEndian);
    const denominator = type === 5 ? view.getUint32(valueOffset + 4, littleEndian) : view.getInt32(valueOffset + 4, littleEndian);
    return denominator ? numerator / denominator : undefined;
  }
  return undefined;
}

function readIfd(
  view: DataView,
  tiff: number,
  relativeOffset: number,
  littleEndian: boolean,
): Map<number, string | number> {
  const values = new Map<number, string | number>();
  const offset = tiff + relativeOffset;
  if (offset < 0 || offset + 2 > view.byteLength) return values;
  const count = view.getUint16(offset, littleEndian);
  for (let index = 0; index < count; index += 1) {
    const entry = offset + 2 + index * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, littleEndian);
    const value = readValue(view, tiff, entry, littleEndian);
    if (value !== undefined && value !== "") values.set(tag, value);
  }
  return values;
}

function formatExposure(value: number): string {
  if (value >= 1) return `${Number(value.toFixed(2))} 秒`;
  return `1/${Math.max(1, Math.round(1 / value))} 秒`;
}

export function parseExif(buffer: ArrayBuffer): ExifEntry[] {
  const range = findExifRange(buffer);
  if (!range || range.tiff + 8 > buffer.byteLength) return [];
  const view = new DataView(buffer);
  const byteOrder = view.getUint16(range.tiff, false);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return [];
  if (view.getUint16(range.tiff + 2, littleEndian) !== 42) return [];
  const ifd0 = readIfd(view, range.tiff, view.getUint32(range.tiff + 4, littleEndian), littleEndian);
  const exifPointer = ifd0.get(0x8769);
  const exif = typeof exifPointer === "number" ? readIfd(view, range.tiff, exifPointer, littleEndian) : new Map();

  const entries: ExifEntry[] = [];
  const add = (label: string, value: unknown, suffix = "") => {
    if (value !== undefined && value !== "") entries.push({ label, value: `${value}${suffix}` });
  };
  add("相机厂商", ifd0.get(0x010f));
  add("相机型号", ifd0.get(0x0110));
  add("镜头", exif.get(0xa434));
  add("拍摄时间", exif.get(0x9003) ?? ifd0.get(0x0132));
  const exposure = exif.get(0x829a);
  if (typeof exposure === "number") add("快门", formatExposure(exposure));
  const aperture = exif.get(0x829d);
  if (typeof aperture === "number") add("光圈", `f/${Number(aperture.toFixed(1))}`);
  add("ISO", exif.get(0x8827));
  const focalLength = exif.get(0x920a);
  if (typeof focalLength === "number") add("焦距", Number(focalLength.toFixed(1)), " mm");
  add("宽度", exif.get(0xa002), " px");
  add("高度", exif.get(0xa003), " px");
  return entries;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

export async function preserveExifInJpeg(sourceUrl: string, renderedDataUrl: string): Promise<string> {
  const source = await fetch(sourceUrl).then((response) => {
    if (!response.ok) throw new Error("源文件读取失败");
    return response.arrayBuffer();
  });
  const range = findExifRange(source);
  if (!range) return renderedDataUrl;
  const exifSegment = new Uint8Array(source, range.start, range.end - range.start);
  const rendered = dataUrlToBytes(renderedDataUrl);
  if (rendered.length < 2 || rendered[0] !== 0xff || rendered[1] !== 0xd8) return renderedDataUrl;
  const output = new Uint8Array(rendered.length + exifSegment.length);
  output.set(rendered.subarray(0, 2), 0);
  output.set(exifSegment, 2);
  output.set(rendered.subarray(2), 2 + exifSegment.length);
  return bytesToDataUrl(output);
}
