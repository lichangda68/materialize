# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

《材料科学基础》「五层解析」Web MVP：用户粘贴一句教材原句，AI 拆成五层（教材原句 / 通俗解释 / 物理画面 / 底层机理与因果 / 考试理解与误区）并配一张 SVG 示意图，目的是「降低理解门槛」而非总结教材。单页应用，无数据库、无登录、无会话。

## 常用命令

```bash
npm install        # 安装依赖（仅 express + dotenv）
npm start          # 启动服务，默认 http://localhost:3001（端口见 .env 的 PORT）
npm test           # 跑全部测试（node --test 自动发现 test/*.test.mjs）
node --test test/schema.test.mjs        # 跑单个测试文件
node --test --test-name-pattern="空输入" # 按名称匹配跑单个用例
```

测试用 stub 的 `chat`/`retrieve`，**无需真实 API key**。端到端验证需在 `.env` 配好 `DEEPSEEK_API_KEY` 后 `npm start` 手动验证。

## 架构（跨文件才能看清的部分）

单进程 Express 服务同时托管静态前端与 JSON API，后端完全无状态。

- **依赖注入是核心模式**：`src/server.js` 读配置、注入真实依赖、监听 → `src/app.js` 导出 `createApp({ chat, retrieve, config })` 工厂。`chat`（LLM 客户端）与 `retrieve`（真题检索）通过参数注入，测试用 stub 替换，因此不依赖真实 key 或数据文件。
- **LLM 链路**：`llm.js` 是 OpenAI 兼容客户端（原生 `fetch`、无 SDK），`LLMError` 带 HTTP 状态；错误归一化——401→「密钥无效」、429→「请求频繁」、超时/网络→友好中文提示，**绝不把底层细节或密钥回传给前端**。仅 `/api/parse` 开启 `response_format: json_object`。
- **输出结构由 `schema.js` 把关**：五键 `original / plain_explanation / physical_picture / mechanism / exam_traps`（`REQUIRED_KEYS`）必须齐全且非空，否则抛 `SchemaError` 由 `app.js` 重试一次。`exam_refs` 与 `physical_picture_svg` 是可选透传。
- **「禁止编造真题」的落地**：`retrieval.js` 用硬编码术语表 `TERMS` 对 `data/questions/*.md` 做关键词命中，返回真实真题；`app.js` 用 `retrieve()` 的结果**覆写** `exam_refs`，不信任模型自造年份/题号。`retrieve(text)` 是唯一检索接口，未来换向量检索或接 PDF 划词只改这一处。
- **追问无状态**：`/api/followup` 接收 `{ question, context }`，上下文由前端拼好（五层结果 + 历史）传入，后端不存会话。

## 关键约定与易错点

- **端口 3001**（3000 被同机 mini-mall 占用）。改 `.env` 或 `config.js` 后必须重启 `npm start` 才生效。
- **密钥只放 `.env`**（已 gitignore），**禁止硬编码进 `config.js`**——历史上发生过一次把明文 key 写进 `config.js` 的事故。
- **SVG 渲染安全**：`physical_picture_svg` 是 AI 生成的第 3 层配图。前端 `app.js` 将其转 base64 用 `<img>` 渲染（`<img>` 内 SVG 脚本不执行），**不要用 `innerHTML` 直插 SVG**；所有 LLM 文本一律 `textContent` 写入。SVG 不合法时前端自动退回文字图注。
- **语言选型**：本项目按需求书用纯 JavaScript（无构建步骤、无 TS），是对全局「TS 严格模式」偏好的**有意偏离**，勿擅自迁移。
- **文案/注释用中文**；代码、命令、变量名、文件路径保持英文。
- **数据**：`data/questions/*.md` 是检索数据源；`data/textbook/*.pdf` 本期不解析，留待「PDF 划词」扩展。
