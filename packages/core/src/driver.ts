export interface SqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * 双端 SQLite 适配接口：
 * - 桌面：better-sqlite3（同步）
 * - 移动：expo-sqlite 的 *Sync API（同步）
 */
export interface SqliteDriver {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): SqliteRunResult;
  get<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): T | undefined;
  all<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): T[];
}

export type QueryRow = Record<string, unknown>;
