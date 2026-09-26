import { create } from "zustand";
import { useSyncExternalStore } from "react";

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
  /** Save-as-component dialog. */
  saveComponentOpen: boolean;
  setSaveComponentOpen: (v: boolean) => void;
  /** Component library manager dialog. */
  componentLibraryOpen: boolean;
  setComponentLibraryOpen: (v: boolean) => void;
  /** MCP integration guide dialog. */
  mcpOpen: boolean;
  setMcpOpen: (v: boolean) => void;
  /** Desktop left navigation panel listing diagrams (persisted). */
  documentsPanel: boolean;
  setDocumentsPanel: (v: boolean) => void;
  /** Desktop shape palette panel (persisted). */
  shapesPanel: boolean;
  setShapesPanel: (v: boolean) => void;
  /** Desktop inspector panel (persisted). */
  inspectorPanel: boolean;
  setInspectorPanel: (v: boolean) => void;
  /** Mobile diagrams drawer. */
  documentsDrawer: boolean;
  setDocumentsDrawer: (v: boolean) => void;
}

/** Reads a persisted boolean preference ("0" = false, anything else = true). */
function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v !== "0";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
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
  saveComponentOpen: false,
  setSaveComponentOpen: (v) => set({ saveComponentOpen: v }),
  componentLibraryOpen: false,
  setComponentLibraryOpen: (v) => set({ componentLibraryOpen: v }),
  mcpOpen: false,
  setMcpOpen: (v) => set({ mcpOpen: v }),
  documentsPanel: readBool("diagram_docs_panel", true),
  setDocumentsPanel: (v) => {
    writeBool("diagram_docs_panel", v);
    set({ documentsPanel: v });
  },
  shapesPanel: readBool("diagram_shapes_panel", true),
  setShapesPanel: (v) => {
    writeBool("diagram_shapes_panel", v);
    set({ shapesPanel: v });
  },
  inspectorPanel: readBool("diagram_inspector_panel", true),
  setInspectorPanel: (v) => {
    writeBool("diagram_inspector_panel", v);
    set({ inspectorPanel: v });
  },
  documentsDrawer: false,
  setDocumentsDrawer: (v) => set({ documentsDrawer: v }),
}));

/** True on phones / tablets where the editor uses drawers. */
export function isCompactLayout(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

const COMPACT_QUERY = "(max-width: 1023px)";

function subscribeCompact(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(COMPACT_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getCompactSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

/** Reactive version of {@link isCompactLayout}: re-renders on resize/orientation change. */
export function useIsCompactLayout(): boolean {
  return useSyncExternalStore(subscribeCompact, getCompactSnapshot, () => false);
}
