/** 应用信息与数据目录。 */
import { app, clipboard, ipcMain, shell, systemPreferences } from "electron";
import { existsSync } from "node:fs";
import { getDbInfo } from "../db";
import { ensureUserDir, ffmpegPath } from "../paths";
import type { AppInfo } from "../../shared/ipc";
import { requireString } from "./validate";

/** Windows 返回 AABBGGRR，需要交换 B/R 通道 */
function systemAccent(): string | null {
  if (process.platform !== "win32" && process.platform !== "darwin") return null;
  try {
    const raw = systemPreferences.getAccentColor();
    if (!/^[0-9a-f]{8}$/i.test(raw)) return null;
    const r = raw.slice(6, 8);
    const g = raw.slice(4, 6);
    const b = raw.slice(2, 4);
    return `#${r}${g}${b}`.toUpperCase();
  } catch {
    return null;
  }
}

export function registerAppIpc(): void {
  ipcMain.handle("app:info", (): AppInfo => {
    const db = getDbInfo();
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron ?? "",
      chrome: process.versions.chrome ?? "",
      node: process.versions.node ?? "",
      platform: process.platform,
      userDataPath: app.getPath("userData"),
      dbPath: db?.path ?? "",
      schemaVersion: db?.schemaVersion ?? 0,
      ffmpegAvailable: existsSync(ffmpegPath()),
    };
  });

  ipcMain.handle("app:openDataFolder", async (): Promise<void> => {
    const error = await shell.openPath(ensureUserDir());
    if (error) throw new Error(`无法打开数据目录：${error}`);
  });

  ipcMain.handle("system:getAccentColor", (): string | null => systemAccent());

  ipcMain.handle("clipboard:writeText", (_event, value: unknown): void => {
    clipboard.writeText(requireString(value, "复制内容", 1_000_000));
  });
}
