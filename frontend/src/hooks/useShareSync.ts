import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import { api } from "@/lib/api";

/**
 * Loads the share state (token) of the open document into `meta.shareToken` so
 * the editor knows whether a share is active. The share link serves the
 * *published* version, so images are regenerated on publish (see ShareDialog).
 */
export function useShareSync() {
  const metaId = useEditor((s) => s.meta.id);
  const editToken = useEditor((s) => s.meta.editToken);
  const setMeta = useEditor((s) => s.setMeta);

  useEffect(() => {
    // Shared editable sessions have no auth, so skip the protected share lookup.
    if (editToken) return;
    if (!metaId) {
      setMeta({ shareToken: "" });
      return;
    }
    let alive = true;
    api
      .getShare(metaId)
      .then((s) => {
        if (alive) setMeta({ shareToken: s.enabled ? s.token : "" });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [metaId, editToken, setMeta]);
}
