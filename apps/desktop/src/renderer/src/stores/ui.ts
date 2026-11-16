import { create } from "zustand";
import type { LegacySourceInput } from "../../../shared/ipc";
import { useSettingsStore } from "./settings";

export type ToastSeverity = "success" | "error" | "info" | "warning";

export interface ToastState {
  message: string;
  severity: ToastSeverity;
}

interface UiState {
  toast: ToastState | null;
  notify: (message: string, severity?: ToastSeverity) => void;
  clearToast: () => void;

  legacyOpen: boolean;
  legacySource: LegacySourceInput | null;
  openLegacy: (source?: LegacySourceInput) => void;
  closeLegacy: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  notify: (message, severity = "info") => set({ toast: { message, severity } }),
  clearToast: () => set({ toast: null }),

  legacyOpen: false,
  legacySource: null,
  openLegacy: (source) => set({ legacyOpen: true, legacySource: source ?? null }),
  closeLegacy: () => set({ legacyOpen: false, legacySource: null }),
}));

export function notify(message: string, severity: ToastSeverity = "info"): void {
  useUiStore.getState().notify(message, severity);
}

export function notifyError(error: unknown): void {
  if (!useSettingsStore.getState().settings.notifications.errors) return;
  const message = error instanceof Error ? error.message : String(error);
  useUiStore.getState().notify(message, "error");
}

/** 导入完成提示受设置开关控制；对话框内仍会显示完整报告。 */
export function notifyImportDone(message: string): void {
  if (!useSettingsStore.getState().settings.notifications.importDone) return;
  useUiStore.getState().notify(message, "success");
}
