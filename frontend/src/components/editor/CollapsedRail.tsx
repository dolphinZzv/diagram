import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Thin vertical strip shown in place of a collapsed side panel. Clicking it
 * expands the panel again, so collapsed panels stay discoverable.
 */
export function CollapsedRail({
  side,
  label,
  onExpand,
}: {
  side: "left" | "right";
  label: string;
  onExpand: () => void;
}) {
  const t = useT();
  const Chevron = side === "left" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`${t("panel.expand")} · ${label}`}
      title={`${t("panel.expand")} · ${label}`}
      className={`hidden shrink-0 flex-col items-center gap-3 bg-background py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex ${
        side === "left" ? "border-r" : "border-l"
      }`}
    >
      <Chevron className="h-4 w-4" />
      <span className="text-[11px] leading-none" style={{ writingMode: "vertical-rl" }}>
        {label}
      </span>
    </button>
  );
}
