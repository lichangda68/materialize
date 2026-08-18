// /api/parse 与 /api/followup 集成测试：用 stub 的 chat/retrieve，无需真实 API key
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { LLMError } from '../src/llm.js';

const VALID = JSON.stringify({
  original: '原句',
  plain_explanation: '通俗解释',
  physical_picture: '物理画面',
  mechanism: '底层机理',
  exam_traps: '考试误区',
});

// 启动 app 并监听随机端口，返回 baseUrl
function start(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function postJson(baseUrl, pathname, body) {
  const res = await fetch(baseUrl + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function makeApp(overrides = {}) {
  const chat = overrides.chat ?? (async () => VALID);
  const retrieve = overrides.retrieve ?? (() => []);
  return createApp({ chat, retrieve, config: { model: 'test-model' } });
}

test('空输入返回 400', async () => {
  const { server, baseUrl } = await start(makeApp());
  try {
    const { status, body } = await postJson(baseUrl, '/api/parse', { text: '   ' });
    assert.equal(status, 400);
    assert.equal(body.error, '请输入教材原句');
  } finally {
    server.close();
  }
});

test('长文本返回 400', async () => {
  const { server, baseUrl } = await start(makeApp());
  try {
    const { status } = await postJson(baseUrl, '/api/parse', { text: 'a'.repeat(2001) });
    assert.equal(status, 400);
  } finally {
    server.close();
  }
});

test('LLM 抛错时返回 502 且不泄露底层细节', async () => {
  const chat = async () => {
    throw new LLMError('API 密钥无效或未授权，请检查 .env 配置', 502);
  };
  const { server, baseUrl } = await start(makeApp({ chat }));
  try {
    const { status, body } = await postJson(baseUrl, '/api/parse', { text: '位错滑移' });
    assert.equal(status, 502);
    assert.equal(body.error, 'API 密钥无效或未授权，请检查 .env 配置');
  } finally {
    server.close();
  }
});

test('成功路径返回固定五层与 exam_refs', async () => {
  const retrieve = () => [{ year: '2019', question: '铁碳相图分析' }];
  const { server, baseUrl } = await start(makeApp({ retrieve }));
  try {
    const { status, body } = await postJson(baseUrl, '/api/parse', { text: '铁碳相图' });
    assert.equal(status, 200);
    for (const key of ['original', 'plain_explanation', 'physical_picture', 'mechanism', 'exam_traps']) {
      assert.equal(typeof body[key], 'string');
    }
    assert.deepEqual(body.exam_refs, [{ year: '2019', question: '铁碳相图分析' }]);
  } finally {
    server.close();
  }
});

test('LLM 首次输出非法 JSON、重试后成功', async () => {
  let calls = 0;
  const chat = async () => {
    calls += 1;
    return calls === 1 ? '不是 JSON' : VALID;
  };
  const { server, baseUrl } = await start(makeApp({ chat }));
  try {
    const { status, body } = await postJson(baseUrl, '/api/parse', { text: '位错' });
    assert.equal(status, 200);
    assert.equal(body.original, '原句');
    assert.equal(calls, 2);
  } finally {
    server.close();
  }
});

test('追问：空问题返回 400', async () => {
  const { server, baseUrl } = await start(makeApp());
  try {
    const { status } = await postJson(baseUrl, '/api/followup', { question: '' });
    assert.equal(status, 400);
  } finally {
    server.close();
  }
});

test('追问：成功返回答案文本', async () => {
  const chat = async () => '位错通过阻碍位错运动来强化金属。';
  const { server, baseUrl } = await start(makeApp({ chat }));
  try {
    const { status, body } = await postJson(baseUrl, '/api/followup', {
      question: '为什么位错能强化金属？',
      context: '【教材原句】位错',
    });
    assert.equal(status, 200);
    assert.equal(body.answer, '位错通过阻碍位错运动来强化金属。');
  } finally {
    server.close();
  }
});

test('追问：问题过长返回 400', async () => {
  const { server, baseUrl } = await start(makeApp());
  try {
    const { status } = await postJson(baseUrl, '/api/followup', { question: 'a'.repeat(501) });
    assert.equal(status, 400);
  } finally {
    server.close();
  }
});
