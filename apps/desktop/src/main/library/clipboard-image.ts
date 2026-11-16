/** 剪贴板图片 → 库内图片条目。 */
import { clipboard } from "electron";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureUserDir } from "../paths";
import { insertItem } from "../db/items-repo";
import { getDriver } from "../db";
import { toItemView } from "../db/item-view";

export function createItemFromClipboardImage(tag: string) {
  const image = clipboard.readImage();
  if (image.isEmpty()) throw new Error("剪贴板中没有图片");

  const id = randomUUID();
  const dir = ensureUserDir("media", "image", id);
  const file = join(dir, "clipboard.png");
  const png = image.toPNG();
  writeFileSync(file, png);

  const size = image.getSize();
  const item = insertItem(getDriver(), {
    title: "剪贴板图片",
    content: `media/image/${id}/clipboard.png`,
    description: `${size.width} × ${size.height}`,
    type: "image",
    tag,
    sizeBytes: png.length,
    fileMtime: Date.now(),
  });

  return toItemView(item);
}
