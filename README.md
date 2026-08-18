
This entire skill was written by JLC PCB,  this is just an English AI translation.  Proceed at your own risk, and let us know if you see any translation that could be improved.  - Nate at IC Alchemy


This is a set of agent skills that help you write extensions for EasyEDA Pro.  There is a lot of potential here, their API is in depth enough that the possibilities are endless.  

---

...Begin the original readme...

English | **[中文](README.md)**

# extension-dev-skill

An AI Skill for [JLCEDA & EasyEDA Pro](https://pro.easyeda.com/) extension plugin development. It provides type-driven API query tools and plugin-development workflow guidance based on the SDK installed in the target project.

## Features

- Optimized for [pro-api-sdk](https://github.com/easyeda/pro-api-sdk)
- TypeScript-driven API discovery from the target project's `node_modules/@jlceda/pro-api-types/index.d.ts`
- Deterministic CLI for API doctor/search/inspect: `scripts/eda-api.js`
- Recipes and guides remain as semantic workflow and runtime knowledge
- MCP debugging toolchain support for automated build → import → log monitoring

## Installation

### 1. Clone the Repository to the Skills Directory

Find or create the skills directory according to your AI Agent's documentation:

```bash
git clone https://github.com/easyeda/extension-dev-skill
```

For example:

> **QwenCode**
> **Project scope**: `.qwen/skills` under the project root  
> **User scope**: `~/.qwen/skills`, applies to all projects on this machine  
> Navigate to the corresponding skills folder and run `git clone https://github.com/easyeda/extension-dev-skill`  

> **OpenCode**
> **Project scope**: `.opencode/skills` under the project root  
> **User scope**: `~/.config/opencode/skills`, applies to all projects on this machine  
> Navigate to the corresponding skills folder and run `git clone https://github.com/easyeda/extension-dev-skill`  

### 2. Use the Skill

Confirm the skill is loaded in your AI Agent, then specify it via command.

For example:

> **QwenCode**
> **1. Open terminal**: Type `qwen` and press Enter  
> **2. Specify skill and send request**: Type `/skills` in the QwenCode CLI and press Enter  
> Select `extension-dev-skill`, press Enter, then type your request  

> **OpenCode**
> **1. Open terminal**: Type `opencode` and press Enter  
> **2. Specify skill and send request**: Type `/skills` in the OpenCode CLI and press Enter  
> Select `extension-dev-skill`, press Enter, then type your request  

## Tested Platforms

| Platform | Model |
|----------|-------|
| OpenClaw | MiniMax-2.7 |
| OpenCode | MiMo V2 Pro Free / MiniMax-2.5 Free |
| QwenCode | Qwen3-Coder |
| Kiro | Claude Opus4.6 |
| Trae | Kimi-K2 / Deepseek-V3 / Doubao |

## MCP Debugging Tools (Optional)

[extension-dev-mcp-tools](https://github.com/easyeda/extension-dev-mcp-tools)

With MCP installed, the AI Agent supports: build `.eext` → import to browser → retrieve console logs.

## Demo Video

Based on OpenCode:

https://github.com/user-attachments/assets/742954b8-9527-43ad-ae08-3f08ec083fa2
