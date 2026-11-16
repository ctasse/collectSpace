/** 文件/目录选择对话框。 */
import { dialog, ipcMain } from "electron";

export function registerDialogIpc(): void {
  ipcMain.handle("dialog:openFiles", async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      title: "选择要收藏的文件",
      properties: ["openFile", "multiSelections"],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:openDirectory", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "选择文件夹",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle("dialog:openLegacyDb", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "选择旧版收藏数据库",
      properties: ["openFile"],
      filters: [
        { name: "SQLite 数据库", extensions: ["db", "sqlite", "sqlite3"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle("dialog:openZip", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "选择旧数据 ZIP",
      properties: ["openFile"],
      filters: [{ name: "ZIP 压缩包", extensions: ["zip"] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}
