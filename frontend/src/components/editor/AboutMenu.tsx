import { useCallback, useEffect, useState } from "react";
import { Github, Info, KeyRound, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getToken, setToken } from "@/lib/api";
import { toast } from "@/lib/toast";

interface VersionInfo {
  version: string;
  commit: string;
  date: string;
}

export function AboutMenu() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [token, setTokenState] = useState(getToken());

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
        toast.error("检查更新失败", data.error);
      } else if (data.updateAvailable) {
        toast.info(`发现新版本 ${data.latest}`, "运行 diagram update 或重新执行安装脚本进行更新");
        window.open(data.url, "_blank");
      } else {
        toast.success("已是最新版本", data.current);
      }
    } catch (e) {
      toast.error("检查更新失败", String(e));
    } finally {
      setChecking(false);
    }
  }, []);

  const saveToken = useCallback(() => {
    setToken(token.trim());
    toast.success(token.trim() ? "已保存访问令牌" : "已清除访问令牌");
  }, [token]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Info className="h-4 w-4" /> 关于 Diagram
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          <div>版本：{info?.version ?? "…"}</div>
          <div>提交：{info?.commit ?? "…"}</div>
          <div>构建：{info?.date ? new Date(info.date).toLocaleDateString() : "…"}</div>
        </div>
        <DropdownMenuSeparator />

        <div className="space-y-1.5 px-2 py-2" onPointerDown={(e) => e.stopPropagation()}>
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> 访问令牌（服务端启用鉴权时填写）
          </Label>
          <div className="flex gap-1.5">
            <Input
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") saveToken();
              }}
              placeholder="DIAGRAM_TOKEN"
              className="h-8 text-xs"
              type="password"
            />
            <Button size="sm" className="h-8" onClick={saveToken}>
              保存
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={checkUpdate} disabled={checking}>
          <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> 检查更新
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("https://github.com/dolphinZzv/diagram", "_blank")}>
          <Github className="h-4 w-4" /> GitHub 仓库
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
