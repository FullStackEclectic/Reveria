import { useCallback, useEffect, useMemo, useState } from "react";
import { BUILTIN_LUTS, generateBuiltinLut } from "./retouch/builtinLuts";
import { decodeLutData, encodeLutData, LutParseError, parseCubeLut, type LutData } from "./retouch/lut";

const LUT_CACHE_KEY = "reveria.customLuts";

export interface LutEntry {
  id: string;
  name: string;
  builtin: boolean;
}

interface StoredLut {
  id: string;
  name: string;
  /** encodeLutData 的结果 */
  data: string;
}

function readStoredLuts(): StoredLut[] {
  try {
    const raw = localStorage.getItem(LUT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredLut =>
        item != null && typeof item.id === "string"
        && typeof item.name === "string" && typeof item.data === "string",
    );
  } catch {
    return [];
  }
}

function writeStoredLuts(luts: StoredLut[]) {
  localStorage.setItem(LUT_CACHE_KEY, JSON.stringify(luts));
}

/**
 * LUT 库：内置 LUT 由公式实时生成，用户导入的 .cube 解析后存入本地。
 * `resolve` 返回可直接上传为纹理的数据，供渲染器按 `settings.lut_file` 取用。
 */
export function useLutLibrary() {
  const [stored, setStored] = useState<StoredLut[]>([]);

  useEffect(() => {
    setStored(readStoredLuts());
  }, []);

  // 内置 LUT 的像素数据只生成一次
  const builtinData = useMemo(() => {
    const map = new Map<string, LutData>();
    for (const meta of BUILTIN_LUTS) {
      const data = generateBuiltinLut(meta.id);
      if (data) map.set(meta.id, data);
    }
    return map;
  }, []);

  const customData = useMemo(() => {
    const map = new Map<string, LutData>();
    for (const item of stored) {
      const decoded = decodeLutData(item.data);
      if (decoded) map.set(item.id, decoded);
    }
    return map;
  }, [stored]);

  const entries = useMemo<LutEntry[]>(
    () => [
      ...BUILTIN_LUTS.map((meta) => ({ id: meta.id, name: meta.name, builtin: true })),
      ...stored.map((item) => ({ id: item.id, name: item.name, builtin: false })),
    ],
    [stored],
  );

  const resolve = useCallback(
    (id: string): LutData | null => {
      if (!id) return null;
      return builtinData.get(id) ?? customData.get(id) ?? null;
    },
    [builtinData, customData],
  );

  /** 导入 .cube 文件，返回新建条目的 id */
  const importLut = useCallback(async (file: File): Promise<string> => {
    const text = await file.text();
    let parsed: LutData;
    try {
      parsed = parseCubeLut(text);
    } catch (error) {
      if (error instanceof LutParseError) throw error;
      throw new LutParseError("无法解析该 LUT 文件，请确认是标准的 .cube 格式");
    }
    const entry: StoredLut = {
      id: `lut-${Date.now()}`,
      name: file.name.replace(/\.cube$/i, ""),
      data: encodeLutData(parsed),
    };
    setStored((current) => {
      const next = [entry, ...current.filter((item) => item.name !== entry.name)];
      try {
        writeStoredLuts(next);
      } catch {
        throw new LutParseError("本地存储空间不足，请先删除部分已导入的 LUT");
      }
      return next;
    });
    return entry.id;
  }, []);

  const deleteLut = useCallback((id: string) => {
    setStored((current) => {
      const next = current.filter((item) => item.id !== id);
      writeStoredLuts(next);
      return next;
    });
  }, []);

  return { entries, resolve, importLut, deleteLut };
}
