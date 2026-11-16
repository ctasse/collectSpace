import type { Migration } from "./migrate.js";

export const SCHEMA_VERSION = 1;

/**
 * 双端共用的 schema v1。
 * 约定：
 * - 只做增量迁移，绝不 DROP/重建用户表；
 * - 媒体路径存相对路径（正斜杠），由宿主拼绝对路径/协议 URL；
 * - 时间统一存 epoch ms，避免时区与字符串排序问题。
 */
const V1_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS items (
     id            TEXT PRIMARY KEY,
     legacy_id     INTEGER,
     legacy_uid    TEXT,
     title         TEXT NOT NULL,
     content       TEXT NOT NULL,
     description   TEXT NOT NULL DEFAULT '',
     type          TEXT NOT NULL CHECK (type IN ('text','url','image','video','file')),
     tag           TEXT NOT NULL DEFAULT '未分类',
     media_missing INTEGER NOT NULL DEFAULT 0,
     legacy_path   TEXT,
     size_bytes    INTEGER,
     file_mtime    INTEGER,
     sha256        TEXT,
     created_at    INTEGER NOT NULL,
     updated_at    INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_items_created
     ON items(created_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_items_tag
     ON items(tag, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_items_type
     ON items(type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_items_legacy_uid
     ON items(legacy_uid) WHERE legacy_uid IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_items_missing
     ON items(media_missing) WHERE media_missing = 1`,
];

export const MIGRATIONS: Migration[] = [
  { version: 1, name: "init", statements: V1_STATEMENTS },
];
