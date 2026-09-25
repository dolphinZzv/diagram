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

### 模板库
- 内置 **基础流程图**、**微服务架构**、**数据管道** 三套模板，一键套用

### 画布与文档
- 缩放、平移、框选、MiniMap、网格吸附
- 撤销 / 重做（最多 100 步）
- 复制 / 删除 / 快捷键
- **JSON 导入 / 导出**（完整保留节点、连线、控制点、样式）
- **PNG / SVG 导出**（高清 2 倍图）
- 服务器端保存 / 打开 / 删除多份图纸（SQLite）

### 快捷键
| 操作 | 快捷键 |
| --- | --- |
| 撤销 | `Ctrl/Cmd + Z` |
| 重做 | `Ctrl/Cmd + Shift + Z` / `Ctrl + Y` |
| 复制选中 | `Ctrl/Cmd + D` |
| 删除选中 | `Delete` / `Backspace` |
| 取消选择 | `Esc` |
| 保存 | `Ctrl/Cmd + S` |
| 多选 | `Shift` / `Ctrl` 拖拽框选 |

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

## 🧪 测试

项目在 CI 中全量运行单元测试（无需本地安装依赖）。

```bash
# 后端
cd backend && go test ./...

# 前端
cd frontend && npm ci && npm run test
```

覆盖内容：
- **后端**：存储 CRUD / 排序 / 未找到处理、HTTP API 全流程、鉴权中间件、限流与 CORS、更新工具函数
- **前端**：形状与连线默认值、几何路径计算、文档序列化/反序列化、zustand 编辑器（增删改、撤销重做、多选对齐与分布）、模板完整性、组件渲染（Shape / ColorField / Toaster）

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
