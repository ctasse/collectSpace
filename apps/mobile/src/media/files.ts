/** 库内媒体文件：路径一律相对文档目录，正斜杠。 */
import * as FileSystem from "expo-file-system";
import {
  mediaRelPath,
  sanitizeFileName,
  uniqueFileName,
  type ContentType,
} from "@collect/core";

function root(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error("应用文档目录不可用");
  return dir;
}

export function mediaUri(relPath: string): string {
  return `${root()}${relPath}`;
}

export async function fileExists(relPath: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(mediaUri(relPath));
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

export interface StoredFile {
  relPath: string;
  sizeBytes: number | null;
  fileMtime: number | null;
}

/** 从分享/文档选择器的 file:// URI 复制进库，返回相对路径与大小。 */
export async function storeFile(
  sourceUri: string,
  fileName: string,
  type: ContentType,
  itemId: string,
): Promise<StoredFile> {
  const dir = `${root()}media/${type}/${itemId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const existing = await FileSystem.readDirectoryAsync(dir).catch(() => []);
  const unique = uniqueFileName(sanitizeFileName(fileName), existing);
  const dest = `${dir}${unique}`;

  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists && !info.isDirectory ? info.size : null;
  const mtime =
    info.exists && !info.isDirectory
      ? Math.trunc(info.modificationTime * 1000)
      : null;

  return {
    relPath: mediaRelPath(type, itemId, unique),
    sizeBytes: size,
    fileMtime: mtime,
  };
}

export async function deleteFile(relPath: string): Promise<void> {
  await FileSystem.deleteAsync(mediaUri(relPath), { idempotent: true });
}

/** 同目录重命名；返回新的相对路径。 */
export async function renameFile(
  relPath: string,
  nextName: string,
): Promise<string> {
  const slash = relPath.lastIndexOf("/");
  const dir = relPath.slice(0, slash + 1);
  const from = mediaUri(relPath);
  const to = mediaUri(`${dir}${nextName}`);
  if (from === to) return relPath;
  const info = await FileSystem.getInfoAsync(to);
  if (info.exists) throw new Error("同名文件已存在，请换一个名称");
  await FileSystem.moveAsync({ from, to });
  return `${dir}${nextName}`;
}
