import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { recoverableDraft } from "@/lib/draft";
import { loadLastDiagramId, saveLastDiagramId } from "@/lib/lastDoc";
import { readDiagramIdFromUrl, setDiagramIdInUrl } from "@/lib/url";
import { useDocuments } from "@/lib/documents";
import { useDiagramActions } from "@/hooks/useDiagramActions";
import { api } from "@/lib/api";
import { seedPendingFromDoc } from "@/lib/syncQueue";
import { toast } from "@/lib/toast";
import { describeError } from "@/lib/errors";
import { useT } from "@/lib/i18n";

/**
 * Decides what to open on first load:
 *   - a shared *editable* session (`?edit=<token>`) loads that diagram and
 *     enables token-based saving,
 *   - otherwise: an unsaved local draft, then the diagram that was open last
 *     time (else the most recent one), then a brand-new diagram (so the app
 *     always has a UUID document).
 */
export function useDocumentBootstrap(editToken?: string) {
  const t = useT();
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const { setViewport, fitView } = useReactFlow();
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const metaId = useEditor((s) => s.meta.id);
  const { openDiagram, createDiagram } = useDiagramActions();

  // Remember the open diagram so a reload returns to it.
  useEffect(() => {
    if (metaId && !editToken) saveLastDiagramId(metaId);
  }, [metaId, editToken]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms));
      };
      // Shared editable session.
      if (editToken) {
        // Prefer unsaved local edits (e.g. reloaded while offline): they are
        // queued and replayed once the room connection is (re)established.
        const draft = recoverableDraft();
        if (draft) {
          const dNodes = normalizeNodes(draft.nodes ?? []);
          const dEdges = normalizeEdges(draft.edges ?? []);
          loadDoc(dNodes, dEdges);
          setMeta({
            id: draft.id ?? null,
            editToken,
            name: draft.name || t("topbar.untitled"),
            description: draft.description ?? "",
            saved: false,
            saving: false,
            shareToken: "",
          });
          seedPendingFromDoc(dNodes, dEdges, draft.name || "");
          if (draft.viewport) later(() => setViewport(draft.viewport!), 60);
          toast.info(t("draft.restoredTitle"), t("draft.restoredDesc"));
          return;
        }
        try {
          const rec = await api.getEditable(editToken);
          loadDoc(normalizeNodes(rec.data.nodes ?? []), normalizeEdges(rec.data.edges ?? []));
          setMeta({
            id: rec.id,
            editToken,
            name: rec.name,
            description: rec.description ?? "",
            saved: true,
            saving: false,
            shareToken: "",
          });
          later(() => {
            if (rec.data.viewport) setViewport(rec.data.viewport);
            else fitView({ padding: 0.3 });
          }, 60);
        } catch (e) {
          toast.error(t("collab.loadFail"), describeError(e));
        }
        return;
      }

      const draft = recoverableDraft();
      if (draft) {
        loadDoc(normalizeNodes(draft.nodes ?? []), normalizeEdges(draft.edges ?? []));
        setMeta({
          id: draft.id ?? null,
          name: draft.name || t("topbar.untitled"),
          description: draft.description ?? "",
          saved: false,
        });
        if (draft.viewport) later(() => setViewport(draft.viewport!), 60);
        setDiagramIdInUrl(draft.id ?? null);
        toast.info(t("draft.restoredTitle"), t("draft.restoredDesc"));
        return;
      }

      await useDocuments.getState().refresh();
      const items = useDocuments.getState().items;
      const urlId = readDiagramIdFromUrl();
      const lastId = loadLastDiagramId();
      const exists = (id: string | null): id is string =>
        !!id && items.some((i) => i.id === id);
      const target =
        (exists(urlId) ? urlId : null) ??
        (exists(lastId) ? lastId : null) ??
        (items.length
          ? [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0].id
          : null);

      if (target) await openDiagram(target);
      else await createDiagram();
    })();
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear deferred viewport timers on unmount so they never run on a
  // torn-down tree (matters for tests / fast navigation).
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
}
