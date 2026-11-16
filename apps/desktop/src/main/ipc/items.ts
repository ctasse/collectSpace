/** 收藏条目 IPC：列表 / 标签 / 新建 / 编辑 / 批改标签 / 删除。 */
import { BrowserWindow, ipcMain, shell } from "electron";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Item } from "@collect/core";
import {
  DEFAULT_TAG,
  insertItem,
  listItems,
  listTags,
  getItem,
  getItemsByIds,
  removeItems,
  setItemsTag,
  updateItem,
} from "../db/items-repo";
import { readSettings } from "../db/settings-repo";
import { getDriver } from "../db";
import { toItemView } from "../db/item-view";
import { createItemFromClipboardImage } from "../library/clipboard-image";
import { importPaths } from "../library/media-import";
import { relocateMediaItem } from "../library/relocate";
import { getVideoThumbnail } from "../library/thumbnails";
import { fetchUrlTitle } from "../library/url-title";
import { toAbsPath, toRelPath } from "../paths";
import { mediaUrl } from "../protocols";
import {
  extensionOf,
  fileStem,
  hostOf,
  isMediaType,
  normalizeUrlInput,
  sanitizeFileName,
} from "@collect/core";
import type {
  ItemListQuery,
  ItemListResult,
  ItemsChangedEvent,
  RemoveResult,
  SetTagInput,
  UpdateTextInput,
} from "../../shared/ipc";
import {
  normalizeTag,
  optionalNumber,
  optionalString,
  optionalType,
  requireId,
  requireIds,
  requireRecord,
  requireString,
} from "./validate";

function notifyChanged(event: ItemsChangedEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("items:changed", event);
  }
}

function defaultDescription(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 50);
}

