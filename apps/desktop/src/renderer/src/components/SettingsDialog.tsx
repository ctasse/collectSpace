import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { AppInfo } from "../../../shared/ipc";
import { useSettingsStore } from "../stores/settings";
import { notifyError } from "../stores/ui";

const THEME_LABELS = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
] as const;

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    window.api.app
      .info()
      .then((value) => {
        if (alive) setInfo(value);
      })
      .catch(() => {
        // 信息读取失败不影响设置项
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const update = (value: Parameters<typeof patch>[0]): void => {
    patch(value).catch(notifyError);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>设置</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              外观
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={settings.themeMode}
              onChange={(_event, value: typeof settings.themeMode | null) => {
                if (value) update({ themeMode: value });
              }}
              sx={{ mb: 1.5 }}
            >
              {THEME_LABELS.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                select
                size="small"
                label="强调色"
                value={settings.accentMode}
                onChange={(event) =>
                  update({
                    accentMode: event.target.value as "system" | "custom",
                  })
                }
                sx={{ width: 160 }}
              >
                <MenuItem value="system">跟随系统</MenuItem>
                <MenuItem value="custom">自定义</MenuItem>
              </TextField>
              <TextField
                label="自定义颜色"
                type="color"
                size="small"
                value={settings.customAccent}
                disabled={settings.accentMode !== "custom"}
                onChange={(event) =>
                  update({
                    customAccent: event.target.value,
                    accentMode: "custom",
                  })
                }
                sx={{ width: 140 }}
              />
              <TextField
                select
                size="small"
                label="每行卡片数"
                value={settings.gridColumns}
                onChange={(event) =>
                  update({
                    gridColumns: Number(event.target.value) as 0 | 2 | 3 | 4 | 5 | 6,
                  })
                }
                sx={{ width: 140 }}
              >
                <MenuItem value={0}>自动</MenuItem>
                {[2, 3, 4, 5, 6].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value} 列
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              数据
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.deleteToTrash}
                  onChange={(event) =>
                    update({ deleteToTrash: event.target.checked })
                  }
                />
              }
              label="删除媒体时移到回收站（关闭则永久删除）"
            />
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  window.api.app.openDataFolder().catch(notifyError);
                }}
              >
                打开数据目录
              </Button>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              通知
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.importDone}
                  onChange={(event) =>
                    update({
                      notifications: {
                        importDone: event.target.checked,
                      },
                    })
                  }
                />
              }
              label="旧数据导入完成时提示"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.errors}
                  onChange={(event) =>
                    update({
                      notifications: {
                        errors: event.target.checked,
                      },
                    })
                  }
                />
              }
              label="操作失败时提示错误"
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              关于
            </Typography>
            <Typography variant="body2">
              CollectSpace {info?.version ?? "—"} · Electron{" "}
              {info?.electron ?? "—"} · Chromium {info?.chrome ?? "—"}
            </Typography>
            {info && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", wordBreak: "break-all", mt: 0.5 }}
                >
                  数据库：{info.dbPath}（schema v{info.schemaVersion}）
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", wordBreak: "break-all" }}
                >
                  数据目录：{info.userDataPath}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  ffmpeg：{info.ffmpegAvailable ? "可用" : "未找到（视频缩略图不可用）"}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
