import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { parseDiagramFile } from "@/lib/doc";
import { parseDiagramText } from "@/lib/mermaidImport";
import { layoutLayered } from "@/lib/layout";
import { toast } from "@/lib/toast";
import { describeError } from "@/lib/errors";
import { tr } from "@/lib/i18n";

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i;
const TEXT_EXT = /\.(mmd|mermaid|puml|plantuml|txt|md)$/i;

interface FSAWindow {
  showOpenFilePicker?: (opts: unknown) => Promise<{ getFile: () => Promise<File> }[]>;
}

/**
 * Reads local files through the browser File API and renders them on the
 * canvas: `.json` diagrams, images (as image nodes) and Mermaid / PlantUML
 * text. Used by the toolbar "open local file" action and canvas drag-and-drop.
 */
export function useFileImport() {
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Dropping a file anywhere should never make the browser navigate to it.
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const paneCenter = useCallback(() => {
    const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
    });
  }, [screenToFlowPosition]);

  const importFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      if (!files.length) return;
      const anchor = at ?? paneCenter();
      let offset = 0;
      for (const file of files) {
        try {
          if (/\.json$/i.test(file.name) || file.type === "application/json") {
            const doc = parseDiagramFile(JSON.parse(await readText(file)));
            useEditor.getState().loadDoc(doc.nodes, doc.edges);
            useEditor.getState().setMeta({
              id: null,
              name: doc.name || file.name.replace(/\.json$/i, ""),
              description: doc.description || "",
              saved: false,
            });
            setTimeout(() => fitView({ padding: 0.3 }), 40);
            toast.success(tr("file.importedDiagram"), doc.name || file.name);
          } else if (file.type.startsWith("image/") || IMAGE_EXT.test(file.name)) {
            const url = await readDataURL(file);
            useEditor.getState().addImageNode(url, {
              x: anchor.x - 110 + offset,
              y: anchor.y - 75 + offset,
            });
            offset += 24;
            toast.success(tr("file.importedImage"), file.name);
          } else if (TEXT_EXT.test(file.name) || file.type.startsWith("text/")) {
            const text = await readText(file);
            const parsed = parseDiagramText(text);
            const nodes =
              parsed.kind === "flowchart" ? layoutLayered(parsed.nodes, parsed.edges, "TB") : parsed.nodes;
            useEditor.getState().loadDoc(nodes, parsed.edges);
            useEditor.getState().setMeta({
              id: null,
              name: file.name.replace(/\.[^.]+$/, ""),
              description: "",
              saved: false,
            });
            setTimeout(() => fitView({ padding: 0.25 }), 40);
            toast.success(tr("file.importedText"), file.name);
          } else {
            toast.error(tr("file.unsupported"), file.name);
          }
        } catch (e) {
          toast.error(tr("file.importFail"), describeError(e));
        }
      }
    },
    [paneCenter, fitView]
  );

  /** Opens the native file picker (File System Access API) when available.
   *  Returns false when the caller should fall back to an <input type=file>. */
  const openLocalFiles = useCallback(async (): Promise<boolean> => {
    const w = window as unknown as FSAWindow;
    if (typeof w.showOpenFilePicker !== "function") return false;
    try {
      const handles = await w.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "Diagram / image / text",
            accept: {
              "application/json": [".json"],
              "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"],
              "text/plain": [".mmd", ".mermaid", ".puml", ".plantuml", ".txt"],
            },
          },
        ],
      });
      const files = await Promise.all(handles.map((h) => h.getFile()));
      await importFiles(files);
      return true;
    } catch (e) {
      // User cancelled the picker: treat as handled, do not open a second dialog.
      if ((e as { name?: string } | null)?.name === "AbortError") return true;
      return false;
    }
  }, [importFiles]);

  return { importFiles, openLocalFiles };
}
