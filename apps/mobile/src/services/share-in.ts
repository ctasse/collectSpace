import { useEffect, useRef } from "react";
import { useShareIntentContext } from "expo-share-intent";
import { useItemsStore } from "../stores/items";
import { notify, notifyError } from "../stores/ui";

/**
 * 系统分享入口：挂在根组件上，冷启动/热启动、任意页面都能接收。
 * 处理完必须 resetShareIntent，避免同一内容被重复导入。
 */
export function useShareImport(): void {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const processing = useRef(false);
  const createText = useItemsStore((state) => state.createText);
  const createUrl = useItemsStore((state) => state.createUrl);
  const importFiles = useItemsStore((state) => state.importFiles);

  useEffect(() => {
    if (!hasShareIntent || processing.current) return;
    processing.current = true;

    void (async () => {
      try {
        let count = 0;
        const url = shareIntent.webUrl ?? undefined;
        const text = shareIntent.text?.trim();

        if (url) {
          await createUrl({ url, title: shareIntent.meta?.title ?? undefined });
          count += 1;
        } else if (text) {
          if (/^https?:\/\//i.test(text)) {
            await createUrl({ url: text, title: shareIntent.meta?.title ?? undefined });
          } else {
            await createText({ content: text });
          }
          count += 1;
        }

        if (shareIntent.files && shareIntent.files.length > 0) {
          const result = await importFiles(
            shareIntent.files.map((file) => ({
              uri: file.path,
              fileName: file.fileName,
              mimeType: file.mimeType,
            })),
          );
          count += result.imported;
          if (result.failed.length > 0) {
            notify(result.failed[0] ?? "分享的文件导入失败", "error");
          }
        }

        if (count > 0) notify(`已收藏 ${count} 项`, "success");
      } catch (caught) {
        notifyError(caught);
      } finally {
        processing.current = false;
        resetShareIntent();
      }
    })();
  }, [hasShareIntent, shareIntent, createText, createUrl, importFiles, resetShareIntent]);
}
