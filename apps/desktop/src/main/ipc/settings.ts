/** 设置读写：设置存 meta.app_settings，patch 做深合并后归一化。 */
import { ipcMain, nativeTheme } from "electron";
import { normalizeSettings, type AppSettings } from "@collect/core";
import { getDriver } from "../db";
import { readSettings, writeSettings } from "../db/settings-repo";
import { requireRecord } from "./validate";

export function registerSettingsIpc(): void {
  ipcMain.handle("settings:get", (): AppSettings => readSettings(getDriver()));

  ipcMain.handle("settings:patch", (_event, input: unknown): AppSettings => {
    const raw = requireRecord(input, "设置");
    const driver = getDriver();
    const current = readSettings(driver);

    const notifications =
      typeof raw.notifications === "object" &&
      raw.notifications !== null &&
      !Array.isArray(raw.notifications)
        ? (raw.notifications as Record<string, unknown>)
        : {};

    const merged = normalizeSettings({
      ...current,
      ...raw,
      notifications: { ...current.notifications, ...notifications },
    });

    writeSettings(driver, merged);
    nativeTheme.themeSource = merged.themeMode;
    return merged;
  });
}
