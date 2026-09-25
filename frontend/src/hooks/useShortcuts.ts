import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";

export function useShortcuts(onSave: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const state = useEditor.getState();

      if (mod && key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      // While typing, let the browser handle everything else.
      if (editing) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        state.redo();
        return;
      }
      if (mod && key === "c") {
        e.preventDefault();
        state.copySelected();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        state.paste();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        state.duplicateSelected();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        state.selectAll();
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) state.ungroupSelected();
        else state.groupSelected();
        return;
      }
      if (mod && key === "l") {
        e.preventDefault();
        const anyLocked = state.nodes.some(
          (n) => state.selectedIds.includes(n.id) && (n.data as { locked?: boolean }).locked
        );
        state.lockSelected(!anyLocked);
        return;
      }
      if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        const forward = e.key === "]";
        if (e.shiftKey) {
          if (forward) state.bringToFront();
          else state.sendToBack();
        } else {
          if (forward) state.bringForward();
          else state.sendBackward();
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        useUi.getState().setShortcutsOpen(true);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedIds.length > 0) {
          e.preventDefault();
          state.removeSelected();
        }
        return;
      }
      if (e.key === "Escape") state.setSelection([]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);
}
