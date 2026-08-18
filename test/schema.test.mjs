// 输出校验（schema.js）单元测试：五键齐全 / 缺字段 / 非 JSON / 代码块容错 / exam_refs 透传
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResult, extractJson, SchemaError } from '../src/schema.js';

const VALID = JSON.stringify({
  original: '  滑移面和滑移方向往往是金属晶体中原子排列最密的晶面和晶向。 ',
  plain_explanation: '金属变形时，原子沿排列最密的方向滑动最省力。',
  physical_picture: '想象一排排最密的原子面像书页一样滑过彼此。',
  mechanism: '密排面原子间距小、密排方向原子排列密，滑移所需临界分切应力最小。',
  exam_traps: '常考滑移面/方向的判定，误区是把密排面与宏观面混淆。',
});

test('五键齐全时通过并归一化（去除首尾空白）', () => {
  const r = parseResult(VALID);
  assert.equal(r.original, '滑移面和滑移方向往往是金属晶体中原子排列最密的晶面和晶向。');
  assert.deepEqual(r.exam_refs, []);
});

test('缺字段时抛 SchemaError', () => {
  assert.throws(() => parseResult('{"original":"a"}'), SchemaError);
});

test('字段为空字符串时抛 SchemaError', () => {
  const bad = JSON.stringify({
    original: 'a',
    plain_explanation: ' ',
    physical_picture: 'c',
    mechanism: 'd',
    exam_traps: 'e',
  });
  assert.throws(() => parseResult(bad), SchemaError);
});

test('非 JSON 文本抛 SchemaError', () => {
  assert.throws(() => parseResult('这不是 JSON'), SchemaError);
});

test('空内容抛 SchemaError', () => {
  assert.throws(() => parseResult(''), SchemaError);
});

test('带代码块标记也能提取并解析', () => {
  const raw = '```json\n' + VALID + '\n```';
  const r = parseResult(raw);
  assert.equal(r.plain_explanation, '金属变形时，原子沿排列最密的方向滑动最省力。');
});

test('extractJson 能容错前后缀文本', () => {
  const obj = extractJson('以下是结果：' + VALID + ' 以上。');
  assert.equal(obj.mechanism, '密排面原子间距小、密排方向原子排列密，滑移所需临界分切应力最小。');
});

test('exam_refs 透传', () => {
  const raw = JSON.stringify({
    original: 'a',
    plain_explanation: 'b',
    physical_picture: 'c',
    mechanism: 'd',
    exam_traps: 'e',
    exam_refs: [{ year: '2019', question: '铁碳相图分析' }],
  });
  assert.equal(parseResult(raw).exam_refs.length, 1);
});

test('无 exam_refs 时回退为空数组', () => {
  assert.deepEqual(parseResult(VALID).exam_refs, []);
});

test('physical_picture_svg 透传：有则保留、无则空串', () => {
  const base = {
    original: 'a',
    plain_explanation: 'b',
    physical_picture: 'c',
    mechanism: 'd',
    exam_traps: 'e',
  };
  const withSvg = parseResult(
    JSON.stringify({ ...base, physical_picture_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }),
  );
  assert.ok(withSvg.physical_picture_svg.startsWith('<svg'));
  assert.equal(parseResult(JSON.stringify(base)).physical_picture_svg, '');
});

test('LLM 返回 null 时抛 SchemaError（而非 TypeError）', () => {
  assert.throws(() => parseResult('null'), SchemaError);
  assert.throws(() => parseResult('  null  '), SchemaError);
});

test('提取 JSON 能容错末尾多余花括号（不再贪心匹配）', () => {
  const valid = JSON.stringify({
    original: 'a',
    plain_explanation: 'b',
    physical_picture: 'c',
    mechanism: 'd',
    exam_traps: 'e',
  });
  const r = parseResult(valid + ' （注：参见教材第3章}');
  assert.equal(r.original, 'a');
});
