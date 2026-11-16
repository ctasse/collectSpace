const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  middot: "·",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1]?.toLowerCase() === "x";
      const digits = isHex ? body.slice(2) : body.slice(1);
      const code = Number.parseInt(digits, isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** 从 HTML 中提取 <title>（旧版 UrlTitleService 的等价实现） */
export function parseTitleFromHtml(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match?.[1]) return null;

  const title = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (!title) return null;
  return title.length > 300 ? title.slice(0, 300) : title;
}

/** 根据响应头 / HTML 头部推断字符集（GBK 页面常见） */
export function inferCharset(contentType: string | null | undefined, head: string): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "");
  if (fromHeader?.[1]) return fromHeader[1].toLowerCase();

  const metaCharset = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head);
  if (metaCharset?.[1]) return metaCharset[1].toLowerCase();

  const httpEquiv = /content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i.exec(head);
  if (httpEquiv?.[1]) return httpEquiv[1].toLowerCase();

  return "utf-8";
}

/** 补全协议并校验；仅允许 http/https */
export function normalizeUrlInput(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
