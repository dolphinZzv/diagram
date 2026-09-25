# Diagram · 流程图 / 架构图设计器

一个开源的在线流程图、架构图设计工具。拖拽式画布，支持自定义形状、连线、控制点、颜色、角度，支持 JSON 导入导出、PNG/SVG 导出，单文件二进制即可部署。

- **后端**：Go（标准库 + SQLite，纯 Go 无 CGO，跨平台交叉编译）
- **前端**：React + TypeScript + TailwindCSS + shadcn/ui + React Flow
- **部署**：单个可执行文件，内嵌前端静态资源，一键安装 / 一键更新

---

## ✨ 功能特性

### 图形编辑
- **12 种基础形状**：矩形、圆角矩形、椭圆、菱形、六边形、三角形、平行四边形、圆柱（数据库）、文档、星形、云、文本
- **架构组件预设**：客户端、API 网关、服务、数据库、缓存、消息队列、对象存储、负载均衡、CDN、Worker
- 拖拽添加、拖拽移动、拖拽缩放（NodeResizer）
- **旋转角度**：任意角度旋转节点（滑杆 / 快捷按钮 / 精确输入）

### 样式自定义
- 填充色、边框色、边框粗细、圆角大小
- 文字颜色、字号、加粗、斜体
- 不透明度
- 颜色选择器内置常用色板 + 任意取色 + 手动输入 HEX

### 连线（边）
- **4 种路径类型**：贝塞尔曲线、直线、折线（直角）、折线（圆角）
- **4 种箭头**：实心箭头、空心箭头、菱形、无（起点 / 终点可分别设置）
- **线条样式**：实线 / 虚线 / 点线
- 颜色、粗细、流动动画
- **可拖拽控制点**：选中连线后点击线段中点新增控制点，拖动改变线条走向，双击删除；也可整体清空
- 连线标签，支持标签文字旋转角度
- 也可直接拖动节点边缘圆点重新连接

### 多选与布局
- 框选 / Shift 多选节点与连线，批量修改颜色、粗细、字号、圆角、透明度、旋转
- **对齐**：左 / 水平居中 / 右 / 顶 / 垂直居中 / 底
- **分布**：水平等距 / 垂直等距
- 批量复制、批量删除

### 分组 / 锁定 / 图层
- **分组 / 取消分组**：把多个节点包进可移动、可缩放的容器（`Ctrl+G` / `Ctrl+Shift+G`）
- **锁定 / 解锁**：锁定后不可移动、缩放、连线（`Ctrl+L`），节点显示锁标记
- **图层**：置顶 / 上移一层 / 下移一层 / 置底（`Ctrl+]` / `Ctrl+[`，加 `Shift` 到顶/到底）
- **复制粘贴**：`Ctrl+C` / `Ctrl+V`，`Ctrl+D` 再制

### 本地草稿（防丢失）
- 编辑内容自动写入浏览器 `localStorage`（防抖 400ms）
- 页面意外关闭后再打开，会自动恢复未保存的草稿并提示
- 保存到服务器后自动清除草稿
- 快捷键面板：右上角 **设置 → 快捷键**，或直接按 `?`

### 模板库
- 内置 **基础流程图**、**微服务架构**、**数据管道** 三套模板，一键套用

### 移动端 / iPad
- 响应式布局：平板/手机自动收起侧边栏，改为抽屉面板
- 顶栏精简：小屏仅保留名称 + 撤销/保存 + **「更多 ⋯」菜单**（新建/打开/历史/分享/导入/模板/导出/主题/清空）
- 底部悬浮工具栏：**添加图形**、**多选**、**属性**
- **双击图形/连线** → 弹出属性面板
- **长按图形/连线/空白处** → 弹出**底部操作菜单**（编辑、子/同级主题、复制、图层、分组、锁定、删除、布局、配色、导出…）
- **多选模式**：开启后拖拽画布可框选多个图形，右侧属性面板批量操作（改色/对齐/分组/图层/删除…）
- 触屏优化：节点手柄/缩放手柄自动放大，防误触；保留双指缩放与拖动
- 关闭双击缩放（避免与双击打开属性冲突），支持安全区域与 `100dvh`

