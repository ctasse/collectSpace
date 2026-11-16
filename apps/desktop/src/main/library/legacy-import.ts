/**
 * 旧 Android 收藏导入（桌面端）。
 *
 * 数据源可任意组合：collection_items.db、媒体目录、ZIP。
 * 原则：
 * - 原库只读：先把 db/-wal/-shm 复制到临时目录再打开；
 * - ZIP 先安全解压到 import-tmp；
 * - legacy_uid = sha1(旧行原文) 保证重复导入幂等；
 * - 媒体匹配按相对路径/后缀/basename/去时间戳前缀逐级降级；
 * - 缺失媒体仍保留条目，标记 media_missing，后续可重新定位。
 */
import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  basenameOf,
  compareMediaCandidates,
  isMediaType,
  legacyPathKeys,
  mapLegacyRow,
  mediaMatchRank,
  mediaRelPath,
  sanitizeFileName,
  type ImportReport,
  type LegacyMappedRow,
  type LegacyRow,
} from "@collect/core";
import { getDriver } from "../db";
import { insertItem } from "../db/items-repo";
import { ensureUserDir, IMPORT_TMP_DIR, LOGS_DIR, toAbsPath } from "../paths";
import { extractZip } from "./zip";

const MAX_INDEX_FILES = 200_000;
const MAX_MEDIA_FILE = 10 * 1024 ** 3;
const MAX_MEDIA_TOTAL = 50 * 1024 ** 3;
const MAX_MESSAGES = 200;
const SESSION_TTL = 30 * 60_000;

export interface LegacySourceInput {
  dbPath?: string;
  mediaDir?: string;
  zipPath?: string;
}

interface MediaEntry {
  absPath: string;
  relPath: string;
  size: number;
  mtime: number;
}

interface SessionEntry {
  row: LegacyMappedRow;
  uid: string;
  legacyId: number | null;
}

interface LegacySession {
  id: string;
  tempDir: string;
  createdAt: number;
  dbLabel: string;
  entries: SessionEntry[];
  index: Map<string, MediaEntry[]>;
  warnings: string[];
  canceled: boolean;
}

export interface LegacyInspectResult {
  sessionId: string;
  dbLabel: string;
  rows: number;
  types: Record<string, number>;
  mediaRows: number;
  matchedMedia: number;
  missingMedia: number;
  ambiguous: number;
  existing: number;
  warnings: string[];
}

export type LegacyStage =
  | "opening-db"
  | "scanning-media"
  | "matching"
  | "copying"
  | "writing"
  | "done";

export interface LegacyProgress {
  sessionId: string;
  stage: LegacyStage;
  processed: number;
  total: number;
  inserted: number;
  repaired: number;
  missing: number;
}

const sessions = new Map<string, LegacySession>();

function sha1(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function findFile(
  root: string,
  name: string,
  maxDepth: number,
  depth = 0,
): string | null {
  if (depth > maxDepth) return null;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.name === name && entry.isFile()) return join(root, entry.name);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const found = findFile(join(root, entry.name), name, maxDepth, depth + 1);
    if (found) return found;
  }
  return null;
}

