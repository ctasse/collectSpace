import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyFfmpeg() {
  try {
    const ffmpeg = require("@ffmpeg-installer/ffmpeg");
    const destDir = join(appRoot, "resources", "ffmpeg");
    mkdirSync(destDir, { recursive: true });
    const binary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const dest = join(destDir, binary);
    if (!existsSync(dest)) {
      copyFileSync(ffmpeg.path, dest);
    }
    console.log(`[assets] ffmpeg -> ${dest}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[assets] ffmpeg 不可用，视频缩略图将降级：${message}`);
  }
}

copyFfmpeg();
