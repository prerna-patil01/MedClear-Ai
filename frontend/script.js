/* ════════════════════════════════════
   MEDCLEAR AI — Clean Frontend v4
   All modals & panels start CLOSED.
   No auto-triggers on load.
════════════════════════════════════ */
'use strict';

const API_BASE = "https://medclearai.onrender.com";

let currentAnalysis = null;
let chatHistory     = [];
let _loadTimer      = null;

/* ── Helpers ── */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ════════════════════════════════════
   BOOT — runs after DOM ready
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* Make absolutely sure every modal/panel starts hidden */
  $$('[id$="-modal"], [id$="-veil"], #history-panel, #history-veil').forEach(el => {
    el.hidden = true;
  });

  initCursor();
  initBgCanvas();
  initUploadTabs();
  initFileUpload();
  initAnalyzeBtn();
  initViewToggle();
  initOrganTooltips();
  initChat();
  initDoctorSearch();
  initModals();
  initHistory();
  initBackBtn();

});

/* ════════════════════════════════════
   CURSOR
════════════════════════════════════ */
function initCursor() {
  const dot   = $('#cursor-dot');
  const trail = $('#cursor-trail');
  const glow  = $('#cursor-glow');
  if (!dot || !trail || !glow) return;

  let mx = 0, my = 0, tx = 0, ty = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left  = mx + 'px';
    dot.style.top   = my + 'px';
    glow.style.left = mx + 'px';
    glow.style.top  = my + 'px';
  });

  (function animTrail() {
    tx += (mx - tx) * 0.13;
    ty += (my - ty) * 0.13;
    trail.style.left = tx + 'px';
    trail.style.top  = ty + 'px';
    requestAnimationFrame(animTrail);
  })();
}

/* ════════════════════════════════════
   NEURAL BG CANVAS
════════════════════════════════════ */
function initBgCanvas() {
  const canvas = $('#bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, nodes = [];
  const mouse = { x: -999, y: -999 };
  const N = 55, DIST = 140;

  const resize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < N; i++) {
    nodes.push({
      x: Math.random() * (window.innerWidth  || 1440),
      y: Math.random() * (window.innerHeight || 900),
      vx: (Math.random() - .5) * .28,
      vy: (Math.random() - .5) * .28,
      r:  1.4 + Math.random() * 1.4,
    });
  }

  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  (function draw() {
    ctx.clearRect(0, 0, W, H);

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      const dx = mouse.x - n.x, dy = mouse.y - n.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 110) { n.x -= dx * .012; n.y -= dy * .012; }
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < DIST) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(0,229,176,${(1 - d/DIST) * 0.16})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,229,176,0.3)';
      ctx.fill();
    });

    requestAnimationFrame(draw);
  })();
}

/* ════════════════════════════════════
   SCREEN TRANSITIONS
════════════════════════════════════ */
function showScreen(name) {
  const map = { upload: '#upload-screen', loading: '#loading-screen', results: '#results-screen' };
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = $(map[name]);
  if (target) target.classList.add('active');
}

