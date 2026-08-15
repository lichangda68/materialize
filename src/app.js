// Express 应用工厂：静态页面 + /api/parse + /api/followup + /api/health
// chat 与 retrieve 通过参数注入，便于测试用 stub 替换；后端完全无状态

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMError } from './llm.js';
import { buildParsePrompt, buildFollowupPrompt } from './prompts.js';
import { parseResult, SchemaError } from './schema.js';
import { findFigure } from './figures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_TEXT_LEN = 2000; // 单句输入长度上限

/**
 * 创建 Express 应用。
 * @param {{ chat: Function, retrieve: Function, config: { model: string } }} deps
 * @returns {import('express').Express}
 */
export function createApp({ chat, retrieve, config }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/figures', express.static(path.resolve(__dirname, '../data/figures')));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, model: config.model });
  });

  app.post('/api/parse', async (req, res) => {
    const { text, chapter, page } = req.body || {};

    // 输入校验
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: '请输入教材原句' });
    }
    if (text.length > MAX_TEXT_LEN) {
      return res.status(400).json({ error: `文本过长，请控制在 ${MAX_TEXT_LEN} 字以内` });
    }

    try {
      const refs = retrieve(text);
      const { system, user } = buildParsePrompt(text.trim(), chapter, page, refs);
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      let result;
      try {
        result = parseResult(await chat(messages, config, { json: true }));
      } catch (err) {
        // 只有「结构不合法」才重试一次；LLM/网络错误直接上抛
        if (!(err instanceof SchemaError)) throw err;
        result = parseResult(await chat(messages, config, { json: true }));
      }

      // 覆写为后端检索到的真实真题，保证「考试层引用」不依赖模型自造
      result.exam_refs = refs;
      // 匹配教材图库；命中返回文件名，未命中为 null（前端回退到自画 SVG）
      result.figure = findFigure(text);
      res.json(result);
    } catch (err) {
      if (err instanceof LLMError) return res.status(err.status || 502).json({ error: err.message });
      if (err instanceof SchemaError) return res.status(502).json({ error: 'AI 返回结果无法解析，请重试' });
      console.error('[parse] 未预期错误：', err);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  app.post('/api/followup', async (req, res) => {
    const { question, context } = req.body || {};
    if (typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: '请输入要追问的问题' });
    }

    try {
      const { system, user } = buildFollowupPrompt(question, context);
      const raw = await chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        config,
      );
      res.json({ answer: raw.trim() });
    } catch (err) {
      if (err instanceof LLMError) return res.status(err.status || 502).json({ error: err.message });
      console.error('[followup] 未预期错误：', err);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  return app;
}
