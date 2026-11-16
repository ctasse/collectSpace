/**
 * PC 端 better-sqlite3 驱动适配（主进程专用）。
 * better-sqlite3 是同步 API，与 core 的 SqliteDriver 接口天然匹配。
 */
import type { SqliteDriver, SqliteRunResult } from "@collect/core";
import type BetterSqlite3 from "better-sqlite3";

export function createBetterSqliteDriver(db: BetterSqlite3.Database): SqliteDriver {
  return {
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []): SqliteRunResult {
      const result = db.prepare(sql).run(...(params as never[]));
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    get<T extends Record<string, unknown>>(
      sql: string,
      params = [],
    ): T | undefined {
      return db.prepare(sql).get(...(params as never[])) as T | undefined;
    },
    all<T extends Record<string, unknown>>(sql: string, params = []): T[] {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
  };
}
