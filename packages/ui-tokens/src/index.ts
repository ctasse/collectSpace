/** 桌面 MUI 与移动 Paper 共用的基础 token */
export const palette = {
  /** 无法读取系统强调色时的种子色（Material 3 baseline） */
  accentFallback: "#6750A4",
  /** 旧 Flutter 自适应图标背景色 */
  iconBackground: "#F9F4DC",
} as const;

export const radius = {
  chip: 8,
  card: 16,
  dialog: 20,
  field: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  fontFamily: '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
  monoFamily: '"Cascadia Mono", Consolas, monospace',
} as const;

export const layout = {
  drawerWidth: 240,
  windowWidth: 1200,
  windowHeight: 820,
  gridMinCardWidth: 220,
} as const;
