'use strict';

const API_BASE = "https://medclearai.onrender.com";
let currentAnalysis = null;
let chatHistory = [];

/* ════════════════════════════════════
   BOOT
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initScreens();
  initUploadScreen();
  initResultsScreen();
  initAnatomy();
  createWireframeBody();
  initChat();
  setupEventListeners();
});

/* ════════════════════════════════════
   CURSOR
════════════════════════════════════ */
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const glow = document.getElementById('cursor-glow');

  document.addEventListener('mousemove', (e) => {
    dot.style.left  = e.clientX + 'px';
    dot.style.top   = e.clientY + 'px';
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
}

/* ════════════════════════════════════
   SCREENS
════════════════════════════════════ */
function initScreens() {
  const uploadScreen  = document.getElementById('upload-screen');
  const resultsScreen = document.getElementById('results-screen');

  window.showScreen = function(name) {
    uploadScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    if (name === 'upload')  uploadScreen.classList.add('active');
    if (name === 'results') resultsScreen.classList.add('active');
  };
}

/* ════════════════════════════════════
   UPLOAD SCREEN
════════════════════════════════════ */
function initUploadScreen() {
  const uploadTabs = document.querySelectorAll('.upload-tab');
  const fileArea   = document.getElementById('upload-file-area');
  const textArea   = document.getElementById('upload-text-area');
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('file-input');
  const analyzeBtn = document.getElementById('analyze-btn');

  uploadTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      uploadTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'file') {
        fileArea.style.display = 'block';
        textArea.style.display = 'none';
      } else {
        fileArea.style.display = 'none';
        textArea.style.display = 'block';
      }
    });
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(200,169,110,0.5)';
    dropZone.style.background  = 'rgba(200,169,110,0.04)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
    }
  });

  analyzeBtn.addEventListener('click', handleAnalyze);
}

async function handleAnalyze() {
  const fileInput  = document.getElementById('file-input');
  const reportText = document.getElementById('report-text');
  const activeTab  = document.querySelector('.upload-tab.active');

  const file = fileInput.files?.[0];
  const text = reportText?.value?.trim();

  if (activeTab.dataset.tab === 'file' && !file) {
    showToast('Please select a file first');
    return;
  }

  if (activeTab.dataset.tab === 'text' && !text) {
    showToast('Please paste some text first');
    return;
  }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;

  try {
    const fd = new FormData();
    if (activeTab.dataset.tab === 'file') {
      fd.append('file', file);
    } else {
      fd.append('text', text);
    }

    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      body: fd,
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);

    currentAnalysis = data;
    renderResults(data);
    window.showScreen('results');
  } catch (err) {
    showToast(err.message || 'Analysis failed');
  } finally {
    btn.disabled = false;
  }
}

function showToast(msg) {
  const existing = document.querySelector('._mc_toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = '_mc_toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position:    'fixed',
    bottom:      '24px',
    left:        '50%',
    transform:   'translateX(-50%)',
    background:  'rgba(176,92,92,0.9)',
    color:       '#f5f0e8',
    padding:     '11px 20px',
    borderRadius:'9px',
    fontSize:    '12.5px',
    zIndex:      '9999',
    fontFamily:  'Jost, sans-serif',
    fontWeight:  '400',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(12px)',
    border:      '1px solid rgba(176,92,92,0.5)',
    boxShadow:   '0 8px 24px rgba(0,0,0,0.4)',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 3500);
}

/* ════════════════════════════════════
   RESULTS SCREEN
════════════════════════════════════ */
function initResultsScreen() {
  const backBtn = document.getElementById('back-btn');
  backBtn?.addEventListener('click', () => {
    currentAnalysis = null;
    chatHistory     = [];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('file-input').value        = '';
    document.getElementById('report-text').value       = '';
    window.showScreen('upload');
  });
}

function renderResults(data) {
  document.getElementById('report-name').textContent = data.title || 'Medical Analysis';
  document.getElementById('report-date').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  renderSummary(data);
  renderFindings(data);
  renderAbnormalValues(data);
  renderRecommendations(data);
  renderQuestions(data);
  renderRiskBadge(data);
  highlightOrgans(data);
  initMeddie(data);
}

function renderSummary(data) {
  const el = document.querySelector('.card-summary .card-text');
  el.textContent = data.summary || 'No summary available';
}

