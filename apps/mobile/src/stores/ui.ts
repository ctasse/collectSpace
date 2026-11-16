import { create } from "zustand";
import { useSettingsStore } from "./settings";

export type ToastKind = "success" | "error" | "info";

interface UiState {
  toast: { message: string; kind: ToastKind } | null;
  notify: (message: string, kind?: ToastKind) => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  notify: (message, kind = "info") => set({ toast: { message, kind } }),
  clearToast: () => set({ toast: null }),
}));

export function notify(message: string, kind: ToastKind = "info"): void {
  useUiStore.getState().notify(message, kind);
}

export function notifyError(error: unknown): void {
  if (!useSettingsStore.getState().settings.notifications.errors) return;
  const message = error instanceof Error ? error.message : String(error);
  useUiStore.getState().notify(message, "error");
}
