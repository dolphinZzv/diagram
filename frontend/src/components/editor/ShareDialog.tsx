import { useCallback, useEffect, useState } from "react";
import { Check, Copy, FileImage, Image as ImageIcon, Link2, Loader2, RefreshCw, Share2, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api, type ShareState } from "@/lib/api";
import { useEditor } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { renderSvg, svgToPngBlob } from "@/lib/exporter";
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

function CopyRow({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(t("share.linkCopied"));
    } else {
      toast.error(t("share.copyFail"), t("share.copyFailDesc"));
    }
  }, [value, t]);

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <Input value={value} readOnly className="h-8 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
      <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function ShareDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const theme = useTheme((s) => s.theme);
  const metaId = useEditor((s) => s.meta.id);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);

  const [share, setShare] = useState<ShareState>({ enabled: false, token: "" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [images, setImages] = useState({ svg: false, png: false });

  const refresh = useCallback(async () => {
    if (!metaId) {
      setShare({ enabled: false, token: "" });
      return;
    }
    setLoading(true);
    try {
      const s = await api.getShare(metaId);
      setShare(s);
      if (s.token) {
        const check = async (format: "svg" | "png") => {
          try {
            const res = await fetch(`/api/share/${s.token}.${format}`, { method: "HEAD" });
            return res.ok;
          } catch {
            return false;
          }
        };
        const [svg, png] = await Promise.all([check("svg"), check("png")]);
        setImages({ svg, png });
      }
    } catch {
      setShare({ enabled: false, token: "" });
    } finally {
      setLoading(false);
    }
  }, [metaId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const url = share.token ? `${window.location.origin}${window.location.pathname}?share=${share.token}` : "";
  const svgUrl = share.token ? `${window.location.origin}/api/share/${share.token}.svg` : "";
  const pngUrl = share.token ? `${window.location.origin}/api/share/${share.token}.png` : "";

  const onEnable = useCallback(async () => {
    if (!metaId) return;
    setBusy(true);
    try {
      setShare(await api.enableShare(metaId));
      toast.success(t("share.enabledToast"), t("share.enabledDesc"));
    } catch (e) {
      toast.error(t("share.enableFail"), String(e));
    } finally {
      setBusy(false);
    }
  }, [metaId, t]);

  const onDisable = useCallback(async () => {
    if (!metaId) return;
    if (!confirm(t("share.confirmDisable"))) return;
    setBusy(true);
    try {
      setShare(await api.disableShare(metaId));
      setImages({ svg: false, png: false });
      toast.info(t("share.disabledToast"));
    } catch (e) {
      toast.error(t("share.disableFail"), String(e));
    } finally {
      setBusy(false);
    }
  }, [metaId, t]);

  const onGenerateImages = useCallback(async () => {
    if (!metaId || !share.token) return;
    setGenBusy(true);
    try {
      const svg = renderSvg(nodes, edges, theme);
      await api.uploadShareImage(
        metaId,
        "svg",
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      );
      const png = await svgToPngBlob(svg, 2);
      await api.uploadShareImage(metaId, "png", png);
      setImages({ svg: true, png: true });
      toast.success(t("share.imageGenerated"));
    } catch (e) {
      toast.error(t("share.imageFail"), String(e));
    } finally {
      setGenBusy(false);
    }
  }, [metaId, share.token, nodes, edges, theme, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> {t("share.title")}
          </DialogTitle>
          <DialogDescription>{t("share.desc")}</DialogDescription>
        </DialogHeader>

        {!metaId ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Share2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t("share.needSave")}</p>
          </div>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("share.loading")}
          </div>
        ) : share.enabled ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> {t("share.link")}
              </div>
              <CopyRow label="" value={url} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onEnable} disabled={busy}>
                  <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> {t("share.regen")}
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={onDisable} disabled={busy}>
                  <ShieldOff className="h-4 w-4" /> {t("share.disable")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(url, "_blank")}>
                  {t("share.preview")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("share.hint")}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("share.imageSection")}</div>
              <p className="text-[11px] text-muted-foreground">{t("share.imageHint")}</p>
              <Button size="sm" onClick={onGenerateImages} disabled={genBusy || nodes.length === 0}>
                {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {t("share.publishImage")}
              </Button>
              {(!images.svg && !images.png) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("share.imageNotReady")}</p>
              )}
              {images.svg && (
                <div className="flex items-center gap-2">
                  <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                  <CopyRow label={t("share.imageSvg")} value={svgUrl} />
                </div>
              )}
              {images.png && (
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <CopyRow label={t("share.imagePng")} value={pngUrl} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("share.notEnabled")}</p>
            <Button onClick={onEnable} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} {t("share.enable")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
