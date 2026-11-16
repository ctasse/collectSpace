import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 桌面端只支持 Windows；Android CI / 非 Windows 机器不需要 Electron 与
// better-sqlite3 的 Windows 二进制，直接跳过，避免下载无关产物。
if (process.platform !== "win32") {
  console.log(`[native] 非 Windows 平台（${process.platform}），跳过桌面原生依赖准备`);
  process.exit(0);
}

if (process.env.COLLECT_SKIP_NATIVE === "1") {
  console.log("[native] COLLECT_SKIP_NATIVE=1，跳过桌面原生依赖准备");
  process.exit(0);
}

const electronDir = dirname(require.resolve("electron/package.json"));

/**
 * 不直接 require("electron")：依赖安装阶段 Electron 的 path.txt 可能还不存在，
 * 这种情况下 electron/index.js 会直接抛错，导致 pnpm install 失败。
 */
function electronBinary() {
  const pathFile = join(electronDir, "path.txt");
  if (!existsSync(pathFile)) return null;
  const relative = readFileSync(pathFile, "utf8").trim();
  if (!relative) return null;
  const binary = join(electronDir, "dist", relative);
  return existsSync(binary) ? binary : null;
}

function ensureElectron() {
  if (electronBinary()) return;

  console.log("[native] 下载 Electron 二进制…");
  const installer = join(electronDir, "install.js");
  const env = {
    ...process.env,
    ELECTRON_MIRROR:
      process.env.ELECTRON_MIRROR ?? "https://npmmirror.com/mirrors/electron/",
  };
  // 调用 install.js 时必须允许下载，否则会留下没有二进制的半成品。
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  execFileSync(process.execPath, [installer], { stdio: "inherit", env });

  if (!electronBinary()) {
    throw new Error("Electron 二进制安装失败：请检查网络或 ELECTRON_MIRROR");
  }
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
