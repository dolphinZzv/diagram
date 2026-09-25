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
  const setMeta = useEditor((s) => s.setMeta);

  useEffect(() => {
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
  }, [metaId, setMeta]);
}
