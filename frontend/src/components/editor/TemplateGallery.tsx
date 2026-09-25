import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { LayoutTemplate } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { TEMPLATES } from "@/lib/templates";
import { diagramToSvg } from "@/lib/svgExport";
import { toast } from "@/lib/toast";

/** Gallery of all templates with rendered previews. */
export function TemplateGallery() {
  const t = useT();
  const open = useUi((s) => s.templateGalleryOpen);
  const setOpen = useUi((s) => s.setTemplateGalleryOpen);
  const theme = useTheme((s) => s.theme);
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const { fitView } = useReactFlow();

  const thumbs = useMemo(
    () =>
      TEMPLATES.map((tpl) => {
        const { nodes, edges } = tpl.build();
        let svg = "";
        try {
          svg = diagramToSvg(nodes, edges, { theme, padding: 16 });
        } catch {
          svg = "";
        }
        return { tpl, svg };
      }),
    [theme]
  );

  const apply = (id: string) => {
    const tpl = TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    const { nodes, edges } = tpl.build();
    loadDoc(nodes, edges);
    setMeta({
      id: null,
      name: t(`template.${tpl.id}.name`),
      description: t(`template.${tpl.id}.desc`),
      saved: false,
    });
    setOpen(false);
    setTimeout(() => fitView({ padding: 0.25 }), 40);
    toast.success(t("topbar.templateApplied"), t(`template.${tpl.id}.name`));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" /> {t("gallery.title")}
          </DialogTitle>
          <DialogDescription>{t("gallery.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {thumbs.map(({ tpl, svg }) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => apply(tpl.id)}
              className="group overflow-hidden rounded-lg border text-left transition-colors hover:border-primary"
            >
              <div
                className="flex h-28 items-center justify-center overflow-hidden bg-muted/30 p-1 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div className="border-t px-2 py-1.5">
                <div className="truncate text-xs font-medium">{t(`template.${tpl.id}.name`)}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {t(`template.${tpl.id}.desc`)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
