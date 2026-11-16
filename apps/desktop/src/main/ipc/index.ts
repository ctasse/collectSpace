import { registerAppIpc } from "./app";
import { registerDialogIpc } from "./dialogs";
import { registerItemsIpc } from "./items";
import { registerLegacyIpc } from "./legacy";
import { registerSettingsIpc } from "./settings";

/** 主进程启动时调用一次；所有通道手动校验入参。 */
export function registerIpc(): void {
  registerAppIpc();
  registerDialogIpc();
  registerSettingsIpc();
  registerItemsIpc();
  registerLegacyIpc();
}
