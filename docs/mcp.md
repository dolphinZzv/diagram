# MCP 使用示例 / Examples

`diagram` 内置 [Model Context Protocol](https://modelcontextprotocol.io) server，AI Agent 可以通过 MCP 直接创建、读取、编辑流程图与架构图。

- [1. 快速接入](#1-快速接入)
- [2. 工具参考](#2-工具参考)
- [3. 数据格式](#3-数据格式)
- [4. 示例：画一张微服务架构图](#4-示例画一张微服务架构图)
- [5. 示例：修改已有图纸](#5-示例修改已有图纸)
- [6. 示例：版本与分享](#6-示例版本与分享)
- [7. 原始 JSON-RPC / curl](#7-原始-json-rpc--curl)
- [8. 提示词模板](#8-提示词模板)
- [9. 排错](#9-排错)

---

## 1. 快速接入

MCP server 有两种传输方式，按需选择其一。

### 1.1 stdio（本地子进程，最简单）

适合 Claude Desktop / Cursor / Cline 等本地客户端。

先安装 CLI：

```bash
curl -fsSL https://raw.githubusercontent.com/dolphinZzv/diagram/main/install.sh | bash
diagram version   # 确认安装成功
```

**Claude Desktop** —— 编辑 `claude_desktop_config.json`（也可直接复制 [`examples/mcp.stdio.json`](../examples/mcp.stdio.json)）：

```json
{
  "mcpServers": {
    "diagram": {
      "command": "diagram",
      "args": ["mcp"],
      "env": {
        "DIAGRAM_DB": "/Users/me/.diagram/diagram.db"
      }
    }
  }
}
```

**Cursor** —— 在项目 `.cursor/mcp.json` 或全局配置中：

```json
{
  "mcpServers": {
    "diagram": {
      "command": "diagram",
      "args": ["mcp"]
    }
  }
}
```

> `DIAGRAM_DB` 不填则默认 `~/.diagram/diagram.db`（与网页端共用同一个库，做到「网页看、Agent 改」）。

### 1.2 HTTP（Streamable HTTP，连接正在运行的 server）

适合远程/容器化 agent，无需本地安装二进制。

```bash
diagram                 # 启动服务，默认 0.0.0.0:8080
# MCP 端点：http://<host>:8080/mcp
```

客户端配置（支持 HTTP transport 的客户端，可复制 [`examples/mcp.http.json`](../examples/mcp.http.json)）：

```json
{
  "mcpServers": {
    "diagram": {
      "type": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

若服务端设置了 `DIAGRAM_TOKEN`，需带令牌：

```json
{
  "mcpServers": {
    "diagram": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer my-secret" }
    }
  }
}
```

HTTP 传输细节：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/mcp` | JSON-RPC 请求。`Accept: application/json` 返回 JSON；`Accept: text/event-stream` 返回 SSE |
| `DELETE` | `/mcp` | 结束会话，返回 200 |
| `GET` | `/mcp` | 不支持（无服务端推送流），返回 405 |

响应头会返回 `Mcp-Session-Id`，客户端可回传以复用会话。

---

## 2. 工具参考

共 **17** 个工具。所有写操作都会自动生成版本快照（内容变化时）。

### 图纸

| 工具 | 参数 | 返回 |
| --- | --- | --- |
| `diagram_list` | – | `[{id, name, description, createdAt, updatedAt}]` |
| `diagram_get` | `id` | `{id, name, description, data:{nodes,edges}}` |
| `diagram_create` | `name`, `description?` | `{id, name}` |
| `diagram_update` | `id`, `data` | `{id, nodes, edges, updatedAt}` |
| `diagram_delete` | `id` | `{status, id}` |

### 节点

| 工具 | 参数 |
| --- | --- |
| `node_add` | `id`, `shape?`, `label?`, `x`, `y`, `fill?`, `stroke?`, `textColor?`, `width?`, `height?`, `rotation?` |
| `node_update` | `id`, `nodeId`, `patch`（合并到节点 `data`，支持 `label/fill/stroke/textColor/width/height/rotation/shape/opacity/locked`） |
| `node_remove` | `id`, `nodeIds: string[]`（同时删除相连的线） |

`node_add` 会自动应用形状默认尺寸：

| shape | 默认尺寸 | 用途 |
| --- | --- | --- |
| `rect` | 120×60 | 处理步骤 |
| `rounded` | 120×60 | 服务 / 起止 |
| `ellipse` | 110×70 | 缓存 / 数据 |
| `diamond` | 120×80 | 判断 |
| `hexagon` | 130×70 | 网关 / 预处理 |
| `triangle` | 110×90 | 提示 |
| `parallelogram` | 120×60 | 输入输出 / 队列 |
| `cylinder` | 96×96 | 数据库 / 存储 |
| `document` | 110×130 | 文档 |
| `star` | 120×110 | 重点 |
| `cloud` | 140×90 | 云 / CDN |
| `text` | 120×48 | 纯文本 |

### 连线

| 工具 | 参数 |
| --- | --- |
| `edge_add` | `id`, `source`, `target`, `sourceHandle?`, `targetHandle?`, `label?`, `color?`, `pathType?`, `arrowType?`, `lineStyle?`, `animated?` |
| `edge_update` | `id`, `edgeId`, `patch` |
| `edge_remove` | `id`, `edgeIds: string[]` |

- `sourceHandle` / `targetHandle`：`t`（上）、`r`（右）、`b`（下）、`l`（左）
- `pathType`：`bezier`（默认）、`straight`、`step`、`smoothstep`
- `arrowType`：`arrowclosed`（默认）、`arrow`、`diamond`、`none`
- `lineStyle`：`solid`（默认）、`dashed`、`dotted`

### 版本与分享

| 工具 | 参数 | 返回 |
| --- | --- | --- |
| `version_list` | `id` | `[{version, origin, label, nodeCount, edgeCount, createdAt}]` |
| `version_create` | `id`, `label?` | `{version, origin, ...}` |
| `version_restore` | `id`, `version` | `{restoredFrom, newVersion}` |
| `share_enable` | `id` | `{enabled, token, path}` |
| `share_get` | `id` | `{enabled, token}` |
| `share_disable` | `id` | `{enabled:false}` |

---

## 3. 数据格式

`diagram_get` 返回的 `data` 与网页端 JSON 导入导出格式一致。

```json
{
  "nodes": [
    {
      "id": "n_xxx",
      "type": "shape",
      "position": { "x": 100, "y": 80 },
      "data": {
        "shape": "rounded",
        "label": "API 网关",
        "fill": "#ede9fe",
        "stroke": "#7c3aed",
        "strokeWidth": 2,
        "textColor": "#5b21b6",
        "fontSize": 14,
        "width": 130,
        "height": 70,
        "rotation": 0,
        "opacity": 1,
        "radius": 8,
        "fontWeight": "normal",
        "fontStyle": "normal",
        "locked": false
      },
      "style": { "width": 130, "height": 70 }
    }
  ],
  "edges": [
    {
      "id": "e_xxx",
      "source": "n_a",
      "target": "n_b",
      "sourceHandle": "r",
      "targetHandle": "l",
      "type": "custom",
      "data": {
        "label": "调用",
        "color": "#475569",
        "width": 2,
        "lineStyle": "solid",
        "arrowType": "arrowclosed",
        "startArrowType": "none",
        "pathType": "bezier",
        "labelRotation": 0,
        "animated": false,
        "points": []
      }
    }
  ]
}
```

常用配色（前端「架构组件」预设）：

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

---

## 4. 示例：画一张微服务架构图

**用户提示词**

> 帮我画一张微服务架构图：客户端 → API 网关 → 用户服务/订单服务；用户服务连数据库，订单服务连缓存和消息队列。保存成「电商架构」。

**Agent 的工具调用序列**

```jsonc
// 1. 新建图纸
diagram_create { "name": "电商架构", "description": "由 AI 生成" }
// → { "id": "8f3c...", "name": "电商架构" }

// 2. 添加节点（记录返回的 nodeId）
node_add { "id":"8f3c...", "shape":"rounded", "label":"客户端",
           "x":0, "y":120, "fill":"#e0f2fe", "stroke":"#0284c7", "textColor":"#075985" }
// → { "nodeId":"n_client" }

node_add { "id":"8f3c...", "shape":"hexagon", "label":"API 网关",
           "x":220, "y":120, "fill":"#ede9fe", "stroke":"#7c3aed", "textColor":"#5b21b6" }
// → { "nodeId":"n_gw" }

node_add { "id":"8f3c...", "shape":"rounded", "label":"用户服务",
           "x":460, "y":40, "fill":"#dcfce7", "stroke":"#16a34a", "textColor":"#166534" }
// → { "nodeId":"n_user" }

node_add { "id":"8f3c...", "shape":"rounded", "label":"订单服务",
           "x":460, "y":200, "fill":"#dcfce7", "stroke":"#16a34a", "textColor":"#166534" }
// → { "nodeId":"n_order" }

node_add { "id":"8f3c...", "shape":"cylinder", "label":"数据库",
           "x":700, "y":20, "fill":"#fef3c7", "stroke":"#d97706", "textColor":"#92400e" }
// → { "nodeId":"n_db" }

node_add { "id":"8f3c...", "shape":"ellipse", "label":"缓存",
           "x":700, "y":180, "fill":"#fee2e2", "stroke":"#dc2626", "textColor":"#991b1b" }
// → { "nodeId":"n_cache" }

node_add { "id":"8f3c...", "shape":"parallelogram", "label":"消息队列",
           "x":700, "y":300, "fill":"#fce7f3", "stroke":"#db2777", "textColor":"#9d174d" }
// → { "nodeId":"n_mq" }

// 3. 连线（r=右侧, l=左侧, b=下方）
edge_add { "id":"8f3c...", "source":"n_client", "target":"n_gw",
           "sourceHandle":"r", "targetHandle":"l" }
edge_add { "id":"8f3c...", "source":"n_gw", "target":"n_user",
           "sourceHandle":"r", "targetHandle":"l" }
edge_add { "id":"8f3c...", "source":"n_gw", "target":"n_order",
           "sourceHandle":"r", "targetHandle":"l" }
edge_add { "id":"8f3c...", "source":"n_user", "target":"n_db",
           "sourceHandle":"r", "targetHandle":"l" }
edge_add { "id":"8f3c...", "source":"n_order", "target":"n_cache",
           "sourceHandle":"r", "targetHandle":"l" }
edge_add { "id":"8f3c...", "source":"n_order", "target":"n_mq",
           "sourceHandle":"b", "targetHandle":"t",
           "lineStyle":"dashed", "animated":true }

// 4. 校验
diagram_get { "id": "8f3c..." }
// → data.nodes 长度 7, data.edges 长度 6
```

**结果**：打开网页 `http://localhost:8080` → 「打开」即可看到这张图。

---

## 5. 示例：修改已有图纸

**用户提示词**

> 把「电商架构」里的订单服务改成橙色，并给它加一个指向「支付服务」的虚线。

```jsonc
// 1. 找到图纸
diagram_list {}
// → [{ "id":"8f3c...", "name":"电商架构", ... }]

// 2. 看结构，找到订单服务的 nodeId
diagram_get { "id":"8f3c..." }

// 3. 改颜色
node_update {
  "id":"8f3c...", "nodeId":"n_order",
  "patch": { "fill":"#ffedd5", "stroke":"#ea580c", "textColor":"#9a3412" }
}

// 4. 新增节点 + 虚线连接
node_add { "id":"8f3c...", "shape":"rounded", "label":"支付服务",
           "x":460, "y":360, "fill":"#ffedd5", "stroke":"#ea580c", "textColor":"#9a3412" }
// → { "nodeId":"n_pay" }

edge_add { "id":"8f3c...", "source":"n_order", "target":"n_pay",
           "sourceHandle":"b", "targetHandle":"t",
           "label":"支付", "lineStyle":"dashed" }
```

**批量调整**：把多个节点统一改成某颜色，只需对每个 `nodeId` 调一次 `node_update`；或用 `diagram_update` 一次性替换整份 `{nodes, edges}`。

---

## 6. 示例：版本与分享

**用户提示词**

> 给「电商架构」打个版本「v1 定稿」，然后生成一个只读分享链接。

```jsonc
// 打版本
version_create { "id":"8f3c...", "label":"v1 定稿" }
// → { "version": 5, "origin": "manual", ... }

// 查看历史
version_list { "id":"8f3c..." }
// → [{ "version":5, "origin":"manual", "label":"v1 定稿" }, ...]

// 误改后回滚
version_restore { "id":"8f3c...", "version":5 }
// → { "restoredFrom":5, "newVersion":6 }

// 分享（只读）
share_enable { "id":"8f3c..." }
// → { "enabled":true, "token":"baee...", "path":"/?share=baee..." }

// 生成图片直链（需在网页端「分享」对话框点一次“生成图片链接”，
// 之后即可用）：http://<host>/api/share/<token>.svg  /  .png

// 关闭分享
share_disable { "id":"8f3c..." }
```

---

## 7. 原始 JSON-RPC / curl

### stdio

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | diagram mcp
```

### HTTP（JSON）

```bash
curl -s http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

### HTTP（SSE）

```bash
curl -N http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
# event: message
# data: {"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}
```

### 调用工具

```bash
curl -s http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{
      "name":"diagram_create",
      "arguments":{"name":"我的第一张图"}
    }
  }'
```

---

## 8. 提示词模板

可直接复制给 Agent：

> 你是流程图助手。使用 `diagram` MCP 工具：
> 1. 先用 `diagram_list` 查找是否已有同名图纸；
> 2. 没有就 `diagram_create` 新建；
> 3. 用 `node_add` 逐个添加节点（选合适形状与配色），用 `edge_add` 连线（合理使用 `sourceHandle/targetHandle`）；
> 4. 最后用 `diagram_get` 校验节点/连线数量，并汇报图纸 id。

其它模板：

- **根据代码生成架构图**：把模块/依赖关系映射为 `node_add` + `edge_add`（依赖用 `lineStyle:"dashed"`）。
- **把需求转成流程图**：判断用 `diamond`，分支边加 `label:"是"/"否"`。
- **美化现有图**：`diagram_get` 读取后，对每个节点 `node_update` 统一配色与字号。
- **生成分享**：完成后 `share_enable`，把返回的 `path` 拼成完整 URL 给用户。

---

## 9. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `command not found: diagram` | 未安装或不在 `PATH`，重跑 `install.sh` 并 `export PATH="$HOME/.local/bin:$PATH"` |
| stdio 无响应 | 确认用的是 `diagram mcp`；stdout 仅输出协议消息，日志在 stderr |
| HTTP `401 unauthorized` | 服务端开启了 `DIAGRAM_TOKEN`，需带 `Authorization: Bearer <token>` |
| HTTP `405` | `GET /mcp` 不支持；请用 `POST` |
| `node not found` / `edge not found` | 传的 `nodeId/edgeId` 不对，先 `diagram_get` 确认 |
| `source or target node not found` | 连线前先创建两端节点 |
| `429 rate limit exceeded` | 触发了 `DIAGRAM_RATE_LIMIT`，降低频率或调大/关闭该限制 |
| 网页看不到 Agent 的改动 | 两者需使用同一个 `DIAGRAM_DB`；网页端重新「打开」刷新 |
| 图片直链 404 | 尚未生成图片，先在网页端「分享 → 生成图片链接」 |

---

更多：项目主页 [README](../README.md) · 版本历史通过 `version_list` 查看。
