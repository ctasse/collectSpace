/**
 * 外部文件 → 库内媒体：
 * media/<type>/<uuid>/<sanitized-name>
 * 先写 .part 并同时计算 sha256，完成后原子 rename，失败清理临时文件。
 */
import {
  createReadStream,
  createWriteStream,
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  extensionToType,
  fileStem,
  mediaRelPath,
  sanitizeFileName,
  uniqueFileName,
  type ContentType,
} from "@collect/core";
import { ensureUserDir } from "../paths";
import { insertItem } from "../db/items-repo";
import { getDriver } from "../db";
import { toItemView } from "../db/item-view";
import type { ItemView } from "@collect/core";

const MAX_FILES = 1000;
const MAX_DEPTH = 12;

export interface ImportPathsResult {
  imported: ItemView[];
  failed: { file: string; error: string }[];
}

function collectFiles(path: string, depth: number, out: string[]): void {
  if (out.length >= MAX_FILES) return;
  const st = statSync(path);
  if (st.isDirectory()) {
    if (depth >= MAX_DEPTH) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) break;
      if (entry.isSymbolicLink()) continue;
      collectFiles(join(path, entry.name), depth + 1, out);
    }
    return;
  }
  if (st.isFile()) out.push(path);
}

async function deleteDirQuietly(dir: string): Promise<void> {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // 清理失败不掩盖原始错误
  }
}

export interface StoredMedia {
  itemId: string;
  relPath: string;
  fileName: string;
  sizeBytes: number;
  fileMtime: number;
  sha256: string;
}

/** 复制外部文件到库内；itemId 传入时复用该目录（重新定位）。 */
export async function storeMediaFile(
  sourcePath: string,
  type: ContentType,
  itemId: string = randomUUID(),
): Promise<StoredMedia> {
  const sourceStat = statSync(sourcePath);
  if (!sourceStat.isFile()) throw new Error("不是可导入的文件");

  const originalName = basename(sourcePath);
  const dirExisted = existsSync(join(ensureUserDir("media", type), itemId));
  const dir = ensureUserDir("media", type, itemId);
  const safeName = sanitizeFileName(originalName);
  const fileName = uniqueFileName(safeName, readdirSync(dir));
  const relPath = mediaRelPath(type, itemId, fileName);
  const dest = join(dir, fileName);
  const part = `${dest}.part`;

  const hash = createHash("sha256");
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      createReadStream(sourcePath),
      tap,
      createWriteStream(part),
    );
    renameSync(part, dest);

    const finalStat = statSync(dest);
    return {
      itemId,
      relPath,
      fileName,
      sizeBytes: finalStat.size,
      fileMtime: Math.trunc(finalStat.mtimeMs),
      sha256: hash.digest("hex"),
    };
  } catch (error) {
    // 只清理本次新建的目录；重新定位时原目录里可能还有旧媒体，不能整目录删除
    try {
      rmSync(part, { force: true });
    } catch {
      // 临时文件清理失败不掩盖原始错误
    }
    if (!dirExisted) await deleteDirQuietly(dir);
    throw error;
  }
}

async function importOne(
  sourcePath: string,
  tag: string,
): Promise<ItemView> {
  const originalName = basename(sourcePath);
  const type: ContentType = extensionToType(originalName);
  const stored = await storeMediaFile(sourcePath, type);

  try {
    return toItemView(
      insertItem(getDriver(), {
        id: stored.itemId,
        title: fileStem(originalName) || "文件",
        content: stored.relPath,
        description: "",
        type,
        tag,
        sizeBytes: stored.sizeBytes,
        fileMtime: stored.fileMtime,
        sha256: stored.sha256,
      }),
    );
  } catch (error) {
    await deleteDirQuietly(ensureUserDir("media", type, stored.itemId));
    throw error;
  }
}

export async function importPaths(
  paths: string[],
  tag: string,
): Promise<ImportPathsResult> {
  const files: string[] = [];
  const failed: { file: string; error: string }[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    try {
      if (!existsSync(path)) {
        failed.push({ file: path, error: "文件不存在" });
        continue;
      }
      const found: string[] = [];
      collectFiles(path, 0, found);
      for (const file of found) {
        if (!seen.has(file)) {
          seen.add(file);
          files.push(file);
        }
      }
    } catch (error) {
      failed.push({
        file: path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (files.length > MAX_FILES) {
    failed.push({
      file: "",
      error: `一次最多导入 ${MAX_FILES} 个文件，多余的已忽略`,
    });
    files.length = MAX_FILES;
  }

  const imported: ItemView[] = [];
  for (const file of files) {
    try {
      imported.push(await importOne(file, tag));
    } catch (error) {
      failed.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { imported, failed };
}
