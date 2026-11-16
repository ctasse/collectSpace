import { basenameOf, stripTimestampPrefix } from "./media.js";

/** 旧版可能出现的媒体根目录（按从具体到宽泛排序） */
const ROOT_PATTERNS: RegExp[] = [
  // 保留 shared_imports/ 子目录，便于与媒体索引的相对路径对齐
  /^\/storage\/emulated\/0\/CollectApp\/(.+)$/i,
  /^\/storage\/emulated\/0\/collection\/(.+)$/i,
  /^\/storage\/emulated\/0\/(?:Download|Documents|Pictures|DCIM\/Camera)\/(.+)$/i,
  /^\/storage\/emulated\/0\/Android\/data\/com\.example\.collect\/(?:cache|files)\/(.+)$/i,
  /^\/data\/user\/0\/com\.example\.collect\/(?:cache|files|databases)\/(.+)$/i,
  /^\/data\/data\/com\.example\.collect\/(?:cache|files|databases)\/(.+)$/i,
  /^\/sdcard\/(.+)$/i,
  /^\/mnt\/sdcard\/(.+)$/i,
  /^\/storage\/emulated\/0\/(.+)$/i,
];

export function normalizeLegacyPath(raw: string): string {
  let value = (raw ?? "").trim();
  value = value.replace(/^file:\/\//i, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    // 非法百分号编码：保留原样
  }
  return value.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** 去掉已知 Android 根前缀，得到库内相对路径 */
export function stripLegacyRoot(raw: string): string {
  const normalized = normalizeLegacyPath(raw);
  for (const pattern of ROOT_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match?.[1]) return match[1].replace(/^\/+/, "");
  }
  return normalized.replace(/^\/+/, "");
}

export interface LegacyPathKeys {
  full: string;
  rel: string;
  base: string;
  baseNoTs: string;
  relNoTs: string;
}

export function legacyPathKeys(raw: string): LegacyPathKeys {
  const full = normalizeLegacyPath(raw);
  const rel = stripLegacyRoot(full);
  const base = basenameOf(rel);
  const baseNoTs = stripTimestampPrefix(base);
  const relNoTs =
    baseNoTs === base ? rel : rel.slice(0, Math.max(0, rel.length - base.length)) + baseNoTs;
  return { full, rel, base, baseNoTs, relNoTs };
}

function normalizedEntry(entryRel: string): string {
  return entryRel.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

/**
 * 返回匹配等级（越小越可信），null 表示不匹配：
 * 0 精确相对路径 / 完整路径
 * 1 相对路径后缀
 * 2 basename 精确
 * 3 去毫秒前缀后的相对路径后缀（保留目录，证据更强）
 * 4 去毫秒前缀后的 basename
 */
export function mediaMatchRank(
  keys: LegacyPathKeys,
  entryRel: string,
): number | null {
  const entry = normalizedEntry(entryRel);
  if (!entry) return null;

  const full = keys.full.toLowerCase();
  const rel = keys.rel.toLowerCase();
  const base = keys.base.toLowerCase();
  const baseNoTs = keys.baseNoTs.toLowerCase();
  const relNoTs = keys.relNoTs.toLowerCase();

  if (entry === rel || entry === full) return 0;
  if (rel && entry.endsWith(`/${rel}`)) return 1;
  if (entry === base || entry.endsWith(`/${base}`)) return 2;
  if (relNoTs && (entry === relNoTs || entry.endsWith(`/${relNoTs}`))) return 3;
  if (baseNoTs && (entry === baseNoTs || entry.endsWith(`/${baseNoTs}`))) return 4;
  return null;
}

/** 多候选时：优先 shared_imports/CollectApp，再取层级更浅、路径更短的 */
export function compareMediaCandidates(
  a: { relPath: string; rank: number },
  b: { relPath: string; rank: number },
): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const preferred = (rel: string): number =>
    /(^|\/)(shared_imports|CollectApp)\//i.test(rel) ? 0 : 1;
  const pref = preferred(a.relPath) - preferred(b.relPath);
  if (pref !== 0) return pref;
  const depthA = a.relPath.split("/").length;
  const depthB = b.relPath.split("/").length;
  if (depthA !== depthB) return depthA - depthB;
  return a.relPath.length - b.relPath.length;
}
