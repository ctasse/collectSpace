import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function ensureElectron() {
  const electronPath = require("electron");
  if (typeof electronPath === "string" && existsSync(electronPath)) return;

  console.log("[native] 下载 Electron 二进制…");
  const installer = require.resolve("electron/install.js");
  execFileSync(process.execPath, [installer], {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_MIRROR:
        process.env.ELECTRON_MIRROR ??
        "https://npmmirror.com/mirrors/electron/",
    },
  });
}

function ensureBetterSqlite3() {
  const electronVersion = require("electron/package.json").version;
  const bs3Dir = dirname(require.resolve("better-sqlite3/package.json"));
  const binary = join(bs3Dir, "build", "Release", "better_sqlite3.node");

  if (existsSync(binary)) return;

  console.log(
    `[native] 安装 better-sqlite3 的 Electron 预编译包（electron ${electronVersion}）…`,
  );
  const prebuildBin = require.resolve("prebuild-install/bin.js");
  execFileSync(
    process.execPath,
    [
      prebuildBin,
      "--runtime=electron",
      `--target=${electronVersion}`,
      `--platform=${process.platform}`,
      `--arch=${process.arch}`,
      "--verbose",
    ],
    { cwd: bs3Dir, stdio: "inherit" },
  );

  if (!existsSync(binary)) {
    throw new Error(
      "better-sqlite3 预编译二进制安装失败：请检查网络，或安装 Visual Studio C++ 工具链后运行 electron-rebuild",
    );
  }
}

ensureElectron();
ensureBetterSqlite3();
console.log(`[native] 就绪（${appRoot}）`);
