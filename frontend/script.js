/* ══════════════════════════════════
   MEDCLEAR v3 — FRONTEND
══════════════════════════════════ */
const API_BASE = "https://medclearai.onrender.com";

/* ── State ── */
let currentAnalysis = null;
let chatHistory     = [];
let dnaAnim         = null;
let loadingDnaAnim  = null;

/* ── DOM ── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const screens = {
  upload:  $('#upload-screen'),
  loading: $('#loading-screen'),
  results: $('#results-screen'),
};

/* ══════════════════════════════════
   DNA ANIMATION
══════════════════════════════════ */
class DNAHelix {
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.t       = 0;
    this.running = true;
    this.speed   = options.speed   || 0.012;
    this.pairs   = options.pairs   || 14;
    this.amp     = options.amp     || null; // auto
    this.color1  = options.color1  || '13,158,128';
    this.color2  = options.color2  || '99,102,241';
    this._resize();
    this._raf();
  }

  _resize() {
    const dpr  = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.W = rect.width;
    this.H = rect.height;
  }

  _draw() {
    const { ctx, W, H, t } = this;
    ctx.clearRect(0, 0, W, H);
    const cx  = W / 2;
    const amp = this.amp || Math.min(W * 0.32, 50);
    const twists = 4;

    // Draw strands
    [0, Math.PI].forEach((offset, si) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const p = i / 120;
        const y = p * H;
        const a = p * Math.PI * twists * 2 + t + offset;
        const x = cx + amp * Math.cos(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = si === 0 ? `rgba(${this.color1},.45)` : `rgba(${this.color2},.45)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw pairs + nodes
    const els = [];
    for (let i = 0; i <= this.pairs; i++) {
      const p  = i / this.pairs;
      const y  = p * H;
      const a  = p * Math.PI * twists * 2 + t;
      const x1 = cx + amp * Math.cos(a);
      const x2 = cx + amp * Math.cos(a + Math.PI);
      const z1 = Math.sin(a);
      const z2 = Math.sin(a + Math.PI);
      const al1 = 0.35 + 0.65 * ((z1 + 1) / 2);
      const al2 = 0.35 + 0.65 * ((z2 + 1) / 2);
      const r1  = 3 + 2 * ((z1 + 1) / 2);
      const r2  = 3 + 2 * ((z2 + 1) / 2);
      els.push({ type: 'bar', x1, x2, y, al: Math.min(al1, al2) * .55, z: (z1 + z2) / 2 });
      els.push({ type: 'node', x: x1, y, r: r1, al: al1, c: this.color1, z: z1 });
      els.push({ type: 'node', x: x2, y, r: r2, al: al2, c: this.color2, z: z2 });
    }

    els.sort((a, b) => a.z - b.z);
    els.forEach(el => {
      if (el.type === 'bar') {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y);
        ctx.lineTo(el.x2, el.y);
        ctx.strokeStyle = `rgba(${this.color1},${el.al})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(el.x, el.y, Math.max(el.r, 1.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${el.c},${el.al})`;
        ctx.fill();
      }
    });

    this.t += this.speed;
  }

  _raf() {
    if (!this.running) return;
    this._draw();
    requestAnimationFrame(() => this._raf());
  }

  stop() { this.running = false; }
  start() { if (!this.running) { this.running = true; this._raf(); } }
}

function initDNA() {
  const bgCanvas = $('#dna-canvas');
  if (bgCanvas) {
    bgCanvas.style.width  = '320px';
    bgCanvas.style.height = '100%';
    dnaAnim = new DNAHelix(bgCanvas, { pairs: 16, speed: 0.008 });
  }
}

function initLoadingDNA() {
  const lc = $('#loading-dna');
  if (lc) {
    lc.style.width  = '80px';
    lc.style.height = '240px';
    loadingDnaAnim = new DNAHelix(lc, { pairs: 10, speed: 0.018, amp: 25 });
  }
}

/* ══════════════════════════════════
   DARK MODE
══════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('medclear_theme', theme);
  $$('.icon-moon').forEach(el => { el.hidden = theme === 'dark'; });
  $$('.icon-sun').forEach(el  => { el.hidden = theme !== 'dark'; });
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
applyTheme(localStorage.getItem('medclear_theme') || 'light');
$('#dark-toggle').addEventListener('click', toggleTheme);
$('#dark-toggle-results').addEventListener('click', toggleTheme);

/* ══════════════════════════════════
   SCREEN TRANSITIONS
══════════════════════════════════ */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'results' && loadingDnaAnim) { loadingDnaAnim.stop(); loadingDnaAnim = null; }
}

/* ══════════════════════════════════
   UPLOAD TYPE TABS
══════════════════════════════════ */
$$('.utype-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.utype-tab').forEach(b => b.classList.remove('active'));
    $$('.upanel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#upanel-${btn.dataset.upanel}`).classList.add('active');
  });
});

