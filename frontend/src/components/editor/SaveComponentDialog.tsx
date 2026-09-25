import { useEffect, useState } from "react";
import { PackagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { buildComponentFromSelection, categoriesOf, DEFAULT_CATEGORY, useComponents } from "@/lib/components";
import { toast } from "@/lib/toast";

const NEW = "__new__";

export function SaveComponentDialog() {
  const t = useT();
  const open = useUi((s) => s.saveComponentOpen);
  const setOpen = useUi((s) => s.setSaveComponentOpen);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selectedIds = useEditor((s) => s.selectedIds);
  const components = useComponents((s) => s.components);
  const addComponent = useComponents((s) => s.add);

  const cats = categoriesOf(components);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(cats[0] ?? DEFAULT_CATEGORY);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory(cats[0] ?? DEFAULT_CATEGORY);
    setNewCategory("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const effectiveCategory = category === NEW ? newCategory.trim() || DEFAULT_CATEGORY : category;

  const onSave = () => {
    const def = buildComponentFromSelection(nodes, edges, selectedIds, name, effectiveCategory);
    if (!def) {
      toast.error(t("comp.needSelection"));
      return;
    }
    addComponent(def);
    toast.success(t("comp.saved"), def.name);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4" /> {t("comp.saveTitle")}
          </DialogTitle>
          <DialogDescription>{t("comp.saveDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("comp.name")}</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onSave();
              }}
              placeholder={t("comp.namePlaceholder")}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("comp.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c} value={c} className="text-sm">
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value={NEW} className="text-sm">
                  {t("comp.newCategory")}
                </SelectItem>
              </SelectContent>
            </Select>
            {category === NEW ? (
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t("comp.newCategoryPlaceholder")}
                className="h-9 text-sm"
              />
            ) : null}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("comp.selectionHint", { n: selectedIds.length })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("inspector.cancel")}
          </Button>
          <Button onClick={onSave} disabled={selectedIds.length === 0}>
            {t("comp.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
