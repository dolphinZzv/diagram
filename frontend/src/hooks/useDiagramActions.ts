import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { api, type DiagramRecord } from "@/lib/api";
import { normalizeEdges, normalizeNodes, serializeDoc } from "@/lib/doc";
import { clearDraft } from "@/lib/draft";
import { confirmDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import { describeError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useDocuments } from "@/lib/documents";
import { setDiagramIdInUrl } from "@/lib/url";

/**
 * Multi-document operations: switching, creating, duplicating, renaming and
 * deleting diagrams. All entry points (left panel, toolbar, dialogs) share this
 * so the "unsaved changes" guard and viewport handling stay consistent.
 */
export function useDiagramActions() {
  const t = useT();
  const { getViewport, setViewport, fitView } = useReactFlow();
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);

  // Deferred viewport work (fitView/setViewport) must not fire after the
  // component unmounts, otherwise React updates a torn-down tree.
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const applyRecord = useCallback(
    (rec: DiagramRecord) => {
      loadDoc(normalizeNodes(rec.data?.nodes ?? []), normalizeEdges(rec.data?.edges ?? []));
      setMeta({
        id: rec.id,
        name: rec.name,
        description: rec.description ?? "",
        saved: true,
        saving: false,
        shareToken: "",
      });
      clearDraft();
      setDiagramIdInUrl(rec.id);
      later(() => {
        if (rec.data?.viewport) setViewport(rec.data.viewport);
        else fitView({ padding: 0.3 });
      }, 40);
    },
    [loadDoc, setMeta, setViewport, fitView, later]
  );

  /** Persists the current diagram, creating it on the server if needed. */
  const saveCurrent = useCallback(async (): Promise<boolean> => {
    const { meta, nodes, edges } = useEditor.getState();
    setMeta({ saving: true });
    try {
      const doc = serializeDoc(nodes, edges, meta.name, meta.description, getViewport());
      if (meta.id) {
        await api.update(meta.id, { name: meta.name, description: meta.description, data: doc });
        setMeta({ saved: true, saving: false });
      } else {
        const created = await api.create({ name: meta.name, description: meta.description, data: doc });
        setMeta({ id: created.id, saved: true, saving: false });
      }
      return true;
    } catch (e) {
      setMeta({ saving: false });
      toast.error(t("topbar.saveFail"), describeError(e));
      return false;
    }
  }, [getViewport, setMeta, t]);

  /** Returns true when it is safe to leave the current document. */
  const confirmLeave = useCallback(async (): Promise<boolean> => {
    const { meta, nodes, edges } = useEditor.getState();
    if (meta.saved) return true;
    if (nodes.length === 0 && edges.length === 0) {
      clearDraft();
      return true;
    }
    const ok = await confirmDialog({
      title: t("docs.unsavedSwitch"),
      confirmText: t("topbar.save"),
    });
    if (!ok) return false;
    const saved = await saveCurrent();
    if (saved) void useDocuments.getState().refresh();
    return saved;
  }, [saveCurrent, t]);

  const openDiagram = useCallback(
    async (id: string): Promise<boolean> => {
      if (useEditor.getState().meta.id === id) return true;
      if (!(await confirmLeave())) return false;
      try {
        const rec = await api.get(id);
        applyRecord(rec);
        return true;
      } catch (e) {
        toast.error(t("open.openFail"), describeError(e));
        return false;
      }
    },
    [applyRecord, confirmLeave, t]
  );

  const createDiagram = useCallback(async (): Promise<boolean> => {
    if (!(await confirmLeave())) return false;
    try {
      const doc = serializeDoc([], [], t("topbar.untitled"), "", getViewport());
      const rec = await api.create({ name: t("topbar.untitled"), description: "", data: doc });
      applyRecord(rec);
      await useDocuments.getState().refresh();
      return true;
    } catch (e) {
      toast.error(t("docs.createFail"), describeError(e));
      return false;
    }
  }, [confirmLeave, applyRecord, getViewport, t]);

  const duplicateDiagram = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      try {
        await useDocuments.getState().duplicate(id, name);
        toast.success(t("docs.duplicated"), name);
        return true;
      } catch (e) {
        toast.error(t("docs.duplicateFail"), describeError(e));
        return false;
      }
    },
    [t]
  );

  const deleteDiagram = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const ok = await confirmDialog({
        title: t("docs.confirmDelete", { name }),
        destructive: true,
      });
      if (!ok) return false;
      try {
        await useDocuments.getState().remove(id);
        // Deleting the open diagram leaves a fresh, unsaved draft.
        if (useEditor.getState().meta.id === id) {
          loadDoc([], []);
          setMeta({
            id: null,
            name: t("topbar.untitled"),
            description: "",
            saved: true,
            saving: false,
            shareToken: "",
          });
          clearDraft();
          setDiagramIdInUrl(null);
        }
        toast.info(t("open.deleted"), name);
        return true;
      } catch (e) {
        toast.error(t("open.deleteFail"), describeError(e));
        return false;
      }
    },
    [loadDoc, setMeta, t]
  );

  const renameDiagram = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      if (useEditor.getState().meta.id === id) {
        // The open document auto-saves the new name.
        setMeta({ name, saved: false });
        return true;
      }
      try {
        await useDocuments.getState().rename(id, name);
        return true;
      } catch (e) {
        toast.error(t("docs.renameFail"), describeError(e));
        return false;
      }
    },
    [setMeta, t]
  );

  return { openDiagram, createDiagram, duplicateDiagram, deleteDiagram, renameDiagram, saveCurrent };
}
