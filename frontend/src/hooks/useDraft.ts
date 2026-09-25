import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { clearDraft, recoverableDraft, saveDraft } from "@/lib/draft";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";

/**
 * Persists the editor to localStorage so a sudden page close does not lose
 * work, and restores an unsaved draft on the next visit.
 */
export function useDraftPersistence() {
  const t = useT();
  const { getViewport, setViewport } = useReactFlow();
  const restored = useRef(false);

  // Restore an unsaved draft exactly once on mount.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = recoverableDraft();
    if (!draft) return;

    const store = useEditor.getState();
    store.loadDoc(normalizeNodes(draft.nodes ?? []), normalizeEdges(draft.edges ?? []));
    store.setMeta({
      id: draft.id ?? null,
      name: draft.name || t("topbar.untitled"),
      description: draft.description ?? "",
      saved: false,
    });
    if (draft.viewport) {
      setTimeout(() => setViewport(draft.viewport!), 60);
    }
    toast.info(t("draft.restoredTitle"), t("draft.restoredDesc"));
  }, [setViewport, t]);

  // Debounced autosave on any change.
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useEditor.subscribe((state) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const { nodes, edges, meta } = state;
        if (meta.saved) {
          // Saved to the server: the draft is no longer needed.
          clearDraft();
          return;
        }
        saveDraft({
          id: meta.id,
          name: meta.name,
          description: meta.description,
          nodes,
          edges,
          viewport: getViewport(),
          saved: false,
          updatedAt: Date.now(),
        });
      }, 400);
    });

    // Also flush synchronously when the page is about to unload.
    const onBeforeUnload = () => {
      const { nodes, edges, meta } = useEditor.getState();
      if (meta.saved) return;
      try {
        saveDraft({
          id: meta.id,
          name: meta.name,
          description: meta.description,
          nodes,
          edges,
          viewport: getViewport(),
          saved: false,
          updatedAt: Date.now(),
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (timer) window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [getViewport]);
}
