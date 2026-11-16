import type { ContentType } from "./types.js";

export const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
] as const;

export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".wmv",
  ".mkv",
] as const;

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

export function fileStem(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const ext = extensionOf(base);
  return ext ? base.slice(0, base.length - ext.length) : base;
}

export function basenameOf(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** 与旧 Flutter 版 _getFileType 一致 */
export function extensionToType(fileName: string): ContentType {
  const ext = extensionOf(fileName);
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return "video";
  return "file";
}

export function isMediaType(type: ContentType): boolean {
  return type === "image" || type === "video" || type === "file";
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED_FILENAME =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/**
 * Windows/Android 通用文件名清洗：
 * - 替换非法字符、去掉末尾空格/点、统一 NFC；
 * - 规避 Windows 保留名；
 * - 保留扩展名，主名最长 120 字符。
 */
export function sanitizeFileName(input: string, fallback = "file"): string {
  let name = (input ?? "")
    .normalize("NFC")
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/[\s.]+$/g, "")
    .trim();

  if (!name) name = fallback;
  if (RESERVED_FILENAME.test(name)) name = `_${name}`;

  const ext = extensionOf(name);
  const stem = ext ? name.slice(0, name.length - ext.length) : name;
  const maxStem = Math.max(1, 120 - ext.length);
  const safeStem = stem.length > maxStem ? stem.slice(0, maxStem) : stem;
  return `${safeStem || fallback}${ext}`;
}

/** Kotlin 分享文件名为 `${System.currentTimeMillis()}_${name}` */
export function stripTimestampPrefix(name: string): string {
  return name.replace(/^\d{13}[_-]?/, "");
}

/** 生成库内相对路径：media/<type>/<uuid>/<name> */
export function mediaRelPath(
  type: ContentType,
  itemId: string,
  fileName: string,
): string {
  return `media/${type}/${itemId}/${sanitizeFileName(fileName)}`;
}

/** 同名文件自动加 _1、_2 …（不修改扩展名） */
export function uniqueFileName(name: string, existing: Iterable<string>): string {
  const used = new Set(existing);
  if (!used.has(name)) return name;

  const ext = extensionOf(name);
  const stem = ext ? name.slice(0, name.length - ext.length) : name;
  let counter = 1;
  let candidate = `${stem}_${counter}${ext}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${stem}_${counter}${ext}`;
  }
  return candidate;
}
