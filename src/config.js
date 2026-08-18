// 集中读取环境变量，统一管理 AI 服务配置
import 'dotenv/config';

/**
 * 加载运行配置。
 * @returns {{ baseUrl: string, apiKey: string, model: string, timeout: number }}
 */
export function loadConfig() {
  const rawTimeout = Number(process.env.TIMEOUT_MS);
  const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 60000;
  return {
    // OpenAI 兼容端点，默认 DeepSeek
    baseUrl: (process.env.BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.MODEL || 'deepseek-chat',
    timeout,
  };
}
