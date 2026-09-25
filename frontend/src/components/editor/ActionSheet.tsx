import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CtxItem } from "./ContextMenu";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  items: (CtxItem | "separator")[];
}

/** Touch-friendly long-press menu shown as a bottom sheet. */
export function ActionSheet({ open, onOpenChange, title, items }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="gap-0 rounded-t-2xl p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="px-2 pb-2 pt-2 text-center text-sm font-semibold">{title}</div>
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {items.map((it, i) =>
            it === "separator" ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={it.label + i}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  it.onClick();
                  onOpenChange(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition-colors active:bg-accent disabled:pointer-events-none disabled:opacity-50",
                  it.danger && "text-destructive"
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.shortcut ? (
                  <span className="font-mono text-[10px] text-muted-foreground">{it.shortcut}</span>
                ) : null}
              </button>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
