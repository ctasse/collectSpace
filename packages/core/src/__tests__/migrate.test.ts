import { describe, expect, it } from "vitest";
import type { SqliteDriver, SqliteRunResult } from "../driver.js";
import { MigrationError, getSchemaVersion, runMigrations } from "../migrate.js";

class FakeDriver implements SqliteDriver {
  readonly executed: string[] = [];
  readonly meta = new Map<string, string>();
  failOn: RegExp | null = null;

  exec(sql: string): void {
    if (this.failOn?.test(sql)) throw new Error("boom");
    this.executed.push(sql);
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    if (this.failOn?.test(sql)) throw new Error("boom");
    if (sql.includes("schema_version")) {
      this.meta.set("schema_version", String(params?.[0] ?? ""));
    }
    return { changes: 1, lastInsertRowid: 1 };
  }

  get<T extends Record<string, unknown>>(sql: string): T | undefined {
    if (sql.includes("schema_version")) {
      const value = this.meta.get("schema_version");
      return value === undefined ? undefined : ({ value } as T);
    }
    return undefined;
  }

  all<T extends Record<string, unknown>>(): T[] {
    return [];
  }
}

describe("runMigrations", () => {
  it("applies migrations in order and records the version", () => {
    const driver = new FakeDriver();
    const applied = runMigrations(driver, [
      { version: 2, name: "second", statements: ["CREATE TABLE b (id INT)"] },
      { version: 1, name: "first", statements: ["CREATE TABLE a (id INT)"] },
    ]);

    expect(applied).toBe(2);
    expect(getSchemaVersion(driver)).toBe(2);
    expect(driver.executed.indexOf("CREATE TABLE a (id INT)")).toBeLessThan(
      driver.executed.indexOf("CREATE TABLE b (id INT)"),
    );
  });

  it("is idempotent", () => {
    const driver = new FakeDriver();
    const migrations = [
      { version: 1, name: "first", statements: ["CREATE TABLE a (id INT)"] },
    ];
    runMigrations(driver, migrations);
    const applied = runMigrations(driver, migrations);
    expect(applied).toBe(0);
  });

  it("rolls back and wraps errors", () => {
    const driver = new FakeDriver();
    driver.failOn = /BROKEN/;
    expect(() =>
      runMigrations(driver, [
        { version: 1, name: "broken", statements: ["BROKEN SQL"] },
      ]),
    ).toThrow(MigrationError);
    expect(driver.executed).toContain("BEGIN");
    expect(driver.executed).toContain("ROLLBACK");
  });
});
