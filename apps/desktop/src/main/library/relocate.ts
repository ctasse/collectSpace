/**
 * 为缺失媒体的条目重新指定本地文件：
 * 复制进库内目录 → 更新 DB 路径/大小/哈希 → 清理旧文件（仅库内相对路径）。
 */
import { existsSync, rmSync, statSync, unlinkSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  extensionToType,
  isMediaType,
  type Item,
  type ItemView,
} from "@collect/core";
import { getDriver } from "../db";
import { getItem, updateItem } from "../db/items-repo";
import { toItemView } from "../db/item-view";
import { toAbsPath } from "../paths";
import { storeMediaFile } from "./media-import";

export async function relocateMediaItem(
  id: string,
  sourcePath: string,
): Promise<ItemView> {
  const driver = getDriver();
  const item = getItem(driver, id);
  if (!item) throw new Error("收藏不存在或已被删除");
  if (!isMediaType(item.type)) throw new Error("该收藏没有本地媒体文件");
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    throw new Error("选择的文件不存在或不是文件");
  }
  if (extensionToType(sourcePath) !== item.type) {
    throw new Error(`文件类型与收藏不一致（需要 ${item.type}）`);
  }

  const stored = await storeMediaFile(sourcePath, item.type, item.id);
  let updated: Item | null;
  try {
    updated = updateItem(driver, id, {
      content: stored.relPath,
      mediaMissing: false,
      sizeBytes: stored.sizeBytes,
      fileMtime: stored.fileMtime,
      sha256: stored.sha256,
    });
    if (!updated) throw new Error("收藏不存在或已被删除");
  } catch (error) {
    // 只删本次复制的新文件；同目录下可能还有原来的旧媒体
    try {
      rmSync(toAbsPath(stored.relPath), { force: true });
    } catch {
      // 清理失败不掩盖原始错误
    }
    throw error;
  }

  // 旧文件仍在库内且路径不同则清理；库外绝对路径不碰
  const oldAbs = toAbsPath(item.content);
  if (!isAbsolute(item.content) && oldAbs !== toAbsPath(stored.relPath)) {
    try {
      if (existsSync(oldAbs)) unlinkSync(oldAbs);
    } catch {
      // 旧文件清理失败不影响修复结果
    }
  }

  return toItemView(updated);
}