/* ════════════════════════════════════
   UPLOAD TABS
════════════════════════════════════ */
function initUploadTabs() {
  $$('.uc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.uc-tab').forEach(b => b.classList.remove('active'));
      $$('.upanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $(`#upanel-${btn.dataset.upanel}`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ════════════════════════════════════
   FILE UPLOAD
════════════════════════════════════ */
function initFileUpload() {
  const fileInput = $('#file-input');
  const dropZone  = $('#drop-zone');
  if (!fileInput || !dropZone) return;

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showFileChip(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    fileInput.files = dt.files;
    showFileChip(f);
    /* Switch to file tab */
    const fileTab = $('[data-upanel="file"]');
    if (fileTab) fileTab.click();
  });
}

function showFileChip(file) {
  const dropZone = $('#drop-zone');
  if (!dropZone) return;
  let chip = dropZone.querySelector('.file-chip');
  if (!chip) { chip = document.createElement('div'); chip.className = 'file-chip'; dropZone.appendChild(chip); }

  if (file.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = e => { chip.innerHTML = `<img src="${e.target.result}" class="file-chip-img" alt=""/><span>${escHtml(file.name)}</span>`; };
    r.readAsDataURL(file);
  } else {
    chip.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>${escHtml(file.name)}</span>`;
  }
}

/* ════════════════════════════════════
   ANALYZE
════════════════════════════════════ */
function initAnalyzeBtn() {
  const btn = $('#analyze-btn');
  if (btn) btn.addEventListener('click', handleAnalyze);
}

async function handleAnalyze() {
  const fileInput  = $('#file-input');
  const reportText = $('#report-text');
  const btn        = $('#analyze-btn');
  const activePanel = $('.upanel.active');

  const file   = fileInput?.files?.[0];
  const text   = reportText?.value?.trim() || '';
  const isFile = activePanel?.id === 'upanel-file';

  if (isFile && !file) { showToast('Please choose a file first.'); return; }
  if (!isFile && !text) {
    if (reportText) { reportText.style.borderColor = 'var(--red)'; setTimeout(() => reportText.style.borderColor = '', 2000); }
    return;
  }

  if (btn) btn.disabled = true;
  showScreen('loading');
  startLoadingAnim(file?.type?.startsWith('image/'));

  try {
    const fd = new FormData();
    if (isFile && file) fd.append('file', file);
    else fd.append('text', text);

    const res  = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);

    currentAnalysis = data;
    renderResults(data);
    initMeddie(data);
    saveHistory(data);
    showScreen('results');

  } catch (err) {
    showScreen('upload');
    showToast(err.message || 'Analysis failed. Please try again.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* Loading */
const LOAD_MSGS  = ['Reading values and cross-referencing…','Identifying abnormal findings…','Assessing risk indicators…','Generating personalized insights…'];
const LOAD_IMAGE = ['Reading medical image with AI vision…','Extracting diagnostic values…','Cross-referencing findings…','Generating your analysis…'];

function startLoadingAnim(isImage) {
  stopLoadingAnim();
  const msgs = isImage ? LOAD_IMAGE : LOAD_MSGS;
  let i = 0;
  const el = $('#loading-msg');
  if (el) el.textContent = msgs[0];
  setLStep(0);
  _loadTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    if (el) el.textContent = msgs[i];
    setLStep(Math.min(i, 2));
  }, 2600);
}

function stopLoadingAnim() {
  if (_loadTimer) { clearInterval(_loadTimer); _loadTimer = null; }
}

function setLStep(n) {
  $$('.lstep').forEach((el, i) => {
    el.classList.toggle('active', i === n);
    el.classList.toggle('done',   i < n);
  });
  const bar = $('#loading-bar');
  if (bar) bar.style.width = `${((n + 1) / 3) * 100}%`;
}

/* ════════════════════════════════════
   RENDER RESULTS
════════════════════════════════════ */
function renderResults(data) {
  stopLoadingAnim();
  const titleEl = $('#report-title');
  if (titleEl) titleEl.textContent = data.title || 'Medical Report';

  renderGauge(data.risk);
  renderRisk(data.risk);
  renderSummary(data.summary);
  renderFindings(data.findings);
  renderLifestyle(data.lifestyle);
  renderQuestions(data.questions);
  renderSpecialists(data.specialists);
  renderStats(data);
  highlightOrgans(data);
}

function renderGauge(risk) {
  if (!risk) return;
  const score = Math.min(Math.max(+(risk.score) || 0, 0), 10);
  const arc = $('#gauge-arc');
  const num = $('#gauge-num');
  if (arc) setTimeout(() => { arc.style.strokeDashoffset = String(269 - (score / 10) * 269); }, 150);
  if (num) num.textContent = score;
}

function renderRisk(risk) {
  if (!risk) return;
  const lvl = (risk.level || '').toLowerCase();
  let label = 'Unknown', cls = '';
  if (lvl.includes('low'))                          { label = 'Low Risk';      cls = 'low'; }
  else if (lvl.includes('mod'))                     { label = 'Moderate Risk'; cls = 'moderate'; }
  else if (lvl.includes('high') || lvl.includes('crit')) { label = 'High Risk'; cls = 'high'; }

  const lvlEl = $('#risk-level');
  const pill  = $('#risk-pill');
  const rsn   = $('#risk-reason');

  if (lvlEl) {
    lvlEl.textContent = risk.level ? risk.level.charAt(0).toUpperCase() + risk.level.slice(1) + ' Risk' : '—';
    lvlEl.style.color = cls === 'low' ? 'var(--teal)' : cls === 'moderate' ? 'var(--amber)' : cls === 'high' ? 'var(--red)' : 'var(--t1)';
  }
  if (pill)  { pill.textContent = label; pill.className = `risk-badge ${cls}`; }
  if (rsn)   rsn.textContent = risk.reason || '';
}

function renderSummary(text) {
  const el = $('#summary-text');
  if (el) el.textContent = text || 'No summary available.';
}

function renderStats(data) {
  const fEl = $('#stat-findings'), qEl = $('#stat-q'), lEl = $('#stat-life');
  if (fEl) fEl.textContent = (data.findings || []).length;
  if (qEl) qEl.textContent = Array.isArray(data.questions) ? data.questions.length : parseList(data.questions).length;
  if (lEl) lEl.textContent = (data.lifestyle || []).length;
}

const STATUS_RANK = { high:0, abnormal:0, critical:0, moderate:1, borderline:1, low:2, normal:3, info:4 };
function getStatus(s) {
  const v = (s || '').toLowerCase();
  if (/high|abnormal|critical/.test(v)) return 'high';
  if (/moderate|borderline/.test(v))    return 'moderate';
  if (/low/.test(v))                    return 'low';
  if (/normal/.test(v))                 return 'normal';
  return 'info';
}

function renderFindings(findings) {
  const grid  = $('#chips-grid');
  const count = $('#chips-count');
  if (!grid || !findings?.length) return;

  const sorted = [...findings].sort((a, b) =>
    (STATUS_RANK[getStatus(a.status)] ?? 5) - (STATUS_RANK[getStatus(b.status)] ?? 5));

  grid.innerHTML = '';
  sorted.forEach((f, i) => {
    const el = buildChip(f);
    el.style.animationDelay = `${i * 0.04}s`;
    grid.appendChild(el);
  });

  if (count) count.textContent = findings.length;
}

function buildChip(f) {
  const st  = getStatus(f.status || f.flag);
  const div = document.createElement('div');
  div.className = `f-chip st-${st}`;
  div.innerHTML = `
    <div class="fc-top">
      <div class="fc-dot"></div>
      <span class="fc-name">${escHtml(f.name || f.test || '')}</span>
      <span class="fc-badge">${escHtml(f.status || f.flag || 'Info')}</span>
    </div>
    <div class="fc-val">${escHtml(f.value || f.result || '—')}${f.reference ? ` <span style="color:var(--t4);font-size:10px">ref:${escHtml(f.reference)}</span>` : ''}</div>
    ${f.explanation ? `<div class="fc-exp">${escHtml(f.explanation)}</div>` : ''}
  `;
  div.addEventListener('click', () => div.classList.toggle('expanded'));
  return div;
}

function renderLifestyle(items) {
  const list = $('#lifestyle-list');
  if (!list || !items?.length) return;
  list.innerHTML = '';
  items.forEach(item => {
    const div  = document.createElement('div');
    div.className = 'lifestyle-item';
    const icon = typeof item === 'object' ? (item.icon || '→') : '→';
    const cat  = typeof item === 'object' ? (item.category || '') : '';
    const text = typeof item === 'object' ? (item.suggestion || '') : String(item);
    div.innerHTML = `<span class="li-icon">${icon}</span><div><div class="li-cat">${escHtml(cat)}</div><div class="li-text">${escHtml(text)}</div></div>`;
    list.appendChild(div);
  });
}

function renderQuestions(items) {
  const list = $('#questions-list');
  if (!list) return;
  const arr = Array.isArray(items) ? items : parseList(items);
  if (!arr.length) return;
  list.innerHTML = '';
  arr.forEach(q => {
    const li = document.createElement('li');
    li.className = 'q-item';
    li.textContent = q;
    list.appendChild(li);
  });
}

function renderSpecialists(specs) {
  const list = $('#spec-list');
  const card = $('#spec-card');
  if (!list || !card) return;
  if (!specs?.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = '';
  specs.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'spec-chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      openModal('doctors');
      const loc = $('#doctor-location');
      if (loc) { loc.placeholder = `Find a ${s} near…`; loc.focus(); }
    });
    list.appendChild(chip);
  });
}

/* ════════════════════════════════════
   ORGAN HIGHLIGHTING
════════════════════════════════════ */
const ORGAN_KEYWORDS = {
  'org-brain':    ['brain','neuro','cognitive','memory','headache','seizure','neurologist'],
  'org-thyroid':  ['thyroid','tsh','t3','t4','hypothyroid','hyperthyroid','iodine','endocrinologist'],
  'org-heart':    ['heart','cardiac','cardio','cholesterol','ecg','ekg','coronary','hypertension','ldl','hdl','triglyceride','blood pressure','artery','cardiologist'],
  'org-lung-l':   ['lung','pulmonary','respiratory','oxygen','saturation','breathing','bronch','spo2','pulmonologist'],
  'org-lung-r':   ['lung','pulmonary','respiratory','oxygen','saturation'],
  'org-liver':    ['liver','bilirubin','alt','ast','sgpt','sgot','hepatic','albumin','jaundice','hepatologist'],
  'org-stomach':  ['glucose','diabetes','hba1c','insulin','pancreas','gastric','stomach','gastroenterologist','blood sugar'],
  'org-kidney-l': ['kidney','creatinine','urea','bun','renal','uric','gfr','proteinuria','nephrologist'],
  'org-kidney-r': ['kidney','creatinine','urea','renal'],
};

const LABEL_MAP = {
  'org-heart':    'lbl-heart',
  'org-lung-l':   'lbl-lungs',
  'org-lung-r':   'lbl-lungs',
  'org-brain':    'lbl-brain',
  'org-liver':    'lbl-liver',
  'org-kidney-l': 'lbl-kidneys',
  'org-kidney-r': 'lbl-kidneys',
};

function highlightOrgans(analysis) {
  const hint = $('#body-hint');
  $$('.organ').forEach(el => {
    el.style.opacity = '0';
    el.classList.remove('critical', 'moderate');
  });
  $$('.olabel').forEach(el => el.classList.remove('active'));

  const text = [
    analysis.summary || '',
    JSON.stringify(analysis.findings || []),
    (analysis.specialists || []).join(' '),
  ].join(' ').toLowerCase();

  let any = false;
  const doneLbls = new Set();

  Object.entries(ORGAN_KEYWORDS).forEach(([id, kws]) => {
    if (!kws.some(k => text.includes(k))) return;
    const el = document.getElementById(id);
    if (!el) return;

    el.style.opacity = '1';

    const isHighRisk = (analysis.findings || []).some(f =>
      kws.some(k => (f.name || '').toLowerCase().includes(k)) &&
      ['high','abnormal','critical'].includes(getStatus(f.status))
    );
    el.classList.add(isHighRisk ? 'critical' : 'moderate');

    any = true;
    const lblId = LABEL_MAP[id];
    if (lblId && !doneLbls.has(lblId)) {
      const lbl = document.getElementById(lblId);
      if (lbl) { lbl.classList.add('active'); doneLbls.add(lblId); }
    }
  });

  if (hint) hint.textContent = any
    ? 'Highlighted areas indicate conditions from your report'
    : 'Interactive Anatomy · Hover organs for details';
}

/* ════════════════════════════════════
   ORGAN TOOLTIP + VIEW TOGGLE
════════════════════════════════════ */
function initOrganTooltips() {
  const orgTip = $('#organ-tip');
  if (!orgTip) return;

  $$('.organ').forEach(organ => {
    organ.addEventListener('mouseenter', function() {
      const name = this.dataset.organ;
      const col  = this.dataset.color;
      if (!name) return;
      orgTip.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      orgTip.style.borderColor = `rgba(${col},0.5)`;
      orgTip.style.color = `rgb(${col})`;
      orgTip.classList.add('visible');
    });
    organ.addEventListener('mousemove', e => {
      const tw = orgTip.offsetWidth;
      let x = e.clientX + 14, y = e.clientY - 12;
      if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
      orgTip.style.left = x + 'px';
      orgTip.style.top  = y + 'px';
    });
    organ.addEventListener('mouseleave', () => orgTip.classList.remove('visible'));
  });
}

function initViewToggle() {
  $$('.vt-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      $$('.vt-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const svg = $('#body-svg');
      if (!svg) return;
      const mode = this.dataset.view;
      svg.style.filter = mode === 'xray'
        ? 'saturate(0) brightness(1.5) contrast(1.4) hue-rotate(180deg) drop-shadow(0 0 30px rgba(0,229,255,0.3))'
        : mode === 'back'
          ? 'hue-rotate(30deg) brightness(.85) drop-shadow(0 0 30px rgba(0,200,255,0.12))'
          : 'drop-shadow(0 0 30px rgba(0,229,255,0.12)) drop-shadow(0 20px 60px rgba(0,0,0,.6))';
    });
  });
}

/* ════════════════════════════════════
   MEDDIE CHAT
════════════════════════════════════ */
function initChat() {
  const input = $('#chat-input');
  const send  = $('#chat-send');

  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  if (send) send.addEventListener('click', sendChat);

  /* Starter chips — only attach once */
  $$('.cs-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.dataset.msg || '';
      sendChat();
      const starters = chip.closest('.chat-starters');
      if (starters) starters.style.display = 'none';
    });
  });
}

function initMeddie(data) {
  chatHistory = [];
  const msgs = $('#chat-msgs');
  if (msgs) msgs.innerHTML = '';

  /* Re-show starters */
  const starters = $('#chat-starters');
  if (starters) starters.style.display = '';

  const risk  = data.risk || {};
  const color = risk.level === 'low' ? 'var(--teal)' : risk.level === 'high' ? 'var(--red)' : 'var(--amber)';
  const rNote = risk.level
    ? ` Risk level: <strong style="color:${color}">${risk.level}</strong> (${risk.score || 0}/10).`
    : '';
  addMsg('ai', `Hi! I'm Meddie. I've analyzed <em>${escHtml(data.title || 'your report')}</em>.${rNote} Ask me anything about your findings.`, true);
}

async function sendChat() {
  const input = $('#chat-input');
  const send  = $('#chat-send');
  const msg   = input?.value?.trim();
  if (!msg) return;

  if (input) input.value = '';
  if (send)  send.disabled = true;

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
    if (!res.ok || data.error) throw new Error(data.error || 'Error');
    const reply = data.response || 'I could not generate a response.';
    chatHistory.push({ role: 'assistant', content: reply });
    typing.remove();
    addMsg('ai', reply);
  } catch (err) {
    typing.remove();
    addMsg('ai', 'Sorry, I encountered an error. Please try again.');
  } finally {
    if (send)  send.disabled = false;
    if (input) input.focus();
  }
}

function addMsg(role, text, html = false) {
  const msgs = $('#chat-msgs');
  if (!msgs) return;

  const wrap   = document.createElement('div');
  wrap.className = `cm cm--${role}`;

  const av     = document.createElement('div');
  av.className = 'cm-av';
  av.innerHTML = role === 'ai'
    ? `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v.3H4.5V7z" stroke="currentColor" stroke-width="1.1"/></svg>`
    : 'You';

  const bubble = document.createElement('div');
  bubble.className = 'cm-bubble';
  html ? (bubble.innerHTML = text) : (bubble.textContent = text);

  wrap.appendChild(av);
  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
}

function addTyping() {
  const msgs = $('#chat-msgs');
  if (!msgs) return { remove: () => {} };
  const wrap = document.createElement('div');
  wrap.className = 'cm cm--ai';
  wrap.innerHTML = `<div class="cm-av"><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/></svg></div><div class="cm-typing"><span></span><span></span><span></span></div>`;
  msgs.appendChild(wrap);
  requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
  return wrap;
}

/* ════════════════════════════════════
   DOCTOR SEARCH
════════════════════════════════════ */
function initDoctorSearch() {
  const btn   = $('#find-doctors-btn');
  const input = $('#doctor-location');
  if (btn)   btn.addEventListener('click', handleDoctors);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') handleDoctors(); });
}

async function handleDoctors() {
  const input = $('#doctor-location');
  const list  = $('#doctor-list');
  const btn   = $('#find-doctors-btn');
  const loc   = input?.value?.trim();
  if (!loc) { if (input) input.focus(); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
  if (list) list.innerHTML = '<div class="modal-empty"><p>Searching…</p></div>';

  try {
    const res  = await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: loc, specialty: deriveSpecialty() }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    if (data.note && !data.doctors?.length) {
      if (list) list.innerHTML = `<div class="modal-empty"><p>${escHtml(data.note)}</p></div>`;
      return;
    }
    renderDoctors(data.doctors || []);
  } catch (err) {
    if (list) list.innerHTML = `<div class="modal-empty"><p>${escHtml(err.message || 'Search failed.')}</p></div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Search'; }
  }
}

function renderDoctors(docs) {
  const list = $('#doctor-list');
  if (!list) return;
  if (!docs.length) { list.innerHTML = '<div class="modal-empty"><p>No results. Try a larger city.</p></div>'; return; }
  list.innerHTML = '';
  docs.forEach(d => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML = `
      <div class="doc-av">${escHtml(getInitials(d.name || 'Dr'))}</div>
      <div class="doc-info">
        <div class="doc-name">${escHtml(d.name || 'Unknown')}</div>
        <div class="doc-spec">${escHtml(d.specialty || d.type || 'Medical Facility')}</div>
        <div class="doc-addr">${escHtml([d.address, d.distance_km ? d.distance_km+' km' : ''].filter(Boolean).join(' · '))}</div>
        <div class="doc-links">
          ${d.maps_url ? `<a href="${escHtml(d.maps_url)}" target="_blank" rel="noopener" class="doc-link">📍 Maps</a>` : ''}
          ${d.phone    ? `<a href="tel:${escHtml(d.phone)}" class="doc-link">📞 Call</a>` : ''}
          ${d.website  ? `<a href="${escHtml(d.website)}" target="_blank" rel="noopener" class="doc-link">🌐 Web</a>` : ''}
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function deriveSpecialty() {
  if (!currentAnalysis) return 'general physician';
  const t = [currentAnalysis.summary || '', JSON.stringify(currentAnalysis.findings || []), (currentAnalysis.specialists || []).join(' ')].join(' ').toLowerCase();
  if (/cardio|heart|cholesterol/.test(t))  return 'cardiologist';
  if (/glucose|diabetes|thyroid/.test(t))  return 'endocrinologist';
  if (/kidney|creatinine/.test(t))         return 'nephrologist';
  if (/liver|bilirubin/.test(t))           return 'hepatologist';
  if (/lung|respiratory/.test(t))          return 'pulmonologist';
  if (currentAnalysis.specialists?.length) return currentAnalysis.specialists[0].toLowerCase();
  return 'general physician';
}

/* ════════════════════════════════════
   MODALS — each wired individually,
   nothing opens unless user clicks
════════════════════════════════════ */
function initModals() {

  /* Generic open/close */
  function openModal(name) {
    const veil  = $(`#${name}-veil`);
    const modal = $(`#${name}-modal`);
    if (veil)  veil.hidden  = false;
    if (modal) modal.hidden = false;
  }
  function closeModal(name) {
    const veil  = $(`#${name}-veil`);
    const modal = $(`#${name}-modal`);
    if (veil)  veil.hidden  = true;
    if (modal) modal.hidden = true;
  }

  /* Expose for specialist chips */
  window._openModal  = openModal;
  window._closeModal = closeModal;

  /* Close buttons (data-modal attribute) */
  $$('.modal-x').forEach(btn => {
    const name = btn.dataset.modal;
    if (name) btn.addEventListener('click', () => closeModal(name));
  });

  /* Veil click-to-close */
  ['doctors', 'lifestyle', 'questions'].forEach(n => {
    $(`#${n}-veil`)?.addEventListener('click', () => closeModal(n));
  });

  /* Triggers */
  $('#doctors-open-btn')?.addEventListener('click', () => openModal('doctors'));

  $('#lifestyle-open-btn')?.addEventListener('click', () => {
    if (!currentAnalysis?.lifestyle?.length) { showToast('Analyze a report first.'); return; }
    openModal('lifestyle');
  });

  $('#questions-open-btn')?.addEventListener('click', () => {
    if (!currentAnalysis?.questions) { showToast('Analyze a report first.'); return; }
    openModal('questions');
  });

  /* Export */
  $('#export-btn')?.addEventListener('click', () => {
    if (!currentAnalysis) { showToast('No analysis to export yet.'); return; }
    window.print();
  });
}

/* Specialist chip uses window._openModal */
function renderSpecialistsPatched(specs) {
  const list = $('#spec-list');
  const card = $('#spec-card');
  if (!list || !card) return;
  if (!specs?.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = '';
  specs.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'spec-chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      window._openModal?.('doctors');
      const loc = $('#doctor-location');
      if (loc) { loc.placeholder = `Find a ${s} near…`; loc.focus(); }
    });
    list.appendChild(chip);
  });
}

/* Override renderSpecialists with patched version */
window.addEventListener('DOMContentLoaded', () => {}, { once: true });

/* ════════════════════════════════════
   HISTORY — panel stays HIDDEN until
   user explicitly clicks History btn
════════════════════════════════════ */
const HKEY = 'medclear_history_v3';

function initHistory() {
  /* Wire all history buttons — individually, not with ^= selector */
  const histBtnTop    = $('#history-btn');
  const histBtnRight  = $('#history-btn-r');
  const histClose     = $('#history-close');
  const histVeil      = $('#history-veil');

  if (histBtnTop)   histBtnTop.addEventListener('click',   openHistory);
  if (histBtnRight) histBtnRight.addEventListener('click', openHistory);
  if (histClose)    histClose.addEventListener('click',    closeHistory);
  if (histVeil)     histVeil.addEventListener('click',     closeHistory);
}

function saveHistory(data) {
  try {
    const h = JSON.parse(localStorage.getItem(HKEY) || '[]');
    h.unshift({
      id: Date.now(),
      title: data.title,
      date: new Date().toISOString(),
      riskLevel: data.risk?.level || 'unknown',
      summary: (data.summary || '').slice(0, 120),
      data,
    });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 5)));
  } catch (e) {}
}

