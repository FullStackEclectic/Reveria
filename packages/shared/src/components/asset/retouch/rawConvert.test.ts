import { describe, expect, it } from "vitest";
import { dataUrlToJpegFile, extractLargestJpeg, isRawFilename } from "../../../rawConvert";

describe("rawConvert", () => {
  it("按扩展名识别相机 RAW", () => {
    expect(isRawFilename("IMG_0001.CR2")).toBe(true);
    expect(isRawFilename("shot.dng")).toBe(true);
    expect(isRawFilename("photo.jpg")).toBe(false);
  });

  it("从夹杂数据中取出最大的 JPEG 预览", () => {
    const tiny = Uint8Array.from([0xff, 0xd8, 0x00, 0x01, 0xff, 0xd9]);
    const payload = new Uint8Array(24_000).fill(0x7f);
    const large = new Uint8Array(2 + payload.length + 2);
    large[0] = 0xff;
    large[1] = 0xd8;
    large.set(payload, 2);
    large[large.length - 2] = 0xff;
    large[large.length - 1] = 0xd9;
    const mixed = new Uint8Array(tiny.length + 8 + large.length);
    mixed.set(tiny, 0);
    mixed.set(large, tiny.length + 8);
    const extracted = extractLargestJpeg(mixed.buffer);
    expect(extracted).not.toBeNull();
    expect(extracted!.length).toBe(large.length);
    expect(extracted![0]).toBe(0xff);
    expect(extracted![1]).toBe(0xd8);
  });

  it("把显影得到的 JPEG data URL 还原为可上传文件", () => {
    const payload = Uint8Array.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
    let binary = "";
    payload.forEach((value) => { binary += String.fromCharCode(value); });
    const file = dataUrlToJpegFile(`data:image/jpeg;base64,${btoa(binary)}`, "DSC0001.ARW");
    expect(file.name).toBe("DSC0001.jpg");
    expect(file.type).toBe("image/jpeg");
  });
});
