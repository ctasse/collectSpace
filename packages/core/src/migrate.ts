import type { SqliteDriver } from "./driver.js";

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export class MigrationError extends Error {
  readonly migration: Migration;
  readonly originalError: unknown;

  constructor(migration: Migration, originalError: unknown) {
    const detail =
      originalError instanceof Error ? originalError.message : String(originalError);
    super(`数据库迁移失败：v${migration.version} ${migration.name} — ${detail}`);
    this.name = "MigrationError";
    this.migration = migration;
    this.originalError = originalError;
  }
}

const META_DDL = `CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

/**
 * 与 EchoTrace packages/core/src/db.ts 同语义：
 * 读取 meta.schema_version，按版本升序执行，每个迁移一个事务，失败回滚并抛错。
 */
export function runMigrations(
  driver: SqliteDriver,
  migrations: Migration[],
): number {
  driver.exec(META_DDL);
  const row = driver.get<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'",
  );
  let current = Number(row?.value ?? 0);
  if (!Number.isFinite(current)) current = 0;

  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  let applied = 0;

  for (const migration of sorted) {
    if (migration.version <= current) continue;

    driver.exec("BEGIN");
    try {
      for (const statement of migration.statements) {
        driver.exec(statement);
      }
      driver.run(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(migration.version)],
      );
      driver.exec("COMMIT");
      current = migration.version;
      applied += 1;
    } catch (error) {
      try {
        driver.exec("ROLLBACK");
      } catch {
        // 回滚失败时保留原始错误，便于定位
      }
      throw new MigrationError(migration, error);
    }
  }

  return applied;
}

export function getSchemaVersion(driver: SqliteDriver): number {
  const row = driver.get<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'",
  );
  return Number(row?.value ?? 0);
}
