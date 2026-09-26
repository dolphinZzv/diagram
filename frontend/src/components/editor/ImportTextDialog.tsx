import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { FileCode2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { parseDiagramText } from "@/lib/mermaidImport";
import { layoutLayered } from "@/lib/layout";
import { toast } from "@/lib/toast";
import { describeError } from "@/lib/errors";

const SAMPLE = `flowchart TD
  A[开始] --> B{判断}
  B -->|是| C[处理]
  B -->|否| D[结束]
  C --> D`;

export function ImportTextDialog() {
  const t = useT();
  const open = useUi((s) => s.importOpen);
  const setOpen = useUi((s) => s.setImportOpen);
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const { fitView } = useReactFlow();

  const [text, setText] = useState(SAMPLE);

  const onImport = () => {
    try {
      const parsed = parseDiagramText(text);
      const { nodes, edges } = parsed;
      // Flowcharts from Mermaid may already be laid out.
      const laid = parsed.kind === "flowchart" ? layoutLayered(nodes, edges, "TB") : nodes;
      loadDoc(laid, edges);
      setMeta({ id: null, name: t("import.title"), description: "", saved: false });
      setOpen(false);
      setTimeout(() => fitView({ padding: 0.25 }), 40);
      toast.success(t("import.ok"), `${laid.length} nodes / ${edges.length} edges`);
    } catch (e) {
      toast.error(t("import.fail"), describeError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4" /> {t("import.title")}
          </DialogTitle>
          <DialogDescription>{t("import.desc")}</DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t("import.placeholder")}
          className="h-56 font-mono text-xs"
          spellCheck={false}
        />

        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("import.hint")}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("inspector.cancel")}
          </Button>
          <Button onClick={onImport}>{t("import.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
