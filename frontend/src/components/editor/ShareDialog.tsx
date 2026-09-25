import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, Share2, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ShareState } from "@/lib/api";
import { useEditor } from "@/lib/store";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Clipboard API needs a secure context; fall back for plain-HTTP LAN use. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareDialog({ open, onOpenChange }: Props) {
  const metaId = useEditor((s) => s.meta.id);
  const [share, setShare] = useState<ShareState>({ enabled: false, token: "" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!metaId) {
      setShare({ enabled: false, token: "" });
      return;
    }
    setLoading(true);
    try {
      setShare(await api.getShare(metaId));
    } catch {
      setShare({ enabled: false, token: "" });
    } finally {
      setLoading(false);
    }
  }, [metaId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const url = share.token
    ? `${window.location.origin}${window.location.pathname}?share=${share.token}`
    : "";

  const onEnable = useCallback(async () => {
    if (!metaId) return;
    setBusy(true);
    try {
      setShare(await api.enableShare(metaId));
      toast.success("已开启分享", "任何人可通过链接只读查看");
    } catch (e) {
      toast.error("开启分享失败", String(e));
    } finally {
      setBusy(false);
    }
  }, [metaId]);

  const onDisable = useCallback(async () => {
    if (!metaId) return;
    if (!confirm("关闭分享后，原链接将立即失效，确定吗？")) return;
    setBusy(true);
    try {
      setShare(await api.disableShare(metaId));
      toast.info("已关闭分享");
    } catch (e) {
      toast.error("关闭分享失败", String(e));
    } finally {
      setBusy(false);
    }
  }, [metaId]);

  const onCopy = useCallback(async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("链接已复制");
    } else {
      toast.error("复制失败", "请手动选择链接复制");
    }
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> 分享（只读）
          </DialogTitle>
          <DialogDescription>
            生成一个只读链接，任何人打开后可以查看、缩放、导出，但无法编辑。
          </DialogDescription>
        </DialogHeader>

        {!metaId ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Share2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">请先保存图纸，之后即可生成分享链接</p>
          </div>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
          </div>
        ) : share.enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <Input value={url} readOnly className="h-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button size="sm" className="h-9 shrink-0" onClick={onCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onEnable} disabled={busy}>
                <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> 重新生成链接
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={onDisable} disabled={busy}>
                <ShieldOff className="h-4 w-4" /> 关闭分享
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.open(url, "_blank")}>
                预览
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              提示：重新生成会使旧链接立即失效；关闭分享会彻底禁用该链接。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">当前未开启分享。</p>
            <Button onClick={onEnable} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} 开启分享
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
