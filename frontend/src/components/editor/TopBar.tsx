import { useCallback, useRef, useState } from "react";
import {
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Image,
  Redo2,
  Save,
  Undo2,
  Upload,
  Workflow,
  Trash2,
  FileImage,
  LayoutTemplate,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditor } from "@/lib/store";
import { exportImage, exportJSON, readJSONFile } from "@/lib/exporter";
import { parseDiagramFile, serializeDoc } from "@/lib/doc";
import { TEMPLATES } from "@/lib/templates";
import { useReactFlow } from "@xyflow/react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { OpenDialog } from "./OpenDialog";
import { VersionHistory } from "./VersionHistory";
import { AboutMenu } from "./AboutMenu";
import { useShortcuts } from "@/hooks/useShortcuts";
import { cn } from "@/lib/utils";

export function TopBar() {
  const meta = useEditor((s) => s.meta);
  const setMeta = useEditor((s) => s.setMeta);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const loadDoc = useEditor((s) => s.loadDoc);
  const clearAll = useEditor((s) => s.clearAll);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);

  const { getViewport, setViewport, fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [openOpen, setOpenOpen] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  const buildDoc = useCallback(
    () => serializeDoc(nodes, edges, meta.name, meta.description, getViewport()),
    [nodes, edges, meta.name, meta.description, getViewport]
  );

  const onSave = useCallback(
    async (forceNew = false) => {
      setMeta({ saving: true });
      try {
        const doc = buildDoc();
        if (meta.id && !forceNew) {
          await api.update(meta.id, { name: meta.name, description: meta.description, data: doc });
          setMeta({ saved: true, saving: false });
          toast.success("已保存", meta.name);
        } else {
          const created = await api.create({ name: meta.name, description: meta.description, data: doc });
          setMeta({ id: created.id, saved: true, saving: false });
          toast.success("已创建并保存", meta.name);
        }
      } catch (e) {
        setMeta({ saving: false });
        toast.error("保存失败", String(e));
      }
    },
    [buildDoc, meta.id, meta.name, meta.description, setMeta]
  );

  const onNew = useCallback(() => {
    if (!meta.saved && !confirm("当前图纸未保存，确定新建吗？")) return;
    loadDoc([], []);
    setMeta({ id: null, name: "未命名流程图", description: "", saved: true });
    setTimeout(() => fitView({ padding: 0.3 }), 30);
  }, [meta.saved, loadDoc, setMeta, fitView]);

  const onImport = useCallback(
    async (file: File) => {
      try {
        const raw = await readJSONFile(file);
        const doc = parseDiagramFile(raw);
        loadDoc(doc.nodes, doc.edges);
        setMeta({
          id: null,
          name: doc.name || file.name.replace(/\.json$/i, ""),
          description: doc.description || "",
          saved: false,
        });
        if (doc.viewport) setTimeout(() => setViewport(doc.viewport!), 30);
        else setTimeout(() => fitView({ padding: 0.3 }), 30);
        toast.success("导入成功", doc.name || file.name);
      } catch (e) {
        toast.error("导入失败", String(e));
      }
    },
    [loadDoc, setMeta, setViewport, fitView]
  );

  const onExportJSON = useCallback(() => {
    exportJSON(buildDoc(), meta.name || "diagram");
    toast.success("已导出 JSON");
  }, [buildDoc, meta.name]);

  const onExportImage = useCallback(
    async (format: "png" | "svg") => {
      try {
        await exportImage(nodes, format, meta.name || "diagram");
        toast.success(`已导出 ${format.toUpperCase()}`);
      } catch (e) {
        toast.error("导出失败", String(e));
      }
    },
    [nodes, meta.name]
  );

  useShortcuts(() => onSave(false));

  return (
    <header className="no-scrollbar flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b bg-background px-3 sm:gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Workflow className="h-4 w-4" />
        </div>
        <span className="hidden text-sm font-semibold sm:block">Diagram</span>
      </div>

      <div className="mx-2 h-6 w-px shrink-0 bg-border" />

      <Input
        value={meta.name}
        onChange={(e) => setMeta({ name: e.target.value, saved: false })}
        className="h-8 w-28 shrink-0 border-transparent bg-transparent text-sm font-medium hover:border-input focus-visible:border-input sm:w-44"
      />
      <span
        className={cn(
          "hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex",
          meta.saving && "opacity-60"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            meta.saved ? "bg-green-500" : "bg-amber-500"
          )}
        />
        {meta.saving ? "保存中…" : meta.saved ? "已保存" : "未保存"}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={past.length === 0} onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>撤销 (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={future.length === 0} onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>重做 (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button variant="ghost" size="sm" className="h-8" onClick={onNew}>
          <FilePlus2 className="h-4 w-4" /> <span className="hidden md:inline">新建</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpenOpen(true)}>
          <FolderOpen className="h-4 w-4" /> <span className="hidden md:inline">打开</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setOpenHistory(true)}
          title="版本历史"
        >
          <History className="h-4 w-4" /> <span className="hidden md:inline">历史</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <LayoutTemplate className="h-4 w-4" /> <span className="hidden md:inline">模板</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>从模板创建</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TEMPLATES.map((tpl) => (
              <DropdownMenuItem
                key={tpl.id}
                onClick={() => {
                  if (!meta.saved && !confirm("当前图纸未保存，确定使用模板替换吗？")) return;
                  const { nodes: tn, edges: te } = tpl.build();
                  loadDoc(tn, te);
                  setMeta({ id: null, name: tpl.name, description: tpl.description, saved: false });
                  setTimeout(() => fitView({ padding: 0.25 }), 40);
                  toast.success("已应用模板", tpl.name);
                }}
              >
                <div className="flex flex-col">
                  <span>{tpl.name}</span>
                  <span className="text-[11px] text-muted-foreground">{tpl.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => onSave(false)}>
          <Save className="h-4 w-4" /> <span className="hidden md:inline">保存</span>
        </Button>

        <Button variant="ghost" size="sm" className="h-8" onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" /> <span className="hidden md:inline">导入</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="h-4 w-4" /> <span className="hidden md:inline">导出</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>导出格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportJSON}>
              <FileJson className="h-4 w-4" /> 导出 JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportImage("png")}>
              <FileImage className="h-4 w-4" /> 导出 PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportImage("svg")}>
              <Image className="h-4 w-4" /> 导出 SVG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm("确定清空画布吗？")) {
                  clearAll();
                  toast.info("已清空画布");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>清空画布</TooltipContent>
        </Tooltip>

        <AboutMenu />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = "";
        }}
      />

      <OpenDialog open={openOpen} onOpenChange={setOpenOpen} />
      <VersionHistory open={openHistory} onOpenChange={setOpenHistory} />
    </header>
  );
}
