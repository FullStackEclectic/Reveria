import { describe, expect, it } from "vitest";
import { parseExif } from "./exif";

function jpegWithCameraMake(make: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(`${make}\0`);
  const tiffLength = 26 + encoded.length;
  const payloadLength = 6 + tiffLength;
  const bytes = new Uint8Array(2 + 2 + 2 + payloadLength + 2);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8, 0xff, 0xe1], 0);
  view.setUint16(4, payloadLength + 2, false);
  bytes.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6);
  const tiff = 12;
  bytes.set([0x49, 0x49], tiff);
  view.setUint16(tiff + 2, 42, true);
  view.setUint32(tiff + 4, 8, true);
  view.setUint16(tiff + 8, 1, true);
  const entry = tiff + 10;
  view.setUint16(entry, 0x010f, true);
  view.setUint16(entry + 2, 2, true);
  view.setUint32(entry + 4, encoded.length, true);
  view.setUint32(entry + 8, 26, true);
  view.setUint32(tiff + 22, 0, true);
  bytes.set(encoded, tiff + 26);
  bytes.set([0xff, 0xd9], bytes.length - 2);
  return bytes.buffer;
}

describe("parseExif", () => {
  it("从 JPEG APP1 TIFF 数据中读取相机厂商", () => {
    expect(parseExif(jpegWithCameraMake("Reveria Cam"))).toContainEqual({
      label: "相机厂商",
      value: "Reveria Cam",
    });
  });

  it("非 JPEG 或无 EXIF 文件返回空列表", () => {
    expect(parseExif(new Uint8Array([1, 2, 3, 4]).buffer)).toEqual([]);
  });
});
