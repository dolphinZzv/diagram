import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";

function nodeBoxSize(n: { style?: unknown; data?: unknown }) {
  const style = n.style as { width?: number; height?: number } | undefined;
  const data = n.data as { width?: number; height?: number } | undefined;
  return { w: style?.width ?? data?.width ?? 120, h: style?.height ?? data?.height ?? 60 };
}

/** Bottom control bar for presentation (walk-through) mode. */
export function PresentationBar() {
  const t = useT();
  const presentation = useUi((s) => s.presentation);
  const stop = useUi((s) => s.stopPresentation);
  const next = useUi((s) => s.presentationNext);
  const prev = useUi((s) => s.presentationPrev);
  const { setCenter } = useReactFlow();

  if (!presentation.active) return null;

  const focus = (id: string | undefined) => {
    if (!id) return;
    const node = useEditor.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeBoxSize(node);
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.3, duration: 400 });
  };

  const total = presentation.order.length;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={t("present.prev")}
          onClick={() => {
            prev();
            focus(presentation.order[Math.max(presentation.index - 1, 0)]);
          }}
          disabled={presentation.index === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-16 text-center text-xs text-muted-foreground">
          {presentation.index + 1} / {total}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={t("present.next")}
          onClick={() => {
            next();
            focus(presentation.order[Math.min(presentation.index + 1, total - 1)]);
          }}
          disabled={presentation.index >= total - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={stop}>
          <X className="h-4 w-4" /> {t("present.exit")}
        </Button>
      </div>
    </div>
  );
}
