/**
 * 自定义特权协议 collect-media://。
 *
 * 生产模式下渲染层是 file:// 加载的，不能直接读取 userData 里的媒体文件；
 * 图片/视频/缩略图统一走这个协议，视频拖进度条依赖 Range/206。
 *
 * URL 形如 collect-media:///media/image/<uuid>/<name>。
 * Chromium 会把 `///media/...` 规范化为 host=media + pathname=/...，
 * 所以取文件时必须把 host 与 pathname 拼回来。
 */
import { protocol } from "electron";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { extname, resolve, sep } from "node:path";

export const MEDIA_SCHEME = "collect-media";

let mediaRoot = "";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function mimeOf(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}

/** app ready 之前调用 */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** 返回本地文件，支持单段 Range（视频 seek 必需） */
function serveFile(absPath: string, req: Request): Response | null {
  let size: number;
  try {
    const st = statSync(absPath);
    if (!st.isFile()) return null;
    size = st.size;
  } catch {
    return null;
  }

  const headers: Record<string, string> = {
    "content-type": mimeOf(absPath),
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
    "access-control-allow-origin": "*",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (!m[1] && m[2]) {
        // bytes=-N：最后 N 字节
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
      }
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
        end = Math.min(end, size - 1);
        const body = Readable.toWeb(
          createReadStream(absPath, { start, end }),
        ) as unknown as ReadableStream<Uint8Array>;
        return new Response(body, {
          status: 206,
          headers: {
            ...headers,
            "content-range": `bytes ${start}-${end}/${size}`,
            "content-length": String(end - start + 1),
          },
        });
      }
      return new Response(null, {
        status: 416,
        headers: { ...headers, "content-range": `bytes */${size}` },
      });
    }
  }

  const body = Readable.toWeb(createReadStream(absPath)) as unknown as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: 200,
    headers: { ...headers, "content-length": String(size) },
  });
}

/** URL → 相对 mediaRoot 的路径；host 必须拼回去 */
function relFromUrl(url: URL): string {
  const joined = `${url.hostname}${url.pathname}`;
  return joined.replace(/^\/+/, "");
}

/** 防目录穿越：目标必须落在 root 之内 */
function safeJoin(root: string, rel: string): string | null {
  if (!root) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = resolve(root);
  const abs = resolve(base, decoded.replace(/^[/\\]+/, ""));
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  return abs;
}

/** app ready 之后调用 */
export function registerProtocolHandlers(opts: { mediaRoot: string }): void {
  mediaRoot = opts.mediaRoot;

  protocol.handle(MEDIA_SCHEME, (req) => {
    const abs = safeJoin(mediaRoot, relFromUrl(new URL(req.url)));
    if (!abs) return textResponse("forbidden", 403);
    return serveFile(abs, req) ?? textResponse("not found", 404);
  });
}

/**
 * 拼接媒体 URL。相对路径一律以 media/ 或 thumbnails/ 开头，
 * 因此 URL 首段（会被规范化成 host）永远是合法 hostname。
 */
export function mediaUrl(relPath: string): string {
  const segments = relPath.split(/[\\/]+/).filter(Boolean);
  return `${MEDIA_SCHEME}:///${segments.map(encodeURIComponent).join("/")}`;
}
