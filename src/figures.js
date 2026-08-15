// 教材图库：把 data/figures 下的图片按「高频概念」匹配到输入句子
// 命中时返回对应教材图文件名，未命中返回 null，由前端回退到 AI 自画 SVG

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countHits } from './retrieval.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIGURES_DIR = path.resolve(__dirname, '../data/figures');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// 高频概念 → 关联术语（术语子集来自 retrieval.TERMS）。文件名用 keyword（如「位错.png」）
const CONCEPTS = [
  { keyword: '铁碳相图', terms: ['相图', '铁碳相图', '珠光体', '铁素体', '渗碳体', '奥氏体', '马氏体', '贝氏体', '莱氏体', '共晶', '共析', '包晶', '杠杆定律'] },
  { keyword: '扩散', terms: ['扩散', '渗碳', '扩散系数', '阿伦尼乌斯', '反应扩散', '扩散型相变', '间隙原子'] },
  { keyword: '位错', terms: ['位错', '滑移', '滑移面', '滑移方向', '刃型位错', '螺型位错', '柏氏矢量', '弗兰克', '线缺陷', '堆垛层错', '不全位错'] },
  { keyword: '形核', terms: ['形核', '均匀形核', '非均匀形核', '过冷度', '结构起伏', '成分过冷'] },
  { keyword: '强化', terms: ['强化', '固溶强化', '细晶强化', '加工硬化', '第二相', '固溶', '时效', '析出', '包申格效应'] },
  { keyword: '再结晶', terms: ['再结晶', '回复', '晶粒长大', '晶粒', '晶界'] },
  { keyword: '晶体结构', terms: ['晶体', '晶格', '晶胞', '空间点阵', '晶面', '晶向', '晶面指数', '晶向指数', '密排', '原子配位数', '致密度', '固溶体'] },
  { keyword: '缺陷', terms: ['点缺陷', '空位', '线缺陷', '面缺陷', '孪晶', '层错能'] },
];

// 缓存扫描结果（增删图后重启生效）
let cached = null;

/**
 * 扫描 data/figures 下的图片文件名（不含路径）。
 * @returns {string[]}
 */
export function listFigures() {
  if (cached) return cached;
  cached = [];
  let files = [];
  try {
    files = fs.readdirSync(FIGURES_DIR);
  } catch {
    return cached; // 目录不存在视为无图
  }
  for (const f of files) {
    if (IMAGE_EXTS.has(path.extname(f).toLowerCase())) cached.push(f);
  }
  return cached;
}

/**
 * 根据输入句子匹配一张教材图，返回文件名或 null。
 * @param {string} text 教材原句
 * @param {{ files?: string[], concepts?: Array<{keyword: string, terms: string[]}> }} [opts] 供测试注入
 * @returns {string|null}
 */
export function findFigure(text, opts = {}) {
  const concepts = opts.concepts ?? CONCEPTS;
  const files = opts.files ?? listFigures();
  if (!files.length) return null;

  const fileStems = new Map(files.map((f) => [path.basename(f, path.extname(f)), f]));
  const hits = countHits(text || '');

  let best = null;
  let bestScore = 0;
  for (const c of concepts) {
    const file = fileStems.get(c.keyword);
    if (!file) continue; // 该概念还没配图

    let score = text.includes(c.keyword) ? 3 : 0; // 概念关键词直接出现，加权
    for (const t of c.terms) {
      if (hits.has(t)) score += 1;
    }
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
