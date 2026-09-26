import { useState } from "react";
import { BookOpen, Bot, Check, Copy, Terminal, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { copyText } from "@/lib/clipboard";

const DOCS_URL = "https://github.com/dolphinZzv/diagram/blob/main/docs/mcp.md";

/** A monospace code block with a copy-to-clipboard button. */
function CopyBlock({ code, label }: { code: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      toast.success(t("mcp.copied"), label);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error(t("mcp.copyFail"), t("share.copyFailDesc"));
    }
  };

  return (
    <div className="overflow-hidden rounded-md border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-2 py-1">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {t("mcp.copy")}
        </Button>
      </div>
      <pre className="max-h-52 overflow-auto p-2.5 font-mono text-[11px] leading-relaxed">{code}</pre>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          {n}
        </span>
        {children}
      </div>
    </div>
  );
}

export function McpDialog() {
  const t = useT();
  const open = useUi((s) => s.mcpOpen);
  const setOpen = useUi((s) => s.setMcpOpen);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const endpoint = `${origin}/mcp`;

  const stdioConfig = JSON.stringify(
    { mcpServers: { diagram: { command: "diagram", args: ["mcp"] } } },
    null,
    2
  );
  const httpConfig = JSON.stringify(
    { mcpServers: { diagram: { type: "http", url: endpoint } } },
    null,
    2
  );
  const prompt = t("mcp.prompt");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> {t("mcp.title")}
          </DialogTitle>
          <DialogDescription>{t("mcp.desc")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="stdio" className="min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stdio">
              <Terminal className="mr-1.5 h-3.5 w-3.5" /> {t("mcp.tabStdio")}
            </TabsTrigger>
            <TabsTrigger value="http">
              <Wifi className="mr-1.5 h-3.5 w-3.5" /> {t("mcp.tabHttp")}
            </TabsTrigger>
          </TabsList>

          <div className="pr-1">
            <TabsContent value="stdio" className="space-y-4">
              <Step n={1}>{t("mcp.install")}</Step>
              <CopyBlock code="curl -fsSL https://raw.githubusercontent.com/dolphinZzv/diagram/main/install.sh | bash" label={t("mcp.installLabel")} />
              <p className="-mt-2 text-[11px] text-muted-foreground">{t("mcp.installHint")}</p>

              <Step n={2}>{t("mcp.stdioConfig")}</Step>
              <CopyBlock code={stdioConfig} label={t("mcp.claudeLabel")} />

              <Step n={3}>{t("mcp.stdioCursor")}</Step>
              <CopyBlock code={stdioConfig} label=".cursor/mcp.json" />
              <p className="-mt-2 text-[11px] text-muted-foreground">{t("mcp.stdioHint")}</p>
            </TabsContent>

            <TabsContent value="http" className="space-y-4">
              <Step n={1}>{t("mcp.httpStart")}</Step>
              <CopyBlock code="diagram" label={t("mcp.httpStartLabel")} />

              <Step n={2}>{t("mcp.httpEndpoint")}</Step>
              <CopyBlock code={endpoint} label={t("mcp.httpEndpointLabel")} />

              <Step n={3}>{t("mcp.httpConfig")}</Step>
              <CopyBlock code={httpConfig} label={t("mcp.httpConfigLabel")} />
              <p className="-mt-2 text-[11px] text-muted-foreground">{t("mcp.httpToken")}</p>
            </TabsContent>
          </div>
        </Tabs>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-medium">{t("mcp.toolsTitle")}</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("mcp.toolsList")}</p>
          <CopyBlock code={prompt} label={t("mcp.promptTitle")} />
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              <BookOpen className="h-4 w-4" /> {t("mcp.fullDocs")}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
