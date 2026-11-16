import { useEffect, useState, type MouseEvent } from "react";
import {
  Box,
  Card,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import type { ItemView } from "@collect/core";
import {
  DeleteIcon,
  EditIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
  LinkIcon,
  MoreIcon,
  OpenInNewIcon,
  PlayIcon,
  TagIcon,
  TextIcon,
  VideoIcon,
} from "./icons";

export interface ItemCardActions {
  onOpen: (item: ItemView) => void;
  onToggleSelect: (id: string) => void;
  onRename: (item: ItemView) => void;
  onTag: (item: ItemView) => void;
  onDelete: (item: ItemView) => void;
  onCopy: (item: ItemView) => void;
  onReveal: (item: ItemView) => void;
  onRelocate: (item: ItemView) => void;
}

interface Props extends ItemCardActions {
  item: ItemView;
  selected: boolean;
  selectionMode: boolean;
  onClick: (event: MouseEvent, item: ItemView) => void;
}

function urlHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function typeIcon(type: ItemView["type"]): JSX.Element {
  switch (type) {
    case "image":
      return <ImageIcon />;
    case "video":
      return <VideoIcon />;
    case "url":
      return <LinkIcon />;
    case "text":
      return <TextIcon />;
    default:
      return <FileIcon />;
  }
}

function PlayBadge(): JSX.Element {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          bgcolor: "rgba(0,0,0,0.55)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        <PlayIcon />
      </Box>
    </Box>
  );
}

function MediaArea({
  item,
  thumbUrl,
}: {
  item: ItemView;
  thumbUrl: string | null;
}): JSX.Element {
  if (item.type === "image" && item.mediaUrl) {
    return (
      <Box
        component="img"
        src={item.mediaUrl}
        alt={item.title}
        loading="lazy"
        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }

  if (item.type === "video" && thumbUrl) {
    return (
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <Box
          component="img"
          src={thumbUrl}
          alt={item.title}
          loading="lazy"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <PlayBadge />
      </Box>
    );
  }

  if (item.type === "text") {
    return (
      <Box sx={{ p: 2, pt: 4.5, width: "100%", height: "100%", overflow: "hidden" }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 6,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
          }}
        >
          {item.content || item.description}
        </Typography>
      </Box>
    );
  }

  const isUrl = item.type === "url";
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        color: isUrl ? "primary.main" : "text.secondary",
        background: isUrl
          ? "linear-gradient(145deg, rgba(103,80,164,0.14), rgba(103,80,164,0.04))"
          : "linear-gradient(145deg, rgba(0,0,0,0.10), rgba(0,0,0,0.03))",
      }}
    >
      <Box sx={{ "& svg": { fontSize: 44 } }}>{typeIcon(item.type)}</Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {isUrl ? urlHost(item.content) : (item.extension || "文件")}
      </Typography>
      {item.type === "video" && !thumbUrl && <PlayBadge />}
    </Box>
  );
}

export function ItemCard(props: Props): JSX.Element {
  const { item, selected, selectionMode, onClick, onToggleSelect } = props;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(item.thumbnailUrl);

  useEffect(() => {
    setThumbUrl(item.thumbnailUrl);
    if (item.type !== "video" || item.thumbnailUrl || item.mediaMissing) return;

    let alive = true;
    window.api.media
      .thumbnail(item.id)
      .then((result) => {
        if (alive && result.url) setThumbUrl(result.url);
      })
      .catch(() => {
        // ffmpeg 不可用或抽帧失败时回退类型图标
      });
    return () => {
      alive = false;
    };
  }, [item.id, item.type, item.thumbnailUrl, item.mediaMissing]);

  const stopAnd = (action: () => void) => (event: MouseEvent): void => {
    event.stopPropagation();
    setMenuAnchor(null);
    action();
  };

  return (
    <Card
      variant="outlined"
      onClick={(event) => onClick(event, item)}
      sx={{
        position: "relative",
        cursor: "pointer",
        overflow: "hidden",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        "&:hover": {
          boxShadow: 2,
          transform: "translateY(-1px)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "1 / 1",
          bgcolor: "action.hover",
          overflow: "hidden",
        }}
      >
        <MediaArea item={item} thumbUrl={thumbUrl} />

        <Checkbox
          size="small"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelect(item.id)}
          sx={{
            position: "absolute",
            top: 4,
            left: 4,
            bgcolor: "background.paper",
            borderRadius: "50%",
            p: 0.25,
            opacity: selected || selectionMode ? 1 : 0.55,
            "&:hover": { opacity: 1 },
          }}
          inputProps={{ "aria-label": `选择 ${item.title}` }}
        />

        <IconButton
          size="small"
          aria-label="更多操作"
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(event.currentTarget);
          }}
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            bgcolor: "background.paper",
            "&:hover": { bgcolor: "background.paper" },
          }}
        >
          <MoreIcon fontSize="small" />
        </IconButton>

        {item.mediaMissing && (
          <Chip
            size="small"
            color="warning"
            label="文件缺失"
            sx={{ position: "absolute", bottom: 8, left: 8 }}
          />
        )}
      </Box>

      <Box sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" noWrap title={item.title}>
          {item.title}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
          <Chip
            size="small"
            icon={<TagIcon />}
            label={item.tag}
            sx={{ height: 20, "& .MuiChip-icon": { fontSize: 13 } }}
          />
          <Typography variant="caption" color="text.secondary">
            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
          </Typography>
        </Stack>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem onClick={stopAnd(() => props.onOpen(item))}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} />
          预览 / 打开
        </MenuItem>
        <MenuItem onClick={stopAnd(() => props.onRename(item))}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          重命名
        </MenuItem>
        <MenuItem onClick={stopAnd(() => props.onTag(item))}>
          <TagIcon fontSize="small" sx={{ mr: 1 }} />
          修改标签
        </MenuItem>
        <MenuItem onClick={stopAnd(() => props.onCopy(item))}>复制内容</MenuItem>
        {item.type !== "url" && item.type !== "text" && (
          <MenuItem onClick={stopAnd(() => props.onReveal(item))}>
            <FolderIcon fontSize="small" sx={{ mr: 1 }} />
            在文件夹中显示
          </MenuItem>
        )}
        {item.mediaMissing && (
          <MenuItem onClick={stopAnd(() => props.onRelocate(item))}>
            <FolderIcon fontSize="small" sx={{ mr: 1 }} />
            重新定位文件
          </MenuItem>
        )}
        <MenuItem onClick={stopAnd(() => props.onDelete(item))} sx={{ color: "error.main" }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          删除
        </MenuItem>
      </Menu>
    </Card>
  );
}
