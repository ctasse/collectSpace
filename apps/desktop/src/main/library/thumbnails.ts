/**
 * 视频缩略图：ffmpeg 抽帧 → thumbnails/video/<sha1(relPath|size|mtime)>.jpg
 * 并发 2，单任务 20s 超时；ffmpeg 缺失时优雅返回 null。
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import { getDriver } from "../db";
import { getItem } from "../db/items-repo";
import { ensureUserDir, ffmpegPath, toAbsPath } from "../paths";

const MAX_CONCURRENT = 2;
const TIMEOUT_MS = 20_000;

let active = 0;
const queue: (() => void)[] = [];

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = (): void => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("ffmpeg 生成缩略图超时"));
    }, TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg 退出码 ${code ?? "?"}`));
    });
  });
}

async function generate(input: string, output: string): Promise<void> {
  const tmp = `${output}.tmp.jpg`;
  const base = [
    "-frames:v",
    "1",
    "-vf",
    "scale=512:-2",
    "-q:v",
    "3",
    tmp,
  ];

  try {
    try {
      await runFfmpeg(["-y", "-ss", "1", "-i", input, ...base]);
    } catch {
      rmSync(tmp, { force: true });
    }

    // 视频短于 1 秒时 ffmpeg 可能正常退出但没写出帧，回退到第一帧
    if (!existsSync(tmp)) {
      await runFfmpeg(["-y", "-ss", "0", "-i", input, ...base]);
    }
    if (!existsSync(tmp)) {
      throw new Error("ffmpeg 未生成缩略图");
    }
    renameSync(tmp, output);
  } finally {
    rmSync(tmp, { force: true });
  }
}

export interface ThumbnailResult {
  relPath: string | null;
  cached: boolean;
}

export async function getVideoThumbnail(itemId: string): Promise<ThumbnailResult> {
  const item = getItem(getDriver(), itemId);
  if (!item || item.type !== "video" || item.mediaMissing) {
    return { relPath: null, cached: false };
  }

  const input = toAbsPath(item.content);
  if (!existsSync(input)) return { relPath: null, cached: false };
  if (!existsSync(ffmpegPath())) return { relPath: null, cached: false };

  let size = item.sizeBytes;
  let mtime = item.fileMtime;
  if (size === null || mtime === null) {
    const stat = statSync(input);
    size = stat.size;
    mtime = Math.trunc(stat.mtimeMs);
  }

  const key = createHash("sha1")
    .update(`${item.content}|${size}|${mtime}`, "utf8")
    .digest("hex");
  const relPath = `thumbnails/video/${key}.jpg`;
  const output = toAbsPath(relPath);

  if (existsSync(output)) return { relPath, cached: true };

  await enqueue(async () => {
    if (existsSync(output)) return;
    ensureUserDir("thumbnails", "video");
    await generate(input, output);
  });

  return existsSync(output)
    ? { relPath, cached: false }
    : { relPath: null, cached: false };
}
