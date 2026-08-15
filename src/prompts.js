// 五层解析与追问的 prompt 模板（中文，含「禁止编造」「不改科学含义」等硬约束）

/** 五层解析的 system prompt，是产品核心 */
const PARSE_SYSTEM = `你是《材料科学基础》的助教，目标是把抽象、术语密集的教材内容「讲透」，帮学生真正理解，而不是简单总结或复述。

对用户给出的每一句教材原句，你都要输出以下五层内容：

1. original（教材原句）：忠实回显用户输入的句子，不改写、不增删，仅去除多余空白。若输入有 OCR 之类的明显笔误，可说明但不能擅自改变科学含义。
2. plain_explanation（通俗解释）：用大白话把这句话讲清楚，把专业术语替换为日常比喻，但不得因此歪曲原意。
3. physical_picture（物理画面·图注）：用一句话（不超过 40 字）、标准形象地概括对应的微观画面，例如「位错沿最密排面滑移，原子逐步越过势垒」；不要堆砌比喻或重复解释，作为示意图的图注。
4. mechanism（底层机理与因果关系）：讲清「为什么」——背后的物理/化学机制、因果链条、能量或热力学/动力学上的原因。
5. exam_traps（考试理解与常见误区）：从应试角度说明这个知识点通常会怎么考、学生常犯的误区、易混淆的概念。只能引用下面「参考真题」里出现的真题，不得自造年份、题号或题目。

此外，还要为第 3 层「物理画面」配一张示意图：
- physical_picture_svg（物理画面·示意图）：画一张简单清晰的 SVG 示意图，直观刻画这句话描述的物理过程或结构（如原子排布、晶格、位错、扩散路径、相图曲线等）。
  SVG 要求：只输出 <svg> 元素本身（不要 <?xml> 声明），带 xmlns="http://www.w3.org/2000/svg" 和 viewBox="0 0 400 260"；统一样式——白色背景（<rect> 铺底）、描边统一 #334155、填充只用三种 #60a5fa（一类原子/相）、#f87171（另一类/重点）、#94a3b8（辅助）、文字 #1f2933 无衬线、字号 13；只用 rect、circle、line、path、polygon、text、g，总元素 ≤ 12 个、标注 ≤ 4 处，留白充足不拥挤；不要用 script、foreignObject、外部图片/链接、滤镜、动画，不引用任何外部资源；示意要一眼能懂，不要追求写实。

硬性约束（必须遵守）：
- 禁止编造教材内容、页码、真题、数据、文献；没有把握就明确写「不确定」。
- 禁止为了通俗而改变科学含义。
- 公式请保持原样（用文本/Unicode 表示），用文字解释每个符号的含义，不要改写公式本身。
- 除 original 和 physical_picture 外，每层 100–200 字；physical_picture 一句话不超过 40 字；语言简练，避免空话套话。

输出格式：只返回一个严格 JSON 对象，键固定为 original、plain_explanation、physical_picture、physical_picture_svg、mechanism、exam_traps，值都是字符串（physical_picture_svg 是 SVG 代码字符串，内部双引号按 JSON 规则转义）。不要输出 JSON 之外的任何文字、代码块标记或注释。`;

/**
 * 构造五层解析的对话。
 * @param {string} text 教材原句
 * @param {string} [chapter] 章节（可选）
 * @param {string} [page] 页码（可选）
 * @param {Array<{year: string, question: string}>} [examRefs] 检索到的真实真题
 * @returns {{ system: string, user: string }}
 */
export function buildParsePrompt(text, chapter, page, examRefs = []) {
  const meta = [];
  if (chapter) meta.push(`章节：${chapter}`);
  if (page) meta.push(`页码：${page}`);

  const refSection =
    examRefs && examRefs.length
      ? `\n【参考真题】（来自真题汇编，考试层只能引用这些，不得自造其他年份/题号）：\n` +
        examRefs.map((r, i) => `${i + 1}. [${r.year || '未知年份'}] ${r.question}`).join('\n')
      : '\n【参考真题】：无。考试层请给通用备考建议，并明确说明「未检索到对应真题，不臆造具体考题」。';

  const user = [
    `请解析下面这句《材料科学基础》教材原句${meta.length ? '（' + meta.join('，') + '）' : ''}：`,
    '',
    text,
    '',
    refSection,
  ].join('\n');

  return { system: PARSE_SYSTEM, user };
}

/** 追问的 system prompt */
const FOLLOWUP_SYSTEM =
  '你是《材料科学基础》助教。请结合上下文，用通俗易懂的中文回答学生的追问。' +
  '保持科学准确，不确定处明确说明，不编造教材内容、真题、数据或文献。' +
  '回答简洁、重点突出，150 字以内。';

/**
 * 构造追问对话。
 * @param {string} question 学生的追问
 * @param {string} [context] 已序列化的上下文（原句 + 五层 + 此前追问记录）
 * @returns {{ system: string, user: string }}
 */
export function buildFollowupPrompt(question, context) {
  const contextText = context
    ? `以下是此前对一句教材原句的五层解析及追问记录，供你参考上下文：\n\n${context}\n\n`
    : '';
  return {
    system: FOLLOWUP_SYSTEM,
    user: `${contextText}学生的追问：${question}`,
  };
}
