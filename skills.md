---
name: diagram
description: 用 Diagram 工具创建/编辑流程图与架构图。当用户要求画流程图、架构图、时序图、思维导图、ER 图，或要修改/分享已有图纸时使用。通过内置 MCP server（stdio 或 HTTP）或 HTTP API 操作，无需打开网页。
---

# 用 Diagram 画图（Agent 操作指南）

Diagram 是一个流程图 / 架构图设计器，内置 **MCP server**。你可以直接通过工具调用创建、读取、修改、分享图纸，用户之后可以在网页端打开继续编辑。

**什么时候用**：用户说「画一张……图」「把这套系统画成架构图」「把这段代码画成依赖图」「修改那张图 / 加一个节点」「生成分享链接」等。

---

## 1. 接入方式（二选一）

**stdio（本地子进程，最常用）**——在 MCP 客户端配置里：

```json
{ "mcpServers": { "diagram": { "command": "diagram", "args": ["mcp"] } } }
```

（`env` 可选 `DIAGRAM_DB` 指定数据库，默认 `~/.diagram/diagram.db`，与网页端共用同一份数据。）

**HTTP（连接正在运行的 server）**——MCP 端点为 `http://<host>:8080/mcp`：

```json
{ "mcpServers": { "diagram": { "type": "http", "url": "http://localhost:8080/mcp" } } }
```

若服务端设置了 `DIAGRAM_TOKEN`，请求需带 `Authorization: Bearer <token>`。

---

## 2. 标准工作流

1. `diagram_list` 看是否已有同名图纸（避免建重复）。
2. `diagram_create { name }` → 得到 `id`（后续所有操作都要带这个 `id`）。
3. 用 `node_add` 逐个添加节点，**记下返回的 `nodeId`**。
4. 用 `edge_add` 连接已知的两端节点。
5. `diagram_get { id }` 校验 `nodes`/`edges` 数量是否正确。
6. 按需：`diagram_publish` 发布、`share_enable` 出分享链接、或直接汇报 `id` 让用户在网页打开。

`id` 是图纸标识；`nodeId`/`edgeId` 是元素标识。**不要凭空编造 id**，要用返回值。

---

## 3. 工具速查（26 个）

### 图纸
| 工具 | 参数 |
| --- | --- |
| `diagram_list` | – |
| `diagram_get` | `id` |
| `diagram_create` | `name`, `description?` |
| `diagram_update` | `id`, `data`（整体替换 `{nodes,edges}`） |
| `diagram_delete` | `id` |
| `diagram_publish` / `diagram_unpublish` | `id` |

### 节点
| 工具 | 参数 |
| --- | --- |
| `node_add` | `id`, `shape?`, `label?`, `x`, `y`, `fill?`, `stroke?`, `textColor?`, `width?`, `height?`, `rotation?` |
| `node_update` | `id`, `nodeId`, `patch`（可含 `label/fill/stroke/textColor/width/height/rotation/shape/opacity/locked`） |
| `node_remove` | `id`, `nodeIds: string[]`（同时删除相连的线） |

### 连线
| 工具 | 参数 |
| --- | --- |
| `edge_add` | `id`, `source`, `target`, `sourceHandle?`, `targetHandle?`, `label?`, `color?`, `pathType?`, `arrowType?`, `lineStyle?`, `animated?` |
| `edge_update` | `id`, `edgeId`, `patch` |
| `edge_remove` | `id`, `edgeIds: string[]` |

### 版本 / 分享 / 组件
`version_list` `version_create{id,label?}` `version_restore{id,version}`
`share_enable{id}` `share_get{id}` `share_disable{id}`
`component_list` `component_get` `component_create` `component_apply` `component_delete`

---

## 4. 画得好看的关键：坐标与尺寸

- 坐标系：**x 向右增大，y 向下增大**；节点 `x,y` 是**左上角**。
- **间距**：同一层水平间隔约 **200–260**，上下层垂直间隔约 **120–160**。不要贴太近。
- 不确定尺寸时用形状默认值（下表），连线会自动接在节点边缘。

`node_add` 的 `shape` 与默认尺寸：

| shape | 尺寸 | 常见用途 |
| --- | --- | --- |
| `rounded` | 120×60 | 服务 / 起止 |
| `rect` | 120×60 | 处理步骤 |
| `diamond` | 120×80 | 判断分支 |
| `hexagon` | 130×70 | 网关 / 预处理 |
| `parallelogram` | 120×60 | 输入输出 / 队列 |
| `cylinder` | 96×96 | 数据库 / 存储 |
| `ellipse` | 110×70 | 缓存 / 数据 |
| `cloud` | 140×90 | 云 / CDN |
| `document` | 110×130 | 文档 |
| `star` | 120×110 | 重点标记 |
| `triangle` | 110×90 | 提示 |
| `text` | 120×48 | 纯文本 |

**连线锚点**（`sourceHandle` / `targetHandle`）：`t` 上、`r` 右、`b` 下、`l` 左。
横向流程用 `r → l`，纵向用 `b → t`。两点之间尽量让方向一致，避免回绕。

**样式取值**：
- `pathType`：`bezier`(默认) / `straight` / `step` / `smoothstep`
- `lineStyle`：`solid`(默认) / `dashed` / `dotted`（依赖、异步用 dashed）
- `arrowType`：`arrowclosed`(默认) / `arrow` / `diamond` / `none`
- `animated: true` 表示流动动画（异步消息常用）

---

## 5. 配色（架构图预设，直接用）