function openHistory() {
  let h = [];
  try { h = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) {}

  const list = $('#history-list');
  if (!list) return;
  list.innerHTML = '';

  if (!h.length) {
    list.innerHTML = '<p class="history-empty">No past analyses yet.</p>';
  } else {
    h.forEach(item => {
      const div = document.createElement('div');
      div.className = 'h-item';
      div.innerHTML = `
        <div class="h-title">${escHtml(item.title || 'Report')}</div>
        <div class="h-meta">
          <span class="h-risk ${escHtml(item.riskLevel || 'unknown')}">${escHtml(item.riskLevel || 'unknown')}</span>
          <span class="h-date">${new Date(item.date).toLocaleDateString()}</span>
        </div>
        <div class="h-summary">${escHtml(item.summary)}…</div>
      `;
      div.addEventListener('click', () => {
        currentAnalysis = item.data;
        renderResults(item.data);
        initMeddie(item.data);
        closeHistory();
        showScreen('results');
      });
      list.appendChild(div);
    });
  }

  $('#history-panel').hidden = false;
  $('#history-veil').hidden  = false;
}

function closeHistory() {
  $('#history-panel').hidden = true;
  $('#history-veil').hidden  = true;
}

/* ════════════════════════════════════
   BACK BUTTON
════════════════════════════════════ */
function initBackBtn() {
  $('#back-btn')?.addEventListener('click', () => {
    currentAnalysis = null;
    chatHistory     = [];

    const fileInput  = $('#file-input');
    const reportText = $('#report-text');
    const dropZone   = $('#drop-zone');

    if (fileInput)  fileInput.value = '';
    if (reportText) reportText.value = '';
    const chip = dropZone?.querySelector('.file-chip');
    if (chip) chip.remove();

    const msgs = $('#chat-msgs');
    if (msgs) msgs.innerHTML = '';

    $$('.organ').forEach(el => { el.style.opacity = '0'; el.classList.remove('critical', 'moderate'); });
    $$('.olabel').forEach(el => el.classList.remove('active'));

    /* Close any open modals */
    ['doctors', 'lifestyle', 'questions'].forEach(n => {
      $(`#${n}-veil`).hidden  = true;
      $(`#${n}-modal`).hidden = true;
    });
    closeHistory();

    showScreen('upload');
  });
}

/* ════════════════════════════════════
   TOAST
════════════════════════════════════ */
function showToast(msg) {
  const old = $('._mc_toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = '_mc_toast';
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--red)', color: '#fff',
    padding: '11px 22px', borderRadius: 'var(--r-lg)',
    fontSize: '13px', fontWeight: '600',
    boxShadow: '0 8px 30px rgba(0,0,0,.4)',
    zIndex: '9999', maxWidth: '90vw', textAlign: 'center',
    fontFamily: 'var(--font-d)',
  });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t?.remove(), 4500);
}

/* ════════════════════════════════════
   UTILITIES
════════════════════════════════════ */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(n) {
  return n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
}

function parseList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\n+/).map(l => l.replace(/^[\d.\-*•\s]+/, '').trim()).filter(Boolean);
}
