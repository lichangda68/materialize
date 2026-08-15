// 前端交互：调用 /api/parse 与 /api/followup，渲染五层卡片与追问
// 注意：所有来自 LLM 的文本一律用 textContent 写入，避免 XSS

const LAYERS = [
  { key: 'original', title: '① 教材原句', accent: 'original' },
  { key: 'plain_explanation', title: '② 通俗解释', accent: 'plain' },
  { key: 'physical_picture', title: '③ 物理画面', accent: 'picture' },
  { key: 'mechanism', title: '④ 底层机理与因果', accent: 'mechanism' },
  { key: 'exam_traps', title: '⑤ 考试理解与常见误区', accent: 'exam' },
];

const textInput = document.getElementById('text-input');
const chapterInput = document.getElementById('chapter-input');
const pageInput = document.getElementById('page-input');
const parseBtn = document.getElementById('parse-btn');
const errorMsg = document.getElementById('error-msg');

const resultSection = document.getElementById('result-section');
const cardsEl = document.getElementById('cards');
const qaHistoryEl = document.getElementById('qa-history');
const followupInput = document.getElementById('followup-input');
const followupBtn = document.getElementById('followup-btn');
const followupError = document.getElementById('followup-error');

let lastResult = null; // 最近一次五层解析结果
let qaHistory = []; // 追问记录 [{ q, a }]

parseBtn.addEventListener('click', parse);
followupBtn.addEventListener('click', followup);
followupInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') followup();
});

async function parse() {
  const text = textInput.value.trim();
  if (!text) {
    showError(errorMsg, '请输入教材原句');
    return;
  }
  clearError(errorMsg);
  setLoading(true);

  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        chapter: chapterInput.value.trim(),
        page: pageInput.value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '解析失败，请重试');

    lastResult = data;
    qaHistory = [];
    renderResult(data);
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showError(errorMsg, err.message || '解析失败，请重试');
  } finally {
    setLoading(false);
  }
}

async function followup() {
  const question = followupInput.value.trim();
  if (!question) return;
  clearError(followupError);
  setFollowupLoading(true);

  try {
    const res = await fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: buildContext() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '追问失败，请重试');

    qaHistory.push({ q: question, a: data.answer });
    followupInput.value = '';
    renderHistory();
  } catch (err) {
    showError(followupError, err.message || '追问失败，请重试');
  } finally {
    setFollowupLoading(false);
  }
}

function renderResult(data) {
  cardsEl.innerHTML = '';
  for (const layer of LAYERS) {
    const card = document.createElement('article');
    card.className = `card card-${layer.accent}`;

    const h = document.createElement('h3');
    h.textContent = layer.title;

    // 物理画面卡片：教材图库优先，其次自画 SVG，文字作为图注
    if (layer.key === 'physical_picture') {
      if (data.figure) {
        const img = document.createElement('img');
        img.className = 'diagram';
        img.alt = '教材示意图';
        img.src = '/figures/' + encodeURIComponent(data.figure);
        card.appendChild(img);
      } else if (isValidSvg(data.physical_picture_svg)) {
        const img = document.createElement('img');
        img.className = 'diagram';
        img.alt = '物理画面示意图';
        img.src = svgToDataUri(data.physical_picture_svg);
        card.appendChild(img);
      }
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    body.textContent = data[layer.key] || '';

    card.appendChild(h);
    card.appendChild(body);

    // 考试卡片若命中真实真题，追加「参考真题」脚注
    if (layer.key === 'exam_traps' && Array.isArray(data.exam_refs) && data.exam_refs.length) {
      card.appendChild(buildExamRefs(data.exam_refs));
    }

    cardsEl.appendChild(card);
  }
  qaHistoryEl.innerHTML = '';
}

function buildExamRefs(refs) {
  const wrap = document.createElement('div');
  wrap.className = 'exam-refs';

  const title = document.createElement('strong');
  title.textContent = '参考真题';
  wrap.appendChild(title);

  const ul = document.createElement('ul');
  for (const r of refs) {
    const li = document.createElement('li');
    li.textContent = `[${r.year || '未知年份'}] ${r.question}`;
    ul.appendChild(li);
  }
  wrap.appendChild(ul);
  return wrap;
}

// 判断字符串是否为含 <svg> 标记的 SVG
function isValidSvg(str) {
  return typeof str === 'string' && /<svg[\s>]/i.test(str) && /<\/svg>/i.test(str);
}

// 将 SVG 字符串转为 data URI（base64）。用 <img> 渲染以隔离脚本，避免 XSS
function svgToDataUri(svg) {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'data:image/svg+xml;base64,' + btoa(bin);
}

function renderHistory() {
  qaHistoryEl.innerHTML = '';
  for (const qa of qaHistory) {
    const q = document.createElement('div');
    q.className = 'qa qa-q';
    q.textContent = '你：' + qa.q;

    const a = document.createElement('div');
    a.className = 'qa qa-a';
    a.textContent = '助教：' + qa.a;

    qaHistoryEl.appendChild(q);
    qaHistoryEl.appendChild(a);
  }
  qaHistoryEl.scrollTop = qaHistoryEl.scrollHeight;
}

// 把五层结果 + 追问历史序列化，作为追问请求的上下文（后端无状态）
function buildContext() {
  const parts = [];
  if (lastResult) {
    parts.push('【教材原句】' + lastResult.original);
    parts.push('【通俗解释】' + lastResult.plain_explanation);
    parts.push('【物理画面】' + lastResult.physical_picture);
    parts.push('【底层机理】' + lastResult.mechanism);
    parts.push('【考试误区】' + lastResult.exam_traps);
  }
  for (const qa of qaHistory) {
    parts.push('问：' + qa.q);
    parts.push('答：' + qa.a);
  }
  return parts.join('\n');
}

function setLoading(on) {
  parseBtn.disabled = on;
  parseBtn.textContent = on ? '解析中…' : '开始解析';
}

function setFollowupLoading(on) {
  followupBtn.disabled = on;
  followupBtn.textContent = on ? '回答中…' : '追问';
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function clearError(el) {
  el.hidden = true;
  el.textContent = '';
}
