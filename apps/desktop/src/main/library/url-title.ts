/**
 * 抓取网页标题（走 Electron net，自动使用系统代理）。
 * 限制：仅 http/https、拒绝本机/内网地址、10s 超时、最多 512KB、仅 HTML。
 */
import { net } from "electron";
import {
  hostOf,
  inferCharset,
  normalizeUrlInput,
  parseTitleFromHtml,
} from "@collect/core";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 512 * 1024;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export interface FetchTitleResult {
  url: string;
  title: string;
}

export async function fetchUrlTitle(rawUrl: string): Promise<FetchTitleResult> {
  const url = normalizeUrlInput(rawUrl);
  if (!url) throw new Error("链接格式不正确（仅支持 http/https）");

  const parsed = new URL(url);
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("不支持抓取本机或内网地址");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await net.fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) throw new Error(`页面返回 ${response.status}`);

    // 重定向后的最终地址也要校验，防止跳到内网
    const finalUrl = response.url || url;
    if (isPrivateHost(new URL(finalUrl).hostname)) {
      throw new Error("链接跳转到了本机或内网地址，已停止");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error("该链接不是网页，无法获取标题");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("页面内容为空");

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const head = buffer.subarray(0, 4096).toString("latin1");
    const charset = inferCharset(contentType, head);

    let html: string;
    try {
      html = new TextDecoder(charset).decode(buffer);
    } catch {
      html = new TextDecoder("utf-8").decode(buffer);
    }

    return { url, title: parseTitleFromHtml(html) ?? hostOf(url) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("获取网页标题超时");
    }
    if (error instanceof Error) throw error;
    throw new Error("获取网页标题失败");
  } finally {
    clearTimeout(timer);
  }
}
