/** 旧数据导入 IPC：预检 / 执行 / 取消 + 进度事件。 */
import { BrowserWindow, ipcMain } from "electron";
import {
  cancelLegacy,
  inspectLegacy,
  runLegacyImport,
  type LegacySourceInput,
} from "../library/legacy-import";
import type { LegacyInspectResult } from "../../shared/ipc";
import { optionalString, requireRecord, requireString } from "./validate";

function readSource(input: unknown): LegacySourceInput {
  const raw = requireRecord(input, "导入来源");
  return {
    dbPath: optionalString(raw.dbPath, "数据库路径", 4000) || undefined,
    mediaDir: optionalString(raw.mediaDir, "媒体目录", 4000) || undefined,
    zipPath: optionalString(raw.zipPath, "ZIP 路径", 4000) || undefined,
  };
}

export function registerLegacyIpc(): void {
  ipcMain.handle(
    "legacy:inspect",
    async (_event, input: unknown): Promise<LegacyInspectResult> =>
      inspectLegacy(readSource(input)),
  );

  ipcMain.handle("legacy:run", async (event, input: unknown) => {
    const raw = requireRecord(input);
    const sessionId = requireString(raw.sessionId, "导入会话", 200);
    const win = BrowserWindow.fromWebContents(event.sender);

    return runLegacyImport(sessionId, (progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("legacy:progress", progress);
      }
    });
  });

  ipcMain.handle("legacy:cancel", (_event, input: unknown): void => {
    const raw = requireRecord(input);
    cancelLegacy(requireString(raw.sessionId, "导入会话", 200));
  });
}
