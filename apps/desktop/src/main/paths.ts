/**
 * userData 下的目录约定。
 * 数据库里存的是「相对 userData 的正斜杠路径」，便于跨平台比对与后续导出。
 */
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

/** 库内媒体根：media/<type>/<uuid>/<name> */
export const MEDIA_DIR = "media";
/** 视频缩略图缓存 */
export const THUMBNAILS_DIR = "thumbnails";
/** 旧数据导入解压临时目录 */
export const IMPORT_TMP_DIR = "import-tmp";
/** 导入日志 */
export const LOGS_DIR = "logs";

export function userDataPath(...segments: string[]): string {
  return join(app.getPath("userData"), ...segments);
}

/** 确保目录存在并返回绝对路径 */
export function ensureUserDir(...segments: string[]): string {
  const dir = userDataPath(...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 绝对路径 → 相对 userData 的正斜杠路径（入库存 DB） */
export function toRelPath(absPath: string): string {
  return relative(app.getPath("userData"), absPath).split("\\").join("/");
}

/** 相对 userData 的路径 → 绝对路径；传入绝对路径时原样返回 */
export function toAbsPath(relPath: string): string {
  if (isAbsolute(relPath)) return relPath;
  return join(app.getPath("userData"), ...relPath.split("/"));
}

/** 开发态取 apps/desktop/resources，打包后取 resources/resources（见 electron-builder.yml） */
export function ffmpegPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "ffmpeg", "ffmpeg.exe")
    : join(app.getAppPath(), "resources", "ffmpeg", "ffmpeg.exe");
}
