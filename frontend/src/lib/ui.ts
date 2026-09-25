import { create } from "zustand";

interface UiState {
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
}));
