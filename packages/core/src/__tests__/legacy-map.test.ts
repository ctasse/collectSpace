import { describe, expect, it } from "vitest";
import {
  legacyKey,
  mapLegacyRow,
  normalizeLegacyType,
} from "../legacy-map.js";

describe("normalizeLegacyType", () => {
  it("keeps known types and falls back to text", () => {
    expect(normalizeLegacyType("image")).toBe("image");
    expect(normalizeLegacyType("url")).toBe("url");
    expect(normalizeLegacyType("bogus")).toBe("text");
    expect(normalizeLegacyType(undefined)).toBe("text");
  });
});

describe("mapLegacyRow", () => {
  it("maps a file row with defaults", () => {
    const mapped = mapLegacyRow(
      {
        id: 7,
        title: "",
        content: "/storage/emulated/0/CollectApp/shared_imports/a.jpg",
        type: "image",
        createTime: "2025-04-01T10:00:00.000",
      },
      1_000,
    );
    expect(mapped.title).toBe("a.jpg");
    expect(mapped.type).toBe("image");
    expect(mapped.tag).toBe("未分类");
    expect(mapped.description).toBe("");
    expect(mapped.createdAt).toBe(Date.parse("2025-04-01T10:00:00.000"));
  });

  it("falls back to now for invalid dates and supports source-as-tag", () => {
    const mapped = mapLegacyRow(
      {
        id: 2,
        title: "",
        content: "hello",
        type: "text",
        createTime: "not-a-date",
        source: "旧标签",
      },
      12_345,
    );
    expect(mapped.createdAt).toBe(12_345);
    expect(mapped.tag).toBe("旧标签");
    expect(mapped.title).toBe("文本收藏");
  });

  it("builds a stable legacy key", () => {
    const row = { id: 1, title: "t", content: "c", createTime: "2025" };
    expect(legacyKey(row)).toBe(legacyKey({ ...row }));
    expect(legacyKey(row)).not.toBe(legacyKey({ ...row, content: "c2" }));
  });
});
