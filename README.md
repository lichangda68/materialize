# 材料科学基础 · 五层解析

一个极简 Web MVP：粘贴一句《材料科学基础》教材原句，AI 把它拆成五层讲透，降低专业术语与抽象概念的理解门槛——而不是简单总结教材。

**五层结构**（固定）：

1. **教材原句** — 忠实回显输入
2. **通俗解释** — 用大白话讲清
3. **物理画面** — 脑海里能「看到」的具体场景
4. **底层机理与因果** — 讲清「为什么」
5. **考试理解与常见误区** — 怎么考、易混点（可引用真实真题）

## 技术栈

- 前端：HTML + CSS + 原生 JavaScript（无构建步骤）
- 后端：Node.js + Express
- AI：DeepSeek（OpenAI 兼容，`.env` 里可换成任意 OpenAI 兼容服务）
- 依赖仅 `express` + `dotenv`，LLM 调用用 Node 原生 `fetch`，无 SDK

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置密钥（.env 已被 .gitignore 忽略，不会提交）
cp .env.example .env
# 编辑 .env，把 DEEPSEEK_API_KEY 换成真实密钥

# 3. 启动
npm start
# 打开 http://localhost:3001
```

> 未配置密钥时服务仍会启动、页面可访问，但调用解析会返回友好的「密钥无效」提示。

## 目录结构

```
src/
  server.js      # 入口：加载配置、注入依赖、监听端口
  app.js         # Express 应用工厂（chat/retrieve 可注入，便于测试）
  config.js      # 读取 .env
  llm.js         # OpenAI 兼容客户端 + 错误归一化
  prompts.js     # 五层解析 / 追问 prompt（含禁止编造约束）
  schema.js      # 输出 JSON 校验与归一化
  retrieval.js   # 真题库关键词检索（无向量库）
  public/        # 前端静态页面
data/
  questions/     # 真题汇编（检索数据源）
  textbook/      # 参考课本 PDF（扫描版，本期不解析）
  figures/       # 教材示意图库（按概念关键词命名的图片，命中优先展示）
test/            # node:test 单元/集成测试
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/parse` | 入参 `{ text, chapter?, page? }` → 返回固定五层 JSON |
| POST | `/api/followup` | 入参 `{ question, context }` → 返回 `{ answer }` |
| GET | `/api/health` | 健康检查 |

五层解析响应结构：

```json
{
  "original": "...",
  "plain_explanation": "...",
  "physical_picture": "...",
  "physical_picture_svg": "<svg ...>...</svg>",
  "mechanism": "...",
  "exam_traps": "...",
  "exam_refs": [ { "year": "2019", "question": "..." } ],
  "figure": "位错.png"
}
```

`exam_refs` 是后端检索到的**真实真题**（命中时非空），用于落地「禁止编造真题」；考试层只能引用这些。

## 教材示意图库

「物理画面」卡片按优先级展示：**教材图库 > 自画 SVG**。把教材里的关键示意图按概念关键词命名（如 `位错.png`、`铁碳相图.png`）放进 `data/figures/`，命中时自动用教材原图，未命中回退到 AI 自画的 SVG。详见 [data/figures/README.md](data/figures/README.md)。

## 测试

```bash
npm test
```

三组测试（无需真实 API key，用 stub 的 `chat`/`retrieve`）：

- `test/schema.test.mjs` — 五键齐全 / 缺字段 / 非 JSON / 代码块容错
- `test/retrieval.test.mjs` — 切题 / 命中 / 未命中 / 条数上限
- `test/parse.test.mjs` — 空输入 400 / 长文本 400 / LLM 抛错 502 / 成功返回五层 / 追问

## 设计约束（遵守「禁止事项」）

- 不编造教材内容、页码、真题、数据、文献：考试层只能引用检索到的真实真题，prompt 中明确禁止自造年份/题号。
- 不为通俗而改变科学含义：prompt 硬约束 + 不确定时明确写「不确定」。
- 不擅自增加 V0.1 范围外功能：无登录、支付、数据库；不做 PDF 解析、向量库、流式输出。

## 后续扩展预留

- `retrieval.js` 的 `retrieve(text)` 是单一检索接口，未来可替换为向量检索或接入 `data/textbook/参考课本.pdf` 的 PDF 划词，无需改动其它模块。
- 追问的后端无状态、前端传历史，未来若需多用户会话可平滑迁移到服务端存储。
