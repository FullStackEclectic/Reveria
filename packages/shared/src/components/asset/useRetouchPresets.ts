import { useCallback, useEffect, useState } from "react";
import { deleteJson, getJson, postJson } from "../../utils";
import { normalizeRetouchSettings, RetouchSettings } from "./editorConstants";

const PRESET_CACHE_KEY = "reveria.customPresets";

export interface CustomRetouchPreset {
  id: string;
  name: string;
  settings: RetouchSettings;
}

interface PresetResponse {
  id: string;
  name: string;
  settings: Partial<RetouchSettings>;
}

function readCachedPresets(): CustomRetouchPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.name === "string" && item.settings)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `local-migrated-${index}`,
        name: item.name,
        settings: normalizeRetouchSettings(item.settings),
      }));
  } catch {
    return [];
  }
}

function writeCachedPresets(presets: CustomRetouchPreset[]) {
  localStorage.setItem(PRESET_CACHE_KEY, JSON.stringify(presets));
}

function mergePreset(list: CustomRetouchPreset[], preset: CustomRetouchPreset) {
  return [preset, ...list.filter((item) => item.id !== preset.id && item.name !== preset.name)];
}

async function saveRemotePreset(name: string, settings: RetouchSettings) {
  const saved = await postJson<PresetResponse>("/api/retouch-presets", { name, settings });
  return { id: saved.id, name: saved.name, settings: normalizeRetouchSettings(saved.settings) };
}

export function useRetouchPresets() {
  const [presets, setPresets] = useState<CustomRetouchPreset[]>(readCachedPresets);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedPresets();
    void getJson<{ presets: PresetResponse[] }>("/api/retouch-presets")
      .then(async ({ presets: remoteItems }) => {
        const remote = remoteItems.map((item) => ({
          id: item.id,
          name: item.name,
          settings: normalizeRetouchSettings(item.settings),
        }));
        const unsynced = cached.filter((item) => {
          if (!item.id.startsWith("local-")) return false;
          const isLegacyCache = item.id.startsWith("local-migrated-");
          return !isLegacyCache || !remote.some((remoteItem) => remoteItem.name === item.name);
        });
        let merged = remote;
        for (const item of unsynced) {
          try {
            merged = mergePreset(merged, await saveRemotePreset(item.name, item.settings));
          } catch {
            merged = mergePreset(merged, item);
          }
        }
        if (!cancelled) {
          setPresets(merged);
          writeCachedPresets(merged);
        }
      })
      .catch((error) => console.warn("加载云端修图预设失败，继续使用本地缓存:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const savePreset = useCallback(async (name: string, settings: RetouchSettings) => {
    try {
      const saved = await saveRemotePreset(name, settings);
      setPresets((current) => {
        const next = mergePreset(current, saved);
        writeCachedPresets(next);
        return next;
      });
      return true;
    } catch (error) {
      console.warn("云端保存修图预设失败，已保存到本地:", error);
      const local = {
        id: `local-${Date.now()}`,
        name,
        settings: normalizeRetouchSettings(settings),
      };
      setPresets((current) => {
        const next = mergePreset(current, local);
        writeCachedPresets(next);
        return next;
      });
      return false;
    }
  }, []);

  const deletePreset = useCallback(async (preset: CustomRetouchPreset) => {
    if (!preset.id.startsWith("local-")) {
      await deleteJson(`/api/retouch-presets/${preset.id}`);
    }
    setPresets((current) => {
      const next = current.filter((item) => item.id !== preset.id);
      writeCachedPresets(next);
      return next;
    });
  }, []);

  return { presets, savePreset, deletePreset };
}
