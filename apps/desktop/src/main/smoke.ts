/**
 * 无界面自检：--smoke 时在主进程内验证 DB 与自定义协议。
 * 使用临时 userData（见 index.ts），不会污染真实收藏库。
 */
import { app, net } from "electron";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_SETTINGS } from "@collect/core";
import { getDriver } from "./db";
import { insertItem, listItems, removeItems } from "./db/items-repo";
import { readSettings, writeSettings } from "./db/settings-repo";
import { inspectLegacy, runLegacyImport } from "./library/legacy-import";
import { relocateMediaItem } from "./library/relocate";
import { getVideoThumbnail } from "./library/thumbnails";
import { mediaUrl } from "./protocols";
import { ensureUserDir, ffmpegPath, toAbsPath, userDataPath } from "./paths";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function checkDatabase(): Promise<void> {
  const driver = getDriver();

  const created = insertItem(driver, {
    title: "smoke 文本",
    content: "hello smoke 中文内容",
    description: "smoke",
    type: "text",
    tag: "smoke",
  });

  const listed = listItems(driver, { query: "hello smoke", limit: 10 });
  assert(
    listed.items.some((item) => item.id === created.id),
    "db: LIKE 搜索未命中新建条目",
  );

  const tagRows = driver.all<{ name: string; count: number }>(
    "SELECT tag AS name, COUNT(*) AS count FROM items GROUP BY tag",
  );
  assert(
    tagRows.some((row) => row.name === "smoke" && row.count === 1),
    "db: 标签计数不正确",
  );

  const removed = removeItems(driver, [created.id]);
  assert(removed === 1, "db: 删除条目失败");

  const original = readSettings(driver);
  writeSettings(driver, { ...DEFAULT_SETTINGS, themeMode: "dark" });
  assert(readSettings(driver).themeMode === "dark", "db: 设置读写失败");
  writeSettings(driver, original);
}

