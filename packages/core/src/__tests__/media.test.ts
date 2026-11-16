import { describe, expect, it } from "vitest";
import {
  extensionToType,
  mediaRelPath,
  sanitizeFileName,
  stripTimestampPrefix,
  uniqueFileName,
} from "../media.js";

describe("extensionToType", () => {
  it("maps images and videos like the Flutter app", () => {
    expect(extensionToType("a.JPG")).toBe("image");
    expect(extensionToType("a.webp")).toBe("image");
    expect(extensionToType("a.MP4")).toBe("video");
    expect(extensionToType("a.mkv")).toBe("video");
    expect(extensionToType("a.pdf")).toBe("file");
    expect(extensionToType("no-ext")).toBe("file");
  });
});

describe("sanitizeFileName", () => {
  it("replaces invalid characters and trims trailing dots/spaces", () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j.png')).toBe(
      "a_b_c_d_e_f_g_h_i_j.png",
    );
    expect(sanitizeFileName("name.   ")).toBe("name");
  });

  it("avoids Windows reserved names but keeps the extension", () => {
    expect(sanitizeFileName("CON.txt")).toBe("_CON.txt");
    expect(sanitizeFileName("nul")).toBe("_nul");
  });

  it("keeps the extension when truncating long names", () => {
    const long = `${"a".repeat(300)}.mp4`;
    const result = sanitizeFileName(long);
    expect(result.endsWith(".mp4")).toBe(true);
    expect(result.length).toBe(120);
  });

  it("falls back for empty names", () => {
    expect(sanitizeFileName("   ", "file")).toBe("file");
  });
});

describe("paths", () => {
  it("strips the Kotlin timestamp prefix", () => {
    expect(stripTimestampPrefix("1712345678901_photo.jpg")).toBe("photo.jpg");
    expect(stripTimestampPrefix("photo.jpg")).toBe("photo.jpg");
  });

  it("builds a relative media path", () => {
    expect(mediaRelPath("image", "uuid-1", "照片 1.png")).toBe(
      "media/image/uuid-1/照片 1.png",
    );
  });

  it("dedupes file names", () => {
    expect(uniqueFileName("a.png", [])).toBe("a.png");
    expect(uniqueFileName("a.png", ["a.png"])).toBe("a_1.png");
    expect(uniqueFileName("a.png", ["a.png", "a_1.png"])).toBe("a_2.png");
  });
});
