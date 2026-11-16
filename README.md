# CollectSpace

一个用于收藏文本、链接、图片、视频与文件的跨端应用。

- **桌面端**：Electron + React + TypeScript（Windows 优先）
- **移动端**：Expo (React Native) + TypeScript（Android 优先）
- **共享层**：`@collect/core` 提供 SQLite schema/迁移、领域类型与纯逻辑

Flutter 旧版完整保留在 `legacy/flutter` 分支与 `flutter-final` tag。

## 目录

```text
apps/desktop        Electron 桌面端
apps/mobile         Expo 移动端
packages/core       双端共享的数据层与纯逻辑
packages/ui-tokens  共享设计 token
```

## 开发

要求 Node >= 20、pnpm 9（通过 corepack 固定）。

```bash
pnpm install
pnpm dev:desktop     # 桌面端（Electron + Vite）
pnpm dev:mobile      # 移动端（Expo Metro）
pnpm typecheck
pnpm test
```

桌面自检与打包（Windows）：

```bash
pnpm --filter @collect/desktop smoke   # 数据库/协议/旧数据导入/缩略图/重新定位
pnpm --filter @collect/desktop dist    # NSIS 安装包 + portable
```

移动端 Android 构建（需要 Android SDK 与 JDK 17）：

```bash
pnpm --filter @collect/mobile prebuild
pnpm android                                   # 生成/运行 Android dev build
pnpm --filter @collect/mobile export:android   # 只验证 JS bundle（先 pnpm typecheck）
```

> 依赖与构建缓存均落在项目盘：pnpm store 为 `.pnpm-store/`，
> electron-builder 二进制缓存为 `.cache/electron-builder/`。
> 冒烟/截图使用 `apps/desktop/.tmp/`，不会写入用户目录。

## 从旧版 Flutter 应用导入（仅桌面）

旧版数据由 Android 私有目录中的 `collection_items.db` 与公共目录
`/storage/emulated/0/CollectApp/` 下的媒体文件组成。桌面端支持：

1. 通过 `adb`、备份工具或旧版导出，把 `collection_items.db` 和 `CollectApp/` 目录取到电脑；
2. 在桌面端「导入旧数据」中选择数据库文件/文件夹或 ZIP；
3. 导入向导会复制媒体到新库目录、重写路径，并报告缺失文件。

移动端不读取旧版数据（Android 应用私有目录无法被其他应用访问），首次启动为空库。

## 数据位置

- 桌面：`%APPDATA%/CollectSpace/`（`collectspace.db`、`media/`、`thumbnails/`、`logs/`）
- 移动：应用文档目录下的 `SQLite/collect.db` 与 `media/`、`thumbnails/`

两端数据库 schema 与迁移完全共享（`packages/core`），但不做自动同步。
Android 端只申请网络权限；文件通过系统文档选择器/分享入口读取，不申请
`MANAGE_EXTERNAL_STORAGE`，旧版外部存储权限在清单中被显式移除。

## 验证

- 桌面：`pnpm --filter @collect/desktop smoke` 覆盖 SQLite、`collect-media://`
  Range、旧库/媒体目录/ZIP 导入、幂等、缩略图缓存与缺失媒体重新定位。
- 移动：`pnpm --filter @collect/mobile typecheck` 与 `export:android` 验证
  TypeScript 与 Metro bundle；APK 由 `.github/workflows/build-android.yml` 构建。
- CI：`.github/workflows/build-windows.yml` 产出 NSIS/portable，
  `.github/workflows/build-android.yml` 产出 debug APK。

## License

MIT
