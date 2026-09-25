import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";

/** Paste an image from the system clipboard to create an image node. */
export function useClipboardPaste() {
  const { screenToFlowPosition } = useReactFlow();
  const t = useT();

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result);
          const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
          const rect = pane?.getBoundingClientRect();
          const pos = screenToFlowPosition({
            x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
            y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
          });
          useEditor.getState().addImageNode(url, { x: pos.x - 110, y: pos.y - 75 });
          toast.success(t("command.imagePasted"));
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        return;
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [screenToFlowPosition, t]);
}
