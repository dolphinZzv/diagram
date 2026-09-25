import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { api } from "@/lib/api";
import { serializeDoc } from "@/lib/doc";

const PREF_KEY = "diagram_autosave";

export function isAutoSaveEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoSaveEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Persists changes to the server automatically (debounced). Only runs for
 * diagrams that already have an id, so it never silently creates new docs.
 */
export function useAutoSave(delay = 2500) {
  const { getViewport } = useReactFlow();

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useEditor.subscribe((state) => {
      if (!isAutoSaveEnabled()) return;
      const { nodes, edges, meta } = state;
      // Need an existing document, unsaved changes, and a non-empty canvas.
      if (!meta.id || meta.saved || meta.saving) return;
      if (nodes.length === 0 && edges.length === 0) return;

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const s = useEditor.getState();
        if (!s.meta.id || s.meta.saved) return;
        s.setMeta({ saving: true });
        try {
          const doc = serializeDoc(s.nodes, s.edges, s.meta.name, s.meta.description, getViewport());
          await api.update(s.meta.id, { name: s.meta.name, description: s.meta.description, data: doc });
          useEditor.getState().setMeta({ saved: true, saving: false });
        } catch {
          useEditor.getState().setMeta({ saving: false });
        }
      }, delay);
    });

    return () => {
      if (timer) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [delay, getViewport]);
}
