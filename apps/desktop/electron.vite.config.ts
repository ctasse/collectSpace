import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    // @collect/core 是 ESM 纯 TS 包，打进 CJS main；better-sqlite3 等原生依赖保持外部化
    plugins: [externalizeDepsPlugin({ exclude: ["@collect/core", "@collect/ui-tokens"] })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { "@": resolve(__dirname, "src/renderer/src") },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
      },
    },
  },
});
