/**
 * items 表读写（桌面主进程）。
 * 所有查询都走 core 的 SqliteDriver，# 与移动端保持同一套 SQL 语义。
 */
import { randomUUID } from "node:crypto";
import type { ContentType, Item, SqliteDriver, TagCount } from "@collect/core";

export const DEFAULT_TAG = "未分类";
export const DEFAULT_TEXT_TITLE = "文本收藏";

interface ItemRow extends Record<string, unknown> {
  id: string;
  legacy_id: number | null;
  legacy_uid: string | null;
  title: string;
  content: string;
  description: string;
  type: string;
  tag: string;
  media_missing: number;
  legacy_path: string | null;
  size_bytes: number | null;
  file_mtime: number | null;
  sha256: string | null;
  created_at: number;
  updated_at: number;
}

function mapRow(row: ItemRow): Item {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    legacyUid: row.legacy_uid,
    title: row.title,
    content: row.content,
    description: row.description,
    type: row.type as ContentType,
    tag: row.tag,
    mediaMissing: row.media_missing === 1,
    legacyPath: row.legacy_path,
    sizeBytes: row.size_bytes,
    fileMtime: row.file_mtime,
    sha256: row.sha256,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NewItemInput {
  /** 可选：导入媒体时需要先确定 UUID 以生成目标路径 */
  id?: string;
  title: string;
  content: string;
  description?: string;
  type: ContentType;
  tag?: string;
  legacyId?: number | null;
  legacyUid?: string | null;
  legacyPath?: string | null;
  mediaMissing?: boolean;
  sizeBytes?: number | null;
  fileMtime?: number | null;
  sha256?: string | null;
  createdAt?: number;
}

export function insertItem(driver: SqliteDriver, input: NewItemInput): Item {
  const id = input.id ?? randomUUID();
  const now = input.createdAt ?? Date.now();
  driver.run(
    `INSERT INTO items (
       id, legacy_id, legacy_uid, title, content, description,
       type, tag, media_missing, legacy_path,
       size_bytes, file_mtime, sha256, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.legacyId ?? null,
      input.legacyUid ?? null,
      input.title,
      input.content,
      input.description ?? "",
      input.type,
      input.tag ?? DEFAULT_TAG,
      input.mediaMissing ? 1 : 0,
      input.legacyPath ?? null,
      input.sizeBytes ?? null,
      input.fileMtime ?? null,
      input.sha256 ?? null,
      now,
      now,
    ],
  );
  const created = getItem(driver, id);
  if (!created) throw new Error("收藏创建失败：未能读回新条目");
  return created;
}

export function getItem(driver: SqliteDriver, id: string): Item | null {
  const row = driver.get<ItemRow>("SELECT * FROM items WHERE id = ?", [id]);
  return row ? mapRow(row) : null;
}

export function getItemsByIds(driver: SqliteDriver, ids: string[]): Item[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = driver.all<ItemRow>(
    `SELECT * FROM items WHERE id IN (${placeholders})`,
    ids,
  );
  return rows.map(mapRow);
}

export interface ListOptions {
  query?: string;
  tag?: string;
  type?: ContentType;
  offset?: number;
  limit?: number;
}

export interface ListResult {
  items: Item[];
  total: number;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildWhere(options: ListOptions): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const tag = options.tag?.trim();
  if (tag) {
    clauses.push("tag = ?");
    params.push(tag);
  }

  if (options.type) {
    clauses.push("type = ?");
    params.push(options.type);
  }

  const query = options.query?.trim();
  if (query) {
    const like = `%${escapeLike(query)}%`;
    clauses.push(
      `(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
        OR description LIKE ? ESCAPE '\\' OR tag LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function listItems(driver: SqliteDriver, options: ListOptions = {}): ListResult {
  const where = buildWhere(options);
  const limit = Math.min(
    Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT)),
    MAX_LIMIT,
  );
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));

  const totalRow = driver.get<{ total: number }>(
    `SELECT COUNT(*) AS total FROM items ${where.sql}`,
    where.params,
  );
  const rows = driver.all<ItemRow>(
    `SELECT * FROM items ${where.sql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  );

  return {
    items: rows.map(mapRow),
    total: Number(totalRow?.total ?? 0),
  };
}

export function listTags(driver: SqliteDriver): TagCount[] {
  const rows = driver.all<{ name: string; count: number }>(
    `SELECT tag AS name, COUNT(*) AS count
     FROM items
     GROUP BY tag
     ORDER BY count DESC, name ASC`,
  );
  return rows.map((row) => ({ name: row.name, count: Number(row.count) }));
}

export interface UpdateItemInput {
  title?: string;
  content?: string;
  description?: string;
  tag?: string;
  mediaMissing?: boolean;
  sizeBytes?: number | null;
  fileMtime?: number | null;
  sha256?: string | null;
}

export function updateItem(
  driver: SqliteDriver,
  id: string,
  patch: UpdateItemInput,
): Item | null {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.title !== undefined) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push("content = ?");
    params.push(patch.content);
  }
  if (patch.description !== undefined) {
    sets.push("description = ?");
    params.push(patch.description);
  }
  if (patch.tag !== undefined) {
    sets.push("tag = ?");
    params.push(patch.tag);
  }
  if (patch.mediaMissing !== undefined) {
    sets.push("media_missing = ?");
    params.push(patch.mediaMissing ? 1 : 0);
  }
  if (patch.sizeBytes !== undefined) {
    sets.push("size_bytes = ?");
    params.push(patch.sizeBytes);
  }
  if (patch.fileMtime !== undefined) {
    sets.push("file_mtime = ?");
    params.push(patch.fileMtime);
  }
  if (patch.sha256 !== undefined) {
    sets.push("sha256 = ?");
    params.push(patch.sha256);
  }
  if (sets.length === 0) return getItem(driver, id);

  sets.push("updated_at = ?");
  params.push(Date.now(), id);
  driver.run(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`, params);
  return getItem(driver, id);
}

export function setItemsTag(
  driver: SqliteDriver,
  ids: string[],
  tag: string,
): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = driver.run(
    `UPDATE items SET tag = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [tag, Date.now(), ...ids],
  );
  return result.changes;
}

export function removeItems(driver: SqliteDriver, ids: string[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = driver.run(
    `DELETE FROM items WHERE id IN (${placeholders})`,
    ids,
  );
  return result.changes;
}
