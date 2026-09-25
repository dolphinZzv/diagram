import type { Edge, Node } from "@xyflow/react";

const KEY = "diagram_draft_v1";

export interface Draft {
  id: string | null;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  saved: boolean;
  updatedAt: number;
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage disabled — drafts are best-effort.
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** A draft worth restoring: unsaved and with actual content. */
export function recoverableDraft(): Draft | null {
  const d = loadDraft();
  if (!d || d.saved) return null;
  const hasContent = (d.nodes?.length ?? 0) > 0 || (d.edges?.length ?? 0) > 0;
  return hasContent ? d : null;
}
