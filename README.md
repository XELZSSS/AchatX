<div align="center">
<img src="assets/icons/app.png" alt="AXCHAT" width="96" height="96" />
<h1>AXCHAT</h1>
  <p>
    <a href="./README.md">English</a> |
    <a href="./README.zh-CN.md">中文</a>
  </p>
  <p>AXCHAT is a desktop AI chat client built on a cross-platform stack.</p>
</div>

## Overview

- Multi-provider chat and model switching
- Local session save, search, and restore
- Third-party OpenAI-compatible integration
- Web search enhanced response capability

## Supported Providers

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

## Quick Start

Requirements:

- Node.js 20+
- npm

Install and run:

```bash
npm install
npm run electron:dev
```

Common commands:

- `npm run dev`: frontend only
- `npm run electron:build:win`: build Windows installer
- `npm run electron:build:win:portable`: build a single-file Windows portable package
- `npm run electron:build:win:all`: build the Windows installer and portable package

## Usage

1. Open Settings and choose a provider.
2. Enter the required API key or complete sign-in for the selected provider.
3. Configure model, base URL, custom headers, and search engine when needed.
4. Start a new session and chat.

## Notes

- Special note: When using Gemini CLI OAuth, get the login credentials from the console and place them in `axchat.local.json`.
- `GEMINI_CLI_PROJECT_ID` and `GOOGLE_CLOUD_PROJECT` can be configured directly in Settings, and also support environment variables.
- Search supports `Tavily`, `Exa`, and `SearXNG`.

Common environment variables:

- `GEMINI_CLI_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT_ID`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `SEARXNG_BASE_URL`
- `AXCHAT_PROXY_ALLOW_HTTP_TARGETS`

## Project Structure

```text
apps/
  main/       Electron main process
  renderer/
    application/     Use cases and orchestration
    infrastructure/  Providers, persistence, bridge clients
    presentation/    UI components and interaction hooks
    shared/          Shared data, types, utils, UI primitives
  shared/     Shared configuration
assets/       Icons and static assets
```
