/** IPC 入参校验：手写、严格、错误文案直接给用户看。 */
import type { ContentType } from "@collect/core";

const TYPES: readonly ContentType[] = ["text", "url", "image", "video", "file"];

export function requireRecord(
  value: unknown,
  label = "参数",
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label}格式不正确`);
  }
  return value as Record<string, unknown>;
}

export function optionalString(
  value: unknown,
  label: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${label}必须是字符串`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${label}过长（最多 ${maxLength} 字符）`);
  }
  return trimmed;
}

export function requireString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  const text = optionalString(value, label, maxLength);
  if (!text) throw new Error(`${label}不能为空`);
  return text;
}

export function requireId(value: unknown): string {
  return requireString(value, "条目 ID", 200);
}

export function requireIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("条目列表格式不正确");
  if (value.length > 1000) throw new Error("一次最多操作 1000 条");
  const ids = value.map((item) => requireId(item));
  return [...new Set(ids)];
}

export function normalizeTag(value: unknown): string {
  const tag = optionalString(value, "标签", 40);
  return tag || "未分类";
}

export function optionalType(value: unknown): ContentType | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !(TYPES as readonly string[]).includes(value)) {
    throw new Error("内容类型不正确");
  }
  return value as ContentType;
}

export function optionalNumber(
  value: unknown,
  label: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}必须是数字`);
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
