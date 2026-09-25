import { create } from "zustand";

interface UiState {
  /** Keyboard shortcuts help dialog. */
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  /** Mobile shape palette drawer. */
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  /** Mobile properties drawer (also opened by double-tapping a node/edge). */
  inspectorOpen: boolean;
  setInspectorOpen: (v: boolean) => void;
  /** When true, dragging on the canvas draws a marquee selection. */
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  /** Touch action sheet (long-press menu). */
  actionSheet: { open: boolean; kind: "node" | "edge" | "pane"; id?: string };
  openActionSheet: (kind: "node" | "edge" | "pane", id?: string) => void;
  closeActionSheet: () => void;
}

export const useUi = create<UiState>((set) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  inspectorOpen: false,
  setInspectorOpen: (v) => set({ inspectorOpen: v }),
  selectMode: false,
  setSelectMode: (v) => set({ selectMode: v }),
  actionSheet: { open: false, kind: "pane" },
  openActionSheet: (kind, id) => set({ actionSheet: { open: true, kind, id } }),
  closeActionSheet: () => set({ actionSheet: { open: false, kind: "pane" } }),
}));

/** True on phones / tablets where the editor uses drawers. */
export function isCompactLayout(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}
