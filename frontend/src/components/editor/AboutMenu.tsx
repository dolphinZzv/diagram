import { useCallback, useEffect, useState } from "react";
import { Github, Info, KeyRound, Languages, Moon, RefreshCw, Settings, Sun, Keyboard, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getToken, setToken } from "@/lib/api";
import { useI18n, useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/lib/ui";
import { toast } from "@/lib/toast";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { isAutoSaveEnabled, setAutoSaveEnabled } from "@/hooks/useAutoSave";
import { setAgentEnabled, useAgentEnabled } from "@/lib/webmcp";

interface VersionInfo {
  version: string;
  commit: string;
  date: string;
}

export function AboutMenu() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const setMcpOpen = useUi((s) => s.setMcpOpen);

  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [token, setTokenState] = useState(getToken());
  const [autoSave, setAutoSave] = useState(isAutoSaveEnabled());
  const sketch = useUi((s) => s.sketch);
  const toggleSketch = useUi((s) => s.toggleSketch);
  const agentEnabled = useAgentEnabled();

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => void 0);
  }, []);

  const checkUpdate = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/update-check");
      const data = (await res.json()) as {
        current: string;
        latest: string;
        updateAvailable: boolean;
        url: string;
        error?: string;
      };
      if (data.error) {
        toast.error(t("about.checkFail"), data.error);
      } else if (data.updateAvailable) {
        toast.info(t("about.updateAvailable", { v: data.latest }), t("about.updateHint"));
        window.open(data.url, "_blank");
      } else {
        toast.success(t("about.upToDate"), data.current);
      }
    } catch (e) {
      toast.error(t("about.checkFail"), describeError(e));
    } finally {
      setChecking(false);
    }
  }, [t]);

  const saveToken = useCallback(() => {
    setToken(token.trim());
    toast.success(token.trim() ? t("about.tokenSaved") : t("about.tokenCleared"));
  }, [token, t]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("about.title")}>
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Info className="h-4 w-4" /> {t("about.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          <div>
            {t("about.version")}: {info?.version ?? "…"}
          </div>
          <div>
            {t("about.commit")}: {info?.commit ?? "…"}
          </div>
          <div>
            {t("about.build")}: {info?.date ? new Date(info.date).toLocaleDateString() : "…"}
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="space-y-2 px-2 py-2" onPointerDown={(e) => e.stopPropagation()}>
          <Label className="text-xs text-muted-foreground">{t("about.theme")}</Label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              className="h-8"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-3.5 w-3.5" /> {t("about.light")}
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              className="h-8"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-3.5 w-3.5" /> {t("about.dark")}
            </Button>
          </div>

          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Languages className="h-3.5 w-3.5" /> {t("about.language")}
          </Label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant={lang === "zh" ? "default" : "outline"}
              className="h-8"
              onClick={() => setLang("zh")}
            >
              中文
            </Button>
            <Button
              size="sm"
              variant={lang === "en" ? "default" : "outline"}
              className="h-8"
              onClick={() => setLang("en")}
            >
              English
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="space-y-1.5 px-2 py-2" onPointerDown={(e) => e.stopPropagation()}>
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> {t("about.token")}
          </Label>
          <div className="flex gap-1.5">
            <Input
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") saveToken();
              }}
              placeholder={t("about.tokenPlaceholder")}
              className="h-8 text-xs"
              type="password"
            />
            <Button size="sm" className="h-8" onClick={saveToken}>
              {t("about.save")}
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div
          className="flex items-center justify-between px-2 py-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Label className="text-xs text-muted-foreground">{t("about.autoSave")}</Label>
          <Switch
            checked={autoSave}
            onCheckedChange={(v) => {
              setAutoSave(v);
              setAutoSaveEnabled(v);
            }}
          />
        </div>

        <div
          className="flex items-center justify-between px-2 py-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Label className="text-xs text-muted-foreground">{t("command.sketch")}</Label>
          <Switch checked={sketch} onCheckedChange={() => toggleSketch()} />
        </div>

        <div
          className="flex items-center justify-between gap-2 px-2 py-2"
          onPointerDown={(e) => e.stopPropagation()}
          title={t("about.agentHint")}
        >
          <Label className="text-xs text-muted-foreground">{t("about.agent")}</Label>
          <Switch checked={agentEnabled} onCheckedChange={(v) => setAgentEnabled(v)} />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setMcpOpen(true)}>
          <Bot className="h-4 w-4" /> {t("mcp.menu")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
          <Keyboard className="h-4 w-4" /> {t("shortcuts.menu")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={checkUpdate} disabled={checking}>
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} /> {t("about.checkUpdate")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("https://github.com/dolphinZzv/diagram", "_blank")}>
          <Github className="h-4 w-4" /> {t("about.github")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
