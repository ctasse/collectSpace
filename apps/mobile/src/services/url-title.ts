/** 链接标题抓取：仅 http(s)、10s 超时、≤512KB、仅 HTML。 */
import {
  hostOf,
  inferCharset,
  normalizeUrlInput,
  parseTitleFromHtml,
} from "@collect/core";

const MAX_BYTES = 512 * 1024;

export async function fetchUrlTitle(
  rawUrl: string,
): Promise<{ url: string; title: string }> {
  const url = normalizeUrlInput(rawUrl);
  if (!url) throw new Error("链接格式不正确（仅支持 http/https）");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) throw new Error(`网页返回 ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      throw new Error("目标不是网页");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("网页内容过大，无法读取标题");
    }

    const charset = inferCharset(
      contentType,
      new TextDecoder().decode(buffer.slice(0, 4096)),
    );
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buffer);
    } catch {
      html = new TextDecoder().decode(buffer);
    }

    return {
      url,
      title: parseTitleFromHtml(html) ?? hostOf(url),
    };
  } finally {
    clearTimeout(timer);
  }
}
