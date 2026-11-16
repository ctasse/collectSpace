import { createTheme, type Theme } from "@mui/material/styles";
import { palette, radius, typography } from "@collect/ui-tokens";

export function buildTheme(
  mode: "light" | "dark",
  accent: string = palette.accentFallback,
): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: accent },
      background:
        mode === "dark"
          ? { default: "#121212", paper: "#1c1b1f" }
          : { default: "#fdfbff", paper: "#ffffff" },
    },
    shape: { borderRadius: radius.field },
    typography: {
      fontFamily: typography.fontFamily,
      button: { textTransform: "none" },
    },
    components: {
      MuiCard: {
        styleOverrides: { root: { borderRadius: radius.card, boxShadow: "none" } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: radius.dialog } },
      },
    },
  });
}
