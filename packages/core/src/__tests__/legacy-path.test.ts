import { describe, expect, it } from "vitest";
import {
  compareMediaCandidates,
  legacyPathKeys,
  mediaMatchRank,
  normalizeLegacyPath,
  stripLegacyRoot,
} from "../legacy-path.js";

describe("legacy path normalization", () => {
  it("normalizes separators and file:// prefixes", () => {
    expect(normalizeLegacyPath("file:///sdcard//a\\\\b.jpg")).toBe(
      "/sdcard/a/b.jpg",
    );
    expect(normalizeLegacyPath("/storage/emulated/0/CollectApp/x%20y.jpg")).toBe(
      "/storage/emulated/0/CollectApp/x y.jpg",
    );
  });

  it("strips known Android roots", () => {
    expect(
      stripLegacyRoot(
        "/storage/emulated/0/CollectApp/shared_imports/1712345678901_a.jpg",
      ),
    ).toBe("shared_imports/1712345678901_a.jpg");
    expect(
      stripLegacyRoot("/storage/emulated/0/collection/shared_imports/a.jpg"),
    ).toBe("shared_imports/a.jpg");
    expect(stripLegacyRoot("/data/user/0/com.example.collect/files/a.jpg")).toBe(
      "a.jpg",
    );
    expect(stripLegacyRoot("/sdcard/Download/a.jpg")).toBe("Download/a.jpg");
  });

  it("builds match keys with timestamp-free variants", () => {
    const keys = legacyPathKeys(
      "/storage/emulated/0/CollectApp/shared_imports/1712345678901_photo.JPG",
    );
    expect(keys.rel).toBe("shared_imports/1712345678901_photo.JPG");
    expect(keys.base).toBe("1712345678901_photo.JPG");
    expect(keys.baseNoTs).toBe("photo.JPG");
    expect(keys.relNoTs).toBe("shared_imports/photo.JPG");
  });
});

describe("mediaMatchRank", () => {
  const keys = legacyPathKeys(
    "/storage/emulated/0/CollectApp/shared_imports/1712345678901_photo.jpg",
  );

  it("ranks exact, suffix, basename and timestamp-free matches", () => {
    expect(mediaMatchRank(keys, "shared_imports/1712345678901_photo.jpg")).toBe(0);
    expect(mediaMatchRank(keys, "CollectApp/shared_imports/1712345678901_photo.jpg")).toBe(1);
    expect(mediaMatchRank(keys, "other/1712345678901_photo.jpg")).toBe(2);
    expect(mediaMatchRank(keys, "other/shared_imports/photo.jpg")).toBe(3);
    expect(mediaMatchRank(keys, "other/photo.jpg")).toBe(4);
    expect(mediaMatchRank(keys, "unrelated.jpg")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(mediaMatchRank(keys, "SHARED_IMPORTS/1712345678901_PHOTO.JPG")).toBe(0);
  });
});

describe("compareMediaCandidates", () => {
  it("prefers better rank, then shared_imports, then shallower paths", () => {
    const sorted = [
      { relPath: "z/deep/path/a.jpg", rank: 1 },
      { relPath: "shared_imports/a.jpg", rank: 1 },
      { relPath: "a.jpg", rank: 3 },
    ].sort(compareMediaCandidates);
    expect(sorted[0]?.relPath).toBe("shared_imports/a.jpg");
    expect(sorted[1]?.relPath).toBe("z/deep/path/a.jpg");
    expect(sorted[2]?.relPath).toBe("a.jpg");
  });
});
