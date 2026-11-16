/** 设置存 meta.app_settings（JSON），双端共用同一 key 与归一化逻辑。 */
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AppSettings,
  type SqliteDriver,
} from "@collect/core";

const SETTINGS_KEY = "app_settings";

export function readSettings(driver: SqliteDriver): AppSettings {
  const row = driver.get<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    [SETTINGS_KEY],
  );
  if (!row?.value) return { ...DEFAULT_SETTINGS };

  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(driver: SqliteDriver, settings: AppSettings): void {
  driver.run(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SETTINGS_KEY, JSON.stringify(settings)],
  );
}