/* ══════════════════════════════════
   FILE UPLOAD
══════════════════════════════════ */
const fileInput = $('#file-input');
const dropZone  = $('#drop-zone');
const reportTxt = $('#report-text');
const analyzeBtn = $('#analyze-btn');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  showFileChip(file);
});

function showFileChip(file) {
  let chip = dropZone.querySelector('.file-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'file-chip';
    dropZone.appendChild(chip);
  }
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      chip.innerHTML = `<img src="${e.target.result}" class="file-chip-img" alt=""/><span>${escHtml(file.name)}</span>`;
    };
    reader.readAsDataURL(file);
  } else {
    chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>${escHtml(file.name)}</span>`;
  }
}

dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dt = new DataTransfer(); dt.items.add(file);
  fileInput.files = dt.files;
  showFileChip(file);
  $('[data-upanel="file"]').click();
});

/* ══════════════════════════════════
   ANALYZE
══════════════════════════════════ */
analyzeBtn.addEventListener('click', handleAnalyze);

async function handleAnalyze() {
  const file = fileInput.files[0];
  const text = reportTxt.value.trim();
  const activePanel = $('.upanel.active').id;
  const useFile = activePanel === 'upanel-file';

  if (useFile && !file) { showError('Please choose a file first.'); return; }
  if (!useFile && !text) {
    reportTxt.style.borderColor = 'var(--red)';
    setTimeout(() => { reportTxt.style.borderColor = ''; }, 2000);
    return;
  }

  analyzeBtn.disabled = true;
  showScreen('loading');
  initLoadingDNA();
  startLoadingAnim(file && file.type.startsWith('image/'));

  try {
    const fd = new FormData();
    if (useFile && file) fd.append('file', file);
    else fd.append('text', text);

    const res  = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);

    currentAnalysis = data;
    renderResults(data);
    initMeddie(data);
    saveHistory(data);
    showScreen('results');
    switchRTab('overview');

  } catch (err) {
    showScreen('upload');
    showError(err.message || 'Analysis failed. Please try again.');
  } finally {
    analyzeBtn.disabled = false;
  }
}

/* Loading animation */
const LOAD_MSGS  = ['Reading values and cross-referencing…','Identifying abnormal findings…','Assessing risk indicators…','Generating insights…'];
const LOAD_IMAGE = ['Reading medical image…','Extracting values with AI vision…','Cross-referencing findings…','Generating your analysis…'];
let _li = null, _lstep = 0;

function startLoadingAnim(isImage) {
  const msgs = isImage ? LOAD_IMAGE : LOAD_MSGS;
  let i = 0;
  const el = $('#loading-sub-text');
  if (el) el.textContent = msgs[0];
  _lstep = 0; setLoadStep(0);
  _li = setInterval(() => {
    i = (i + 1) % msgs.length;
    if (el) el.textContent = msgs[i];
    setLoadStep(Math.min(i, 2));
  }, 2400);
}

function setLoadStep(n) {
  $$('.lstep').forEach((el, i) => {
    el.classList.toggle('active', i === n);
    el.classList.toggle('done', i < n);
  });
}

function stopLoadingAnim() { clearInterval(_li); }

/* ══════════════════════════════════
   RESULTS TABS
══════════════════════════════════ */
$$('.rtab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchRTab(btn.dataset.rtab));
});

function switchRTab(name) {
  $$('.rtab-btn').forEach(b => b.classList.toggle('active', b.dataset.rtab === name));
  $$('.rtab-panel').forEach(p => p.classList.toggle('active', p.id === `rtab-${name}`));
}

/* ══════════════════════════════════
   RENDER RESULTS
══════════════════════════════════ */
function renderResults(data) {
  stopLoadingAnim();
  renderRisk(data.risk);
  renderSummary(data.summary);
  renderFindings(data.findings);
  renderLifestyle(data.lifestyle);
  renderQuestions(data.questions);
  renderSpecialists(data.specialists);
  highlightOrgans(data);
  animateGauge(data.risk);
}

/* ── Risk ── */
function renderRisk(risk) {
  if (!risk) return;
  const level = (risk.level || '').toLowerCase();
  let label = 'Unknown';
  if (level.includes('low'))      label = 'Low Risk';
  else if (level.includes('moderate')) label = 'Moderate Risk';
  else if (level.includes('high'))   label = 'High Risk';

  const banner = $('#risk-banner');
  const lvlEl  = $('#risk-level-text');
  const badge  = $('#risk-badge');
  const reason = $('#risk-reason-text');

  if (lvlEl) lvlEl.textContent = risk.level ? risk.level.charAt(0).toUpperCase() + risk.level.slice(1) + ' Risk' : '—';
  if (badge) { badge.textContent = label; badge.className = `risk-pill ${level.includes('moderate') ? 'moderate' : level.includes('high') ? 'high' : level.includes('low') ? 'low' : ''}`; }
  if (reason) reason.textContent = risk.reason || '';
}

/* ── Gauge ── */
function animateGauge(risk) {
  if (!risk) return;
  const arc    = $('#gauge-arc');
  const numEl  = $('#gauge-num');
  const score  = Math.min(Math.max(risk.score || 0, 0), 10);
  const total  = 257; // stroke-dasharray
  const offset = total - (score / 10) * total;
  if (arc)   setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);
  if (numEl) numEl.textContent = score;
}

/* ── Summary ── */
function renderSummary(text) {
  const el = $('#summary-content');
  if (el) el.textContent = text || 'No summary available.';
}

/* ── Findings ── */
const STATUS_ORDER = { high:0, abnormal:0, critical:0, moderate:1, borderline:1, low:2, normal:3, info:4 };

function getStatus(s) {
  const v = (s || '').toLowerCase();
  if (v.includes('high') || v.includes('abnormal') || v.includes('critical')) return 'high';
  if (v.includes('moderate') || v.includes('borderline')) return 'moderate';
  if (v.includes('low')) return 'low';
  if (v.includes('normal')) return 'normal';
  return 'info';
}

function renderFindings(findings) {
  const list = $('#findings-list');
  const badge = $('#findings-badge');
  const lbl   = $('#findings-count-label');
  if (!list || !findings?.length) return;

  const sorted = [...findings].sort((a, b) => (STATUS_ORDER[getStatus(a.status)] ?? 5) - (STATUS_ORDER[getStatus(b.status)] ?? 5));

  list.innerHTML = '';
  sorted.forEach(f => list.appendChild(buildFindingCard(f)));

  const count = findings.length;
  if (badge) badge.textContent = count;
  if (lbl)   lbl.textContent   = `${count} result${count !== 1 ? 's' : ''}`;
}

function buildFindingCard(f) {
  const st    = getStatus(f.status || f.flag);
  const div   = document.createElement('div');
  div.className = `finding-card st-${st}`;
  const isNeutral = ['normal','info'].includes(st);
  const barW  = st === 'high' ? 85 : st === 'moderate' ? 60 : st === 'low' ? 25 : st === 'normal' ? 50 : 40;

  div.innerHTML = `
    <div class="finding-top">
      <div class="finding-name">${escHtml(f.name || f.test || '')}</div>
      <span class="finding-badge ${isNeutral ? 'info' : ''}">${escHtml(f.status || f.flag || 'Info')}</span>
    </div>
    <div class="finding-value-row">
      <span class="finding-value">${escHtml(f.value || f.result || '—')}</span>
      ${f.reference ? `<span class="finding-ref">ref: ${escHtml(f.reference)}</span>` : ''}
    </div>
    <div class="finding-bar-wrap"><div class="finding-bar" style="width:0%" data-w="${barW}%"></div></div>
    ${f.explanation ? `<div class="finding-explanation">${escHtml(f.explanation)}</div>` : ''}
  `;

  // Animate bar
  setTimeout(() => {
    const bar = div.querySelector('.finding-bar');
    if (bar) bar.style.width = bar.dataset.w;
  }, 80);

  return div;
}

/* ── Lifestyle ── */
function renderLifestyle(items) {
  const grid = $('#lifestyle-list');
  if (!grid || !items?.length) return;
  grid.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'lifestyle-item';
    const icon = typeof item === 'object' ? (item.icon || '→') : '→';
    const cat  = typeof item === 'object' ? (item.category || '') : '';
    const text = typeof item === 'object' ? (item.suggestion || '') : String(item);
    div.innerHTML = `<span class="lifestyle-icon">${icon}</span><div class="lifestyle-text"><div class="lifestyle-cat">${escHtml(cat)}</div><div class="lifestyle-suggestion">${escHtml(text)}</div></div>`;
    grid.appendChild(div);
  });
}

/* ── Questions ── */
function renderQuestions(items) {
  const list = $('#questions-list');
  if (!list || !items?.length) return;
  list.innerHTML = '';
  (Array.isArray(items) ? items : parseList(items)).forEach(q => {
    const li = document.createElement('li');
    li.className = 'question-item';
    li.textContent = q;
    list.appendChild(li);
  });
}

/* ── Specialists ── */
function renderSpecialists(specialists) {
  const row  = $('#specialists-list');
  const sec  = $('#specialists-section');
  if (!row || !sec) return;
  if (!specialists?.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  row.innerHTML = '';
  specialists.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'specialist-chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      switchRTab('doctors');
      const loc = $('#doctor-location');
      if (loc) { loc.placeholder = `Find a ${s} near…`; loc.focus(); }
    });
    row.appendChild(chip);
  });
}

/* ══════════════════════════════════
   ORGAN HIGHLIGHTING
══════════════════════════════════ */
const ORGAN_MAP = {
  'org-brain':    ['brain','neurologist','neuro','headache','cognitive','memory','seizure'],
  'org-thyroid':  ['thyroid','tsh','t3','t4','endocrinologist','hypothyroid','hyperthyroid','iodine'],
  'org-heart':    ['heart','cardiac','cardiologist','cholesterol','ecg','ekg','coronary','artery','blood pressure','hypertension','ldl','hdl','triglyceride'],
  'org-lung-l':   ['lung','pulmonologist','respiratory','oxygen','saturation','breathing','pulmonary','bronch','spo2'],
  'org-lung-r':   ['lung','pulmonologist','respiratory','oxygen','saturation'],
  'org-liver':    ['liver','hepatologist','bilirubin','alt','ast','sgpt','sgot','hepatic','albumin','jaundice'],
  'org-stomach':  ['glucose','diabetes','hba1c','insulin','pancreas','gastroenterologist','stomach','gastric','blood sugar'],
  'org-kidney-l': ['kidney','nephrologist','creatinine','urea','bun','renal','uric','gfr','proteinuria'],
  'org-kidney-r': ['kidney','nephrologist','creatinine','urea','renal'],
};

const LABEL_MAP = {
  'org-brain':'lbl-brain','org-thyroid':'lbl-thyroid','org-heart':'lbl-heart',
  'org-lung-l':'lbl-lungs','org-lung-r':'lbl-lungs','org-liver':'lbl-liver',
  'org-stomach':'lbl-stomach','org-kidney-l':'lbl-kidneys','org-kidney-r':'lbl-kidneys',
};

function highlightOrgans(analysis) {
  const hint = $('#body-hint');
  // Reset all
  document.querySelectorAll('.organ').forEach(el => {
    el.style.opacity = '0'; el.classList.remove('active');
  });
  document.querySelectorAll('.organ-lbl').forEach(el => { el.style.opacity = '0'; });

  const text = [
    analysis.summary || '',
    JSON.stringify(analysis.findings || []),
    (analysis.specialists || []).join(' '),
    (analysis.questions   || []).join(' '),
  ].join(' ').toLowerCase();

  let anyActive = false;
  const activatedLabels = new Set();

  Object.entries(ORGAN_MAP).forEach(([organId, keywords]) => {
    if (keywords.some(kw => text.includes(kw))) {
      const el = document.getElementById(organId);
      if (el) {
        el.style.opacity = '1';
        el.classList.add('active');
        anyActive = true;
        const lblId = LABEL_MAP[organId];
        if (lblId && !activatedLabels.has(lblId)) {
          const lbl = document.getElementById(lblId);
          if (lbl) { lbl.style.opacity = '1'; activatedLabels.add(lblId); }
        }
      }
    }
  });

  if (hint) hint.textContent = anyActive ? 'Highlighted areas need attention' : 'No specific organ areas identified';
}

/* ══════════════════════════════════
   3D CARD EFFECT
══════════════════════════════════ */
function init3DCards() {
  $$('.card-3d').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - .5;
      const y = (e.clientY - rect.top)  / rect.height - .5;
      card.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ══════════════════════════════════
   FLOATING MEDDIE
══════════════════════════════════ */
const meddieModal    = $('#meddie-modal');
const meddieBackdrop = $('#meddie-backdrop');
const meddieOpen     = $('#meddie-fab');
const meddieClose    = $('#meddie-modal-close');

meddieOpen.addEventListener('click', () => {
  meddieModal.hidden    = false;
  meddieBackdrop.hidden = false;
  setTimeout(() => $('#chat-input')?.focus(), 300);
});

function closeMeddie() {
  meddieModal.hidden    = true;
  meddieBackdrop.hidden = true;
}

meddieClose.addEventListener('click', closeMeddie);
meddieBackdrop.addEventListener('click', closeMeddie);

/* ══════════════════════════════════
   CHAT
══════════════════════════════════ */
const chatInput  = $('#chat-input');
const chatSend   = $('#chat-send-btn');
const chatWindow = $('#chat-messages');

function initMeddie(data) {
  chatHistory = [];
  chatWindow.innerHTML = '';
  const risk = data.risk || {};
  const rNote = risk.level ? ` Your risk level is <strong>${risk.level}</strong> (${risk.score || 0}/10).` : '';
  addMsg('ai', `Hi! I'm Meddie. I've reviewed your report — <em>${escHtml(data.title || 'your medical report')}</em>.${rNote} Ask me anything about the findings.`, true);
}

chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
chatSend.addEventListener('click', sendChat);

$$('.starter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chatInput.value = chip.dataset.msg;
    sendChat();
    chip.closest('.chat-starters').style.display = 'none';
  });
});

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = '';
  chatSend.disabled = true;
  addMsg('user', msg);
  const typing = addTyping();
  chatHistory.push({ role: 'user', content: msg });

  try {
    const res  = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: currentAnalysis, history: chatHistory.slice(-10) }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
    const reply = data.response || 'I could not generate a response. Please try again.';
    chatHistory.push({ role: 'assistant', content: reply });
    typing.remove();
    addMsg('ai', reply);
  } catch (err) {
    typing.remove();
    addMsg('ai', 'Sorry, I encountered an error. Please try again.');
  } finally {
    chatSend.disabled = false;
    chatInput.focus();
  }
}

function addMsg(role, text, asHTML = false) {
  const wrap = document.createElement('div');
  wrap.className = `chat-msg chat-msg--${role === 'ai' ? 'ai' : 'user'}`;
  const av = document.createElement('div');
  av.className = 'chat-msg-av';
  if (role === 'ai') {
    av.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v.3H4.5V7z" stroke="currentColor" stroke-width="1.1"/></svg>`;
  } else {
    av.textContent = 'You'; av.style.fontSize = '8px';
  }
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  asHTML ? (bubble.innerHTML = text) : (bubble.textContent = text);
  wrap.appendChild(av); wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  requestAnimationFrame(() => { chatWindow.scrollTop = chatWindow.scrollHeight; });
}

function addTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg chat-msg--ai';
  wrap.innerHTML = `<div class="chat-msg-av"><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/></svg></div><div class="chat-typing"><span></span><span></span><span></span></div>`;
  chatWindow.appendChild(wrap);
  requestAnimationFrame(() => { chatWindow.scrollTop = chatWindow.scrollHeight; });
  return wrap;
}

/* ══════════════════════════════════
   DOCTOR SEARCH
══════════════════════════════════ */
$('#find-doctors-btn').addEventListener('click', handleDoctors);
$('#doctor-location').addEventListener('keydown', e => { if (e.key === 'Enter') handleDoctors(); });

async function handleDoctors() {
  const loc  = $('#doctor-location').value.trim();
  if (!loc) { $('#doctor-location').focus(); return; }
  const list = $('#doctor-list');
  const btn  = $('#find-doctors-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" class="spin"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="20 14"/></svg> Searching…`;
  list.innerHTML = '<div class="empty-state"><p>Searching near you…</p></div>';

  try {
    const res  = await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: loc, specialty: deriveSpecialty() }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    if (data.note && !data.doctors?.length) {
      list.innerHTML = `<div class="empty-state"><p>${escHtml(data.note)}</p></div>`; return;
    }
    renderDoctors(data.doctors || []);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>${escHtml(err.message || 'Search failed. Try a different location.')}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Search`;
  }
}

function renderDoctors(docs) {
  const list = $('#doctor-list');
  if (!docs.length) { list.innerHTML = '<div class="empty-state"><p>No results. Try a larger city or different area.</p></div>'; return; }
  list.innerHTML = '';
  docs.forEach(d => {
    const card = document.createElement('div');
    card.className = 'doctor-card';
    card.innerHTML = `
      <div class="doctor-av">${escHtml(getInitials(d.name || 'Dr'))}</div>
      <div class="doctor-info">
        <div class="doctor-name">${escHtml(d.name || 'Unknown')}</div>
        <div class="doctor-spec">${escHtml(d.specialty || d.type || 'Medical Facility')}</div>
        <div class="doctor-addr">${escHtml([d.address, d.distance_km ? `${d.distance_km} km` : ''].filter(Boolean).join(' · '))}</div>
        <div class="doctor-links">
          ${d.maps_url ? `<a href="${escHtml(d.maps_url)}" target="_blank" rel="noopener" class="doctor-link">📍 Maps</a>` : ''}
          ${d.phone    ? `<a href="tel:${escHtml(d.phone)}" class="doctor-link">📞 Call</a>` : ''}
          ${d.website  ? `<a href="${escHtml(d.website)}" target="_blank" rel="noopener" class="doctor-link">🌐 Web</a>` : ''}
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function deriveSpecialty() {
  if (!currentAnalysis) return 'general physician';
  const text = [currentAnalysis.summary || '', JSON.stringify(currentAnalysis.findings || []), (currentAnalysis.specialists || []).join(' ')].join(' ').toLowerCase();
  if (text.includes('cardio') || text.includes('heart') || text.includes('cholesterol')) return 'cardiologist';
  if (text.includes('glucose') || text.includes('diabetes') || text.includes('thyroid')) return 'endocrinologist';
  if (text.includes('kidney') || text.includes('creatinine')) return 'nephrologist';
  if (text.includes('liver') || text.includes('bilirubin')) return 'hepatologist';
  if (text.includes('lung') || text.includes('respiratory')) return 'pulmonologist';
  if ((currentAnalysis.specialists || []).length) return currentAnalysis.specialists[0].toLowerCase();
  return 'general physician';
}

/* ══════════════════════════════════
   PDF DOWNLOAD
══════════════════════════════════ */
$('#download-btn-top').addEventListener('click', downloadPDF);
$('#download-btn-actions').addEventListener('click', downloadPDF);

function downloadPDF() {
  if (!currentAnalysis) return;
  if (!window.jspdf) { window.print(); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 20, PW = doc.internal.pageSize.getWidth() - 2 * M;
  let y = M;
  const nl = (n = 6) => { y += n; if (y > 270) { doc.addPage(); y = M; } };
  const txt = (t, sz, style = 'normal', col = [0, 0, 0]) => {
    doc.setFontSize(sz); doc.setFont('helvetica', style); doc.setTextColor(...col);
    doc.splitTextToSize(String(t || ''), PW).forEach(l => {
      if (y > 275) { doc.addPage(); y = M; }
      doc.text(l, M, y); y += sz * .45;
    });
  };
  const sec = t => { nl(6); txt(t, 13, 'bold', [13, 158, 128]); nl(1); doc.setDrawColor(13,158,128); doc.setLineWidth(.3); doc.line(M, y, M+PW, y); y += 5; };

  txt(currentAnalysis.title || 'Medical Report Analysis', 20, 'bold', [14, 17, 23]);
  nl(3); txt(`MedClear AI · ${new Date().toLocaleDateString()}`, 9, 'normal', [120,120,120]);
  nl(8);
  if (currentAnalysis.risk) {
    const r = currentAnalysis.risk;
    const c = r.level === 'low' ? [30,140,90] : r.level === 'high' ? [201,54,54] : [212,131,10];
    txt(`Risk: ${(r.level||'').toUpperCase()}  ·  Score: ${r.score||0}/10`, 13, 'bold', c);
    if (r.reason) { nl(3); txt(r.reason, 10, 'normal', [80,80,80]); }
    nl(4);
  }
  sec('Summary'); txt(currentAnalysis.summary || '', 10, 'normal', [60,60,60]);
  if (currentAnalysis.findings?.length) {
    sec('Key Findings');
    currentAnalysis.findings.forEach(f => {
      nl(2); txt(`${f.name}: ${f.value} [${f.status||''}]${f.reference?' ref:'+f.reference:''}`, 10, 'bold', [14,17,23]);
      if (f.explanation) { nl(2); txt(f.explanation, 9, 'normal', [80,80,80]); }
      nl(2);
    });
  }
  if (currentAnalysis.specialists?.length) { sec('Specialists'); txt(currentAnalysis.specialists.join('  ·  '), 10, 'normal', [13,158,128]); }
  if (currentAnalysis.lifestyle?.length) {
    sec('Lifestyle');
    currentAnalysis.lifestyle.forEach(it => {
      nl(2); txt(`• ${typeof it === 'object' ? it.suggestion : it}`, 10, 'normal', [60,60,60]);
    });
  }
  if (currentAnalysis.questions?.length) {
    sec('Questions for Your Doctor');
    currentAnalysis.questions.forEach((q, i) => { nl(2); txt(`${i+1}. ${q}`, 10, 'normal', [60,60,60]); });
  }
  nl(10); txt('MedClear AI is for educational purposes only. Always consult a qualified healthcare professional.', 8, 'italic', [150,150,150]);
  doc.save(`MedClear-${(currentAnalysis.title||'Report').replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);
}

/* ══════════════════════════════════
   HISTORY
══════════════════════════════════ */
const HKEY = 'medclear_history_v2';

function saveHistory(data) {
  try {
    const h = JSON.parse(localStorage.getItem(HKEY) || '[]');
    h.unshift({ id: Date.now(), title: data.title, date: new Date().toISOString(), riskLevel: data.risk?.level || 'unknown', summary: (data.summary || '').slice(0, 120), data });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 5)));
  } catch (e) {}
}

function openHistory() {
  const list = $('#history-list');
  let h = [];
  try { h = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) {}
  list.innerHTML = '';
  if (!h.length) { list.innerHTML = '<p class="history-empty">No past analyses yet.</p>'; }
  else h.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<div class="history-item-title">${escHtml(item.title || 'Report')}</div><div class="history-item-meta"><span class="risk-chip risk-chip--${item.riskLevel||'unknown'}">${item.riskLevel||'unknown'}</span><span style="font-size:12px;color:var(--ink-50)">${new Date(item.date).toLocaleDateString()}</span></div><div class="history-item-summary">${escHtml(item.summary)}…</div>`;
    div.addEventListener('click', () => {
      currentAnalysis = item.data;
      renderResults(item.data); initMeddie(item.data);
      closeHistory(); showScreen('results'); switchRTab('overview');
      setTimeout(init3DCards, 100);
    });
    list.appendChild(div);
  });
  $('#history-panel').hidden = false;
  $('#history-overlay').hidden = false;
}

function closeHistory() { $('#history-panel').hidden = true; $('#history-overlay').hidden = true; }

$$('[id^="history-btn"]').forEach(btn => btn.addEventListener('click', openHistory));
$('#history-close').addEventListener('click', closeHistory);
$('#history-overlay').addEventListener('click', closeHistory);

/* ══════════════════════════════════
   BACK BUTTON
══════════════════════════════════ */
$('#back-btn').addEventListener('click', () => {
  currentAnalysis = null; chatHistory = [];
  fileInput.value = ''; reportTxt.value = '';
  const chip = dropZone?.querySelector('.file-chip'); if (chip) chip.remove();
  chatWindow.innerHTML = '';
  $('#doctor-list').innerHTML = '<div class="empty-state"><div class="empty-icon"><svg width="44" height="44" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="18" r="8" stroke="currentColor" stroke-width="1.2" opacity=".3"/><path d="M8 34c0-5 5-9 12-9s12 4 12 9" stroke="currentColor" stroke-width="1.2" opacity=".3" stroke-linecap="round"/></svg></div><p>Enter your city above to find nearby specialists</p></div>';
  document.querySelectorAll('.organ').forEach(el => { el.style.opacity='0'; el.classList.remove('active'); });
  showScreen('upload');
});

/* ══════════════════════════════════
   ERROR TOAST
══════════════════════════════════ */
function showError(msg) {
  const old = $('.err-toast'); if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'err-toast';
  Object.assign(t.style, { position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'var(--red)', color:'#fff', padding:'12px 20px', borderRadius:'var(--r-lg)', fontSize:'13.5px', fontWeight:'500', boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:'9999', maxWidth:'90vw', textAlign:'center', fontFamily:'var(--font-sans)' });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

/* ══════════════════════════════════
   UTILITIES
══════════════════════════════════ */
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function getInitials(n) { return n.split(' ').filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join(''); }
function parseList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\n+/).map(l=>l.replace(/^[\d.\-*•\s]+/,'').trim()).filter(Boolean);
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
window.addEventListener('load', () => {
  initDNA();
  setTimeout(init3DCards, 500);
});
