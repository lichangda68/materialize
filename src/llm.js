// OpenAI 兼容的 chat completions 客户端：用 Node 原生 fetch，无 SDK 依赖
// 职责：请求大模型、归一化错误（超时/鉴权/限流/网络），绝不把密钥或原始错误暴露给前端

/** 统一的 LLM 错误，携带 HTTP 状态码（默认 502） */
export class LLMError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

/**
 * 调用 OpenAI 兼容的 /chat/completions。
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ baseUrl: string, apiKey: string, model: string, timeout: number }} config
 * @param {{ json?: boolean, temperature?: number }} [opts]
 * @returns {Promise<string>} 返回 assistant 的文本内容
 */
export async function chat(messages, config, opts = {}) {
  const url = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  const payload = {
    model: config.model,
    messages,
    temperature: opts.temperature ?? 0.3,
  };
  // DeepSeek 支持 json_object 输出格式，便于解析五层结果；失败时 schema.js 有兜底提取
  if (opts.json) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401) throw new LLMError('API 密钥无效或未授权，请检查 .env 配置', 502);
      if (res.status === 429) throw new LLMError('请求过于频繁，请稍后重试', 502);
      throw new LLMError(`AI 服务返回错误（状态码 ${res.status}）`, 502);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new LLMError('AI 服务返回内容为空', 502);
    }
    return content;
  } catch (err) {
    // 已经归一化的错误直接抛出
    if (err instanceof LLMError) throw err;
    // 超时
    if (err?.name === 'AbortError') throw new LLMError('AI 服务响应超时，请稍后重试', 502);
    // 网络 / 其它未知错误：不把底层细节暴露给前端
    throw new LLMError('无法连接 AI 服务，请检查网络或 API 配置', 502);
  } finally {
    clearTimeout(timer);
  }
}
