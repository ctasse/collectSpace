import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
} from "../settings.js";

describe("normalizeSettings", () => {
  it("returns defaults for junk", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ themeMode: "neon" })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and drops unknown fields", () => {
    const result = normalizeSettings({
      themeMode: "dark",
      accentMode: "custom",
      customAccent: "#aabbcc",
      gridColumns: 3,
      closeToTray: true,
      deleteToTrash: false,
      notifications: { importDone: false, errors: true },
      unknown: 1,
    });
    expect(result).toEqual({
      themeMode: "dark",
      accentMode: "custom",
      customAccent: "#AABBCC",
      gridColumns: 3,
      closeToTray: true,
      deleteToTrash: false,
      notifications: { importDone: false, errors: true },
    });
    expect("unknown" in result).toBe(false);
  });

  it("rejects invalid accents and grid columns", () => {
    const result = normalizeSettings({
      customAccent: "red",
      gridColumns: 9,
    });
    expect(result.customAccent).toBe(DEFAULT_SETTINGS.customAccent);
    expect(result.gridColumns).toBe(0);
  });

  it("merges patches without resetting other fields", () => {
    const merged = mergeSettings(
      { ...DEFAULT_SETTINGS, themeMode: "dark" },
      { gridColumns: 2 },
    );
    expect(merged.themeMode).toBe("dark");
    expect(merged.gridColumns).toBe(2);
  });
});
