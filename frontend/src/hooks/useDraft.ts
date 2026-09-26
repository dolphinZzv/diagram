import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { clearDraft, saveDraft } from "@/lib/draft";

/**
 * Persists the editor to localStorage (debounced) so a sudden page close does
 * not lose work, and flushes synchronously on unload. Restoring a draft on the
 * next visit is handled by `useDocumentBootstrap`.
 */
export function useDraftPersistence() {
  const { getViewport } = useReactFlow();

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
