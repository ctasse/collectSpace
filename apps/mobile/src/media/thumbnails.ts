/** 视频首帧缩略图：按 item id 缓存在 thumbnails/ 下。 */
import * as FileSystem from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { ItemView } from "@collect/core";
import { mediaUri } from "./files";

function thumbUri(id: string): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("应用文档目录不可用");
  return `${root}thumbnails/${id}.jpg`;
}

export async function getVideoThumbnail(item: ItemView): Promise<string | null> {
  if (item.type !== "video" || !item.mediaUrl) return null;

  const dir = `${FileSystem.documentDirectory}thumbnails/`;
  const dest = thumbUri(item.id);
  const cached = await FileSystem.getInfoAsync(dest);
  if (cached.exists && !cached.isDirectory) return dest;

  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const result = await VideoThumbnails.getThumbnailAsync(
      mediaUri(item.content),
      { time: 1000, quality: 0.7 },
    );
    await FileSystem.copyAsync({ from: result.uri, to: dest });
    return dest;
  } catch {
    return null;
  }
}
