import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainEntry = join(appRoot, "out", "main", "index.js");

if (!existsSync(mainEntry)) {
  console.error("未找到 out/main/index.js，请先运行 pnpm build");
  process.exit(1);
}

const electron = require("electron");
const args = [appRoot, "--smoke", ...process.argv.slice(2)];
const child = spawn(electron, args, {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1",
    // 冒烟测试的库/媒体/缩略图都放项目内，不写 C 盘临时目录
    COLLECT_RUNTIME_DIR: join(appRoot, ".tmp"),
  },
});

const timer = setTimeout(() => {
  console.error("smoke 超时（60s）");
  child.kill();
  process.exit(1);
}, 60_000);

child.on("exit", (code) => {
  clearTimeout(timer);
  process.exit(code ?? 1);
});
