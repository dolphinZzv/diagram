import { ChevronRight, CornerUpLeft } from "lucide-react";
import { useUi } from "@/lib/ui";
import { useEditor } from "@/lib/store";
import { useSubgraphNav } from "@/hooks/useSubgraphNav";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Breadcrumb shown while editing a nested document (subgraph). */
export function SubgraphBreadcrumb() {
  const t = useT();
  const path = useUi((s) => s.subgraphPath);
  const { back } = useSubgraphNav();
  const meta = useEditor((s) => s.meta);

  if (path.length === 0) return null;
  const chain = [...path, { id: meta.id ?? "", name: meta.name }];

  return (
    <div className="no-scrollbar flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/30 px-2 text-xs">
      <button
        type="button"
        onClick={() => void back(path.length - 1)}
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors hover:bg-accent"
      >
        <CornerUpLeft className="h-3.5 w-3.5" /> {t("subgraph.back")}
      </button>
      <span className="mx-1 h-4 w-px shrink-0 bg-border" />
      {chain.map((seg, i) => {
        const current = i === chain.length - 1;
        return (
          <div key={`${seg.id}-${i}`} className="flex shrink-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : null}
            <button
              type="button"
              disabled={current}
              onClick={() => !current && void back(i)}
              className={cn(
                "max-w-[180px] truncate rounded-md px-2 py-1 transition-colors",
                current ? "font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {seg.name || t("topbar.untitled")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