### 主题与多语言
- **明暗主题**：一键切换，偏好保存在本地；首次访问跟随系统
- **多语言**：中文 / English，可在设置面板切换，首次按浏览器语言自动选择
- 画布、背景网格、MiniMap、导出图片背景均随主题自适应

### 时序图
- 内置**时序图模板**（参与者 + 生命线 + 消息）
- 生命线节点：顶部参与者标题 + 竖向虚线生命线，每行一个连接点
- 快捷添加：右键/长按 → **添加参与者 / 添加消息**（自动使用下一空行）
- 消息支持实线/虚线、标签、颜色、动画（复用连线能力）
- **导出 Mermaid 时序图**（`sequenceDiagram`）

### 模板与导入导出
- **模板库（8 套 + 缩略图预览）**：基础流程图 / 微服务架构 / 数据管道 / 思维导图 / 时序图 / Kubernetes / ER 图 / 组织架构
- **文本转图**：导入 Mermaid（`flowchart` / `sequenceDiagram`）与 PlantUML（时序 / 活动图）
- 导出 **JSON / PNG / SVG（纯矢量）/ Mermaid**，复制为图片到系统剪贴板
- **PWA**：可安装到桌面、支持离线使用

### 思维导图
- 内置**思维导图模板**（中心主题 + 多级分支）
- **Tab** 添加子主题、**Enter** 添加同级主题
- 右键菜单：添加子主题 / 同级主题
- **思维导图布局**：中心主题居中，分支左右均匀展开（右键空白 → 思维导图布局）

### 草稿 / 发布
- 编辑内容为**草稿**（自动保存）；分享链接与图片始终展示**已发布**版本
- 分享面板可查看发布状态（已发布 / 有未发布修改）并一键 **发布**
- 发布时自动重新渲染并上传 SVG / PNG 图片

### 布局与配色
- **自动布局**：按拓扑分层整理，支持纵向 / 横向
- **一键配色**：整图套用配色主题（海洋 / 森林 / 日落 / 单色）
- **方向键微调**：选中后方向键移动 1px，`Shift` 10px
- **导出 Mermaid**：导出/复制 `flowchart` 文本，便于进文档与 Git

### 画布与文档
- 缩放、平移、框选、MiniMap、网格吸附
- **命令面板 `Ctrl/⌘+K`**（`Ctrl+F` 同）：搜索执行所有操作 / 配色 / 样式预设 / 图形 / 模板 / 节点并定位
- **空画布引导**：新画布上直接选择模板 / 添加图形 / 查看快捷键
- **右键 / 长按菜单**：编辑/复制/再制/删除/置顶置底/分组/图层/锁定/自动布局/配色/导出
- **拖动智能辅助线**：拖动时与其他节点自动对齐并吸附
- **双击图形内联编辑文字**（桌面）；触屏双击打开属性面板
- **格式刷**：`Ctrl+Shift+C` / `Ctrl+Shift+V` 复制/粘贴样式，8 个样式预设
- **一键美化**：统一间距/圆角/字号并套用配色（海洋/森林/日落/单色）
- **手绘风**：SVG 滤镜模拟手绘（设置内开关）
- **图片节点 / 便签**：粘贴图片即成节点；便签形状；**复制为图片**到剪贴板
- **自动保存**：已有图纸的修改自动保存到服务器（可在设置中关闭）
- 撤销 / 重做（最多 100 步）
- 复制 / 删除 / 快捷键

### 版本控制（版本历史）
- **自动版本**：每次保存若图纸内容变化，自动记录一个版本（内容相同不重复记录）
- **手动快照**：可随时创建带备注的里程碑版本
- **版本列表**：按时间倒序展示版本号、来源（创建/自动/手动/恢复）、时间、节点/连线数
- **载入预览**：把历史版本载入画布查看（不保存）
- **一键恢复**：恢复到任一历史版本，并自动生成一条“恢复”记录
- **删除版本**、每个图纸最多保留 100 个版本（自动清理最旧的）
- 删除图纸时同步清理其全部版本

