import { useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";
import { palette, radius } from "@collect/ui-tokens";
import { useSettingsStore } from "./stores/settings";

/** 系统/设置 → Paper MD3 主题；Android 12+ 跟系统动态色，否则用种子色。 */
export function useAppTheme(): { theme: MD3Theme; dark: boolean } {
  const settings = useSettingsStore((state) => state.settings);
  const systemScheme = useColorScheme();
  const dark =
    settings.themeMode === "system"
      ? systemScheme === "dark"
      : settings.themeMode === "dark";

  const { theme } = useMaterial3Theme({
    fallbackSourceColor: palette.accentFallback,
    sourceColor:
      settings.accentMode === "custom" ? settings.customAccent : undefined,
  });

  return useMemo(() => {
    const base = dark ? MD3DarkTheme : MD3LightTheme;
    const colors = theme[dark ? "dark" : "light"];
    return {
      dark,
      theme: {
        ...base,
        roundness: radius.card / 4,
        colors: { ...base.colors, ...colors },
      },
    };
  }, [dark, theme]);
}
