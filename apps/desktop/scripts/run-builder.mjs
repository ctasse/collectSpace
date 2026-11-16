/**
 * electron-builder 包装：把二进制缓存固定在项目内（默认 D 盘），
 * 避免下载的 NSIS / winCodeSign 等中间产物留在 C 盘用户目录。
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "../..");
const cacheDir = join(repoRoot, ".cache", "electron-builder");
mkdirSync(cacheDir, { recursive: true });

const cli = require.resolve("electron-builder/cli.js");
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_BUILDER_CACHE: cacheDir,
    CSC_IDENTITY_AUTO_DISCOVERY:
      process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? "false",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