function renderFindings(data) {
  const findings = data.findings || [];
  const grid     = document.getElementById('findings-grid');
  const count    = document.getElementById('findings-count');

  count.textContent = findings.length;
  grid.innerHTML    = '';

  findings.slice(0, 6).forEach(f => {
    const item = document.createElement('div');
    item.className = 'finding-item';
    item.innerHTML = `
      <div class="finding-name">${escHtml(f.name || f.test || '')}</div>
      <div class="finding-value">${escHtml(f.value || f.result || '—')}</div>
      <div class="finding-status">${escHtml(f.status || 'Info')}</div>
    `;
    grid.appendChild(item);
  });
}

function renderAbnormalValues(data) {
  const findings = data.findings || [];
  const abnormal = findings.filter(f =>
    ['high', 'abnormal', 'critical', 'low'].includes((f.status || '').toLowerCase())
  );

  if (!abnormal.length) {
    document.getElementById('abnormal-card').style.display = 'none';
    return;
  }

  document.getElementById('abnormal-card').style.display = 'block';
  const list = document.getElementById('abnormal-list');
  list.innerHTML = '';

  abnormal.forEach(f => {
    const item = document.createElement('div');
    item.className = 'abnormal-item';
    item.innerHTML = `
      <strong>${escHtml(f.name || f.test || '')}</strong>: ${escHtml(f.value || '—')}
      <br/><small>${escHtml(f.status || 'Abnormal')}</small>
    `;
    list.appendChild(item);
  });
}

function renderRecommendations(data) {
  const recs = data.lifestyle || [];
  if (!recs.length) {
    document.getElementById('recommendations-card').style.display = 'none';
    return;
  }

  document.getElementById('recommendations-card').style.display = 'block';
  const list = document.getElementById('recommendations-list');
  list.innerHTML = '';

  recs.forEach(r => {
    const item = document.createElement('div');
    item.className = 'recommendation-item';
    const icon = typeof r === 'object' ? (r.icon || '→') : '→';
    const cat  = typeof r === 'object' ? (r.category || '') : '';
    const text = typeof r === 'object' ? (r.suggestion || '') : String(r);
    item.innerHTML = `<strong>${escHtml(cat)}</strong>: ${icon} ${escHtml(text)}`;
    list.appendChild(item);
  });
}

function renderQuestions(data) {
  const questions = data.questions || [];
  const list  = document.getElementById('questions-list');
  const count = document.getElementById('questions-count');

  count.textContent = questions.length;
  list.innerHTML    = '';

  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    list.appendChild(li);
  });
}

function renderRiskBadge(data) {
  const badge = document.querySelector('.risk-badge');
  const level = (data.risk?.level || 'Unknown').toLowerCase();

  if (level.includes('low')) {
    badge.style.background = 'rgba(122,158,142,0.15)';
    badge.style.color      = '#a3c4b5';
    badge.textContent      = 'Low Risk';
  } else if (level.includes('high') || level.includes('critical')) {
    badge.style.background = 'rgba(176,92,92,0.15)';
    badge.style.color      = '#d98080';
    badge.textContent      = 'High Risk';
  } else {
    badge.style.background = 'rgba(200,169,110,0.15)';
    badge.style.color      = '#e2c99a';
    badge.textContent      = 'Moderate Risk';
  }
}

/* ════════════════════════════════════
   ANATOMY / WIREFRAME BODY
════════════════════════════════════ */
function initAnatomy() {
  document.addEventListener('mousemove', (e) => {
    const svg = document.getElementById('anatomy-svg');
    if (!svg) return;
    const x =  (e.clientX / window.innerWidth  - 0.5) * 8;
    const y = -(e.clientY / window.innerHeight - 0.5) * 4;
    svg.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  });
}

