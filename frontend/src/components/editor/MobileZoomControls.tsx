import { Maximize, Minus, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useT } from "@/lib/i18n";
import { useIsCompactLayout } from "@/lib/ui";

/**
 * Large, thumb-friendly zoom controls shown on phones / tablets, where the
 * default React Flow buttons (26px) are too small to tap reliably and pinch
 * zoom alone is fiddly.
 */
export function MobileZoomControls() {
  const t = useT();
  const compact = useIsCompactLayout();
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();

  if (!compact) return null;

  const pct = Math.round(zoom * 100);
  const primary =
    "flex h-12 w-12 items-center justify-center text-foreground transition-colors active:bg-accent";

  return (
    <div
      className="fixed right-3 bottom-[6rem] z-30 flex flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-lg backdrop-blur"
      role="group"
      aria-label={t("zoom.group")}
    >
      <button
        type="button"
        aria-label={t("zoom.in")}
        className={primary}
        onClick={() => zoomIn({ duration: 150 })}
      >
        <Plus className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={t("zoom.reset")}
        title={t("zoom.reset")}
        className="flex h-9 w-12 items-center justify-center border-y text-[11px] font-medium tabular-nums text-muted-foreground transition-colors active:bg-accent"
        onClick={() => zoomTo(1, { duration: 200 })}
      >
        {pct}%
      </button>
      <button
        type="button"
        aria-label={t("zoom.out")}
        className={primary}
        onClick={() => zoomOut({ duration: 150 })}
      >
        <Minus className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={t("ctx.fitView")}
        title={t("ctx.fitView")}
        className="flex h-12 w-12 items-center justify-center border-t transition-colors active:bg-accent"
        onClick={() => fitView({ padding: 0.25, duration: 250 })}
      >
        <Maximize className="h-5 w-5" />
      </button>
    </div>
  );
}