| 组件 | fill | stroke | textColor |
| --- | --- | --- | --- |
| 客户端 | `#e0f2fe` | `#0284c7` | `#075985` |
| API 网关 | `#ede9fe` | `#7c3aed` | `#5b21b6` |
| 服务 | `#dcfce7` | `#16a34a` | `#166534` |
| 数据库 | `#fef3c7` | `#d97706` | `#92400e` |
| 缓存 | `#fee2e2` | `#dc2626` | `#991b1b` |
| 消息队列 | `#fce7f3` | `#db2777` | `#9d174d` |
| 对象存储 | `#e0e7ff` | `#4f46e5` | `#3730a3` |
| 负载均衡 | `#ccfbf1` | `#0d9488` | `#115e59` |
| CDN | `#f3e8ff` | `#9333ea` | `#6b21a8` |
| Worker | `#ffedd5` | `#ea580c` | `#9a3412` |

同类节点用同一套颜色；不要每层都换色。

---

## 6. 常用套路

**架构图（分层从左到右）**
- 网关用 `hexagon`，服务用 `rounded`，库用 `cylinder`，缓存用 `ellipse`，队列用 `parallelogram`，CDN 用 `cloud`。
- `客户端 → 网关 → 服务 → (数据库/缓存)`，按上表配色。

**流程图**
- 判断用 `diamond`，分支连线加 `label:"是"` / `"否"`。
- 起止可用 `rounded`，处理用 `rect`。

**依赖 / 调用关系图**
- 依赖边用 `lineStyle:"dashed"`；主调用实线。
- 代码模块名直接作为 `label`。

**时序图**
- 通过 `diagram_create` 后加「生命线」节点需要特殊类型，建议直接用网页「文本转图」导入 Mermaid `sequenceDiagram`；或用 `diagram_update` 一次性写入 Mermaid 解析后的结构。

**修改已有图**
- 先 `diagram_get` 找到目标 `nodeId`，再 `node_update` / `edge_add`。
- 批量换色：对每个 `nodeId` 调一次 `node_update`（或用 `diagram_update` 整体替换）。

**生成分享**
- `share_enable { id }` → 返回只读链接 `path`（形如 `/?share=<token>`），把完整 URL 给用户。
- 分享页显示的是**已发布版本**：先 `diagram_publish` 再分享。
- 可编辑分享（多人实时协作）需在网页端「分享 → 可编辑分享」开启。

---

## 7. 校验与汇报

完成后用 `diagram_get` 确认数量，并给用户回报：

```
图纸已创建：<name>（id: <id>）
节点 N 个、连线 M 条
打开：http://<host>:8080/?id=<id>
```

---

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| `source or target node not found` | 先建好两端节点，且 `source`/`target` 用的是 `node_add` 返回的 `nodeId` |
| 节点/连线找不到 | 用 `diagram_get` 重新确认 id |
| 图很乱 | 检查坐标：同类节点对齐同一 x/y，间距 200–260 / 120–160 |
| 连线方向奇怪 | 指定 `sourceHandle`/`targetHandle`（`r→l` 或 `b→t`） |
| HTTP 401 | 需要 `Authorization: Bearer <DIAGRAM_TOKEN>` |
| HTTP 405 | `/mcp` 只支持 `POST`（SSE 用 `Accept: text/event-stream`） |
| 429 | 触发限流，放慢调用频率 |
| 网页看不到改动 | 网页端与 agent 用同一个 `DIAGRAM_DB`；网页重新「打开」刷新 |
| 分享图片 404 | 需先在网页端「分享」里生成图片链接 |

更详细的接入与原始 JSON-RPC/curl 示例见仓库 `docs/mcp.md`。

---

## 9. 浏览器内 agent（WebMCP / window.diagramAgent）

**默认关闭**：需在编辑器 **设置（齿轮）→ 允许浏览器 Agent 操作** 打开后，工具才会注册；关闭后 `window.diagramAgent` 立即消失。这样外部 agent 不会在你不知情时改动画布。

开启后，网页编辑器会把一组工具暴露给**浏览器内的 agent**，让 agent 直接操作当前画布（无需服务端、无需扩展）：

- **WebMCP**：如果浏览器支持实验性的 `navigator.modelContext`，编辑器会自动注册这批工具。
- **兜底通道**：始终暴露 `window.diagramAgent`，任何扩展 / 书签 / 控制台 / agent 都可调用：
  ```js
  window.diagramAgent.tools                       // [{name, description}]
  await window.diagramAgent.call("diagram_get_state")
  await window.diagramAgent.call("diagram_add_node", { shape: "rounded", label: "网关", x: 0, y: 0 })
  ```

工具（12 个，都在本地 store 上执行，**用户可撤销**）：

| 工具 | 说明 |
| --- | --- |
| `diagram_get_state` | 读取当前图纸（名称 / 节点 / 连线 / 选中），**先调它拿 id** |
| `diagram_add_node` | 加节点：`shape` `label` `x` `y` `fill` `stroke` `textColor` `width` `height` |
| `diagram_update_node` | 改节点：`nodeId` + `patch` |
| `diagram_remove_nodes` | 删节点（含相连的线） |
| `diagram_add_edge` | 连线：`source` `target` `sourceHandle` `targetHandle` `label` `lineStyle` … |
| `diagram_remove_edges` | 删连线 |
| `diagram_select` | 选中节点/连线 |
| `diagram_set_name` | 重命名图纸 |
| `diagram_auto_layout` | 自动布局（`TB` / `LR`） |
| `diagram_undo` | 撤销上一步 |
| `diagram_export_mermaid` | 导出 Mermaid 文本 |
| `diagram_list_templates` | 列出内置模板 |

典型用法：先 `diagram_get_state`，再 `diagram_add_node`（多次）→ `diagram_add_edge` → 再 `diagram_get_state` 校验。
