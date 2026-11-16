import type { SQLiteBindParams, SQLiteDatabase } from "expo-sqlite";
import type { SqliteDriver, SqliteRunResult } from "@collect/core";

/** 把 expo-sqlite 的同步 API 适配成 core 的 SqliteDriver。 */
export function createExpoDriver(db: SQLiteDatabase): SqliteDriver {
  return {
    exec(sql: string): void {
      db.execSync(sql);
    },
    run(sql: string, params: unknown[] = []): SqliteRunResult {
      const result = db.runSync(sql, params as SQLiteBindParams);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowId,
      };
    },
    get<T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): T | undefined {
      return db.getFirstSync<T>(sql, params as SQLiteBindParams) ?? undefined;
    },
    all<T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): T[] {
      return db.getAllSync<T>(sql, params as SQLiteBindParams);
    },
  };
}
