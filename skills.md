---
name: diagram
description: 使用/开发 Diagram（流程图与架构图设计器）项目：如何构建、运行、测试，如何通过 MCP 或 HTTP API 让 agent 创建与编辑图纸，以及数据格式、协作与常见坑。当需要在本仓库里工作，或需要让 agent 直接读写图纸时使用。
---

# Diagram 项目使用指南（供 AI Agent）

一个开源的流程图 / 架构图设计器：**Go 后端（标准库 + 纯 Go SQLite）+ React 前端**，前端构建后嵌入单个可执行文件。

- 面向用户的功能说明见 [`README.md`](./README.md)
- MCP 的完整示例（接入配置 / 工具参考 / 完整会话）见 [`docs/mcp.md`](./docs/mcp.md)

---

## 1. 构建 / 运行 / 测试

依赖：Go ≥ 1.23、Node ≥ 18。

```bash
make dev      # 开发模式：后端 :8080 + 前端 :5173（热更新，/api 代理到后端）
make build    # 构建单文件可执行：bin/diagram
make web      # 只构建前端到 frontend/dist
make backend  # 前端产物拷入 backend/dist 并编译后端
make run      # 构建并运行
make clean
```

测试（CI 会全量跑）：

```bash
cd backend  && go test ./...     # Go 测试
cd frontend && npm ci && npm run test
cd frontend && npx tsc --noEmit  # 类型检查（tsconfig 开了 noUnusedLocals）
```

CLI：

```bash
diagram                        # 启动服务，默认 0.0.0.0:8080
diagram -addr 127.0.0.1:8080   # 指定监听地址
diagram mcp                    # 以 stdio 方式启动 MCP server
diagram update                 # 自更新
diagram version
```

环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DIAGRAM_ADDR` | `0.0.0.0:8080` | 监听地址 |
| `DIAGRAM_DATA_DIR` | 用户目录 | SQLite 数据目录（`DIAGRAM_DB` 可直接指定 db 路径） |
| `DIAGRAM_TOKEN` | 空 | 设置后 `/api/diagrams*` 需要 `Authorization: Bearer <token>` |
| `DIAGRAM_RATE_LIMIT` | `600` | 每 IP 每分钟 API 上限，`0` 关闭 |
| `DIAGRAM_ALLOW_ORIGIN` | 空 | 跨域时才设置 |

---

## 2. 让 agent 直接读写图纸（推荐：MCP）

### stdio（本地子进程）

```json
{
  "mcpServers": {
    "diagram": {
      "command": "diagram",
      "args": ["mcp"],
      "env": { "DIAGRAM_DB": "/home/me/.diagram/diagram.db" }
    }
  }
}
```

### HTTP（Streamable HTTP，连接正在运行的 server）

```
http://localhost:8080/mcp
```

- `POST /mcp`：JSON-RPC。`Accept: application/json` 返回 JSON；`Accept: text/event-stream` 返回 SSE。
- 响应头带 `Mcp-Session-Id`；`DELETE /mcp` 结束会话。
- 若设置了 `DIAGRAM_TOKEN`，`/mcp` 同样需要 `Authorization: Bearer <token>`。

### MCP 工具（26 个）

| 分类 | 工具 |
| --- | --- |
| 图纸 | `diagram_list` `diagram_get` `diagram_create` `diagram_update` `diagram_delete` |
| 节点 | `node_add` `node_update` `node_remove` |
| 连线 | `edge_add` `edge_update` `edge_remove` |
| 版本 | `version_list` `version_create` `version_restore` |
| 只读分享 | `share_enable` `share_get` `share_disable` |
| 发布 | `diagram_publish` `diagram_unpublish` |
| 组件库 | `component_list` `component_get` `component_create` `component_apply` `component_delete` |

典型流程：`diagram_create` → 多次 `node_add` → `edge_add` → `diagram_get` 校验。
`node_add` 的 `shape` 取值：`rect` `rounded` `ellipse` `diamond` `hexagon` `triangle` `parallelogram` `cylinder` `document` `star` `cloud` `text`。

---

## 3. HTTP API

`*` = 设置 `DIAGRAM_TOKEN` 后需要鉴权；其余为公开接口。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` `/api/version` `/api/update-check` | 公开探针 |
| GET/POST | `/api/diagrams` | 列表 / 新建 * |
| GET/PUT/DELETE | `/api/diagrams/{id}` | 读取 / 保存 / 删除 * |
| GET/POST | `/api/diagrams/{id}/versions` | 版本列表 / 创建快照 * |
| GET/POST/DELETE | `/api/diagrams/{id}/versions/{version}` | 读取 / 恢复 / 删除版本 * |
| GET | `/api/diagrams/{id}/publish` | 发布状态 * |
| POST/DELETE | `/api/diagrams/{id}/publish` | 发布 / 取消发布 * |
| GET/POST/DELETE | `/api/diagrams/{id}/share` | 只读分享：查询 / 开启(轮换) / 关闭 * |
| PUT | `/api/diagrams/{id}/share/image?format=svg\|png` | 上传渲染好的分享图 * |
| GET | `/api/share/{token}` | 公开只读获取（已发布版本） |
| GET | `/api/share/{token}.svg` / `.png` | 公开图片直链 |
| GET/POST/DELETE | `/api/diagrams/{id}/edit` | 可编辑分享：查询 / 开启(轮换) / 关闭 * |
| GET/PUT | `/api/edit/{token}` | 公开：用编辑 token 读取 / 保存草稿 |
| GET | `/api/ws?token=<editToken>&name=<name>` | 公开：实时协作 WebSocket |
| — | `/api/components*` | 组件库 CRUD * |

前端 URL 约定：

