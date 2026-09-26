import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Toaster() {
  const t = useT();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t2) => {
        const Icon = t2.variant === "success" ? CheckCircle2 : t2.variant === "error" ? XCircle : Info;
        return (
          <div
            key={t2.id}
            role={t2.variant === "error" ? "alert" : "status"}
            aria-atomic="true"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-background p-3 shadow-lg animate-in slide-in-from-bottom-2",
              t2.variant === "error" && "border-destructive/40",
              t2.variant === "success" && "border-green-500/40"
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                t2.variant === "success" && "text-green-600",
                t2.variant === "error" && "text-destructive",
                t2.variant === "default" && "text-primary"
              )}
            />
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{t2.title}</p>
              {t2.description ? <p className="text-xs text-muted-foreground">{t2.description}</p> : null}
            </div>
            <button
              onClick={() => dismiss(t2.id)}
              aria-label={t("toast.dismiss")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