async function deleteMediaFiles(candidates: Item[]): Promise<string[]> {
  const items = candidates.filter((item) => isMediaType(item.type) && item.content);
  if (items.length === 0) return [];

  const useTrash = readSettings(getDriver()).deleteToTrash;
  const errors: string[] = [];

  for (const item of items) {
    const abs = toAbsPath(item.content);
    if (!existsSync(abs)) continue;
    try {
      if (useTrash) {
        await shell.trashItem(abs);
      } else {
        unlinkSync(abs);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${item.title}：${reason}`);
    }
  }
  return errors;
}

export function registerItemsIpc(): void {
  ipcMain.handle("items:list", (_event, input: unknown): ItemListResult => {
    const raw = input === undefined || input === null ? {} : requireRecord(input);
    const query: ItemListQuery = {
      query: optionalString(raw.query, "搜索关键词", 200),
      tag: optionalString(raw.tag, "标签", 40),
      type: optionalType(raw.type),
      offset: optionalNumber(raw.offset, "偏移量", 0, 0, 10_000_000),
      limit: optionalNumber(raw.limit, "分页大小", 200, 1, 500),
    };

    const result = listItems(getDriver(), query);
    return { items: result.items.map(toItemView), total: result.total };
  });

  ipcMain.handle("items:tags", () => listTags(getDriver()));

  ipcMain.handle("items:createText", (_event, input: unknown) => {
    const raw = requireRecord(input);
    const content = requireString(raw.content, "内容", 100_000);
    const title = optionalString(raw.title, "标题", 300) || "文本收藏";
    const description =
      optionalString(raw.description, "描述", 2000) ?? defaultDescription(content);
    const tag = normalizeTag(raw.tag);

    const item = insertItem(getDriver(), {
      title,
      content,
      description,
      type: "text",
      tag,
    });
    notifyChanged({ reason: "create", ids: [item.id] });
    return toItemView(item);
  });

  ipcMain.handle("items:createUrl", (_event, input: unknown) => {
    const raw = requireRecord(input);
    const original = requireString(raw.url, "链接", 4000);
    const url = normalizeUrlInput(original);
    if (!url) throw new Error("链接格式不正确（仅支持 http/https）");

    const title = optionalString(raw.title, "标题", 300) || hostOf(url);
    const description = optionalString(raw.description, "描述", 2000) ?? "";
    const tag = normalizeTag(raw.tag);

    const item = insertItem(getDriver(), {
      title,
      content: url,
      description,
      type: "url",
      tag,
    });
    notifyChanged({ reason: "create", ids: [item.id] });
    return toItemView(item);
  });

  ipcMain.handle("items:updateText", (_event, input: unknown) => {
    const raw = requireRecord(input);
    const inputData: UpdateTextInput = {
      id: requireId(raw.id),
      title: optionalString(raw.title, "标题", 300),
      content: optionalString(raw.content, "内容", 100_000),
      description: optionalString(raw.description, "描述", 2000),
      tag: raw.tag === undefined ? undefined : normalizeTag(raw.tag),
    };

    const driver = getDriver();
    const existing = getItem(driver, inputData.id);
    if (!existing) throw new Error("收藏不存在或已被删除");
    if (
      inputData.content !== undefined &&
      existing.type !== "text" &&
      existing.type !== "url"
    ) {
      throw new Error("媒体收藏不支持修改内容");
    }
    if (inputData.title !== undefined && !inputData.title) {
      throw new Error("标题不能为空");
    }

    const updated = updateItem(driver, inputData.id, {
      title: inputData.title,
      content: inputData.content,
      description: inputData.description,
      tag: inputData.tag,
    });
    if (!updated) throw new Error("收藏不存在或已被删除");

    notifyChanged({ reason: "update", ids: [updated.id] });
    return toItemView(updated);
  });

  ipcMain.handle("url:fetchTitle", async (_event, input: unknown) => {
    const raw = requireRecord(input);
    const url = requireString(raw.url, "链接", 4000);
    return fetchUrlTitle(url);
  });

  ipcMain.handle("media:thumbnail", async (_event, input: unknown) => {
    const raw = requireRecord(input);
    const id = requireId(raw.id);
    const result = await getVideoThumbnail(id);
    return {
      url: result.relPath ? mediaUrl(result.relPath) : null,
      cached: result.cached,
    };
  });

  ipcMain.handle("items:createFromClipboardImage", (_event, input: unknown) => {
    const raw = input === undefined || input === null ? {} : requireRecord(input);
    const tag = normalizeTag(raw.tag);
    const item = createItemFromClipboardImage(tag);
    notifyChanged({ reason: "create", ids: [item.id] });
    return item;
  });

  ipcMain.handle("items:importPaths", async (_event, input: unknown) => {
    const raw = requireRecord(input);
    if (!Array.isArray(raw.paths) || raw.paths.length === 0) {
      throw new Error("请选择要导入的文件");
    }
    if (raw.paths.length > 1000) throw new Error("一次最多导入 1000 个文件");
    const paths = raw.paths.map((path) => requireString(path, "文件路径", 4000));
    const tag = normalizeTag(raw.tag);

    const result = await importPaths(paths, tag);
    if (result.imported.length > 0) {
      notifyChanged({
        reason: "create",
        ids: result.imported.map((item) => item.id),
      });
    }
    return result;
  });

  ipcMain.handle("items:rename", (_event, input: unknown) => {
    const raw = requireRecord(input);
    const id = requireId(raw.id);
    const title = requireString(raw.title, "标题", 300);
    const driver = getDriver();
    const existing = getItem(driver, id);
    if (!existing) throw new Error("收藏不存在或已被删除");

    if (!isMediaType(existing.type)) {
      const updated = updateItem(driver, id, { title });
      if (!updated) throw new Error("收藏不存在或已被删除");
      notifyChanged({ reason: "update", ids: [id] });
      return toItemView(updated);
    }

    const ext = extensionOf(existing.content);
    const stem = fileStem(title) || "文件";
    const fileName = sanitizeFileName(`${stem}${ext}`);
    const currentAbs = toAbsPath(existing.content);
    const targetAbs = join(dirname(currentAbs), fileName);

    if (targetAbs !== currentAbs) {
      if (!existsSync(currentAbs)) throw new Error("原文件缺失，无法重命名");
      if (existsSync(targetAbs)) throw new Error("同名文件已存在，请换一个名称");
      renameSync(currentAbs, targetAbs);
    }

    let updated: Item | null;
    try {
      updated = updateItem(driver, id, {
        title: stem,
        content: toRelPath(targetAbs),
      });
      if (!updated) throw new Error("收藏不存在或已被删除");
    } catch (error) {
      // DB 更新失败时把文件改回原名，避免库与磁盘不一致
      if (targetAbs !== currentAbs && existsSync(targetAbs) && !existsSync(currentAbs)) {
        try {
          renameSync(targetAbs, currentAbs);
        } catch {
          // 回滚失败时保留原始错误
        }
      }
      throw error;
    }

    notifyChanged({ reason: "update", ids: [id] });
    return toItemView(updated);
  });

  ipcMain.handle("items:setTag", (_event, input: unknown) => {
    const raw = requireRecord(input);
    const data: SetTagInput = {
      ids: requireIds(raw.ids),
      tag: normalizeTag(raw.tag),
    };
    const updated = setItemsTag(getDriver(), data.ids, data.tag || DEFAULT_TAG);
    if (updated > 0) notifyChanged({ reason: "tag", ids: data.ids });
    return { updated };
  });

  ipcMain.handle("items:open", async (_event, input: unknown): Promise<void> => {
    const raw = requireRecord(input);
    const id = requireId(raw.id);
    const item = getItem(getDriver(), id);
    if (!item) throw new Error("收藏不存在或已被删除");

    if (item.type === "url") {
      if (!/^https?:\/\//i.test(item.content)) {
        throw new Error("仅支持打开 http/https 链接");
      }
      await shell.openExternal(item.content);
      return;
    }

    if (isMediaType(item.type)) {
      const abs = toAbsPath(item.content);
      if (!existsSync(abs)) throw new Error("文件缺失，请先重新定位");
      const error = await shell.openPath(abs);
      if (error) throw new Error(`无法打开文件：${error}`);
    }
  });

  ipcMain.handle("items:showInFolder", (_event, input: unknown): void => {
    const raw = requireRecord(input);
    const id = requireId(raw.id);
    const item = getItem(getDriver(), id);
    if (!item) throw new Error("收藏不存在或已被删除");
    if (!isMediaType(item.type)) throw new Error("该收藏没有本地文件");
    const abs = toAbsPath(item.content);
    if (!existsSync(abs)) throw new Error("文件缺失，请先重新定位");
    shell.showItemInFolder(abs);
  });

  ipcMain.handle("items:relocate", async (_event, input: unknown) => {
    const raw = requireRecord(input);
    const id = requireId(raw.id);
    const sourcePath = requireString(raw.path, "文件路径", 4000);
    const updated = await relocateMediaItem(id, sourcePath);
    notifyChanged({ reason: "update", ids: [id] });
    return updated;
  });

  ipcMain.handle("items:remove", async (_event, input: unknown): Promise<RemoveResult> => {
    const raw = requireRecord(input);
    const ids = requireIds(raw.ids);
    const driver = getDriver();
    // 先取行（删除后读不到），再删库、删文件；文件失败只上报，不影响已删的库记录
    const candidates = getItemsByIds(driver, ids);
    const removed = removeItems(driver, ids);
    const fileErrors = await deleteMediaFiles(candidates);
    if (removed > 0) notifyChanged({ reason: "remove", ids });
    return { removed, fileErrors };
  });
}
