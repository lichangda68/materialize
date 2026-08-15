// 校验并归一化 LLM 输出的五层 JSON，保证「结果结构固定」
// 缺字段、非 JSON 时抛 SchemaError，由上层决定重试或报错

/** 五层解析必须包含的键 */
export const REQUIRED_KEYS = [
  'original',
  'plain_explanation',
  'physical_picture',
  'mechanism',
  'exam_traps',
];

/** 输出结构不合法时抛出 */
export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * 解析 LLM 返回文本并校验五层结构。
 * @param {string} raw LLM 返回的原始文本
 * @returns {{ original: string, plain_explanation: string, physical_picture: string, mechanism: string, exam_traps: string, exam_refs: Array }}
 */
export function parseResult(raw) {
  const obj = extractJson(raw);
  for (const key of REQUIRED_KEYS) {
    if (typeof obj[key] !== 'string' || obj[key].trim() === '') {
      throw new SchemaError(`解析结果缺少字段：${key}`);
    }
  }
  const out = {};
  for (const key of REQUIRED_KEYS) out[key] = obj[key].trim();
  out.exam_refs = Array.isArray(obj.exam_refs) ? obj.exam_refs : [];
  // 示意图为可选字段：有则保留、无则空串（前端据此决定是否渲染图片）
  out.physical_picture_svg = typeof obj.physical_picture_svg === 'string' ? obj.physical_picture_svg.trim() : '';
  return out;
}

/**
 * 从 LLM 文本中提取 JSON 对象，容错处理代码块标记、前后缀。
 * @param {string} raw
 * @returns {object}
 */
export function extractJson(raw) {
  if (!raw || typeof raw !== 'string') throw new SchemaError('AI 返回内容为空');
  // 先尝试直接解析
  try {
    return JSON.parse(raw);
  } catch {
    /* 继续尝试提取子串 */
  }
  // 提取第一个 {...} 子串（匹配到最后一个右花括号，尽量覆盖嵌套）
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* 继续抛错 */
    }
  }
  throw new SchemaError('AI 返回内容不是有效 JSON');
}
