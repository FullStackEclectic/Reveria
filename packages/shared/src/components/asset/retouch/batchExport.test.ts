import { describe, expect, it } from "vitest";
import { formatBatchFilename, joinExportPath, sanitizeExportName } from "./batchExport";

describe("batchExport", () => {
  it("清洗非法文件名并去掉原扩展名", () => {
    expect(sanitizeExportName("  封面<>.jpg  ")).toBe("封面__");
    expect(sanitizeExportName("")).toBe("image");
  });

  it("按模板生成带序号的导出文件名", () => {
    expect(formatBatchFilename("{name}_{index}", {
      name: "模特A.png", index: 3, total: 12,
    }, "jpeg")).toBe("模特A_03.jpg");
    expect(formatBatchFilename("  ", { name: "a", index: 1, total: 1 }, "webp")).toBe("a_retouched.webp");
  });

  it("拼接桌面端目录与文件名", () => {
    expect(joinExportPath("D:\\Exports\\", "a.jpg")).toBe("D:\\Exports\\a.jpg");
    expect(joinExportPath("/tmp/out", "a.png")).toBe("/tmp/out/a.png");
  });
});