function createWireframeBody() {
  const svg = document.getElementById('anatomy-svg');
  if (!svg) return;

  /* ── palette aligned to old-money theme ── */
  const C = {
    body:    '#8a7a5a',   /* aged brass — skeleton / outline */
    heart:   '#b05c5c',   /* dusty rouge */
    lung:    '#7a9e8e',   /* muted sage */
    liver:   '#c8a96e',   /* gold */
    kidney:  '#8a9eb0',   /* muted slate */
    stomach: '#a08e6a',   /* warm bronze */
    thyroid: '#b8a070',   /* lighter brass */
    brain:   '#c8a96e',   /* gold-tinted */
    spine:   'rgba(138,122,90,0.25)',
    glow:    'rgba(200,169,110,0.12)',
  };

  /* ── defs ── */
  const defs = ns('defs');

  /* gradient for body outline */
  const grad = ns('linearGradient');
  grad.id = 'bodyGrad';
  setA(grad, { x1:'0%', y1:'0%', x2:'0%', y2:'100%' });
  const s1 = ns('stop');
  setA(s1, { offset:'0%',   'stop-color':'#c8a96e', 'stop-opacity':'0.9' });
  const s2 = ns('stop');
  setA(s2, { offset:'100%', 'stop-color':'#5a4a2a', 'stop-opacity':'0.4' });
  grad.append(s1, s2);
  defs.append(grad);

  /* glow filter */
  const filter = ns('filter');
  filter.id = 'organGlow';
  const blur = ns('feGaussianBlur');
  setA(blur, { stdDeviation:'2.5', result:'blur' });
  const merge = ns('feMerge');
  const mn1 = ns('feMergeNode'); setA(mn1, { in:'blur' });
  const mn2 = ns('feMergeNode'); setA(mn2, { in:'SourceGraphic' });
  merge.append(mn1, mn2);
  filter.append(blur, merge);
  defs.append(filter);

  svg.append(defs);

  /* ── helpers ── */
  function ns(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }
  function setA(el, attrs) {
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  }
  function organ(el, id, organName) {
    el.id = id;
    el.classList.add('organ');
    el.dataset.organ = organName;
    return el;
  }
  function circle(cx, cy, r, stroke, id, name, fill = 'none') {
    const c = ns('circle');
    setA(c, { cx, cy, r, stroke, 'stroke-width':'1.2', fill });
    return organ(c, id, name);
  }
  function ellipse(cx, cy, rx, ry, stroke, id, name) {
    const e = ns('ellipse');
    setA(e, { cx, cy, rx, ry, stroke, 'stroke-width':'1.1', fill:'none' });
    return organ(e, id, name);
  }
  function path(d, stroke, id, name, fill = 'none', sw = '1.2') {
    const p = ns('path');
    setA(p, { d, stroke, fill, 'stroke-width': sw, 'stroke-linejoin':'round' });
    if (id) return organ(p, id, name);
    return p;
  }
  function line(x1, y1, x2, y2, stroke, sw = '1.2') {
    const l = ns('line');
    setA(l, { x1, y1, x2, y2, stroke, 'stroke-width': sw });
    return l;
  }

  /* ── structure ── */

  // Neck
  svg.append(path('M140 75 L140 95 Q150 93, 160 95 L160 75', C.body));

  // Clavicles
  svg.append(path('M115 98 Q132 94, 150 95 Q168 94, 185 98', C.body, null, null, 'none', '1'));

  // Thorax cage lines
  [105,115,125,135].forEach((y, i) => {
    const w = [14, 18, 20, 18][i];
    svg.append(path(`M${150-w} ${y} Q150 ${y+4}, ${150+w} ${y}`, `rgba(138,122,90,0.22)`, null, null, 'none', '0.8'));
  });

  // Spine
  const spineEl = ns('path');
  setA(spineEl, {
    d: 'M150 95 Q149.5 150, 150 240',
    stroke: C.spine, 'stroke-width': '0.9', fill: 'none', 'stroke-dasharray': '3,4',
  });
  svg.append(spineEl);

  // Body outline
  const bodyOutline = ns('path');
  setA(bodyOutline, {
    d: 'M120 95 L113 185 Q113 215, 130 242 L170 242 Q187 215, 187 185 L180 95',
    stroke: 'url(#bodyGrad)', 'stroke-width': '1.5', fill: 'none', opacity: '0.65',
  });
  svg.append(bodyOutline);

  // Arms
  svg.append(line(120, 98, 100, 190, C.body, '1.2'));
  svg.append(line(180, 98, 200, 190, C.body, '1.2'));
  // Forearms
  svg.append(line(100, 190, 96,  260, C.body, '1'));
  svg.append(line(200, 190, 204, 260, C.body, '1'));

  // Hips
  svg.append(path('M130 242 Q130 255, 125 265 Q150 270, 175 265 Q170 255, 170 242', C.body, null, null, 'none', '1'));

  // Legs
  svg.append(line(135, 265, 130, 360, C.body, '1.4'));
  svg.append(line(165, 265, 170, 360, C.body, '1.4'));
  // Shins
  svg.append(line(130, 360, 128, 440, C.body, '1.2'));
  svg.append(line(170, 360, 172, 440, C.body, '1.2'));
  // Feet
  svg.append(path('M122 440 Q128 445, 138 444', C.body, null, null, 'none', '1'));
  svg.append(path('M178 440 Q172 445, 162 444', C.body, null, null, 'none', '1'));

  // Head
  const head = circle('150', '50', '28', C.brain, 'org-brain', 'Brain');
  setA(head, { opacity: '0.9', 'stroke-linecap': 'round' });
  svg.append(head);

  // Brain detail (lobes)
  svg.append(path('M130 47 Q133 38, 150 36 Q167 38, 170 47', `rgba(200,169,110,0.35)`, null, null, 'none', '0.9'));
  svg.append(path('M150 36 L150 55', `rgba(200,169,110,0.2)`, null, null, 'none', '0.7'));

  // Thyroid
  const thyroid = ellipse('150', '86', '9', '5', C.thyroid, 'org-thyroid', 'Thyroid');
  setA(thyroid, { opacity: '0.7' });
  svg.append(thyroid);

  // Left lung
  const lungL = ns('path');
  setA(lungL, {
    d: 'M122 100 Q118 110, 117 125 Q117 145, 122 155 Q130 160, 138 155 Q143 145, 143 125 Q143 108, 138 100 Z',
    stroke: C.lung, 'stroke-width': '1.1', fill: 'rgba(122,158,142,0.07)',
  });
  organ(lungL, 'org-lung-l', 'Left Lung');
  svg.append(lungL);

  // Right lung
  const lungR = ns('path');
  setA(lungR, {
    d: 'M178 100 Q182 110, 183 125 Q183 145, 178 155 Q170 160, 162 155 Q157 145, 157 125 Q157 108, 162 100 Z',
    stroke: C.lung, 'stroke-width': '1.1', fill: 'rgba(122,158,142,0.07)',
  });
  organ(lungR, 'org-lung-r', 'Right Lung');
  svg.append(lungR);

  // Heart
  const heart = ns('path');
  setA(heart, {
    d: 'M150 118 L144 112 Q138 109, 135 114 Q132 118, 136 124 L150 134 L164 124 Q168 118, 165 114 Q162 109, 156 112 Z',
    stroke: C.heart, 'stroke-width': '1.2', fill: 'rgba(176,92,92,0.15)',
  });
  organ(heart, 'org-heart', 'Heart');
  svg.append(heart);

  // Liver
  const liver = ns('path');
  setA(liver, {
    d: 'M155 148 Q170 145, 182 150 Q186 162, 180 174 Q170 180, 158 176 Q150 172, 148 162 Q148 152, 155 148 Z',
    stroke: C.liver, 'stroke-width': '1.1', fill: 'rgba(200,169,110,0.06)',
  });
  organ(liver, 'org-liver', 'Liver');
  svg.append(liver);

  // Stomach
  const stomach = ns('path');
  setA(stomach, {
    d: 'M136 152 Q130 158, 131 170 Q133 180, 143 182 Q153 183, 157 174 Q160 164, 155 154 Q148 148, 140 150 Z',
    stroke: C.stomach, 'stroke-width': '1', fill: 'rgba(160,142,106,0.06)',
  });
  organ(stomach, 'org-stomach', 'Stomach');
  svg.append(stomach);

  // Left kidney
  const kidneyL = ns('path');
  setA(kidneyL, {
    d: 'M123 178 Q118 183, 118 193 Q118 203, 123 207 Q130 210, 136 206 Q140 200, 140 191 Q140 182, 136 178 Q130 174, 123 178 Z',
    stroke: C.kidney, 'stroke-width': '1', fill: 'rgba(110,138,158,0.07)',
  });
  organ(kidneyL, 'org-kidney-l', 'Left Kidney');
  svg.append(kidneyL);

  // Right kidney
  const kidneyR = ns('path');
  setA(kidneyR, {
    d: 'M177 178 Q182 183, 182 193 Q182 203, 177 207 Q170 210, 164 206 Q160 200, 160 191 Q160 182, 164 178 Q170 174, 177 178 Z',
    stroke: C.kidney, 'stroke-width': '1', fill: 'rgba(110,138,158,0.07)',
  });
  organ(kidneyR, 'org-kidney-r', 'Right Kidney');
  svg.append(kidneyR);

  /* ── organ tooltip ── */
  const tooltip = document.querySelector('.organ-tooltip') || document.getElementById('organ-tooltip');

  document.querySelectorAll('.organ').forEach(o => {
    o.addEventListener('mouseenter', () => {
      tooltip.textContent = o.dataset.organ;
      tooltip.classList.add('visible');
    });
    o.addEventListener('mousemove', (e) => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 12) + 'px';
    });
    o.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

function highlightOrgans(data) {
  const ORGAN_KEYWORDS = {
    'org-brain':   ['brain', 'neuro', 'headache'],
    'org-thyroid': ['thyroid', 'tsh', 't3', 't4'],
    'org-heart':   ['heart', 'cardiac', 'cholesterol', 'blood pressure'],
    'org-lung-l':  ['lung', 'respiratory', 'oxygen', 'spo2'],
    'org-lung-r':  ['lung', 'respiratory'],
    'org-liver':   ['liver', 'bilirubin', 'alt', 'ast'],
    'org-stomach': ['glucose', 'diabetes', 'stomach'],
    'org-kidney-l':['kidney', 'creatinine', 'urea', 'renal'],
    'org-kidney-r':['kidney', 'creatinine'],
  };

  const text = [
    data.summary || '',
    JSON.stringify(data.findings || []),
    (data.specialists || []).join(' '),
  ].join(' ').toLowerCase();

  Object.entries(ORGAN_KEYWORDS).forEach(([id, kws]) => {
    const organ = document.getElementById(id);
    if (!organ) return;
    const match = kws.some(k => text.includes(k));
    if (match) {
      organ.classList.add('highlight');
      organ.style.opacity = '1';
    } else {
      organ.classList.remove('highlight');
      organ.style.opacity = '0.35';
    }
  });
}

/* ════════════════════════════════════
   MEDDIE CHAT
════════════════════════════════════ */
function initChat() {
  const input   = document.getElementById('chat-input');
  const send    = document.getElementById('chat-send');
  const prompts = document.querySelectorAll('.prompt-chip');

  if (send)  send.addEventListener('click', sendMessage);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  prompts.forEach(chip => {
    chip.addEventListener('click', () => {
      const msg = chip.dataset.prompt;
      if (input) input.value = msg;
      sendMessage();
    });
  });
}

function initMeddie(data) {
  chatHistory = [];
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = '';

  const risk     = data.risk?.level || 'unknown';
  const greeting = `Hi! I've analysed your <em>${data.title || 'medical report'}</em>. Your risk level is <strong>${risk}</strong>. What would you like to know?`;
  addMessage('ai', greeting);
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');
  const msg   = input?.value?.trim();

  if (!msg) return;

  input.value   = '';
  send.disabled = true;

  addMessage('user', msg);
  chatHistory.push({ role: 'user', content: msg });

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: currentAnalysis,
        history: chatHistory.slice(-5),
      }),
    });

    const data  = await res.json();
    const reply = data.response || 'I could not generate a response.';
    addMessage('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    addMessage('ai', 'Sorry, I encountered an error. Please try again.');
  } finally {
    send.disabled = false;
    input?.focus();
  }
}

function addMessage(role, text) {
  const messages = document.getElementById('chat-messages');
  const msg    = document.createElement('div');
  msg.className = 'message ' + role;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML  = text;

  msg.appendChild(bubble);
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

/* ════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════ */
function setupEventListeners() {
  document.getElementById('risk-btn')?.addEventListener('click', () => {
    showToast(`Risk Level: ${currentAnalysis?.risk?.level || 'Unknown'}`);
  });

  document.getElementById('meddie-btn')?.addEventListener('click', () => {
    document.getElementById('chat-input')?.focus();
  });

  document.getElementById('pdf-btn')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('diet-btn')?.addEventListener('click', () => {
    showToast('Diet plan coming soon');
  });

  document.getElementById('doctor-btn')?.addEventListener('click', () => {
    showToast('Find doctor feature coming soon');
  });
}

/* ════════════════════════════════════
   UTILITIES
════════════════════════════════════ */
function escHtml(str) {
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(str || '').replace(/[&<>"']/g, c => map[c]);
}
