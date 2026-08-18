// 服务入口：加载配置、注入依赖、启动 HTTP 服务
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { chat } from './llm.js';
import { retrieve } from './retrieval.js';

const config = loadConfig();
const app = createApp({ chat, retrieve, config });

if (!config.apiKey) {
  console.warn('[提示] 未检测到 DEEPSEEK_API_KEY，请复制 .env.example 为 .env 并填入密钥后再启动。');
}

const rawPort = Number(process.env.PORT);
const PORT = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 3001;
// 默认只监听本机回环地址，避免局域网内他人访问并消耗 API 额度；如需局域网访问可显式设置 HOST
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`材料科学基础 · 五层解析已启动：http://localhost:${PORT}`);
});
