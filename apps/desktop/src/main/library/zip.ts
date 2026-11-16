/**
 * 旧数据 ZIP 安全解压：只读流式落到临时目录。
 * - 拒绝绝对路径 / 盘符 / `..` / NUL / 符号链接
 * - 限制条目数、单文件大小、总解压大小、压缩比
 * - 条目名 UTF-8 标志缺失时回退 GBK（旧 Windows 打包常见）
 */
import yauzl from "yauzl";
import iconv from "iconv-lite";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const MAX_ENTRIES = 100_000;
const MAX_ENTRY_SIZE = 10 * 1024 ** 3;
const MAX_TOTAL_SIZE = 50 * 1024 ** 3;
const MAX_RATIO = 1000;
const RATIO_MIN_SIZE = 1024 ** 2;

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

function decodeEntryName(entry: yauzl.Entry): string {
  const raw = entry.fileName as unknown;
  if (Buffer.isBuffer(raw)) {
    const isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
    try {
      return (isUtf8 ? raw.toString("utf8") : iconv.decode(raw, "gbk")).replace(/\\/g, "/");
    } catch {
      return raw.toString("utf8").replace(/\\/g, "/");
    }
  }
  return String(raw).replace(/\\/g, "/");
}

function safeEntryPath(name: string): string | null {
  const normalized = name.replace(/^\/+/, "");
  if (!normalized || normalized.includes("\u0000")) return null;
  if (/^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." || segment === "")) return null;
  return normalized;
}

function isSymlink(entry: yauzl.Entry): boolean {
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
  return mode === 0o120000;
}

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, decodeStrings: false, autoClose: true },
      (error, zipfile) => {
        if (error || !zipfile) {
          reject(new ZipError(`无法打开 ZIP：${error?.message ?? "未知错误"}`));
          return;
        }
        resolvePromise(zipfile);
      },
    );
  });
}

function streamEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry, dest: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(new ZipError(`读取 ZIP 条目失败：${error?.message ?? entry.fileName}`));
        return;
      }
      mkdirSync(dirname(dest), { recursive: true });
      pipeline(stream, createWriteStream(dest))
        .then(() => resolvePromise())
        .catch(reject);
    });
  });
}

export interface ZipExtractResult {
  files: number;
  bytes: number;
}

export async function extractZip(
  zipPath: string,
  destRoot: string,
): Promise<ZipExtractResult> {
  const root = resolve(destRoot);
  const zipfile = await openZip(zipPath);

  let files = 0;
  let total = 0;

  await new Promise<void>((resolvePromise, reject) => {
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      try {
        zipfile.close();
      } catch {
        // 已关闭
      }
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    zipfile.on("entry", (entry) => {
      void (async () => {
        files += 1;
        if (files > MAX_ENTRIES) {
          throw new ZipError(`ZIP 条目超过 ${MAX_ENTRIES} 个，已中止`);
        }

        const name = decodeEntryName(entry);
        if (name.endsWith("/")) {
          zipfile.readEntry();
          return;
        }
        if (isSymlink(entry)) {
          throw new ZipError(`ZIP 包含符号链接，已中止：${name}`);
        }

        const safeName = safeEntryPath(name);
        if (!safeName) {
          throw new ZipError(`ZIP 包含不安全路径，已中止：${name}`);
        }

        if (entry.uncompressedSize > MAX_ENTRY_SIZE) {
          throw new ZipError(`ZIP 内单个文件超过 10GB，已中止：${name}`);
        }
        total += entry.uncompressedSize;
        if (total > MAX_TOTAL_SIZE) {
          throw new ZipError("ZIP 解压后总大小超过 50GB，已中止");
        }
        if (
          entry.uncompressedSize > RATIO_MIN_SIZE &&
          entry.uncompressedSize / Math.max(1, entry.compressedSize) > MAX_RATIO
        ) {
          throw new ZipError(`ZIP 条目压缩比异常，疑似压缩炸弹：${name}`);
        }

        const dest = resolve(root, safeName);
        if (dest !== root && !dest.startsWith(root + sep)) {
          throw new ZipError(`ZIP 路径越界，已中止：${name}`);
        }

        await streamEntry(zipfile, entry, dest);
        zipfile.readEntry();
      })().catch(fail);
    });

    zipfile.on("end", () => {
      if (settled) return;
      settled = true;
      resolvePromise();
    });
    zipfile.on("error", fail);
    zipfile.readEntry();
  });

  return { files, bytes: total };
}
