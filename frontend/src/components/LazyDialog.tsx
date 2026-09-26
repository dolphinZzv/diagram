import { Suspense, useEffect, useState, type ReactNode } from "react";

/**
 * Defers mounting `children` until `open` first becomes true, and suspends
 * while the (lazy) child chunk loads. Keeps optional dialogs and their heavy
 * dependencies out of the initial bundle without changing call sites much.
 */
export function LazyDialog({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}
