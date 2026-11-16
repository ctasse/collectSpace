import { basenameOf } from "./media.js";
import type { ContentType } from "./types.js";

/** 旧 sqflite 行（列可能缺失，用 unknown 保留原始值） */
export interface LegacyRow {
  id: number;
  title?: unknown;
  content?: unknown;
  description?: unknown;
  type?: unknown;
  createTime?: unknown;
  tag?: unknown;
  source?: unknown;
}

export interface LegacyMappedRow {
  type: ContentType;
  title: string;
  content: string;
  description: string;
  tag: string;
  createdAt: number;
  legacyKey: string;
}

const CONTENT_TYPES: readonly ContentType[] = [
  "text",
  "url",
  "image",
  "video",
  "file",
];

export function normalizeLegacyType(value: unknown): ContentType {
  return typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
    ? (value as ContentType)
    : "text";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 稳定的导入幂等键；桌面端再对它做 sha1 存入 legacy_uid */
export function legacyKey(row: LegacyRow): string {
  return [
    String(row.id),
    asText(row.createTime),
    asText(row.title),
    asText(row.content),
  ].join("\u0000");
}

export function mapLegacyRow(row: LegacyRow, now = Date.now()): LegacyMappedRow {
  const type = normalizeLegacyType(row.type);
  const content = asText(row.content);
  const titleCandidate = asText(row.title).trim();
  const title =
    titleCandidate ||
    (type === "text" ? "文本收藏" : basenameOf(content) || "未命名");
  const description = asText(row.description);

  const tagCandidate = asText(row.tag).trim() || asText(row.source).trim();
  const tag = tagCandidate || "未分类";

  const parsed = Date.parse(asText(row.createTime));
  const createdAt = Number.isFinite(parsed) ? parsed : now;

  return {
    type,
    title,
    content,
    description,
    tag,
    createdAt,
    legacyKey: legacyKey(row),
  };
}
