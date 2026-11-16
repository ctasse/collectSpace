/**
 * 数据库初始化：启动时执行 core 里的迁移（双端共用 schema）。
 * DB 文件位于 userData/collectspace.db。
 */
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  MIGRATIONS,
  getSchemaVersion,
  runMigrations,
  type SqliteDriver,
} from "@collect/core";
import { createBetterSqliteDriver } from "./driver";

let db: Database.Database | null = null;
let driver: SqliteDriver | null = null;
let dbInfo: DbInitResult | null = null;

export interface DbInitResult {
  path: string;
  schemaVersion: number;
  applied: number;
}

export function initDatabase(): DbInitResult {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "collectspace.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  driver = createBetterSqliteDriver(db);
  const applied = runMigrations(driver, MIGRATIONS);
  const schemaVersion = getSchemaVersion(driver);
  dbInfo = { path: dbPath, schemaVersion, applied };

  console.log(`[db] ${dbPath} schema_version=${schemaVersion} applied=${applied}`);
  return { path: dbPath, schemaVersion, applied };
}

export function getDriver(): SqliteDriver {
  if (!driver) throw new Error("数据库尚未初始化");
  return driver;
}

export function getDbInfo(): DbInitResult | null {
  return dbInfo;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("数据库尚未初始化");
  return db;
}

export function closeDatabase(): void {
  driver = null;
  db?.close();
  db = null;
}