### 分享（只读）
- 一键生成**只读分享链接**，别人打开即可查看（可缩放/平移/导出 PNG），无法编辑
- 可**重新生成链接**（旧链接立即失效）或**关闭分享**
- 分享接口独立于编辑接口，**无需登录/鉴权**即可访问
- 支持 `?share=<token>` 直接打开只读画布
- **图片分享**：一键生成可直接嵌入文档 / IM 的图片链接（`/api/share/<token>.svg`、`.png`）
- **JSON 导入 / 导出**（完整保留节点、连线、控制点、样式）
- **PNG / SVG 导出**（高清 2 倍图）
- 服务器端保存 / 打开 / 删除多份图纸（SQLite）

### 快捷键
| 操作 | 快捷键 |
| --- | --- |
| 撤销 / 重做 | `Ctrl+Z` / `Ctrl+Shift+Z`（`Ctrl+Y`） |
| 复制 / 粘贴 | `Ctrl+C` / `Ctrl+V` |
| 再制（副本） | `Ctrl+D` |
| 删除选中 | `Delete` / `Backspace` |
| 全选 | `Ctrl+A` |
| 分组 / 取消分组 | `Ctrl+G` / `Ctrl+Shift+G` |
| 锁定 / 解锁 | `Ctrl+L` |
| 上移 / 下移一层 | `Ctrl+]` / `Ctrl+[` |
| 置顶 / 置底 | `Ctrl+Shift+]` / `Ctrl+Shift+[` |
| 保存 | `Ctrl+S` |
| 取消选择 | `Esc` |
| 多选 | `Shift` 点选 / 拖拽框选 |
| 框选多个 | 桌面：直接拖拽空白处；触屏：开启底部「多选」后拖拽 |
| 双击图形 | 打开属性面板（触屏） |
| 长按图形/空白 | 打开操作菜单（触屏） |
| 平移画布 | 中键 / 右键拖拽，或按住 `Space` 拖拽 |
| 快捷键帮助 | `?` |

> macOS 上 `Ctrl` 对应 `⌘`（Command）。

---

## 🚀 一键安装 / 更新

> 所有二进制均由 GitHub Actions 交叉编译产出（linux/darwin/windows × amd64/arm64）。

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/dolphinZzv/diagram/main/install.sh | bash
```

安装完成后：

```bash
diagram                       # 启动，默认监听 0.0.0.0:8080
diagram -addr 0.0.0.0:9000    # 自定义端口（默认即监听所有网卡）
diagram -addr 127.0.0.1:8080  # 仅本机访问
diagram update                # 一键更新到最新版本
diagram version               # 查看版本
```

> 默认监听 `0.0.0.0:8080`，同一局域网内可通过 `http://<本机IP>:8080` 访问。

自定义安装目录或指定版本：

```bash
curl -fsSL .../install.sh | INSTALL_DIR=$HOME/bin bash
curl -fsSL .../install.sh | VERSION=v1.0.0 bash
```

### Windows

