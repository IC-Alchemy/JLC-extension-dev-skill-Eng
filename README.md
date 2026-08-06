**[English](README_EN.md)** | 中文

# extension-dev-skill

用于 [嘉立创EDA & EasyEDA 专业版](https://lceda.cn/) 扩展插件开发的 AI Skill。它提供类型驱动的 API 查询工具和插件开发工作流，让 API 查询以目标项目当前安装的 SDK 为准。

## 功能特性

- 针对[pro-api-sdk](https://github.com/easyeda/pro-api-sdk)优化
- 基于目标项目 `node_modules/@jlceda/pro-api-types/index.d.ts` 的类型驱动 API 查询
- 新增确定性 CLI：`scripts/eda-api.js`，支持 doctor/search/inspect
- recipes 和 guide 保留为场景流程、运行时语义和经验知识

## 安装说明

### 1. 拉取仓库到skill目录

根据你使用的 AI Agent 文档，找到或创建存放 Skill 的目录：

```bash
git clone https://github.com/easyeda/extension-dev-skill
```

例如：  

> **QwenCode**  
> **项目作用域**：位于项目根目录下的 .qwen/skills  
> **用户作用域**：位于 ~/.qwen/skills，对本机所有项目生效  
> 进入到对应的skills文件夹下  
> 在终端执行`git clone https://github.com/easyeda/extension-dev-skill`即可

> **OpenCode**  
> **项目作用域**：位于项目根目录下的 .opencode/skills  
> **用户作用域**：位于 ~/.config/opencode/skills，对本机所有项目生效  
> 进入到对应的skills文件夹下  
> 在终端执行`git clone https://github.com/easyeda/extension-dev-skill`即可


### 2. 使用指定skill

在你的 AI Agent 中确认 Skill 已加载，可通过命令指定skill。

例如：

> **QwenCode**  
> **1.进入终端**：在终端中输入`qwen`后回车  
> **2.指定skill并发送需求**：在QwenCode的CLI中输入`/skills`回车  
> 选择要使用的extension-dev-skill并回车，然后填入你的需求   

> **OpenCode**  
> **1.进入终端**：在终端中输入`opencode`后回车  
> **2.指定skill并发送需求**：在OpenCode的CLI中输入`/skills`回车  
> 选择要使用的extension-dev-skill并回车，然后填入你的需求   


## 已测试的平台
  
| 平台 | 模型 |
|------|------|
| OpenClaw | MiniMax-2.7 |
| OpenCode | MiMo V2 Pro Free|
| QwenCode | Qwen3-Coder |
| Kiro | Claude Opus4.6 |
| Trae | Kimi-K2 / Deepseek-V3|


## 推荐安装

[extension-dev-mcp-tools](https://github.com/easyeda/extension-dev-mcp-tools)

安装后可支持：构建 `.eext` → 导入浏览器 → 获取控制台日志。

[easyeda-api-skill](https://github.com/easyeda/easyeda-api-skill)  
[eext-run-api-gateway](https://github.com/easyeda/eext-run-api-gateway)

安装后可借助easyeda-api-skill的文档及eext-run-api-gateway插件进行API验证。



## 演示视频

基于 OpenCode：

https://github.com/user-attachments/assets/742954b8-9527-43ad-ae08-3f08ec083fa2


