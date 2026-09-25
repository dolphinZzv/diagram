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
  /** Sequence-diagram message composer. */
  messageDialog: { open: boolean; sourceId?: string };
  openMessageDialog: (sourceId?: string) => void;
  closeMessageDialog: () => void;
  /** Hand-drawn look for shapes and edges. */
  sketch: boolean;
  toggleSketch: () => void;
  /** Command palette (Ctrl/⌘+K). */
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  /** Presentation (walk-through) mode. */
  presentation: { active: boolean; index: number; order: string[] };
  startPresentation: (order: string[]) => void;
  stopPresentation: () => void;
  presentationNext: () => void;
  presentationPrev: () => void;
  /** Text import (Mermaid / PlantUML) dialog. */
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  /** Template gallery dialog. */
  templateGalleryOpen: boolean;
  setTemplateGalleryOpen: (v: boolean) => void;
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
  messageDialog: { open: false },
  openMessageDialog: (sourceId) => set({ messageDialog: { open: true, sourceId } }),
  closeMessageDialog: () => set({ messageDialog: { open: false } }),
  sketch: false,
  toggleSketch: () => set({ sketch: !useUi.getState().sketch }),
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  presentation: { active: false, index: 0, order: [] },
  startPresentation: (order) => set({ presentation: { active: true, index: 0, order } }),
  stopPresentation: () => set({ presentation: { active: false, index: 0, order: [] } }),
  presentationNext: () =>
    set((s) => ({
      presentation: {
        ...s.presentation,
        index: Math.min(s.presentation.index + 1, s.presentation.order.length - 1),
      },
    })),
  presentationPrev: () =>
    set((s) => ({ presentation: { ...s.presentation, index: Math.max(s.presentation.index - 1, 0) } })),
  importOpen: false,
  setImportOpen: (v) => set({ importOpen: v }),
  templateGalleryOpen: false,
  setTemplateGalleryOpen: (v) => set({ templateGalleryOpen: v }),
}));

/** True on phones / tablets where the editor uses drawers. */
export function isCompactLayout(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}
