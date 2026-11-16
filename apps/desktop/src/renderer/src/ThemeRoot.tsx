import { useEffect, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { palette } from "@collect/ui-tokens";
import { buildTheme } from "./theme";
import { useSettingsStore } from "./stores/settings";

/** 跟随系统深浅色 + Windows 强调色；设置变化即时生效。 */
export function ThemeRoot({ children }: { children: ReactNode }): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const load = useSettingsStore((state) => state.load);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [systemAccent, setSystemAccent] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    const refreshAccent = (): void => {
      window.api.system
        .getAccentColor()
        .then((accent) => {
          if (alive) setSystemAccent(accent);
        })
        .catch(() => {
          // 取不到系统强调色时用种子色
        });
    };

    refreshAccent();
    window.addEventListener("focus", refreshAccent);
    return () => {
      alive = false;
      window.removeEventListener("focus", refreshAccent);
    };
  }, []);

  const mode =
    settings.themeMode === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : settings.themeMode;
  const accent =
    settings.accentMode === "custom"
      ? settings.customAccent
      : (systemAccent ?? palette.accentFallback);

  return (
    <ThemeProvider theme={buildTheme(mode, accent)}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
