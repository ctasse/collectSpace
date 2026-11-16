import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeDatabase, getDriver, initDatabase } from "./db";
import { readSettings } from "./db/settings-repo";
import { registerIpc } from "./ipc";
import { disposeLegacySessions } from "./library/legacy-import";
import { installApplicationMenu } from "./menu";
import { registerPrivilegedSchemes, registerProtocolHandlers } from "./protocols";
import { runSmokeChecks, seedScreenshotData } from "./smoke";

const isSmoke = process.argv.includes("--smoke");
const shotArg = process.argv.find((arg) => arg.startsWith("--screenshot="));
const screenshotPath = shotArg ? shotArg.slice("--screenshot=".length) : "";
const isScreenshot = Boolean(screenshotPath);

// 自定义 scheme 必须在 app ready 之前注册
registerPrivilegedSchemes();

app.setName("CollectSpace");
app.setAppUserModelId("com.ctasse.collectspace");

if (isSmoke || isScreenshot) {
  // 自检/截图使用独立临时目录，避免写入真实收藏数据；
  // COLLECT_RUNTIME_DIR 可把中间产物固定到项目盘（默认不留在 C 盘）。
  const tempRoot = process.env.COLLECT_RUNTIME_DIR
    ? join(process.env.COLLECT_RUNTIME_DIR, "runtime")
    : app.getPath("temp");
  const tempDir = join(
    tempRoot,
    isSmoke ? "collectspace-smoke" : "collectspace-shot",
  );
  rmSync(tempDir, { recursive: true, force: true });
  app.setPath("userData", tempDir);
}

let mainWindow: BrowserWindow | null = null;
let pendingOpenPaths: string[] = [];

/** 从 argv 中挑出真实存在的文件（排除 exe、应用目录、命令行开关） */
function filePathsFromArgv(argv: string[]): string[] {
  const appPath = app.getAppPath();
  return argv.filter((arg) => {
    if (!arg || arg.startsWith("-") || arg === ".") return false;
    if (arg === process.execPath || arg === appPath) return false;
    try {
      return existsSync(arg) && statSync(arg).isFile();
    } catch {
      return false;
    }
  });
}

function sendOpenPaths(paths: string[]): void {
  if (paths.length === 0) return;
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("app:openPaths", paths);
  } else {
    pendingOpenPaths.push(...paths);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#121212",
    title: "CollectSpace",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 只允许 http(s) 外链在新窗口里走系统浏览器，其余一律拒绝
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl && target.origin === new URL(devUrl).origin) return;
    if (target.protocol === "file:") return;
    event.preventDefault();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingOpenPaths.length > 0) {
      const paths = pendingOpenPaths;
      pendingOpenPaths = [];
      mainWindow?.webContents.send("app:openPaths", paths);
    }
  });

  if (isScreenshot) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        void (async () => {
          try {
            const win = mainWindow;
            if (!win) throw new Error("窗口已关闭");
            const image = await win.webContents.capturePage();
            writeFileSync(screenshotPath, image.toPNG());
            console.log(`SCREENSHOT OK ${screenshotPath}`);
            app.exit(0);
          } catch (error) {
            console.error("SCREENSHOT FAILED", error);
            app.exit(1);
          }
        })();
      }, 1800);
    });
  }

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function focusMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (!isSmoke && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    focusMainWindow();
    sendOpenPaths(filePathsFromArgv(argv));
  });

  app.whenReady().then(async () => {
    initDatabase();
    nativeTheme.themeSource = readSettings(getDriver()).themeMode;
    registerProtocolHandlers({ mediaRoot: app.getPath("userData") });
    registerIpc();
    installApplicationMenu();

    if (isSmoke) {
      try {
        await runSmokeChecks();
        console.log(
          `SMOKE OK name=${app.getName()} userData=${app.getPath("userData")}`,
        );
        app.exit(0);
      } catch (error) {
        console.error("SMOKE FAILED", error);
        app.exit(1);
      }
      return;
    }

    if (isScreenshot) seedScreenshotData();
    pendingOpenPaths.push(...filePathsFromArgv(process.argv));
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    disposeLegacySessions();
    closeDatabase();
  });
}
