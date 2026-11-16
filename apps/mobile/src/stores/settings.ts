import { create } from "zustand";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "@collect/core";
import { getDriver } from "../db";
import { readSettings, writeSettings } from "../db/settings-repo";

export type SettingsPatch = Partial<Omit<AppSettings, "notifications">> & {
  notifications?: Partial<AppSettings["notifications"]>;
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  patch: (patch: SettingsPatch) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  load: async () => {
    try {
      const settings = readSettings(getDriver());
      set({ settings, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  patch: async (patch) => {
    const current = get().settings;
    const settings = normalizeSettings({
      ...current,
      ...patch,
      notifications: {
        ...current.notifications,
        ...patch.notifications,
      },
    });
    writeSettings(getDriver(), settings);
    set({ settings, loaded: true });
  },
}));
