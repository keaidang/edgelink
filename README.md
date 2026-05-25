# ⚡ EdgeLink - 极速边缘短链接服务

EdgeLink 是一款基于 **腾讯云 EdgeOne Pages** 的轻量、极速、开箱即用的 Serverless 网址短链接生成与重定向服务。

项目使用 **Edge Functions (边缘函数)** 处理重定向与 API 请求，利用 **EdgeOne KV** 作为低延迟全球分布式存储，并提供了一个高颜值、现代科技感（暗黑玻璃拟态）的控制台面板。

---

## 🚀 一键部署

您可以通过点击下方的部署按钮，快速将本项目克隆并部署到您自己的腾讯云 EdgeOne Pages 中：

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fkeaidang%2Fedgelink)

> 💡 **部署提示**：上方一键部署已直接绑定您的公开仓库。若您后续将项目克隆到其他私有仓库或个人分支，可以手动把链接中的 `repository-url` 替换为您对应仓库的 URL 编码。

---

## ✨ 核心特性

- **全球超低延迟重定向**：基于 EdgeOne 全球边缘计算节点运行，重定向逻辑在距离用户最近的节点执行，无冷启动，毫秒级响应。
- **高颜值管理面板**：精美打磨的 Glassmorphism 暗黑科技风 UI，支持移动端自适应适配。
- **数据统计分析**：内置公共点击量统计 API，前端实时获取短链接访问次数。
- **本地设备历史**：使用浏览器 `localStorage` 记录该设备生成的历史短链，保证隐私且方便管理。
- **生成二维码**：一键生成高清二维码，支持前端直接下载保存。
- **安全管理后台**：支持使用 `ADMIN_TOKEN` 环境变量锁定的管理面板，可全局查看所有短链、查看累计点击量并一键删除短链。
- **离线开发支持**：代码内建 local mock 内存数据库机制，本地开发无需连接云端 KV，即可无缝秒级跑通。

---

## 🛠️ 本地开发与测试

EdgeLink 支持在本地零配置运行（自动降级为内存数据库运行）。

### 1. 克隆并安装依赖
```bash
git clone <your-repo-url>
cd Link
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

启动后，访问浏览器 **`http://localhost:3000`** 即可开始测试：
- **默认后台管理员密钥**：`admin123`
- 本地生成的短链数据保存在内存中，重启服务器后清空。

---

## 📦 云端部署与配置说明

在线上运行时，为了持久化存储数据并保护管理员面板，您需要完成以下两步配置：

### 1. 绑定 EdgeOne KV 命名空间
1. 在腾讯云 EdgeOne 控制台进入 **存储 - KV**。
2. 创建一个命名空间（例如命名为 `link`，您的 ID 为 `ns-p9i1iezwjxCp`）。
3. 进入您的 EdgeOne Pages 项目，选择 **项目设置** -> **绑定 KV**：
   - **变量名 (Variable Name)**: `link` (必须为 `link`，代码会自动识别该全局变量/环境变量)
   - **KV 命名空间**: 选择您刚刚创建的命名空间。

### 2. 配置管理员密钥 (ADMIN_TOKEN)
1. 进入您的 EdgeOne Pages 项目，选择 **项目设置** -> **环境变量**。
2. 添加一个新的环境变量：
   - **变量名 (Variable Name)**: `ADMIN_TOKEN`
   - **值 (Value)**: 输入您自定义的复杂密码（例如 `AdminSecrt2026`）。
3. 保存后重新部署。此时，在前端“管理控制台”中输入该值即可解锁全局链接列表的管理与删除。

---

## 📂 目录结构

```text
/
├── edgeone.json                   # EdgeOne Pages 路由构建配置
├── package.json                   # NPM 配置文件
├── LICENSE                        # 开源许可证 (MIT)
├── README.md                      # 开源说明文档
├── server.js                      # 本地开发仿真服务器
├── index.html                     # 控制台 HTML 结构
├── style.css                      # 自定义 HSL 暗黑科技风样式表
├── app.js                         # 前端业务逻辑与二维码生成器
└── edge-functions/                # 边缘计算服务函数目录
    ├── api/
    │   ├── create.js              # 生成短链接 API
    │   ├── stats.js               # 公共单链接点击量查询 API
    │   └── admin/
    │       ├── list.js            # 管理员拉取全部短链 API
    │       └── delete.js          # 管理员删除短链 API
    └── [code].js                  # 短链接重定向服务引擎 (带异步点击数累计)
```

---

## 📄 开源许可 & 作者信息

- **作者**：[keaidang](https://github.com/keaidang)
- **开源仓库**：[GitHub - keaidang/edgelink](https://github.com/keaidang/edgelink)

本项目依据 [MIT License](LICENSE) 协议开源。欢迎自由修改、分发与商业化使用。
