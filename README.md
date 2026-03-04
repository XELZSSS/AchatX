<div align="center">
  <img src="assets/icons/app.png" alt="AchatX" width="96" height="96" />
  <h1>AchatX</h1>
</div>

AchatX 是一款跨平台的AI聊天应用，支持多家模型供应商（兼容openai格式的第三方供应商）与搜索增强，适合日常对话与检索辅助。

## 📝 作者声明

本项目是由 Codex 从 0 到 1 的自主开发完成，可以说这个项目是用来展示 Codex 模型能力的，也可以当作一个玩具项目来体验和把玩。

## 🚀 核心功能

- 多模型供应商切换与模型配置
- 文本对话与记忆导出
- 可选搜索增强（搜索引擎）
- 会话自动保存与搜索
- 本地 Ollama 支持

## 🧱 技术栈

- Electron + Vite + React
- TypeScript
- Tailwind CSS
- OpenAI SDK / Google GenAI SDK
- Fastify 代理

## 🤝 支持的供应商

- Gemini
- OpenAI
- OpenAI-Compatible
- OpenRouter
- Ollama
- xAI
- DeepSeek
- GLM
- MiniMax
- Moonshot
- iFlow

## ⚡ 快速开始

1. 安装依赖

```
npm install
```

2. 启动开发模式

```
npm run electron:dev
```

如仅需前端：

```
npm run dev
```

## 🧭 基本使用

1. 打开设置，选择供应商并填写 API Key
2. 可按需开启“搜索引擎”并配置 Tavily Key
3. 新建对话后即可开始聊天
4. 输入后即可发送文本对话

## ⚙️ 配置说明

- API Key：必须填写，否则无法请求模型
- 模型：可填写供应商支持的模型名
- Base URL / 自定义 Header：OpenAI-Compatible、OpenRouter 支持
- 搜索引擎：可选，用于搜索增强
- 记忆：可在设置中的“记忆”标签页配置 Mem0

### 🧠 记忆功能（Mem0）

- 功能入口：设置 -> `记忆`
- 需要填写：
  - `Mem0 API Key`
  - `Mem0 用户 ID`
- 点击“导出”后会通过本地代理请求 Mem0 导出接口，并下载为本地 `json` 文件
- 该功能依赖网络，且需要有效的 Mem0 凭证

### 🔒 本地代理安全参数（可选）

- `MINIMAX_PROXY_PORT`：本地代理端口（默认 `4010`）
- `MINIMAX_PROXY_HOST`：本地代理监听地址（默认 `127.0.0.1`）
- `MINIMAX_PROXY_ALLOWED_ORIGINS`：额外允许的 CORS 来源，多个用逗号分隔
- `ACHATX_PROXY_TOKEN`：代理访问令牌；设置后，请求需带 `x-achatx-proxy-token` 头
- `ACHATX_PROXY_STATIC_HTTP2`：是否为静态上游代理启用 HTTP/2（默认关闭；支持 `1/true/yes/on`，也可在设置页「版本」标签中切换）

### 🌐 OpenRouter 专用说明

- 默认 Base URL：`https://openrouter.ai/api/v1`
- API Key：填写 OpenRouter 的 API Key
- 模型名：可填写 `openrouter/auto` 或任意 OpenRouter 模型 ID
- 可选自定义 Header（建议）：
  - `HTTP-Referer`：你的站点 URL
  - `X-Title`：你的应用名称

可选环境变量：

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`

### 🦙 Ollama 专用说明

- 默认 Base URL：`http://localhost:11434/v1/`
- API Key：可留空（仅用于占位）
- 模型名：填写本地 Ollama 模型名，例如 `llama3.2`

## 🧰 常用脚本

- 开发：`npm run electron:dev`
- 构建：`npm run build`
- Windows 打包：`npm run electron:build:win`
- 代码检查：`npm run lint`
- 格式化：`npm run format`

## 🗂️ 目录结构

```
apps/
  main/                         Electron 主进程
    proxy/                      代理进程启动与配置
    main.cjs                    主进程入口
    window.cjs                  窗口生命周期与导航控制
    preload.cjs                 渲染层安全桥接
    ipc.cjs                     主进程 IPC 注册
    tray.cjs                    托盘逻辑
    updater.cjs                 版本更新逻辑
  renderer/                     前端界面
    features/                   业务功能分层
    components/                 UI 组件
      settingsModal/            设置页子模块
    services/                   服务层
    utils/                      工具与 i18n
  server/                       本地代理服务
    proxy/                      代理路由/中间件/配置
    llm-proxy.mjs               代理入口
  shared/                       主进程与代理共享配置
assets/icons/                   应用图标
```

## ⚠️ 注意事项

- 本项目主要面向本地使用，API Key 会在本地保存
- 搜索增强需要额外的 Tavily Key
- 记忆导出需要额外的 Mem0 API Key 与用户 ID

## 🙏 致谢

- 感谢 [Codex CLI](https://github.com/openai/codex) 提供的开发支持
- 感谢 [Ollama](https://github.com/ollama/ollama) 提供的本地模型接口支持
- 感谢 [Mem0](https://github.com/mem0ai/mem0) 提供对记忆能力与相关接口方案的支持
- 感谢 [Tavily](https://github.com/tavily-ai/tavily-python) 提供的搜索能力接口支持
