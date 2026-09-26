import { create } from "zustand";

/**
 * Promise-based replacement for the native `window.confirm` / `window.prompt`
 * dialogs. Call `confirmDialog(...)` / `promptDialog(...)` from anywhere; the
 * single `<ConfirmDialog />` mounted at the app root renders the request in the
 * design system's style and resolves the promise.
 */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface PendingConfirm {
  kind: "confirm";
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

interface PendingPrompt {
  kind: "prompt";
  options: PromptOptions;
  resolve: (value: string | null) => void;
}

export type PendingDialog = PendingConfirm | PendingPrompt;

interface DialogState {
  pending: PendingDialog | null;
  requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
  requestPrompt: (options: PromptOptions) => Promise<string | null>;
  settle: (value: boolean | string | null) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  pending: null,
  requestConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { kind: "confirm", options, resolve } });
    }),
  requestPrompt: (options) =>
    new Promise<string | null>((resolve) => {
      set({ pending: { kind: "prompt", options, resolve } });
    }),
  settle: (value) => {
    const pending = get().pending;
    if (!pending) return;
    set({ pending: null });
    if (pending.kind === "confirm") pending.resolve(value === true);
    else pending.resolve(typeof value === "string" ? value : null);
  },
}));

/** Show a styled confirmation dialog and resolve to the user's choice. */
export const confirmDialog = (options: ConfirmOptions) =>
  useDialogStore.getState().requestConfirm(options);

/** Show a styled text-input dialog and resolve to the entered value (or null). */
export const promptDialog = (options: PromptOptions) =>
  useDialogStore.getState().requestPrompt(options);