async function checkProtocol(): Promise<void> {
  const dir = userDataPath("media", "smoke");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "probe.txt");
  writeFileSync(file, "collectspace", "utf8");

  try {
    const url = mediaUrl("media/smoke/probe.txt");
    const full = await net.fetch(url);
    assert(full.status === 200, `protocol: 期望 200，实际 ${full.status}`);
    assert((await full.text()) === "collectspace", "protocol: 文件内容不一致");

    const partial = await net.fetch(url, { headers: { range: "bytes=0-4" } });
    assert(partial.status === 206, `protocol: 期望 Range 206，实际 ${partial.status}`);
    assert((await partial.text()) === "colle", "protocol: Range 内容不一致");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

type LegacyFixtureRow = [
  title: string,
  content: string,
  description: string,
  type: string,
  createTime: string,
  tag: string,
];

function createLegacyDb(dbPath: string, rows: LegacyFixtureRow[]): void {
  const db = new Database(dbPath);
  db.exec(`CREATE TABLE collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    createTime TEXT NOT NULL,
    tag TEXT NOT NULL
  )`);

  const insert = db.prepare(
    `INSERT INTO collection_items (title, content, description, type, createTime, tag)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) insert.run(...row);
  db.close();
}

function makeLegacyFixture(): { dbPath: string; mediaDir: string; root: string } {
  const root = userDataPath("legacy-fixture");
  const dbPath = join(root, "collection_items.db");
  const mediaDir = join(root, "media");
  const shared = join(mediaDir, "shared_imports");
  mkdirSync(shared, { recursive: true });

  writeFileSync(join(shared, "1712345678901_photo.jpg"), "fake-jpeg-bytes", "utf8");
  writeFileSync(join(shared, "资料.txt"), "legacy-file", "utf8");

  createLegacyDb(dbPath, [
    ["旧文本", "hello legacy", "", "text", "2024-01-01T10:00:00.000", "旧标签"],
    ["旧链接", "https://example.com", "", "url", "2024-01-02T10:00:00.000", "链接"],
    [
      "旧图片",
      "/storage/emulated/0/CollectApp/shared_imports/1712345678901_photo.jpg",
      "photo.jpg",
      "image",
      "2024-01-03T10:00:00.000",
      "图片",
    ],
    [
      "旧视频",
      "/storage/emulated/0/CollectApp/shared_imports/missing.mp4",
      "",
      "video",
      "2024-01-04T10:00:00.000",
      "视频",
    ],
    [
      "旧文件",
      "/storage/emulated/0/CollectApp/shared_imports/资料.txt",
      "desc",
      "file",
      "2024-01-05T10:00:00.000",
      "文件",
    ],
  ]);

  return { dbPath, mediaDir, root };
}

let crcTable: Uint32Array | null = null;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[i] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 生成 store-only ZIP（UTF-8 名称），用于验证解压与路径安全 */
function writeZip(
  zipPath: string,
  entries: { name: string; data: Buffer }[],
): void {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(0, 10);
    head.writeUInt16LE(0, 12);
    head.writeUInt16LE(0, 14);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt16LE(0, 30);
    head.writeUInt16LE(0, 32);
    head.writeUInt16LE(0, 34);
    head.writeUInt16LE(0, 36);
    head.writeUInt32LE(0, 38);
    head.writeUInt32LE(offset, 42);
    central.push(head, name);

    offset += local.length + name.length + data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  writeFileSync(zipPath, Buffer.concat([...locals, centralBuffer, end]));
}

async function checkLegacyZipImport(): Promise<void> {
  const root = userDataPath("legacy-zip-fixture");
  mkdirSync(root, { recursive: true });
  try {
    const dbPath = join(root, "collection_items.db");
    createLegacyDb(dbPath, [
      ["ZIP 文本", "zip text", "", "text", "2024-02-01T10:00:00.000", "压缩包"],
      [
        "ZIP 图片",
        "/storage/emulated/0/CollectApp/shared_imports/zip-photo.jpg",
        "",
        "image",
        "2024-02-02T10:00:00.000",
        "压缩包",
      ],
    ]);
    const photo = Buffer.from("zip-photo-bytes", "utf8");
    const zipPath = join(root, "legacy-backup.zip");
    writeZip(zipPath, [
      { name: "backup/collection_items.db", data: readFileSync(dbPath) },
      {
        name: "backup/CollectApp/shared_imports/zip-photo.jpg",
        data: photo,
      },
    ]);

    const inspected = await inspectLegacy({ zipPath });
    assert(inspected.rows === 2, `zip: 期望 2 行，实际 ${inspected.rows}`);
    assert(inspected.matchedMedia === 1, `zip: 期望命中 1 个媒体，实际 ${inspected.matchedMedia}`);

    const report = await runLegacyImport(inspected.sessionId, () => {});
    assert(report.inserted === 2, `zip: 期望新增 2 条，实际 ${report.inserted}`);
    assert(report.mediaCopied === 1, `zip: 期望复制 1 个媒体，实际 ${report.mediaCopied}`);

    // 恶意 ZIP：条目路径越界必须被拒绝
    const evilZip = join(root, "evil.zip");
    writeZip(evilZip, [{ name: "../evil.txt", data: Buffer.from("evil") }]);
    let rejected = false;
    try {
      await inspectLegacy({ zipPath: evilZip });
    } catch {
      rejected = true;
    }
    assert(rejected, "zip: 路径穿越条目未被拒绝");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function checkLegacyImport(): Promise<void> {
  const fixture = makeLegacyFixture();
  try {
    const inspected = await inspectLegacy({
      dbPath: fixture.dbPath,
      mediaDir: fixture.mediaDir,
    });
    assert(inspected.rows === 5, `legacy: 期望 5 行，实际 ${inspected.rows}`);
    assert(inspected.mediaRows === 3, `legacy: 期望 3 条媒体，实际 ${inspected.mediaRows}`);
    assert(inspected.matchedMedia === 2, `legacy: 期望命中 2 个媒体，实际 ${inspected.matchedMedia}`);
    assert(inspected.missingMedia === 1, `legacy: 期望缺失 1 个媒体，实际 ${inspected.missingMedia}`);

    const first = await runLegacyImport(inspected.sessionId, () => {});
    assert(first.inserted === 5, `legacy: 期望新增 5 条，实际 ${first.inserted}`);
    assert(first.mediaCopied === 2, `legacy: 期望复制 2 个媒体，实际 ${first.mediaCopied}`);
    assert(first.mediaMissing === 1, `legacy: 期望缺失 1 个媒体，实际 ${first.mediaMissing}`);

    const driver = getDriver();
    const image = driver.get<{ content: string; media_missing: number }>(
      "SELECT content, media_missing FROM items WHERE legacy_id = 3",
    );
    assert(image?.media_missing === 0, "legacy: 图片条目的 media_missing 应为 0");
    assert(
      Boolean(image && existsSync(toAbsPath(image.content))),
      "legacy: 图片文件未复制到库内",
    );

    const missing = driver.get<{ media_missing: number }>(
      "SELECT media_missing FROM items WHERE legacy_id = 4",
    );
    assert(missing?.media_missing === 1, "legacy: 缺失视频应标记 media_missing=1");

    const secondInspect = await inspectLegacy({
      dbPath: fixture.dbPath,
      mediaDir: fixture.mediaDir,
    });
    assert(secondInspect.existing === 5, `legacy: 二次预检期望 5 条已存在，实际 ${secondInspect.existing}`);
    const second = await runLegacyImport(secondInspect.sessionId, () => {});
    assert(second.inserted === 0, `legacy: 二次导入不应新增，实际 ${second.inserted}`);
    assert(second.skippedExisting === 5, `legacy: 二次导入期望跳过 5 条，实际 ${second.skippedExisting}`);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

async function checkRelocate(): Promise<void> {
  const root = userDataPath("relocate-smoke");
  mkdirSync(root, { recursive: true });
  const replacement = join(root, "replacement.jpg");
  const wrongType = join(root, "wrong.txt");
  writeFileSync(replacement, "replacement-image", "utf8");
  writeFileSync(wrongType, "text", "utf8");

  const item = insertItem(getDriver(), {
    title: "缺失图片",
    content: "media/image/missing-smoke/old.jpg",
    type: "image",
    tag: "smoke",
    mediaMissing: true,
  });

  try {
    let rejected = false;
    try {
      await relocateMediaItem(item.id, wrongType);
    } catch {
      rejected = true;
    }
    assert(rejected, "relocate: 类型不匹配应被拒绝");

    const updated = await relocateMediaItem(item.id, replacement);
    assert(!updated.mediaMissing, "relocate: 修复后仍标记缺失");
    assert(Boolean(updated.mediaUrl), "relocate: 修复后没有媒体 URL");
    assert(
      existsSync(toAbsPath(updated.content)),
      "relocate: 复制后的媒体文件不存在",
    );
    assert(updated.content.startsWith("media/image/"), "relocate: 媒体路径不在库内");
  } finally {
    removeItems(getDriver(), [item.id]);
    rmSync(root, { recursive: true, force: true });
    rmSync(userDataPath("media", "image", item.id), { recursive: true, force: true });
  }
}

async function checkThumbnails(): Promise<void> {
  if (!existsSync(ffmpegPath())) {
    console.log("SMOKE thumbnail skipped: ffmpeg missing");
    return;
  }

  const dir = ensureUserDir("media", "video", "smoke-video");
  const input = join(dir, "sample.mp4");
  try {
    execFileSync(
      ffmpegPath(),
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x240:d=1",
        "-pix_fmt",
        "yuv420p",
        input,
      ],
      { windowsHide: true, stdio: "ignore" },
    );

    const stat = statSync(input);
    const item = insertItem(getDriver(), {
      title: "smoke video",
      content: "media/video/smoke-video/sample.mp4",
      type: "video",
      tag: "smoke",
      sizeBytes: stat.size,
      fileMtime: Math.trunc(stat.mtimeMs),
    });

    const first = await getVideoThumbnail(item.id);
    assert(Boolean(first.relPath), "thumb: 未生成缩略图");
    assert(!first.cached, "thumb: 首次生成不应命中缓存");
    assert(
      Boolean(first.relPath && existsSync(toAbsPath(first.relPath))),
      "thumb: 缩略图文件不存在",
    );

    const second = await getVideoThumbnail(item.id);
    assert(second.cached, "thumb: 第二次应命中缓存");

    removeItems(getDriver(), [item.id]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function runSmokeChecks(): Promise<void> {
  await checkDatabase();
  await checkProtocol();
  await checkLegacyImport();
  await checkLegacyZipImport();
  await checkRelocate();
  await checkThumbnails();
  console.log("SMOKE CHECKS OK db protocol legacy legacy-zip relocate thumb");
}

/** --screenshot 模式：往临时库里放几条示例数据，便于检查真实渲染效果 */
export function seedScreenshotData(): void {
  const driver = getDriver();
  const count = driver.get<{ total: number }>("SELECT COUNT(*) AS total FROM items");
  if (Number(count?.total ?? 0) > 0) return;

  const imageDir = ensureUserDir("media", "image", "shot-image");
  const imageFile = join(imageDir, "sample.png");
  let imageSize = 0;
  try {
    copyFileSync(join(app.getAppPath(), "build", "icon.png"), imageFile);
    imageSize = statSync(imageFile).size;
  } catch {
    // 图标缺失时跳过图片样例，不影响其余检查
  }

  if (imageSize > 0) {
    insertItem(driver, {
      title: "示例图片",
      content: "media/image/shot-image/sample.png",
      description: "",
      type: "image",
      tag: "灵感",
      sizeBytes: imageSize,
      fileMtime: Date.now(),
    });
  }

  insertItem(driver, {
    title: "今天读到的句子",
    content: "把复杂留给自己，把简单留给用户。",
    description: "把复杂留给自己，把简单留给用户。",
    type: "text",
    tag: "摘录",
  });

  insertItem(driver, {
    title: "example.com",
    content: "https://example.com/",
    description: "",
    type: "url",
    tag: "稍后读",
  });

  insertItem(driver, {
    title: "项目资料",
    content: "media/file/shot-file/资料.zip",
    description: "",
    type: "file",
    tag: "未分类",
    mediaMissing: true,
  });
}
