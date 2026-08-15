// 真题检索（retrieval.js）单元测试：切题 / 加载 / 命中 / 未命中 / 条数上限
import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, loadEntries, extractQuestions, countHits, scoreEntry } from '../src/retrieval.js';

test('一行多题拆分为多个题目', () => {
  assert.deepEqual(extractQuestions('1. 固溶体　2. 偏析　3. 相变'), ['固溶体', '偏析', '相变']);
});

test('非题号行不提取', () => {
  assert.deepEqual(extractQuestions('**参考答案**：如下'), []);
  assert.deepEqual(extractQuestions('## 一、名词解释（每小题3分，共60分）'), []);
});

test('真题库可加载且含条目与年份', () => {
  const entries = loadEntries();
  assert.ok(entries.length > 100, `条目数应足够多，实际 ${entries.length}`);
  assert.ok(entries.some((e) => e.year === '2007'), '应含 2007 年条目');
  assert.ok(entries.every((e) => typeof e.question === 'string' && e.question.length >= 2));
});

test('术语命中返回相关真题', () => {
  const r = retrieve('铁碳相图的杠杆定律计算');
  assert.ok(r.length >= 1, '应命中至少一条真题');
  assert.ok(r.every((x) => typeof x.question === 'string'));
  assert.ok(r.some((x) => /相图|杠杆|碳/.test(x.question)), '命中题目应与输入相关');
});

test('无关文本返回空数组', () => {
  assert.deepEqual(retrieve('今天天气很好'), []);
});

test('空输入返回空数组', () => {
  assert.deepEqual(retrieve(''), []);
});

test('topN 上限生效', () => {
  const r = retrieve('位错', { topN: 3 });
  assert.ok(r.length <= 3);
});

test('命中计数与打分内部逻辑', () => {
  const hits = countHits('位错滑移与柏氏矢量');
  assert.ok(hits.has('位错'));
  assert.ok(hits.has('滑移'));
  assert.equal(scoreEntry('简述位错滑移的基本过程', hits), 2);
});
