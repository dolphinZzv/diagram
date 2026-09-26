import { useEffect, useRef, useState } from "react";
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
import { useDialogStore } from "@/lib/dialog";
import { useT } from "@/lib/i18n";

/**
 * Renders the pending `confirmDialog` / `promptDialog` request. Mounted once at
 * the app root so every call site shares the same styled dialog.
 */
export function ConfirmDialog() {
  const t = useT();
  const pending = useDialogStore((s) => s.pending);
  const settle = useDialogStore((s) => s.settle);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending?.kind === "prompt") {
      setValue(pending.options.defaultValue ?? "");
      // Radix focuses on open; make sure the input ends up focused.
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => window.clearTimeout(id);
    }
  }, [pending]);

  if (!pending) return null;

  const { kind, options } = pending;
  const destructive = kind === "confirm" && options.destructive;
  const confirmText =
    options.confirmText ?? (destructive ? t("dialog.delete") : t("dialog.ok"));
  const cancelText = options.cancelText ?? t("dialog.cancel");

  const submit = () => {
    if (kind === "confirm") settle(true);
    else settle(value);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) settle(kind === "confirm" ? false : null);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description ? (
            <DialogDescription>{options.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {kind === "prompt" ? (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submit();
            }}
            placeholder={options.placeholder}
          />
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => settle(kind === "confirm" ? false : null)}
          >
            {cancelText}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
