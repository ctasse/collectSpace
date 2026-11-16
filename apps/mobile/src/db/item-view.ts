/** DB 条目 → 移动端视图（媒体 URI 指向应用文档目录）。 */
import {
  basenameOf,
  extensionOf,
  isMediaType,
  type Item,
  type ItemView,
} from "@collect/core";
import { mediaUri } from "../media/files";

export function toItemView(item: Item): ItemView {
  const media = isMediaType(item.type);
  const available = media && !item.mediaMissing;

  return {
    ...item,
    mediaUrl: available ? mediaUri(item.content) : null,
    thumbnailUrl: null,
    fileName: media ? basenameOf(item.content) : null,
    extension: media ? extensionOf(item.content) : null,
  };
}