function copyDatabaseFiles(dbPath: string, destDir: string): string {
  const dest = join(destDir, basename(dbPath));
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${dbPath}${suffix}`;
    if (existsSync(source)) {
      copyFileSync(source, `${dest}${suffix}`);
    }
  }
  return dest;
}

function readLegacyRows(dbPath: string): LegacyRow[] {
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    throw new Error(`无法打开旧数据库：${messageOf(error)}`);
  }

  try {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'collection_items'",
      )
      .get();
    if (!table) throw new Error("数据库中未找到 collection_items 表");

    const columns = db
      .prepare("PRAGMA table_info(collection_items)")
      .all() as { name: string }[];
    const names = new Set(columns.map((column) => column.name));
    const required = ["id", "title", "content", "type", "createTime"];
    const missing = required.filter((name) => !names.has(name));
    if (missing.length > 0) {
      throw new Error(`旧数据库缺少必需列：${missing.join("、")}`);
    }

    const description = names.has("description") ? "description" : "''";
    const tag = names.has("tag") ? "tag" : names.has("source") ? "source" : "''";
    const rows = db
      .prepare(
        `SELECT id, title, content, ${description} AS description,
                type, createTime, ${tag} AS tag
         FROM collection_items
         ORDER BY createTime DESC`,
      )
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      id: Number(row.id ?? 0),
      title: row.title,
      content: row.content,
      description: row.description,
      type: row.type,
      createTime: row.createTime,
      tag: row.tag,
    }));
  } finally {
    db.close();
  }
}

function addMediaFile(
  index: Map<string, MediaEntry[]>,
  file: string,
  relPath: string,
): void {
  let stat;
  try {
    stat = statSync(file);
    if (!stat.isFile()) return;
  } catch {
    return;
  }

  const entry: MediaEntry = {
    absPath: file,
    relPath: relPath.replace(/\\/g, "/"),
    size: stat.size,
    mtime: Math.trunc(stat.mtimeMs),
  };
  const key = basenameOf(entry.relPath).toLowerCase();
  const list = index.get(key);
  if (list) list.push(entry);
  else index.set(key, [entry]);
}

function walkMedia(
  root: string,
  dir: string,
  depth: number,
  index: Map<string, MediaEntry[]>,
  warnings: string[],
): number {
  if (depth > 12) return 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      count += walkMedia(root, join(dir, entry.name), depth + 1, index, warnings);
      continue;
    }
    if (!entry.isFile()) continue;

    const lower = entry.name.toLowerCase();
    if (lower.startsWith("collection_items.db") || lower === ".nomedia") continue;
    if (count >= MAX_INDEX_FILES) {
      if (!warnings.includes("媒体文件过多，索引已截断")) {
        warnings.push("媒体文件过多，索引已截断");
      }
      return count;
    }

    const file = join(dir, entry.name);
    addMediaFile(index, file, relative(root, file));
    count += 1;
  }
  return count;
}

function bestMatch(
  index: Map<string, MediaEntry[]>,
  rawPath: string,
): { entry: MediaEntry | null; ambiguous: boolean } {
  const keys = legacyPathKeys(rawPath);
  const candidates = index.get(keys.base.toLowerCase()) ?? [];

  const ranked: { entry: MediaEntry; rank: number }[] = [];
  for (const entry of candidates) {
    const rank = mediaMatchRank(keys, entry.relPath);
    if (rank !== null) ranked.push({ entry, rank });
  }
  if (ranked.length === 0) return { entry: null, ambiguous: false };

  ranked.sort((a, b) =>
    compareMediaCandidates(
      { relPath: a.entry.relPath, rank: a.rank },
      { relPath: b.entry.relPath, rank: b.rank },
    ),
  );
  const top = ranked[0];
  if (!top) return { entry: null, ambiguous: false };
  return {
    entry: top.entry,
    ambiguous: ranked.filter((candidate) => candidate.rank === top.rank).length > 1,
  };
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt <= SESSION_TTL) continue;
    sessions.delete(id);
    try {
      rmSync(session.tempDir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响新导入
    }
  }
}

async function prepareSession(input: LegacySourceInput): Promise<LegacySession> {
  const dbPath = input.dbPath?.trim() ?? "";
  const mediaDir = input.mediaDir?.trim() ?? "";
  const zipPath = input.zipPath?.trim() ?? "";
  if (!dbPath && !mediaDir && !zipPath) {
    throw new Error("请选择旧数据库、媒体目录或 ZIP 中的至少一项");
  }

  const id = randomUUID();
  const tempDir = ensureUserDir(IMPORT_TMP_DIR, id);
  const warnings: string[] = [];
  const roots: string[] = [];

  try {
    if (mediaDir) {
      if (!isDirectory(mediaDir)) throw new Error("媒体目录不存在或不是文件夹");
      roots.push(mediaDir);
    }

    if (zipPath) {
      if (!isFile(zipPath)) throw new Error("ZIP 文件不存在");
      const extractDir = join(tempDir, "zip");
      mkdirSync(extractDir, { recursive: true });
      await extractZip(zipPath, extractDir);
      roots.push(extractDir);
    }

    let actualDb = dbPath && isFile(dbPath) ? dbPath : "";
    if (dbPath && !actualDb) throw new Error("数据库文件不存在");

    if (!actualDb) {
      for (const root of roots) {
        const found = findFile(root, "collection_items.db", 8);
        if (found) {
          actualDb = found;
          break;
        }
      }
    }
    if (!actualDb) {
      throw new Error(
        zipPath
          ? "ZIP 中未找到收藏数据库 collection_items.db"
          : "未找到收藏数据库 collection_items.db，请手动选择",
      );
    }

    const dbCopyDir = join(tempDir, "db");
    mkdirSync(dbCopyDir, { recursive: true });
    const dbCopy = copyDatabaseFiles(actualDb, dbCopyDir);
    const rows = readLegacyRows(dbCopy);
    const mapped = rows.map((row) => mapLegacyRow(row));

    const index = new Map<string, MediaEntry[]>();
    for (const root of roots) {
      walkMedia(root, root, 0, index, warnings);
    }

    const entries: SessionEntry[] = mapped.map((row, index) => {
      const raw = rows[index];
      return {
        row,
        uid: sha1(row.legacyKey),
        legacyId: raw && Number.isFinite(raw.id) ? raw.id : null,
      };
    });

    return {
      id,
      tempDir,
      createdAt: Date.now(),
      dbLabel: actualDb,
      entries,
      index,
      warnings,
      canceled: false,
    };
  } catch (error) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // 保留原始错误
    }
    throw error;
  }
}

export async function inspectLegacy(
  input: LegacySourceInput,
): Promise<LegacyInspectResult> {
  cleanupStaleSessions();
  const session = await prepareSession(input);
  sessions.set(session.id, session);

  const driver = getDriver();
  const existingRows = driver.all<{ legacy_uid: string }>(
    "SELECT legacy_uid FROM items WHERE legacy_uid IS NOT NULL",
  );
  const existing = new Set(existingRows.map((row) => row.legacy_uid));

  const types: Record<string, number> = {};
  let matchedMedia = 0;
  let missingMedia = 0;
  let ambiguous = 0;
  let existingCount = 0;

  for (const { row, uid } of session.entries) {
    types[row.type] = (types[row.type] ?? 0) + 1;
    if (existing.has(uid)) existingCount += 1;
    if (!isMediaType(row.type)) continue;
    const match = bestMatch(session.index, row.content);
    if (match.entry) matchedMedia += 1;
    else missingMedia += 1;
    if (match.ambiguous) ambiguous += 1;
  }

  return {
    sessionId: session.id,
    dbLabel: session.dbLabel,
    rows: session.entries.length,
    types,
    mediaRows: session.entries.filter(({ row }) => isMediaType(row.type)).length,
    matchedMedia,
    missingMedia,
    ambiguous,
    existing: existingCount,
    warnings: session.warnings,
  };
}

export function cancelLegacy(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) session.canceled = true;
}

export function disposeLegacySessions(): void {
  for (const [id, session] of sessions) {
    sessions.delete(id);
    try {
      rmSync(session.tempDir, { recursive: true, force: true });
    } catch {
      // 退出时忽略清理错误
    }
  }
}

interface CopyContext {
  totalBytes: number;
}

async function copyMedia(
  entry: MediaEntry,
  relPath: string,
  context: CopyContext,
): Promise<{ size: number; mtime: number; sha256: string }> {
  if (entry.size > MAX_MEDIA_FILE) {
    throw new Error("单个媒体文件超过 10GB，已跳过");
  }
  if (context.totalBytes + entry.size > MAX_MEDIA_TOTAL) {
    throw new Error("媒体总大小超过 50GB，已中止");
  }

  const dest = toAbsPath(relPath);
  const part = `${dest}.part`;
  mkdirSync(dirname(dest), { recursive: true });

  const hash = createHash("sha256");
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(createReadStream(entry.absPath), tap, createWriteStream(part));
    renameSync(part, dest);
    const stat = statSync(dest);
    context.totalBytes += stat.size;
    return {
      size: stat.size,
      mtime: Math.trunc(stat.mtimeMs),
      sha256: hash.digest("hex"),
    };
  } catch (error) {
    try {
      if (existsSync(part)) unlinkSync(part);
    } catch {
      // 清理失败不掩盖原始错误
    }
    throw error;
  }
}

export async function runLegacyImport(
  sessionId: string,
  onProgress: (progress: LegacyProgress) => void,
): Promise<ImportReport> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("导入会话已过期，请重新选择数据源");

  const driver = getDriver();
  const startedAt = Date.now();
  const report: ImportReport = {
    jobId: session.id,
    startedAt,
    finishedAt: startedAt,
    canceled: false,
    rows: session.entries.length,
    inserted: 0,
    skippedExisting: 0,
    repaired: 0,
    mediaRows: session.entries.filter(({ row }) => isMediaType(row.type)).length,
    mediaCopied: 0,
    mediaMissing: 0,
    mediaFailed: 0,
    bytesCopied: 0,
    ambiguous: 0,
    warnings: [...session.warnings],
    errors: [],
    logPath: null,
  };

  const existingRows = driver.all<{
    id: string;
    legacy_uid: string;
    media_missing: number;
    content: string;
  }>(
    "SELECT id, legacy_uid, media_missing, content FROM items WHERE legacy_uid IS NOT NULL",
  );
  const existing = new Map(
    existingRows.map((row) => [
      row.legacy_uid,
      { id: row.id, mediaMissing: row.media_missing === 1, content: row.content },
    ]),
  );

  const copyContext: CopyContext = { totalBytes: 0 };
  let lastEmit = 0;
  let processed = 0;

  const emit = (stage: LegacyStage, force = false): void => {
    const now = Date.now();
    if (!force && now - lastEmit < 150 && processed % 20 !== 0) return;
    lastEmit = now;
    try {
      onProgress({
        sessionId,
        stage,
        processed,
        total: report.rows,
        inserted: report.inserted,
        repaired: report.repaired,
        missing: report.mediaMissing,
      });
    } catch {
      // 渲染进程已关闭时忽略
    }
  };

  emit("matching", true);

  try {
    for (const { row, uid, legacyId } of session.entries) {
      if (session.canceled) {
        report.canceled = true;
        break;
      }

      const existingItem = existing.get(uid);
      if (existingItem) {
        if (existingItem.mediaMissing && isMediaType(row.type)) {
          const match = bestMatch(session.index, row.content);
          if (match.entry) {
            try {
              const destRel =
                existingItem.content ||
                mediaRelPath(
                  row.type,
                  existingItem.id,
                  sanitizeFileName(basenameOf(row.content) || "file"),
                );
              const destAbs = toAbsPath(destRel);
              const copied = existsSync(destAbs)
                ? { size: statSync(destAbs).size, mtime: Math.trunc(statSync(destAbs).mtimeMs), sha256: null }
                : await copyMedia(match.entry, destRel, copyContext);
              driver.run(
                `UPDATE items SET content = ?, media_missing = 0,
                   size_bytes = ?, file_mtime = ?, sha256 = COALESCE(?, sha256), updated_at = ?
                 WHERE id = ?`,
                [
                  destRel,
                  copied.size,
                  copied.mtime,
                  copied.sha256,
                  Date.now(),
                  existingItem.id,
                ],
              );
              report.repaired += 1;
              report.mediaCopied += 1;
              if (copied.sha256) report.bytesCopied += copied.size;
            } catch (error) {
              report.mediaFailed += 1;
              report.skippedExisting += 1;
              report.errors.push({
                legacyId,
                title: row.title,
                reason: `媒体修复失败：${messageOf(error)}`,
              });
            }
          } else {
            // 条目已在库中，只是媒体仍然缺失：按“已存在”计，不重复插入
            report.skippedExisting += 1;
            report.mediaMissing += 1;
          }
        } else {
          report.skippedExisting += 1;
        }
        processed += 1;
        emit("writing");
        continue;
      }

      const itemId = randomUUID();
      let content = row.content;
      let mediaMissing = false;
      let sizeBytes: number | null = null;
      let fileMtime: number | null = null;
      let sha256: string | null = null;

      if (isMediaType(row.type)) {
        const match = bestMatch(session.index, row.content);
        if (match.ambiguous) report.ambiguous += 1;

        const fileName = sanitizeFileName(
          basenameOf(row.content) || basenameOf(match.entry?.relPath ?? "") || "file",
        );
        const relPath = mediaRelPath(row.type, itemId, fileName);
        content = relPath;

        if (match.entry) {
          try {
            const copied = await copyMedia(match.entry, relPath, copyContext);
            sizeBytes = copied.size;
            fileMtime = copied.mtime;
            sha256 = copied.sha256;
            report.mediaCopied += 1;
            report.bytesCopied += copied.size;
          } catch (error) {
            mediaMissing = true;
            report.mediaFailed += 1;
            report.mediaMissing += 1;
            report.errors.push({
              legacyId,
              title: row.title,
              reason: `媒体复制失败：${messageOf(error)}`,
            });
          }
        } else {
          mediaMissing = true;
          report.mediaMissing += 1;
        }
        emit("copying");
      }

      try {
        insertItem(driver, {
          id: itemId,
          title: row.title,
          content,
          description: row.description,
          type: row.type,
          tag: row.tag,
          legacyId,
          legacyUid: uid,
          legacyPath: row.content,
          mediaMissing,
          sizeBytes,
          fileMtime,
          sha256,
          createdAt: row.createdAt,
        });
        report.inserted += 1;
      } catch (error) {
        report.errors.push({
          legacyId,
          title: row.title,
          reason: `写入失败：${messageOf(error)}`,
        });
      }

      processed += 1;
      emit("writing");
    }
  } finally {
    report.finishedAt = Date.now();
    report.warnings = report.warnings.slice(0, MAX_MESSAGES);
    report.errors = report.errors.slice(0, MAX_MESSAGES);

    try {
      const logDir = ensureUserDir(LOGS_DIR);
      const logPath = join(logDir, `legacy-import-${session.id}.json`);
      writeFileSync(
        logPath,
        JSON.stringify(
          { ...report, source: { db: session.dbLabel, warnings: session.warnings } },
          null,
          2,
        ),
        "utf8",
      );
      report.logPath = logPath;
    } catch {
      report.logPath = null;
    }

    sessions.delete(session.id);
    try {
      rmSync(session.tempDir, { recursive: true, force: true });
    } catch {
      // 临时目录清理失败不影响导入结果
    }
    emit("done", true);
  }

  return report;
}
