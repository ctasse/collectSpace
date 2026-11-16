import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  hostOf,
  inferCharset,
  normalizeUrlInput,
  parseTitleFromHtml,
} from "../url-title.js";

describe("parseTitleFromHtml", () => {
  it("extracts and normalizes Chinese titles", () => {
    const html =
      "<html><head><title>\n  收藏 &amp; 分享  \n</title></head></html>";
    expect(parseTitleFromHtml(html)).toBe("收藏 & 分享");
  });

  it("decodes numeric entities and strips nested tags", () => {
    expect(parseTitleFromHtml("<title>A&#33; <b>B</b></title>")).toBe("A! B");
  });

  it("returns null when missing or empty", () => {
    expect(parseTitleFromHtml("<html></html>")).toBeNull();
    expect(parseTitleFromHtml("<title>   </title>")).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("handles named, decimal and hex entities", () => {
    expect(decodeHtmlEntities("&lt;a&gt; &quot;b&quot; &#39;c&#39; &#x4E2D;")).toBe(
      "<a> \"b\" 'c' 中",
    );
  });
});

describe("inferCharset", () => {
  it("prefers the response header", () => {
    expect(inferCharset("text/html; charset=GBK", '<meta charset="utf-8">')).toBe(
      "gbk",
    );
  });

  it("falls back to meta tags", () => {
    expect(inferCharset(null, '<meta http-equiv="Content-Type" content="text/html; charset=gb2312">')).toBe(
      "gb2312",
    );
    expect(inferCharset(null, "<html></html>")).toBe("utf-8");
  });
});

describe("normalizeUrlInput", () => {
  it("adds https and validates schemes", () => {
    expect(normalizeUrlInput("example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrlInput("http://example.com/a")).toBe("http://example.com/a");
    expect(normalizeUrlInput("javascript:alert(1)")).toBeNull();
    expect(normalizeUrlInput("   ")).toBeNull();
  });

  it("extracts hosts", () => {
    expect(hostOf("https://example.com/a/b")).toBe("example.com");
    expect(hostOf("not a url")).toBe("not a url");
  });
});
