const ID_PARAM = "id";

/**
 * The currently open diagram is reflected in the URL as `?id=<uuid>` so it can
 * be bookmarked, shared and reloaded directly. Other params (e.g. `?v=` cache
 * busting, `?share=`) are preserved.
 */
export function readDiagramIdFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(ID_PARAM);
  } catch {
    return null;
  }
}

export function setDiagramIdInUrl(id: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(ID_PARAM, id);
    else url.searchParams.delete(ID_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore (e.g. file:// or restricted environments) */
  }
}
