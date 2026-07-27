import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./editorConstants";
import {
  type CustomRetouchPreset,
  synchronizeCachedPresets,
} from "./useRetouchPresets";

function preset(id: string, name: string, exposure: number): CustomRetouchPreset {
  return {
    id,
    name,
    settings: { ...DEFAULT_SETTINGS, exposure },
  };
}

describe("synchronizeCachedPresets", () => {
  it("同名离线预设覆盖云端旧版本，且结果只保留一份", async () => {
    const local = preset("local-100", "清透", 24);
    const remote = preset("remote-1", "清透", 8);
    const saved = preset("remote-1", "清透", 24);
    const saveRemote = vi.fn().mockResolvedValue(saved);

    const result = await synchronizeCachedPresets([local], [remote], saveRemote);

    expect(saveRemote).toHaveBeenCalledWith("清透", local.settings);
    expect(result).toEqual([saved]);
  });

  it("迁移产生的旧缓存与云端同名时以云端为准，避免覆盖新版本", async () => {
    const legacy = preset("local-migrated-0", "清透", 8);
    const remote = preset("remote-1", "清透", 24);
    const saveRemote = vi.fn();

    const result = await synchronizeCachedPresets([legacy], [remote], saveRemote);

    expect(saveRemote).not.toHaveBeenCalled();
    expect(result).toEqual([remote]);
  });

  it("同步失败时保留离线版本，供后续重试", async () => {
    const local = preset("local-100", "清透", 24);
    const remote = preset("remote-1", "清透", 8);
    const saveRemote = vi.fn().mockRejectedValue(new Error("network unavailable"));

    const result = await synchronizeCachedPresets([local], [remote], saveRemote);

    expect(result).toEqual([local]);
  });
});
