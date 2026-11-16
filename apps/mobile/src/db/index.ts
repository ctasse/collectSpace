import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import {
  getSchemaVersion,
  MIGRATIONS,
  runMigrations,
  type SqliteDriver,
} from "@collect/core";
import { createExpoDriver } from "./driver";

let database: SQLiteDatabase | null = null;
let driver: SqliteDriver | null = null;

export interface DbInfo {
  path: string;
  schemaVersion: number;
}

export function initDatabase(): DbInfo {
  if (database && driver) {
    return { path: database.databasePath, schemaVersion: getSchemaVersion(driver) };
  }

  database = openDatabaseSync("collect.db");
  database.execSync("PRAGMA journal_mode = WAL");
  database.execSync("PRAGMA busy_timeout = 5000");
  driver = createExpoDriver(database);
  runMigrations(driver, MIGRATIONS);

  return {
    path: database.databasePath,
    schemaVersion: getSchemaVersion(driver),
  };
}

export function getDriver(): SqliteDriver {
  if (!driver) throw new Error("数据库尚未初始化");
  return driver;
}

export function getDbInfo(): DbInfo {
  if (!database || !driver) throw new Error("数据库尚未初始化");
  return {
    path: database.databasePath,
    schemaVersion: getSchemaVersion(driver),
  };
}
