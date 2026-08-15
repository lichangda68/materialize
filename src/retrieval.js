// 轻量真题检索：加载 data/questions 下的真题汇编 .md，按材料学术语词典做关键词命中计数
// 无向量库、零成本；抽象出 retrieve(text) 单一接口，未来可换成向量检索或接 PDF 划词

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../data/questions/大连海事大学材料科学基础真题汇编2007-2025.md');

// 材料学高频术语词典，用于命中计数（覆盖历年高频考点）
export const TERMS = [
  '固溶体', '固溶强化', '偏析', '相变', '原子配位数', '超点阵', '非均匀形核', '均匀形核',
  '结构起伏', '堆垛层错', '不全位错', '再结晶', '成分过冷', '拓扑密堆相', '电子浓度',
  '包申格效应', '反应扩散', '致密度', '置换固溶体', '空间点阵', '珠光体', '铁素体',
  '渗碳体', '奥氏体', '马氏体', '贝氏体', '莱氏体', '铁碳相图', '相图', '杠杆定律',
  '共晶', '共析', '包晶', '扩散', '渗碳', '阿伦尼乌斯', '扩散系数', '位错', '滑移',
  '滑移面', '滑移方向', '刃型位错', '螺型位错', '柏氏矢量', '弗兰克', '晶面', '晶向',
  '晶面指数', '晶向指数', '密排', '晶粒', '晶界', '细化', '形核', '过冷度', '回复',
  '晶粒长大', '强化', '加工硬化', '细晶强化', '第二相', '固溶', '析出', '热力学',
  '动力学', '自由能', '熵', '空位', '间隙原子', '点缺陷', '线缺陷', '面缺陷', '层错能',
  '孪晶', '塑性', '超塑性', '应变时效', '时效', '扩散型相变', '高分子', '聚合物',
];

// 模块级缓存，首次调用时懒加载
let entries = [];

/**
 * 从 markdown 真题汇编中解析出条目列表 [{ year, question }]。
 * 处理「1. 固溶体　2. 偏析」这种一行多题的情况。
 * @param {string} [file] 真题文件路径
 * @returns {Array<{year: string, question: string}>}
 */
export function loadEntries(file = DATA_FILE) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  let year = '';
  const found = [];
  for (const line of lines) {
    const y = line.match(/^#+\s*(20\d{2})\s*年/);
    if (y) {
      year = y[1];
      continue;
    }
    for (const question of extractQuestions(line)) {
      if (question.length >= 2) found.push({ year, question });
    }
  }
  return found;
}

/**
 * 从一行文本中提取题目（可能一行含多个题号）。
 * @param {string} line
 * @returns {string[]}
 */
export function extractQuestions(line) {
  const trimmed = line.trim();
  if (!/^\d+[.、．]\s*/.test(trimmed)) return [];
  // 按「空白 + 题号」边界拆成多个小题
  return trimmed
    .split(/\s+(?=\d+[.、．]\s*)/)
    .map((p) => p.replace(/^\d+[.、．]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * 统计文本命中的术语集合。
 * @param {string} text
 * @returns {Set<string>}
 */
export function countHits(text) {
  const hits = new Set();
  for (const term of TERMS) {
    if (text.includes(term)) hits.add(term);
  }
  return hits;
}

/**
 * 根据命中术语给真题条目打分。
 * @param {string} question
 * @param {Set<string>} hits
 * @returns {number}
 */
export function scoreEntry(question, hits) {
  let score = 0;
  for (const term of hits) {
    if (question.includes(term)) score += 1;
  }
  return score;
}

/**
 * 检索与输入相关的真实真题。
 * @param {string} text 输入的教材原句
 * @param {{ topN?: number, entries?: Array<{year: string, question: string}> }} [opts]
 * @returns {Array<{year: string, question: string}>} 命中数 0 或 topN 条
 */
export function retrieve(text, opts = {}) {
  const topN = opts.topN ?? 4;
  const pool = opts.entries ?? (entries.length ? entries : (entries = loadEntries()));

  const hits = countHits(text || '');
  if (hits.size === 0) return [];

  return pool
    .map((e) => ({ ...e, score: scoreEntry(e.question, hits) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ year, question }) => ({ year, question }));
}