从 [Releases](https://github.com/dolphinZzv/diagram/releases/latest) 下载 `diagram_windows_amd64.zip`，解压后运行 `diagram.exe`。

---

## 🔐 访问鉴权（可选）

默认无需登录，适合本机 / 内网使用。若需暴露到公网，启动时设置 `DIAGRAM_TOKEN` 即可开启鉴权：

```bash
DIAGRAM_TOKEN=my-secret diagram
```

启用后：
- 图纸相关接口（`/api/diagrams*`）需要 `Authorization: Bearer <token>`
- 前端在右上角 **设置（齿轮）→ 访问令牌** 中填写 token，之后自动携带
- `/api/health`、`/api/version`、`/api/update-check` 保持公开

> 注意：请配合 HTTPS 反向代理使用，避免 token 明文传输。

### 其他安全开关

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `DIAGRAM_TOKEN` | 空（不鉴权） | 设置后 `/api/diagrams*` 需要 Bearer token |
| `DIAGRAM_RATE_LIMIT` | `600` | 每 IP 每分钟 API 请求上限，`0` 关闭限流 |
| `DIAGRAM_ALLOW_ORIGIN` | 空（同源） | 仅在需要跨域时设置，例如 `https://example.com` 或 `*` |

### Docker（可选）

```bash
docker build -t diagram .
docker run -p 8080:8080 -v diagram-data:/data diagram
```

---

## 🛠 从源码构建

依赖：Go ≥ 1.23、Node ≥ 18。

```bash
git clone git@github.com:dolphinZzv/diagram.git
cd diagram

# 一键构建（先构建前端，再嵌入后端）
make build

# 运行
./bin/diagram
```

开发模式（前后端分离热更新）：

```bash
make dev
# 后端: http://localhost:8080
# 前端: http://localhost:5173  (代理 /api 到后端)
```

### 目录结构

```
diagram/
├── backend/                 # Go 后端
│   ├── main.go              # 入口 / CLI / 路由
│   ├── api.go               # 图纸 CRUD API
│   ├── store.go             # SQLite 存储
│   ├── spa.go               # 内嵌前端 + SPA 路由
│   ├── update.go            # 自更新
│   └── dist/                # 构建时嵌入的前端产物
├── frontend/                # React 前端
│   └── src/
│       ├── components/ui/   # shadcn/ui 组件
│       ├── components/editor/
│       │   ├── Canvas.tsx       # React Flow 画布
│       │   ├── ShapeNode.tsx    # 自定义节点
│       │   ├── CustomEdge.tsx   # 自定义连线（含控制点）
│       │   ├── Inspector.tsx    # 属性面板
│       │   ├── ShapePalette.tsx # 图形面板
│       │   └── TopBar.tsx       # 工具栏
│       └── lib/             # 类型 / store / 导出 / API
├── install.sh               # 一键安装脚本
├── docs/mcp.md              # MCP 使用示例文档
├── Makefile
└── .github/workflows/       # CI + Release
```

---

## 🔌 HTTP API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查（公开） |
| `GET` | `/api/version` | 版本信息（公开） |
| `GET` | `/api/update-check` | 检查更新（公开） |
| `GET` | `/api/diagrams` | 图纸列表 * |
| `POST` | `/api/diagrams` | 新建图纸 * |
| `GET` | `/api/diagrams/{id}` | 获取图纸 * |
| `PUT` | `/api/diagrams/{id}` | 保存图纸 * |
| `DELETE` | `/api/diagrams/{id}` | 删除图纸 * |
| `GET` | `/api/diagrams/{id}/versions` | 版本列表 * |
| `POST` | `/api/diagrams/{id}/versions` | 创建手动快照 * |
| `GET` | `/api/diagrams/{id}/versions/{version}` | 获取指定版本数据 * |
| `POST` | `/api/diagrams/{id}/versions/{version}/restore` | 恢复到此版本 * |
| `DELETE` | `/api/diagrams/{id}/versions/{version}` | 删除指定版本 * |
| `GET` | `/api/diagrams/{id}/share` | 获取分享状态 * |
| `POST` | `/api/diagrams/{id}/share` | 开启 / 重置分享链接 * |
| `DELETE` | `/api/diagrams/{id}/share` | 关闭分享 * |
| `GET` | `/api/share/{token}` | 公开只读获取图纸（无需鉴权） |
| `PUT` | `/api/diagrams/{id}/share/image?format=svg\|png` | 上传渲染好的分享图片 * |
| `GET` | `/api/share/{token}.svg` / `.png` | 直接返回分享图片（无需鉴权） |

> \* 设置 `DIAGRAM_TOKEN` 后需要 `Authorization: Bearer <token>`。

图纸数据格式（同时用于 JSON 导入导出）：

```json
{
  "version": 1,
  "type": "diagram",
  "name": "系统架构",
  "nodes": [
    {
      "id": "n_1",
      "type": "shape",
      "position": { "x": 100, "y": 100 },
      "data": {
        "shape": "rounded",
        "label": "API 网关",
        "fill": "#ede9fe",
        "stroke": "#7c3aed",
        "strokeWidth": 2,
        "rotation": 0,
        "width": 160,
        "height": 80
      }
    }
  ],
  "edges": [
    {
      "id": "e_1",
      "source": "n_1",
      "target": "n_2",
      "type": "custom",
      "data": {
        "color": "#475569",
        "width": 2,
        "lineStyle": "solid",
        "pathType": "bezier",
        "arrowType": "arrowclosed",
        "points": []
      }
    }
  ]
}
```

---

## 🤖 MCP Server（供 AI Agent 直接编辑流程图）

> 📖 **完整示例文档：[docs/mcp.md](docs/mcp.md)**（接入配置、工具参考、数据格式、完整会话示例、curl 调试）

内置 MCP server，提供两种传输方式：

### 1) stdio（本地子进程）

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

### 2) HTTP（Streamable HTTP，连接正在运行的 server）

```
http://localhost:8080/mcp
```

- `POST /mcp`：JSON-RPC，请求头 `Accept: application/json` 返回 JSON；`Accept: text/event-stream` 返回 SSE。
- 响应头返回 `Mcp-Session-Id`；`DELETE /mcp` 结束会话，`GET /mcp` 返回 405。
- 启用 `DIAGRAM_TOKEN` 时，`/mcp` 同样需要 `Authorization: Bearer <token>`。

### 工具列表（17 个）

| 工具 | 说明 |
| --- | --- |
| `diagram_list` | 列出所有图纸 |
| `diagram_get` | 获取图纸完整数据（nodes/edges） |
| `diagram_create` | 新建空图纸，返回 id |
| `diagram_update` | 用 `{nodes, edges}` 整体替换 |
| `diagram_delete` | 删除图纸 |
| `node_add` | 添加节点（形状/文本/坐标/颜色） |
| `node_update` | 修改节点字段（可合并 patch） |
| `node_remove` | 删除节点（含相连的线） |
| `edge_add` | 连接两个节点 |
| `edge_update` | 修改连线字段 |
| `edge_remove` | 删除连线 |
| `version_list` | 版本历史 |
| `version_create` | 手动快照 |
| `version_restore` | 恢复到指定版本 |
| `share_enable` | 开启/轮换只读分享链接 |
| `share_get` | 查询分享状态 |
| `share_disable` | 关闭分享 |

### 示例：让 agent 画一张图

依次调用：`diagram_create` → `node_add`（多次）→ `edge_add` → `diagram_get` 验证即可。

更多完整示例（微服务架构、修改图纸、版本与分享、提示词模板、排错）：见 **[docs/mcp.md](docs/mcp.md)**。

---

## 🧪 测试

项目在 CI 中全量运行单元测试（无需本地安装依赖）。

```bash
# 后端
cd backend && go test ./...

# 前端
cd frontend && npm ci && npm run test
```

覆盖内容：
- **后端**：存储 CRUD / 排序 / 未找到处理、HTTP API 全流程、鉴权中间件、限流与 CORS、更新工具函数、**版本历史（自动/手动/恢复/删除/裁剪/去重）**、**只读分享（开启/关闭/轮换令牌/公开只读/鉴权边界）**、**图片分享（上传/直链/非法格式/级联删除）**、**旧库迁移**、**MCP（工具列表/初始化/增删改查流程/错误处理/HTTP 与 SSE 传输/鉴权）**
- **前端**：形状与连线默认值、几何路径、矢量 SVG 导出、文档序列化、zustand 编辑器（增删改/撤销重做/多选对齐分布/**分组/锁定/图层/复制粘贴/全选**）、模板、组件渲染、**跨环境 ID 生成**、**i18n**、**主题**、**本地草稿**

---

## 📦 发布流程（CI/CD）

仓库已配置 GitHub Actions：

- **CI**（`.github/workflows/ci.yml`）：每次 push / PR 自动构建前端并编译后端。
- **Release**（`.github/workflows/release.yml`）：推送 `v*` 标签时自动：
  1. 构建前端并嵌入后端；
  2. 交叉编译 6 个平台（linux/darwin/windows × amd64/arm64）；
  3. 生成 `checksums.txt`；
  4. 创建 GitHub Release 并上传所有产物与 `install.sh`。

发布新版本：

```bash
git tag v1.0.0
git push origin v1.0.0
```

用户即可通过 `diagram update` 或重新运行 `install.sh` 一键升级。

---

## 📄 License

[MIT](./LICENSE)
