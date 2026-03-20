<div align="center">
<img src="assets/icons/app.png" alt="Orlinx" width="96" height="96" />
<h1>Orlinx</h1>
  <p>
    <a href="./README.md">English</a> |
    <a href="./README.zh-CN.md">中文</a>
  </p>
  <p>Orlinx 是一个基于跨平台方案的桌面 AI Chat 客户端。</p>
</div>

## 功能简介

- 多供应商聊天与模型切换
- 本地会话保存、搜索与恢复
- 第三方 OpenAI 兼容格式接入
- 提供网络搜索增强模型回复能力

## 支持的供应商

- Gemini
- Gemini CLI OAuth
- OpenAI
- Codex OAuth
- OpenAI-Compatible
- NVIDIA
- xAI
- DeepSeek
- GLM
- MiniMax
- Kimi
- Xiaomi MiMo
- LongCat

## 快速开始

环境要求：

- Node.js 20+
- npm

安装并启动：

```bash
npm install
npm run electron:dev
```

常用命令：

- `npm run dev`：仅启动前端
- `npm run electron:build:win`：打包 Windows 安装程序
- `npm run electron:build:win:portable`：打包单文件 Windows 便携版
- `npm run electron:build:win:all`：同时打包 Windows 安装程序和便携版

## 使用

1. 打开设置，选择供应商。
2. 按供应商要求填写 API Key 或完成登录。
3. 按需配置模型、Base URL、自定义 Header 和搜索引擎。
4. 新建对话后即可开始聊天。

## 配置说明

- 特别注意：使用 Gemini CLI OAuth 登录时，需要在控制台获取登录凭证，并配置到 `orlinx.local.json` 文件。
- 可在设置页直接填写 `GEMINI_CLI_PROJECT_ID` 和 `GOOGLE_CLOUD_PROJECT`，也支持环境变量。
- 搜索功能支持 `Tavily`、`Exa` 和 `SearXNG`，推荐优先在设置页中配置。

常用环境变量：

- `GEMINI_CLI_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT_ID`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `SEARXNG_BASE_URL`
- `Orlinx_PROXY_ALLOW_HTTP_TARGETS`

## 项目目录

```text
apps/
  main/       Electron 主进程
  renderer/
    application/     用例与编排
    infrastructure/  Providers、持久化、桥接客户端
    presentation/    UI 组件与交互 hooks
    shared/          共享数据、类型、工具与 UI 基元
  shared/     共享配置
assets/       图标与静态资源
```

