import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ContentType } from "@collect/core";
import { useItemsStore } from "../stores/items";
import { useUiStore } from "../stores/ui";
import { SettingsDialog } from "./SettingsDialog";
import {
  CloseIcon,
  CollectionIcon,
  ImportIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
} from "./icons";

const DRAWER_WIDTH = 256;

const TYPE_OPTIONS: { value: ContentType | ""; label: string }[] = [
  { value: "", label: "全部类型" },
  { value: "text", label: "文本" },
  { value: "url", label: "链接" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "file", label: "文件" },
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tags = useItemsStore((state) => state.tags);
  const tag = useItemsStore((state) => state.tag);
  const type = useItemsStore((state) => state.type);
  const query = useItemsStore((state) => state.query);
  const total = useItemsStore((state) => state.total);
  const setTagFilter = useItemsStore((state) => state.setTagFilter);
  const setTypeFilter = useItemsStore((state) => state.setTypeFilter);
  const setQuery = useItemsStore((state) => state.setQuery);
  const openLegacy = useUiStore((state) => state.openLegacy);

  const allCount = tags.reduce((sum, item) => sum + item.count, 0);
  const title = tag ?? "全部收藏";

  const closeMobile = (): void => {
    if (isMobile) setMobileOpen(false);
  };

  const selectTag = (value: string | null): void => {
    setTagFilter(value);
    closeMobile();
  };

  const sidebar = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "12px",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "grid",
            placeItems: "center",
          }}
        >
          <TagIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            CollectSpace
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            收藏，随时可取
          </Typography>
        </Box>
      </Box>

      <List dense disablePadding>
        <ListItem disablePadding>
          <ListItemButton selected={tag === null} onClick={() => selectTag(null)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CollectionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="全部收藏" />
            <Chip size="small" label={allCount} sx={{ height: 20 }} />
          </ListItemButton>
        </ListItem>
      </List>

      <Divider sx={{ my: 1 }} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, pb: 0.5, fontWeight: 600 }}
      >
        标签
      </Typography>

      <List dense disablePadding sx={{ flex: 1, overflowY: "auto", px: 0.5 }}>
        {tags.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
            添加收藏后可在这里按标签筛选
          </Typography>
        )}
        {tags.map((item) => (
          <ListItem key={item.name} disablePadding>
            <ListItemButton
              selected={tag === item.name}
              onClick={() => selectTag(item.name)}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 34 }}>
                <TagIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={item.name} primaryTypographyProps={{ noWrap: true }} />
              <Typography variant="caption" color="text.secondary">
                {item.count}
              </Typography>
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Button fullWidth startIcon={<ImportIcon />} onClick={() => openLegacy()}>
          导入旧数据
        </Button>
        <Button
          fullWidth
          startIcon={<SettingsIcon />}
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          {isMobile && (
            <IconButton onClick={() => setMobileOpen(true)} aria-label="打开标签栏">
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.25 }}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              共 {total} 项
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、内容、标签"
            sx={{ width: { xs: 180, sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="清空搜索"
                    onClick={() => setQuery("")}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <TextField
            select
            size="small"
            label="类型"
            value={type ?? ""}
            onChange={(event) =>
              setTypeFilter((event.target.value || null) as ContentType | null)
            }
            sx={{ width: 118 }}
          >
            {TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Tooltip title="设置">
            <IconButton aria-label="设置" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box component="main" sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
