/** DB 条目 → 渲染层视图（补齐媒体/缩略图 URL 与文件名信息）。 */
import { existsSync } from "node:fs";
import { basenameOf, extensionOf, isMediaType, type Item, type ItemView } from "@collect/core";
import { toAbsPath } from "../paths";
import { mediaUrl } from "../protocols";

export function toItemView(item: Item): ItemView {
  const media = isMediaType(item.type);
  // DB 标记之外再核对磁盘，手工删文件后也能显示“文件缺失”并重新定位
  const available = media && !item.mediaMissing && existsSync(toAbsPath(item.content));

  return {
    ...item,
    mediaMissing: media ? !available : item.mediaMissing,
    mediaUrl: available ? mediaUrl(item.content) : null,
    // 视频缩略图按需加载；首帧返回 null，UI 用类型图标回退
    thumbnailUrl: null,
    fileName: media ? basenameOf(item.content) : null,
    extension: media ? extensionOf(item.content) : null,
  };
}
