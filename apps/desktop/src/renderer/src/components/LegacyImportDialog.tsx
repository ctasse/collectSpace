import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { ImportReport } from "@collect/core";
import type {
  LegacyInspectResult,
  LegacyProgress,
  LegacyStage,
} from "../../../shared/ipc";
import { useItemsStore } from "../stores/items";
import { notifyError, notifyImportDone, useUiStore } from "../stores/ui";
import { CloseIcon, FolderIcon, ImportIcon } from "./icons";

const STAGE_LABELS: Record<LegacyStage, string> = {
  "opening-db": "打开数据库",
  "scanning-media": "扫描媒体",
  matching: "匹配媒体",
  copying: "复制媒体",
  writing: "写入收藏",
  done: "完成",
};

function SourceRow({
  label,
  value,
  hint,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  value: string;
  hint: string;
  onPick: () => void;
  onClear: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0 }} color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}
        color={value ? "text.primary" : "text.secondary"}
      >
        {value || hint}
      </Typography>
      <Button size="small" onClick={onPick} disabled={disabled}>
        选择
      </Button>
      {value && (
        <IconButton size="small" onClick={onClear} disabled={disabled} aria-label="清除">
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

export function LegacyImportDialog(): JSX.Element {
  const open = useUiStore((state) => state.legacyOpen);
  const source = useUiStore((state) => state.legacySource);
  const close = useUiStore((state) => state.closeLegacy);
  const initItems = useItemsStore((state) => state.init);

  const [dbPath, setDbPath] = useState("");
  const [mediaDir, setMediaDir] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [summary, setSummary] = useState<LegacyInspectResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<LegacyProgress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDbPath(source?.dbPath ?? "");
    setMediaDir(source?.mediaDir ?? "");
    setZipPath(source?.zipPath ?? "");
    setSummary(null);
    setReport(null);
    setProgress(null);
    setError(null);
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    return window.api.legacy.onProgress((value) => {
      setProgress((current) =>
        current && current.sessionId !== value.sessionId ? current : value,
      );
    });
  }, [open]);

  const pickDb = async (): Promise<void> => {
    const path = await window.api.dialog.openLegacyDb();
    if (!path) return;
    setDbPath(path);
    setZipPath("");
    setSummary(null);
    setReport(null);
  };

  const pickMediaDir = async (): Promise<void> => {
    const path = await window.api.dialog.openDirectory();
    if (!path) return;
    setMediaDir(path);
    setZipPath("");
    setSummary(null);
    setReport(null);
  };

  const pickZip = async (): Promise<void> => {
    const path = await window.api.dialog.openZip();
    if (!path) return;
    setZipPath(path);
    setDbPath("");
    setMediaDir("");
    setSummary(null);
    setReport(null);
  };

  const inspect = async (): Promise<void> => {
    if (!dbPath && !mediaDir && !zipPath) {
      setError("请先选择旧数据库、媒体目录或 ZIP");
      return;
    }
    setInspecting(true);
    setError(null);
    try {
      const result = await window.api.legacy.inspect({
        dbPath: dbPath || undefined,
        mediaDir: mediaDir || undefined,
        zipPath: zipPath || undefined,
      });
      setSummary(result);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    } finally {
      setInspecting(false);
    }
  };

  const run = async (): Promise<void> => {
    if (!summary) return;
    setRunning(true);
    setError(null);
    try {
      const result = await window.api.legacy.run(summary.sessionId);
      setReport(result);
      notifyImportDone(
        result.canceled
          ? `导入已取消，新增 ${result.inserted} 条`
          : `导入完成：新增 ${result.inserted} 条，修复 ${result.repaired} 条`,
      );
      await initItems();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    } finally {
      setRunning(false);
    }
  };

  const cancel = (): void => {
    if (!summary) return;
    window.api.legacy.cancel(summary.sessionId).catch(notifyError);
  };

  const closeDialog = (): void => {
    if (running) return;
    setDbPath("");
    setMediaDir("");
    setZipPath("");
    setSummary(null);
    setReport(null);
    setProgress(null);
    setError(null);
    close();
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  return (
    <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ImportIcon color="primary" />
        导入旧版数据
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {!summary && !report && (
            <>
              <Typography variant="body2" color="text.secondary">
                选择旧手机导出的 collection_items.db、CollectApp 媒体文件夹，或包含两者的 ZIP。
                原文件只读，不会修改。
              </Typography>
              <SourceRow
                label="数据库"
                value={dbPath}
                hint="collection_items.db"
                onPick={() => void pickDb()}
                onClear={() => setDbPath("")}
                disabled={inspecting || running}
              />
              <SourceRow
                label="媒体目录"
                value={mediaDir}
                hint="包含 shared_imports 的文件夹"
                onPick={() => void pickMediaDir()}
                onClear={() => setMediaDir("")}
                disabled={inspecting || running}
              />
              <SourceRow
                label="ZIP"
                value={zipPath}
                hint="旧数据压缩包"
                onPick={() => void pickZip()}
                onClear={() => setZipPath("")}
                disabled={inspecting || running}
              />
              <Typography variant="caption" color="text.secondary">
                数据库和媒体目录可以同时选择；选择 ZIP 会覆盖前两项。
              </Typography>
            </>
          )}

          {summary && !report && (
            <>
              <Alert severity="info">
                找到 {summary.rows} 条收藏，其中媒体 {summary.mediaRows} 条：
                匹配 {summary.matchedMedia}，缺失 {summary.missingMedia}
                {summary.ambiguous > 0 ? `，歧义 ${summary.ambiguous}` : ""}。
                已有 {summary.existing} 条导入过，将跳过。
              </Alert>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {Object.entries(summary.types).map(([type, count]) => (
                  <Chip key={type} size="small" label={`${type} ${count}`} />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                数据库：{summary.dbLabel}
              </Typography>
              {summary.warnings.length > 0 && (
                <Alert severity="warning">
                  {summary.warnings.slice(0, 3).join("；")}
                </Alert>
              )}

              {(running || progress) && (
                <Box>
                  <LinearProgress
                    variant={progress && progress.total > 0 ? "determinate" : "indeterminate"}
                    value={percent}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    {progress
                      ? `${STAGE_LABELS[progress.stage]} · ${progress.processed}/${progress.total} · 新增 ${progress.inserted} · 修复 ${progress.repaired} · 缺失 ${progress.missing}`
                      : "准备导入…"}
                  </Typography>
                </Box>
              )}
            </>
          )}

          {report && (
            <>
              <Alert severity={report.errors.length > 0 ? "warning" : "success"}>
                {report.canceled ? "导入已取消（已完成的条目保留）。" : "导入完成。"}
                {" "}共处理 {report.rows} 条，新增 {report.inserted}，跳过 {report.skippedExisting}，
                修复 {report.repaired}；复制媒体 {report.mediaCopied} 个，缺失 {report.mediaMissing} 个。
              </Alert>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`媒体行 ${report.mediaRows}`} />
                <Chip size="small" label={`歧义 ${report.ambiguous}`} />
                <Chip size="small" label={`失败 ${report.mediaFailed}`} />
                <Chip size="small" label={`错误 ${report.errors.length}`} />
              </Stack>
              {report.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    错误（前 5 条）
                  </Typography>
                  {report.errors.slice(0, 5).map((item, index) => (
                    <Typography
                      key={`${item.legacyId ?? "x"}-${index}`}
                      variant="caption"
                      color="error"
                      sx={{ display: "block", wordBreak: "break-all" }}
                    >
                      {item.title || `旧 ID ${item.legacyId ?? "?"}`}：{item.reason}
                    </Typography>
                  ))}
                </Box>
              )}
              {report.warnings.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {report.warnings.slice(0, 3).join("；")}
                </Typography>
              )}
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                日志：{report.logPath ?? "未写入"}
              </Typography>
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        {report ? (
          <>
            <Button
              startIcon={<FolderIcon />}
              onClick={() => window.api.app.openDataFolder().catch(notifyError)}
            >
              数据目录
            </Button>
            <Button variant="contained" onClick={closeDialog}>
              完成
            </Button>
          </>
        ) : summary ? (
          <>
            <Button onClick={() => setSummary(null)} disabled={running}>
              返回
            </Button>
            {running ? (
              <Button color="warning" onClick={cancel}>
                取消导入
              </Button>
            ) : (
              <Button variant="contained" onClick={() => void run()}>
                开始导入
              </Button>
            )}
          </>
        ) : (
          <>
            <Button onClick={closeDialog} disabled={inspecting}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={() => void inspect()}
              disabled={inspecting}
            >
              {inspecting ? "预检中…" : "开始预检"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