- `?share=<token>` → 只读分享页（展示**已发布**版本）
- `?edit=<token>` → 可编辑协作页（实时房间，多人同时编辑）
- `?id=<uuid>` → 常规编辑器，打开指定图纸

---

## 4. 图纸数据格式

`data` 字段（也是 JSON 导入导出格式）：

```json
{
  "version": 1,
  "type": "diagram",
  "name": "系统架构",
  "description": "",
  "nodes": [
    {
      "id": "n_1",
      "type": "shape",
      "position": { "x": 100, "y": 100 },
      "data": { "shape": "rounded", "label": "API 网关", "fill": "#ede9fe", "stroke": "#7c3aed", "width": 160, "height": 80 },
      "style": { "width": 160, "height": 80 }
    }
  ],
  "edges": [
    {
      "id": "e_1",
      "source": "n_1",
      "target": "n_2",
      "type": "custom",
      "data": { "color": "#475569", "width": 2, "lineStyle": "solid", "pathType": "bezier", "arrowType": "arrowclosed", "points": [] }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

要点：
- 节点类型：`shape`（图形）/ `group`（分组容器）/ `lane`（泳道）/ `lifeline`（时序图生命线）。
- 容器的子节点用 `parentId` + `extent: "parent"` 表达。
- 连线 `type` 固定为 `custom`；`pathType` ∈ `bezier|straight|step|smoothstep`；`arrowType`/`startArrowType` ∈ `arrowclosed|arrow|diamond|none`；`points` 是可拖拽控制点。
- id 前缀约定：节点 `n_`、连线 `e_`、分组 `g_`、泳道 `l_`。
- **图纸 id 是 UUID**（由服务端生成）。

---

## 5. 实时协作（可编辑分享）

- 房间以图纸 id 划分，鉴权用该图纸的 **edit token**：`/api/ws?token=<editToken>`。
- 消息：客户端发 `hello` / `ops`（元素级：`{k:"node"|"edge"|"meta", id, v}`）/ `presence`（光标+选区）；服务端回 `init`（自身信息 + 文档快照 + 在线者）、`ops`、`presence`、`peer`（join/leave）。
- 服务端对同一房间的操作做**全序**并广播，冲突为 **last-write-wins**；合并后的文档防抖落库。
- 前端 `useRealtime` 会：本地 diff 成 ops、断线**指数退避重连**、未发送的 ops 保存在 `syncPending` 队列、重连后先采纳服务器快照再把队列里的本地改动叠加并补发。
- 编辑分享开启后，**owner 的 `?id=` 编辑器也会加入同一房间**（通过受保护接口取 edit token），避免 REST 自动保存与房间内存状态互相覆盖。

---

## 6. 关键源码位置

```
backend/
  main.go        # 入口 / CLI / 路由 / env
  api.go         # 图纸 CRUD
  store.go       # SQLite schema + 迁移
  share.go       # 只读分享
  publish.go     # 草稿/发布
  edit.go        # 可编辑分享（edit token 的公开读写）
  ws.go          # 实时协作房间（WebSocket）
  mcp.go         # MCP server（stdio + HTTP）
  spa.go         # 内嵌前端 + SPA 回退 + 缓存头
frontend/src/
  App.tsx                    # 布局 & 路由(?share/?edit/?id)
  components/editor/         # Canvas / TopBar / Inspector / ShapeNode / CustomEdge / DocumentsPanel …
  components/editor/Canvas.tsx  # React Flow 配置（Loose 连接模式、手势、长按菜单）
  lib/store.ts               # zustand 编辑器状态（nodes/edges/meta、撤销重做、分组…）
  lib/api.ts                 # 所有 HTTP 调用
  lib/i18n.ts                # 中/英词条（新增 UI 文案必须两边都加）
  lib/syncQueue.ts           # 实时协作待发队列
  hooks/                     # useRealtime / useAutoSave / useDraft / useDiagramActions …
docs/mcp.md      # MCP 详细文档
```

---

## 7. 约定与常见坑

- **改 UI 文案**：在 `frontend/src/lib/i18n.ts` 的 `zh` 和 `en` 两个字典里都加，不要硬编码中文。
- **新增节点/连线默认值**：`lib/types.ts` 的 `defaultNodeData` / `defaultEdgeData`。
- **前端测试** 与源码同目录（`*.test.ts(x)`），用 vitest + jsdom（`src/test/setup.ts` 里 mock 了 `matchMedia`/`ResizeObserver`/`localStorage`）。
- **不要用 `window.confirm/prompt`**：用 `lib/dialog.ts` 的 `confirmDialog` / `promptDialog`（有统一样式）。
- **React Flow 受控**：`<ReactFlow>` 的 `connectionMode` 必须是 `ConnectionMode.Loose`（节点只有 source 手柄），否则**连线不渲染**；只读视图隐藏手柄要用 `opacity:0` 而不是 `display:none`（否则量不到手柄几何、连线退化成点）。
- **`NodeResizer` 的回调要保持稳定**（用 `useCallback`），否则每次渲染都会销毁 resizer，导致移动端触摸缩放「动一下就停」。
- **Service Worker 缓存**：更新后若页面异常，用带参数地址绕过缓存（如 `/?v=<n>`）或清除站点数据。`spa.go` 对缺失静态资源返回 404（不会回退成 HTML）。
- **鉴权**：只有 `/api/diagrams*` 与 `/api/components*`、`/mcp` 需要 `DIAGRAM_TOKEN`；`/api/share/*`、`/api/edit/*`、`/api/ws` 是公开的（分别用 share token / edit token 鉴权）。
- **导出**：`lib/exporter.ts`（PNG/SVG/JSON/Mermaid）与 `lib/svgExport.tsx`（纯矢量渲染，同时用于分享图片）。
