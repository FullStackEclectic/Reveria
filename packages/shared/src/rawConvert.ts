export const RAW_EXTENSIONS = ["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2", "pef", "srw", "raw"] as const;

export function isRawFilename(name: string): boolean {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match) return false;
  return (RAW_EXTENSIONS as readonly string[]).includes(match[1].toLowerCase());
}

export function isRawFile(file: File): boolean {
  return isRawFilename(file.name);
}

type WailsApp = {
  NativeRawConvertAvailable?: () => Promise<boolean> | boolean;
  SelectRawFiles?: () => Promise<string[] | null>;
  ConvertRawFile?: (path: string) => Promise<string>;
  ConvertRawBytes?: (rawBase64: string, filename: string) => Promise<string>;
};

function wailsApp(): WailsApp | undefined {
  return (window as unknown as { go?: { main?: { App?: WailsApp } } }).go?.main?.App;
}

export async function nativeRawConvertAvailable(): Promise<boolean> {
  const app = wailsApp();
  if (!app?.ConvertRawFile && !app?.ConvertRawBytes) return false;
  if (!app.NativeRawConvertAvailable) return true;
  return Boolean(await app.NativeRawConvertAvailable());
}

export async function selectRawFilesNative(): Promise<string[] | null> {
  const app = wailsApp();
  if (!app?.SelectRawFiles) return null;
  const paths = await app.SelectRawFiles();
  return paths?.length ? paths : [];
}

export async function convertRawPathNative(path: string): Promise<File> {
  const app = wailsApp();
  if (!app?.ConvertRawFile) {
    throw new Error("当前桌面端尚未启用 RAW 传感器显影");
  }
  const dataUrl = await app.ConvertRawFile(path);
  const name = path.replace(/^.*[\\/]/, "");
  return dataUrlToJpegFile(dataUrl, name);
}

export function extractLargestJpeg(data: ArrayBuffer): Uint8Array | null {
  const bytes = new Uint8Array(data);
  let bestStart = -1;
  let bestEnd = -1;
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== 0xff || bytes[index + 1] !== 0xd8) continue;
    for (let end = index + 2; end < bytes.length - 1; end += 1) {
      if (bytes[end] !== 0xff || bytes[end + 1] !== 0xd9) continue;
      const size = end + 2 - index;
      if (size > 20_000 && size > bestEnd - bestStart) {
        bestStart = index;
        bestEnd = end + 2;
      }
      index = end + 1;
      break;
    }
  }
  if (bestStart < 0) return null;
  return bytes.subarray(bestStart, bestEnd);
}

export function dataUrlToJpegFile(dataUrl: string, rawName: string): File {
  const comma = dataUrl.indexOf(",");
  const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const name = rawName.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([bytes], name, { type: "image/jpeg" });
}

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取 RAW 失败"));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function convertRawWithNativeEngine(file: File): Promise<File | null> {
  const app = wailsApp();
  if (!app?.ConvertRawBytes || !(await nativeRawConvertAvailable())) return null;
  try {
    const dataUrl = await app.ConvertRawBytes(await fileToBase64(file), file.name);
    return dataUrlToJpegFile(dataUrl, file.name);
  } catch {
    return null;
  }
}

export async function convertRawToJpegFile(file: File): Promise<File> {
  const native = await convertRawWithNativeEngine(file);
  if (native) return native;
  const buffer = await file.arrayBuffer();
  const jpeg = extractLargestJpeg(buffer);
  if (!jpeg) {
    throw new Error(`无法转换 ${file.name}：请使用桌面端进行传感器显影，或确认文件内含 JPEG 预览`);
  }
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([jpeg.slice()], name, { type: "image/jpeg" });
}

export async function fileForImageUpload(file: File): Promise<File> {
  if (!isRawFile(file)) return file;
  return convertRawToJpegFile(file);
}

export const RAW_ACCEPT = RAW_EXTENSIONS.map((ext) => `.${ext}`).join(",");
export const IMAGE_AND_RAW_ACCEPT = `image/*,${RAW_ACCEPT}`;
