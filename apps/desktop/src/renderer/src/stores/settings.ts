import { create } from "zustand";
import { DEFAULT_SETTINGS, type AppSettings } from "@collect/core";
import type { SettingsPatch } from "../../../shared/ipc";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  patch: (patch: SettingsPatch) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  load: async () => {
    try {
      const settings = await window.api.settings.get();
      set({ settings, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  patch: async (patch) => {
    const settings = await window.api.settings.patch(patch);
    set({ settings, loaded: true });
  },
}));
