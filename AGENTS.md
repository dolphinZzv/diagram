# AGENTS.md

本文件写给在本仓库里**改代码**的编码 agent：常用命令、约定、坑与发布流程。
（若你要的是「怎么**使用**这个图工具画图」，看根目录 [`skills.md`](./skills.md)。）

## 项目结构

- **后端**：Go（标准库 + 纯 Go SQLite，无 CGO），前端构建产物通过 `//go:embed` 嵌入，最终是单个可执行文件。
- **前端**：React + TypeScript + TailwindCSS + shadcn/ui + React Flow（`@xyflow/react`），zustand 管理状态。
- 数据：SQLite，包含图纸、版本、组件、分享/编辑 token、分享图片等。

```
backend/            # Go 后端
  main.go           # 入口 / CLI / 路由 / 环境变量
  api.go            # 图纸 CRUD
  store.go          # schema + 迁移 + 查询
  share.go edit.go  # 只读分享 / 可编辑分享
  publish.go        # 草稿/发布
  ws.go             # 实时协作房间（WebSocket）
  mcp.go            # MCP server（stdio + HTTP）
  spa.go            # 内嵌前端、SPA 回退、缓存头
  dist/             # 构建时嵌入的前端产物（除 index.html 外均 gitignore）
frontend/src/
  App.tsx           # 布局 + 路由(?share / ?edit / ?id)
  components/editor/# Canvas / TopBar / Inspector / ShapeNode / CustomEdge / DocumentsPanel …
  components/ui/    # shadcn/ui 基础组件
  lib/              # store / api / i18n / doc / exporter / syncQueue / peers …
  hooks/            # useRealtime / useAutoSave / useDraft / useDiagramActions …
docs/mcp.md         # MCP 使用文档（面向使用方）
skills.md           # agent「怎么用这个工具」的操作指南
```

## 常用命令

```bash
make dev                  # 后端 :8080 + 前端 :5173（热更新）
make build                # 构建单文件 bin/diagram（会先构建前端并拷入 backend/dist）
make web / make backend   # 分别只构建前端 / 后端
make run

# 提交前必须全绿：
cd frontend && npx tsc --noEmit          # 类型检查（tsconfig 开了 noUnusedLocals/noUnusedParameters）
cd frontend && npm run test              # vitest（源码旁 *.test.ts(x)）
cd backend  && go test ./...             # Go 测试
```

本地验证 UI 改动：`make build && ./bin/diagram`，然后浏览器开 `http://localhost:8080`。

## 硬性约定

- **i18n**：任何用户可见文案都要在 `frontend/src/lib/i18n.ts` 的 `zh` 和 `en` 两个字典里同时加。禁止硬编码中文/英文。
- **弹窗**：禁止 `window.confirm` / `window.prompt`，用 `frontend/src/lib/dialog.ts` 的 `confirmDialog` / `promptDialog`。
- **图标按钮**：加 `aria-label`（`Button` 组件在无显式 label 时会用 `title` 兜底）；纯图标按钮必须有可访问名。
- **新增节点/连线默认值**：改 `frontend/src/lib/types.ts` 的 `defaultNodeData` / `defaultEdgeData`。
- **测试**：新逻辑尽量补测试，与源码同目录（`*.test.ts(x)`）。前端用 vitest + jsdom（`src/test/setup.ts` 已 mock `matchMedia`/`ResizeObserver`/`localStorage`）。
- **不要提交**：`diagram.log`、`bin/`、`frontend/dist/`、`/tmp` 相关内容。`backend/dist/index.html` 是跟踪的，`make backend` 会更新它。

## 容易踩的坑（重要）

- **React Flow 连接模式**：`<ReactFlow>` 必须 `connectionMode={ConnectionMode.Loose}`。节点只有 `source` 手柄，用 Strict 模式会**整条边不渲染**。
- **只读视图隐藏手柄**：用 `opacity: 0` + `pointer-events: none`，**不要用 `display: none`** —— React Flow 需要量到手柄几何来算连线路径，`display:none` 会让连线退化成点（只有图形没有线）。
- **`NodeResizer` 的回调要稳定**：`onResizeEnd` 必须 `useCallback`，否则每次渲染都会销毁并重建 resizer；移动端触摸缩放的 `touchmove` 是绑在手柄元素上的，一销毁就「动一下就停」。
- **定时器**：`setTimeout` 里做 `fitView`/`setViewport` 之类会触发 React 更新的操作，要在组件卸载时清理，否则测试会报未处理的 `window is not defined`。
- **Service Worker 缓存**：改完前端后若页面异常，用带参数地址绕过缓存（`/?v=<n>`）或清站点数据。`spa.go` 对缺失静态资源返回 404，不会回退成 HTML。
- **`noUnusedLocals` 开启**：删代码时记得删无用的 import/变量，否则 `tsc` 失败（构建会挂）。
- **鉴权边界**：`/api/diagrams*`、`/api/components*`、`/mcp` 需要 `DIAGRAM_TOKEN`；`/api/share/*`、`/api/edit/*`、`/api/ws` 是公开的（分别用 share token / edit token 鉴权）。
- **图纸 id 是 UUID**；节点/连线/分组 id 前缀约定 `n_` / `e_` / `g_` / `l_`。

## 前端数据流（改之前先看）

- `lib/store.ts`（zustand）是编辑器唯一状态源：`nodes` / `edges` / `meta` / `selectedIds` / 撤销重做。`meta` 里有 `id`、`saved`、`editToken`、`realtime` 等标志。
- `lib/api.ts` 汇总所有 HTTP 调用；错误用 `ApiError` + `lib/errors.ts` 的 `describeError` 友好化。
- 实时协作：`lib/syncQueue.ts` 存待发 ops；`hooks/useRealtime.ts` 负责 diff、发送、应用远端、断线重连与补发。
- 保存路径：普通文档走 `PUT /api/diagrams/{id}`（`?id=`）；可编辑分享走 `PUT /api/edit/{token}`（`?edit=`）；实时房间由服务端落库（`meta.realtime` 时关闭客户端自动保存）。

## 发布流程

1. 确保 `go test ./...` 与前端 `npm run test`、`npx tsc --noEmit` 全绿。
2. 提交（建议按功能拆分），例如：`feat(v0.17): ...`。
3. 打标签并推送，触发 GitHub Actions 交叉编译 6 个平台并创建 Release：

```bash
git tag v0.17.0
git push origin main
git push origin v0.17.0
```

`.github/workflows/release.yml` 会构建前端、嵌入后端、交叉编译（linux/darwin/windows × amd64/arm64）、生成 `checksums.txt` 与 Release 产物。
