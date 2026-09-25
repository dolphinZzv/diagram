import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import type { LineStyle, ShapeNodeData } from "@/lib/types";

/** Composer for a sequence-diagram message (choose source → target). */
export function SequenceMessageDialog() {
  const t = useT();
  const open = useUi((s) => s.messageDialog.open);
  const initialSource = useUi((s) => s.messageDialog.sourceId);
  const close = useUi((s) => s.closeMessageDialog);
  const nodes = useEditor((s) => s.nodes);
  const addMessage = useEditor((s) => s.addMessage);

  const lifelines = useMemo(
    () => nodes.filter((n) => n.type === "lifeline").sort((a, b) => a.position.x - b.position.x),
    [nodes]
  );

  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [lineStyle, setLineStyle] = useState<LineStyle>("solid");

  useEffect(() => {
    if (!open) return;
    const ids = lifelines.map((l) => l.id);
    const src = initialSource && ids.includes(initialSource) ? initialSource : (ids[0] ?? "");
    const idx = ids.indexOf(src);
    const tgt = ids[idx + 1] ?? ids.find((id) => id !== src) ?? "";
    setSource(src);
    setTarget(tgt);
    setLabel("");
    setLineStyle("solid");
  }, [open, initialSource, lifelines]);

  const labelOf = (id: string) =>
    ((lifelines.find((l) => l.id === id)?.data as ShapeNodeData | undefined)?.label || id) as string;

  const confirm = () => {
    if (!source || !target || source === target) return;
    addMessage(source, target, label.trim() || undefined, lineStyle);
    toast.success(t("seq.added"), `${labelOf(source)} → ${labelOf(target)}`);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("seq.messageTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("seq.source")}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lifelines.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-sm">
                    {labelOf(l.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-center text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("seq.target")}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lifelines
                  .filter((l) => l.id !== source)
                  .map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-sm">
                      {labelOf(l.id)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("inspector.label")}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") confirm();
              }}
              placeholder={t("seq.message")}
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("inspector.lineStyle")}</Label>
            <Tabs value={lineStyle} onValueChange={(v) => setLineStyle(v as LineStyle)}>
              <TabsList className="grid h-9 w-full grid-cols-3">
                <TabsTrigger value="solid" className="text-xs">
                  {t("inspector.solid")}
                </TabsTrigger>
                <TabsTrigger value="dashed" className="text-xs">
                  {t("inspector.dashed")}
                </TabsTrigger>
                <TabsTrigger value="dotted" className="text-xs">
                  {t("inspector.dotted")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("inspector.cancel")}
          </Button>
          <Button onClick={confirm} disabled={!source || !target || source === target}>
            {t("seq.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
