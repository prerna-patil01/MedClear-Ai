'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   MEDCLEAR AI — script.js  (Final — includes theme, diet, doctor, chat)
═══════════════════════════════════════════════════════════════════════════ */

const API_BASE      = 'https://medclearai.onrender.com';
let currentAnalysis = null;
let chatHistory     = [];

/* ─────────────────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCursor();
  initScreens();
  initUploadScreen();
  initResultsScreen();
  initAnatomy();
  createWireframeBody();
  initChat();
  setupEventListeners();
  initMobileResponsive();
  injectModalStyles();
});

/* ─────────────────────────────────────────────────────────────────────────
   THEME — Dark & Cream
───────────────────────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('mc-theme') || 'dark';
  applyTheme(saved);

  // Re-insert header toggle when results screen opens
  const results = document.getElementById('results-screen');
  if (results) {
    new MutationObserver(() => insertHeaderToggle())
      .observe(results, { attributes: true, attributeFilter: ['class'] });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mc-theme', theme);
  const icon = theme === 'cream' ? '☀️' : '🌙';
  const tip  = theme === 'cream' ? 'Switch to Dark mode' : 'Switch to Cream mode';
  document.querySelectorAll('.theme-toggle, .theme-toggle-upload').forEach(btn => {
    btn.textContent = icon;
    btn.title       = tip;
  });
  const svg = document.getElementById('anatomy-svg');
  if (svg) {
    svg.style.filter = theme === 'cream'
      ? 'drop-shadow(0 0 18px rgba(138,94,40,0.15)) saturate(0.85)'
      : 'drop-shadow(0 0 18px rgba(200,169,110,0.08))';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'cream' : 'dark');
}

function makeThemeBtn(className) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.addEventListener('click', toggleTheme);
  return btn;
}

function insertHeaderToggle() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight || headerRight.querySelector('.theme-toggle')) return;
  const btn = makeThemeBtn('theme-toggle');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  btn.textContent = currentTheme === 'cream' ? '☀️' : '🌙';
  btn.title = currentTheme === 'cream' ? 'Switch to Dark mode' : 'Switch to Cream mode';
  headerRight.insertBefore(btn, headerRight.firstChild);
}

function insertUploadToggle() {
  const uploadScreen = document.getElementById('upload-screen');
  if (!uploadScreen || uploadScreen.querySelector('.theme-toggle-upload')) return;
  const btn = makeThemeBtn('theme-toggle-upload');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  btn.textContent = currentTheme === 'cream' ? '☀️' : '🌙';
  btn.title = currentTheme === 'cream' ? 'Switch to Dark mode' : 'Switch to Cream mode';
  uploadScreen.appendChild(btn);
}

/* ─────────────────────────────────────────────────────────────────────────
   CURSOR
───────────────────────────────────────────────────────────────────────── */
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const glow = document.getElementById('cursor-glow');
  if (!dot || !glow) return;
  document.addEventListener('mousemove', (e) => {
    dot.style.left  = e.clientX + 'px';
    dot.style.top   = e.clientY + 'px';
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   SCREENS
───────────────────────────────────────────────────────────────────────── */
function initScreens() {
  const uploadScreen  = document.getElementById('upload-screen');
  const resultsScreen = document.getElementById('results-screen');
  window.showScreen = (name) => {
    uploadScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    if (name === 'upload')  { uploadScreen.classList.add('active');  insertUploadToggle(); }
    if (name === 'results') { resultsScreen.classList.add('active'); insertHeaderToggle(); }
  };
  // Insert upload toggle on first load
  insertUploadToggle();
}

/* ─────────────────────────────────────────────────────────────────────────
   MOBILE RESPONSIVE
───────────────────────────────────────────────────────────────────────── */
function initMobileResponsive() {
  const meddieBtn = document.getElementById('meddie-btn');
  const panelLeft = document.querySelector('.panel-left');
  if (!meddieBtn || !panelLeft) return;

  meddieBtn.addEventListener('click', () => {
    if (window.innerWidth < 768) panelLeft.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && panelLeft.classList.contains('active')) {
      if (!panelLeft.contains(e.target) && !meddieBtn.contains(e.target)) {
        panelLeft.classList.remove('active');
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) panelLeft.classList.remove('active');
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   UPLOAD SCREEN
───────────────────────────────────────────────────────────────────────── */
function initUploadScreen() {
  const uploadTabs       = document.querySelectorAll('.upload-tab');
  const fileArea         = document.getElementById('upload-file-area');
  const textArea         = document.getElementById('upload-text-area');
  const dropZone         = document.getElementById('drop-zone');
  const fileInput        = document.getElementById('file-input');
  const fileSelected     = document.getElementById('file-selected');
  const fileSelectedName = document.getElementById('file-selected-name');
  const fileSelectedSize = document.getElementById('file-selected-size');
  const fileRemove       = document.getElementById('file-remove');
  const analyzeBtn       = document.getElementById('analyze-btn');

  uploadTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      uploadTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      fileArea.style.display = tab.dataset.tab === 'file' ? 'block' : 'none';
      textArea.style.display = tab.dataset.tab === 'text' ? 'block' : 'none';
    });
  });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) { fileInput.files = files; showFileSelected(files[0]); }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) showFileSelected(fileInput.files[0]);
  });

  fileRemove?.addEventListener('click', () => {
    fileInput.value = '';
    if (fileSelected) fileSelected.style.display = 'none';
    if (dropZone)     dropZone.style.display      = 'block';
  });

  function showFileSelected(file) {
    if (!fileSelected || !fileSelectedName || !fileSelectedSize) return;
    fileSelectedName.textContent = file.name;
    fileSelectedSize.textContent = file.size < 1024 * 1024
      ? (file.size / 1024).toFixed(1) + ' KB'
      : (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    dropZone.style.display     = 'none';
    fileSelected.style.display = 'flex';
  }

  analyzeBtn.addEventListener('click', handleAnalyze);
}

async function handleAnalyze() {
  const fileInput  = document.getElementById('file-input');
  const reportText = document.getElementById('report-text');
  const activeTab  = document.querySelector('.upload-tab.active');
  const file       = fileInput.files?.[0];
  const text       = reportText?.value?.trim();

  if (activeTab.dataset.tab === 'file' && !file) { showToast('Please select a file first'); return; }
  if (activeTab.dataset.tab === 'text' && !text) { showToast('Please paste some text first'); return; }

  const btn        = document.getElementById('analyze-btn');
  const btnContent = btn.querySelector('.submit-content');
  btn.disabled = true;
  if (btnContent) {
    btnContent.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           style="animation:mcSpin 0.8s linear infinite">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                 M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Analysing…`;
  }

  try {
    const fd = new FormData();
    if (activeTab.dataset.tab === 'file') fd.append('file', file);
    else fd.append('text', text);

    const res  = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);

    currentAnalysis = data;
    renderResults(data);
    window.showScreen('results');
  } catch (err) {
    showToast(err.message || 'Analysis failed. Please try again.');
  } finally {
    btn.disabled = false;
    if (btnContent) {
      btnContent.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
                   10-4.48 10-10S17.52 2 12 2zm-1 14l-4-4
                   1.41-1.41L11 13.17l6.59-6.59L19 8l-8 8z"
                fill="currentColor"/>
        </svg>
        Analyse Report
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="opacity:.7">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'error') {
  document.querySelector('._mc_toast')?.remove();
  const toast = document.createElement('div');
  toast.className = '_mc_toast';
  toast.textContent = msg;
  const bg = type === 'success' ? 'rgba(122,158,142,0.92)' : 'rgba(176,92,92,0.92)';
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%',
    transform: 'translateX(-50%) translateY(8px)',
    background: bg, color: '#f5f0e8', padding: '11px 22px',
    borderRadius: '10px', fontSize: '12.5px', zIndex: '9999',
    fontFamily: 'Jost, sans-serif', fontWeight: '400',
    letterSpacing: '0.02em', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    opacity: '0',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast?.remove(), 300);
  }, 3200);
}

/* ─────────────────────────────────────────────────────────────────────────
   RESULTS SCREEN
───────────────────────────────────────────────────────────────────────── */
function initResultsScreen() {
  document.getElementById('back-btn')?.addEventListener('click', () => {
    currentAnalysis = null;
    chatHistory     = [];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('file-input').value        = '';
    document.getElementById('report-text').value       = '';
    const fileSelected = document.getElementById('file-selected');
    const dropZone     = document.getElementById('drop-zone');
    if (fileSelected) fileSelected.style.display = 'none';
    if (dropZone)     dropZone.style.display      = 'block';
    window.showScreen('upload');
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   RENDER RESULTS
───────────────────────────────────────────────────────────────────────── */
function renderResults(data) {
  document.getElementById('report-name').textContent =
    data.title || 'Medical Analysis';
  document.getElementById('report-date').textContent =
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
  if (el) el.textContent = data.summary || 'No summary available.';
}

function renderFindings(data) {
  const findings = data.findings || [];
  const grid     = document.getElementById('findings-grid');
  const count    = document.getElementById('findings-count');
  if (count) count.textContent = findings.length;
  if (!grid) return;
  grid.innerHTML = '';
  findings.slice(0, 6).forEach(f => {
    const item = document.createElement('div');
    item.className = 'finding-item';
    item.innerHTML = `
      <div class="finding-name">${escHtml(f.name || f.test || '')}</div>
      <div class="finding-value">${escHtml(f.value || f.result || '—')}</div>
      <div class="finding-status">${escHtml(f.status || 'Info')}</div>`;
    grid.appendChild(item);
  });
}

function renderAbnormalValues(data) {
  const abnormal = (data.findings || []).filter(f =>
    ['high', 'abnormal', 'critical', 'low'].includes((f.status || '').toLowerCase())
  );
  const card = document.getElementById('abnormal-card');
  if (!card) return;
  if (!abnormal.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const list = document.getElementById('abnormal-list');
  if (!list) return;
  list.innerHTML = '';
  abnormal.forEach(f => {
    const item = document.createElement('div');
    item.className = 'abnormal-item';
    item.innerHTML = `
      <strong>${escHtml(f.name || f.test || '')}</strong>: ${escHtml(f.value || '—')}
      <br/><small>${escHtml(f.status || 'Abnormal')}</small>`;
    list.appendChild(item);
  });
}

function renderRecommendations(data) {
  const recs = data.lifestyle || [];
  const card = document.getElementById('recommendations-card');
  if (!card) return;
  if (!recs.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const list = document.getElementById('recommendations-list');
  if (!list) return;
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
  const list      = document.getElementById('questions-list');
  const count     = document.getElementById('questions-count');
  if (count) count.textContent = questions.length;
  if (!list) return;
  list.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    list.appendChild(li);
  });
}

function renderRiskBadge(data) {
  const badge = document.querySelector('.risk-badge');
  if (!badge) return;
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

/* ─────────────────────────────────────────────────────────────────────────
   ANATOMY
───────────────────────────────────────────────────────────────────────── */
function initAnatomy() {
  document.addEventListener('mousemove', (e) => {
    const svg = document.getElementById('anatomy-svg');
    if (!svg || window.innerWidth < 768) return;
    const x =  (e.clientX / window.innerWidth  - 0.5) * 8;
    const y = -(e.clientY / window.innerHeight - 0.5) * 4;
    svg.style.transform = `rotateY(${x}deg) rotateX(${y}deg) scale(1.15)`;
  });
}

function createWireframeBody() {
  const svg = document.getElementById('anatomy-svg');
  if (!svg) return;

  svg.setAttribute('viewBox', '0 0 300 600');
  svg.style.transform       = 'scale(1.15)';
  svg.style.transformOrigin = 'center';

  const C = {
    body:    '#8a7a5a',
    heart:   '#b05c5c',
    lung:    '#7a9e8e',
    liver:   '#c8a96e',
    kidney:  '#8a9eb0',
    stomach: '#a08e6a',
    thyroid: '#b8a070',
    brain:   '#c8a96e',
    spine:   'rgba(138,122,90,0.25)',
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ns     = tag => document.createElementNS(SVG_NS, tag);
  const setA   = (el, attrs) => { Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
  const organ  = (el, id, name) => { el.id = id; el.classList.add('organ'); el.dataset.organ = name; return el; };
  const circle  = (cx, cy, r, stroke, id, name) => organ(setA(ns('circle'),  { cx, cy, r, stroke, 'stroke-width': '1.2', fill: 'none' }), id, name);
  const ellipse = (cx, cy, rx, ry, stroke, id, name) => organ(setA(ns('ellipse'), { cx, cy, rx, ry, stroke, 'stroke-width': '1.1', fill: 'none' }), id, name);
  const path    = (d, stroke, id, name, fill = 'none', sw = '1.2') => {
    const p = setA(ns('path'), { d, stroke, fill, 'stroke-width': sw, 'stroke-linejoin': 'round' });
    return id ? organ(p, id, name) : p;
  };
  const line = (x1, y1, x2, y2, stroke, sw = '1.2') => setA(ns('line'), { x1, y1, x2, y2, stroke, 'stroke-width': sw });

  const defs = ns('defs');
  const grad = setA(ns('linearGradient'), { id: 'bodyGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  grad.append(setA(ns('stop'), { offset: '0%',   'stop-color': '#c8a96e', 'stop-opacity': '0.9' }));
  grad.append(setA(ns('stop'), { offset: '100%', 'stop-color': '#5a4a2a', 'stop-opacity': '0.4' }));
  defs.append(grad);
  const filter = setA(ns('filter'), { id: 'organGlow' });
  const blur   = setA(ns('feGaussianBlur'), { stdDeviation: '2.5', result: 'blur' });
  const merge  = ns('feMerge');
  merge.append(setA(ns('feMergeNode'), { in: 'blur' }));
  merge.append(setA(ns('feMergeNode'), { in: 'SourceGraphic' }));
  filter.append(blur, merge);
  defs.append(filter);
  svg.append(defs);

  svg.append(path('M140 75 L140 95 Q150 93, 160 95 L160 75', C.body));
  svg.append(path('M115 98 Q132 94, 150 95 Q168 94, 185 98', C.body, null, null, 'none', '1'));
  [105, 115, 125, 135].forEach((y, i) => {
    const w = [14, 18, 20, 18][i];
    svg.append(path(`M${150-w} ${y} Q150 ${y+4}, ${150+w} ${y}`, 'rgba(138,122,90,0.22)', null, null, 'none', '0.8'));
  });
  svg.append(setA(ns('path'), { d: 'M150 95 Q149.5 150, 150 240', stroke: C.spine, 'stroke-width': '0.9', fill: 'none', 'stroke-dasharray': '3,4' }));
  svg.append(setA(ns('path'), { d: 'M120 95 L113 185 Q113 215, 130 242 L170 242 Q187 215, 187 185 L180 95', stroke: 'url(#bodyGrad)', 'stroke-width': '1.5', fill: 'none', opacity: '0.65' }));
  svg.append(line(120, 98, 100, 190, C.body, '1.2'));
  svg.append(line(180, 98, 200, 190, C.body, '1.2'));
  svg.append(line(100, 190, 96, 260, C.body, '1'));
  svg.append(line(200, 190, 204, 260, C.body, '1'));
  svg.append(path('M130 242 Q130 255, 125 265 Q150 270, 175 265 Q170 255, 170 242', C.body, null, null, 'none', '1'));
  svg.append(line(135, 265, 130, 360, C.body, '1.4'));
  svg.append(line(165, 265, 170, 360, C.body, '1.4'));
  svg.append(line(130, 360, 128, 440, C.body, '1.2'));
  svg.append(line(170, 360, 172, 440, C.body, '1.2'));
  svg.append(path('M122 440 Q128 445, 138 444', C.body, null, null, 'none', '1'));
  svg.append(path('M178 440 Q172 445, 162 444', C.body, null, null, 'none', '1'));

  const head = circle('150', '50', '28', C.brain, 'org-brain', 'Brain');
  setA(head, { opacity: '0.9' });
  svg.append(head);
  svg.append(path('M130 47 Q133 38, 150 36 Q167 38, 170 47', 'rgba(200,169,110,0.35)', null, null, 'none', '0.9'));
  svg.append(path('M150 36 L150 55', 'rgba(200,169,110,0.2)', null, null, 'none', '0.7'));

  const thyroid = ellipse('150', '86', '9', '5', C.thyroid, 'org-thyroid', 'Thyroid');
  setA(thyroid, { opacity: '0.7' });
  svg.append(thyroid);

  const lungL = organ(setA(ns('path'), { d: 'M122 100 Q118 110, 117 125 Q117 145, 122 155 Q130 160, 138 155 Q143 145, 143 125 Q143 108, 138 100 Z', stroke: C.lung, 'stroke-width': '1.1', fill: 'rgba(122,158,142,0.07)' }), 'org-lung-l', 'Left Lung');
  const lungR = organ(setA(ns('path'), { d: 'M178 100 Q182 110, 183 125 Q183 145, 178 155 Q170 160, 162 155 Q157 145, 157 125 Q157 108, 162 100 Z', stroke: C.lung, 'stroke-width': '1.1', fill: 'rgba(122,158,142,0.07)' }), 'org-lung-r', 'Right Lung');
  svg.append(lungL, lungR);
  svg.append(organ(setA(ns('path'), { d: 'M150 118 L144 112 Q138 109, 135 114 Q132 118, 136 124 L150 134 L164 124 Q168 118, 165 114 Q162 109, 156 112 Z', stroke: C.heart, 'stroke-width': '1.2', fill: 'rgba(176,92,92,0.15)' }), 'org-heart', 'Heart'));
  svg.append(organ(setA(ns('path'), { d: 'M155 148 Q170 145, 182 150 Q186 162, 180 174 Q170 180, 158 176 Q150 172, 148 162 Q148 152, 155 148 Z', stroke: C.liver, 'stroke-width': '1.1', fill: 'rgba(200,169,110,0.06)' }), 'org-liver', 'Liver'));
  svg.append(organ(setA(ns('path'), { d: 'M136 152 Q130 158, 131 170 Q133 180, 143 182 Q153 183, 157 174 Q160 164, 155 154 Q148 148, 140 150 Z', stroke: C.stomach, 'stroke-width': '1', fill: 'rgba(160,142,106,0.06)' }), 'org-stomach', 'Stomach'));
  svg.append(organ(setA(ns('path'), { d: 'M123 178 Q118 183, 118 193 Q118 203, 123 207 Q130 210, 136 206 Q140 200, 140 191 Q140 182, 136 178 Q130 174, 123 178 Z', stroke: C.kidney, 'stroke-width': '1', fill: 'rgba(110,138,158,0.07)' }), 'org-kidney-l', 'Left Kidney'));
  svg.append(organ(setA(ns('path'), { d: 'M177 178 Q182 183, 182 193 Q182 203, 177 207 Q170 210, 164 206 Q160 200, 160 191 Q160 182, 164 178 Q170 174, 177 178 Z', stroke: C.kidney, 'stroke-width': '1', fill: 'rgba(110,138,158,0.07)' }), 'org-kidney-r', 'Right Kidney'));

  const tooltip = document.getElementById('organ-tooltip');
  document.querySelectorAll('.organ').forEach(o => {
    o.addEventListener('mouseenter', () => {
      if (tooltip) { tooltip.textContent = o.dataset.organ; tooltip.classList.add('visible'); }
    });
    o.addEventListener('mousemove', (e) => {
      if (tooltip) { tooltip.style.left = (e.clientX + 14) + 'px'; tooltip.style.top = (e.clientY - 12) + 'px'; }
    });
    o.addEventListener('mouseleave', () => { if (tooltip) tooltip.classList.remove('visible'); });
  });
}

function highlightOrgans(data) {
  const ORGAN_MAP = {
    'org-brain':    { kw: ['brain','neuro','cognitive','headache','cns','memory'],           tk: ['eeg','mri brain','neurological'] },
    'org-thyroid':  { kw: ['thyroid','tsh','t3','t4','goiter','hypothyroid','hyperthyroid'], tk: ['thyroid function','thyroid panel'] },
    'org-heart':    { kw: ['heart','cardiac','cholesterol','ecg','ekg','coronary','hypertension','ldl','hdl','triglyceride','artery','myocardial'], tk: ['troponin','bnp','echocardiogram','cardiac enzymes'] },
    'org-lung-l':   { kw: ['lung','pulmonary','respiratory','oxygen','spo2','breathing','bronch','pneumonia','asthma'], tk: ['spirometry','chest x-ray','pft','oxygen saturation'] },
    'org-lung-r':   { kw: ['lung','pulmonary','respiratory','oxygen'],                       tk: ['chest imaging','respiratory function'] },
    'org-liver':    { kw: ['liver','bilirubin','alt','ast','sgpt','sgot','hepatic','albumin','jaundice','cirrhosis','hepatitis'], tk: ['liver function','liver enzymes','ast/alt'] },
    'org-stomach':  { kw: ['glucose','diabetes','hba1c','insulin','pancreas','stomach','blood sugar','glycemia'], tk: ['blood glucose','glucose tolerance','fasting blood sugar'] },
    'org-kidney-l': { kw: ['kidney','creatinine','urea','bun','renal','uric','gfr','proteinuria','nephro'], tk: ['kidney function','renal panel','creatinine clearance'] },
    'org-kidney-r': { kw: ['kidney','creatinine','urea','renal'],                            tk: ['kidney','renal'] },
  };

  const organSeverity = {};
  (data.findings || []).forEach(finding => {
    const ft = [finding.name, finding.test, finding.status, finding.value].join(' ').toLowerCase();
    Object.entries(ORGAN_MAP).forEach(([id, { kw, tk }]) => {
      if (kw.some(k => ft.includes(k)) || tk.some(k => ft.includes(k))) {
        const sev = getStatus(finding.status);
        if (!organSeverity[id] || severityRank(sev) < severityRank(organSeverity[id]))
          organSeverity[id] = sev;
      }
    });
  });

  document.querySelectorAll('.organ').forEach(o => {
    const sev = organSeverity[o.id];
    o.classList.remove('highlight', 'highlight-low', 'highlight-moderate', 'highlight-high');
    if (sev) {
      o.classList.add('highlight', `highlight-${sev}`);
      o.style.opacity = '1';
      o.style.filter  =
        sev === 'high'     ? 'drop-shadow(0 0 6px rgba(176,92,92,0.7))'   :
        sev === 'moderate' ? 'drop-shadow(0 0 5px rgba(200,169,110,0.6))' :
                             'drop-shadow(0 0 4px rgba(122,158,142,0.5))';
    } else {
      o.style.opacity = '0.32';
      o.style.filter  = 'none';
    }
  });
}

function getStatus(s) {
  s = (s || '').toLowerCase();
  if (/high|abnormal|critical|elevated|above|increase/.test(s)) return 'high';
  if (/moderate|borderline|low|reduced|decrease|below/.test(s))  return 'moderate';
  return 'low';
}
function severityRank(s) { return ({ high: 0, moderate: 1, low: 2 })[s] ?? 3; }

/* ─────────────────────────────────────────────────────────────────────────
   MEDDIE CHAT
───────────────────────────────────────────────────────────────────────── */
function initChat() {
  const input   = document.getElementById('chat-input');
  const send    = document.getElementById('chat-send');
  const prompts = document.querySelectorAll('.prompt-chip');
  send?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  prompts.forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.dataset.prompt;
      sendMessage();
    });
  });
}

function initMeddie(data) {
  chatHistory = [];
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  messages.innerHTML = '';
  addMessage('ai', `Hi! I've analysed your <em>${escHtml(data.title || 'medical report')}</em>. Your risk level is <strong>${escHtml(data.risk?.level || 'unknown')}</strong>. What would you like to know?`);
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');
  const msg   = input?.value?.trim();
  if (!msg) return;
  input.value = '';
  send.disabled = true;
  addMessage('user', escHtml(msg));
  chatHistory.push({ role: 'user', content: msg });
  try {
    const res   = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: currentAnalysis, history: chatHistory.slice(-6) }),
    });
    const data  = await res.json();
    const reply = data.response || 'I could not generate a response.';
    addMessage('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch {
    addMessage('ai', 'Sorry, I encountered an error. Please try again.');
  } finally {
    send.disabled = false;
    input?.focus();
  }
}

function addMessage(role, html) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  const wrap   = document.createElement('div');
  wrap.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = html;
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
}

/* ─────────────────────────────────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────────────────────────────────── */
function setupEventListeners() {
  document.getElementById('risk-btn')?.addEventListener('click', () => {
    if (!currentAnalysis) return;
    showToast(`Risk: ${currentAnalysis.risk?.level || 'Unknown'} — ${currentAnalysis.risk?.reason || ''}`);
  });
  document.getElementById('meddie-btn')?.addEventListener('click', () => {
    if (window.innerWidth >= 768) document.getElementById('chat-input')?.focus();
  });
  document.getElementById('pdf-btn')?.addEventListener('click', () => window.print());
  document.getElementById('diet-btn')?.addEventListener('click', () => openDietModal());
  document.getElementById('doctor-btn')?.addEventListener('click', () => openDoctorModal());
}

/* ─────────────────────────────────────────────────────────────────────────
   DIET PLAN MODAL
───────────────────────────────────────────────────────────────────────── */
function openDietModal() {
  if (!currentAnalysis) { showToast('Please analyse a report first'); return; }
  document.getElementById('diet-modal')?.remove();
  const modal = document.createElement('div');
  modal.id        = 'diet-modal';
  modal.className = 'mc-modal-overlay';
  modal.innerHTML = `
    <div class="mc-modal" style="max-width:720px;">
      <div class="mc-modal-header">
        <div>
          <h2 class="mc-modal-title">Personalised Diet Plan</h2>
          <p class="mc-modal-sub">Generated from your medical report findings</p>
        </div>
        <button class="mc-modal-close" id="diet-close">✕</button>
      </div>
      <div class="mc-modal-body" id="diet-body">
        <div class="mc-loading">
          <div class="mc-spinner"></div>
          <p>Generating your personalised diet plan…</p>
          <small>Analysing findings and conditions</small>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#diet-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  requestAnimationFrame(() => modal.classList.add('mc-modal-visible'));
  fetchDietPlan();
}

async function fetchDietPlan() {
  const body = document.getElementById('diet-body');
  if (!body) return;
  try {
    const res  = await fetch(`${API_BASE}/api/diet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: currentAnalysis }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    renderDietPlan(data.diet_plan, body);
  } catch (err) {
    body.innerHTML = `
      <div class="mc-error">
        <span>⚠</span>
        <p>${escHtml(err.message || 'Failed to generate diet plan.')}</p>
        <button class="mc-retry" onclick="fetchDietPlan()">Try Again</button>
      </div>`;
  }
}

function renderDietPlan(plan, body) {
  if (!plan || !body) return;
  const mealBlock = (obj) => {
    if (!obj) return '';
    const items  = (obj.suggestions || []).map(s => `<li>${escHtml(s)}</li>`).join('');
    const avoids = (obj.avoid || []).map(a => `<span class="dp-avoid-tag">${escHtml(a)}</span>`).join('');
    return `<ul class="dp-meal-list">${items}</ul>${avoids ? `<div class="dp-avoid-row">${avoids}</div>` : ''}`;
  };
  const nutrientsPrio  = (plan.nutrients_to_prioritize || []).map(n => `
    <div class="dp-nutrient dp-nutrient--good">
      <strong>${escHtml(n.nutrient)}</strong><span>${escHtml(n.reason)}</span>
      <div class="dp-sources">${(n.sources || []).map(s => `<span>${escHtml(s)}</span>`).join('')}</div>
    </div>`).join('');
  const nutrientsLimit = (plan.nutrients_to_limit || []).map(n => `
    <div class="dp-nutrient dp-nutrient--limit">
      <strong>${escHtml(n.nutrient)}</strong><span>${escHtml(n.reason)}</span>
      <div class="dp-limit-badge">${escHtml(n.limit || '')}</div>
    </div>`).join('');
  const sampleHtml = Object.entries(plan.sample_day || {}).map(([t, m]) => `
    <div class="dp-sample-row">
      <span class="dp-sample-time">${escHtml(t.replace(/_/g, ' '))}</span>
      <span class="dp-sample-meal">${escHtml(m)}</span>
    </div>`).join('');

  body.innerHTML = `
    <div class="dp-wrap">
      <div class="dp-summary-card">
        <div class="dp-summary-meta">
          <span>📅 ${escHtml(plan.duration || '4-week plan')}</span>
          <span>🔥 ${escHtml(plan.calories_range || '')}</span>
          ${(plan.conditions_addressed || []).map(c => `<span class="dp-condition-tag">${escHtml(c)}</span>`).join('')}
        </div>
        <p class="dp-summary-text">${escHtml(plan.summary || '')}</p>
      </div>
      <div class="dp-section-title">Daily Meals</div>
      <div class="dp-meals-grid">
        ${['breakfast','lunch','dinner','snacks'].map(m => `
          <div class="dp-meal-card">
            <div class="dp-meal-label">${m.charAt(0).toUpperCase()+m.slice(1)}</div>
            ${mealBlock(plan.meals?.[m])}
          </div>`).join('')}
      </div>
      ${sampleHtml ? `<div class="dp-section-title">Sample Day</div><div class="dp-sample-card">${sampleHtml}</div>` : ''}
      ${nutrientsPrio  ? `<div class="dp-section-title">Nutrients to Prioritise</div><div class="dp-nutrients-grid">${nutrientsPrio}</div>` : ''}
      ${nutrientsLimit ? `<div class="dp-section-title">Nutrients to Limit</div><div class="dp-nutrients-grid">${nutrientsLimit}</div>` : ''}
      ${(plan.foods_to_avoid || []).length ? `
        <div class="dp-section-title">Foods to Avoid</div>
        <div class="dp-avoid-list">${plan.foods_to_avoid.map(f => `<div class="dp-avoid-item">⚠ ${escHtml(f)}</div>`).join('')}</div>` : ''}
      ${plan.hydration ? `
        <div class="dp-section-title">Hydration</div>
        <div class="dp-hydration-card">
          <strong>💧 ${escHtml(plan.hydration.target || '')}</strong>
          <ul>${(plan.hydration.tips || []).map(t => `<li>${escHtml(t)}</li>`).join('')}</ul>
        </div>` : ''}
      ${(plan.lifestyle_tips || []).length ? `
        <div class="dp-section-title">Lifestyle Tips</div>
        <div class="dp-tips-list">${plan.lifestyle_tips.map(t => `<div class="dp-tip">✦ ${escHtml(t)}</div>`).join('')}</div>` : ''}
      <div class="dp-disclaimer">${escHtml(plan.disclaimer || 'Consult a registered dietitian before making significant dietary changes.')}</div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   FIND DOCTOR MODAL
───────────────────────────────────────────────────────────────────────── */
function openDoctorModal() {
  if (!currentAnalysis) { showToast('Please analyse a report first'); return; }
  document.getElementById('doctor-modal')?.remove();
  const specialists   = currentAnalysis?.specialists || [];
  const suggestedSpec = specialists.length ? specialists[0].toLowerCase() : 'general physician';
  const modal = document.createElement('div');
  modal.id        = 'doctor-modal';
  modal.className = 'mc-modal-overlay';
  modal.innerHTML = `
    <div class="mc-modal" style="max-width:680px;">
      <div class="mc-modal-header">
        <div>
          <h2 class="mc-modal-title">Find a Doctor</h2>
          <p class="mc-modal-sub">Nearby clinics and hospitals based on your report</p>
        </div>
        <button class="mc-modal-close" id="doctor-close">✕</button>
      </div>
      <div class="mc-modal-body">
        <div class="fd-search-row">
          <div class="fd-field">
            <label>Your Location</label>
            <input type="text" id="fd-location" class="fd-input"
                   placeholder="e.g. Hyderabad, Mumbai, New York…" autocomplete="off"/>
          </div>
          <div class="fd-field">
            <label>Specialty</label>
            <input type="text" id="fd-specialty" class="fd-input"
                   value="${escHtml(suggestedSpec)}" placeholder="e.g. cardiologist" autocomplete="off"/>
          </div>
          <button class="fd-search-btn" id="fd-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
              <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Search
          </button>
        </div>
        ${specialists.length ? `
          <div class="fd-suggested">
            Suggested from your report:
            ${specialists.map(s => `<span class="fd-spec-tag" data-spec="${escHtml(s.toLowerCase())}">${escHtml(s)}</span>`).join('')}
          </div>` : ''}
        <div id="fd-results" class="fd-results"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#doctor-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  requestAnimationFrame(() => modal.classList.add('mc-modal-visible'));

  modal.querySelectorAll('.fd-spec-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.getElementById('fd-specialty').value = tag.dataset.spec;
      modal.querySelectorAll('.fd-spec-tag').forEach(t => { t.style.background = ''; t.style.borderColor = ''; t.style.color = ''; });
      tag.style.background  = 'rgba(200,169,110,0.18)';
      tag.style.borderColor = 'rgba(200,169,110,0.4)';
      tag.style.color       = '#e2c99a';
    });
  });

  const doSearch = () => {
    const location  = document.getElementById('fd-location')?.value?.trim();
    const specialty = document.getElementById('fd-specialty')?.value?.trim() || 'general physician';
    if (!location) { showToast('Please enter your location'); return; }
    fetchDoctors(location, specialty);
  };
  document.getElementById('fd-search').addEventListener('click', doSearch);
  document.getElementById('fd-location').addEventListener('keydown',  (e) => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('fd-specialty').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
}

async function fetchDoctors(location, specialty) {
  const results = document.getElementById('fd-results');
  if (!results) return;
  results.innerHTML = `
    <div class="mc-loading">
      <div class="mc-spinner"></div>
      <p>Searching near ${escHtml(location)}…</p>
    </div>`;
  try {
    const res  = await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, specialty }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    renderDoctors(data, results);
  } catch (err) {
    results.innerHTML = `
      <div class="mc-error">
        <span>🔍</span>
        <p>${escHtml(err.message || 'Search failed. Please try again.')}</p>
      </div>`;
  }
}

function renderDoctors(data, container) {
  const doctors = data.doctors || [];
  if (!doctors.length) {
    container.innerHTML = `
      <div class="mc-error">
        <span>🔍</span>
        <p>${escHtml(data.note || 'No doctors found nearby. Try a different location.')}</p>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="fd-meta">Found <strong>${doctors.length}</strong> result${doctors.length !== 1 ? 's' : ''} near <strong>${escHtml(data.location || '')}</strong></div>
    <div class="fd-list">
      ${doctors.map(d => `
        <div class="fd-card">
          <div class="fd-card-left">
            <div class="fd-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" opacity="0.85"/>
              </svg>
            </div>
            <div class="fd-info">
              <strong class="fd-name">${escHtml(d.name)}</strong>
              <span class="fd-type">${escHtml(d.type)} · ${escHtml(d.specialty)}</span>
              <span class="fd-address">${escHtml(d.address)}</span>
            </div>
          </div>
          <div class="fd-card-right">
            <span class="fd-dist">${d.distance_km} km</span>
            <div class="fd-actions">
              ${d.phone   ? `<a href="tel:${escHtml(d.phone)}" class="fd-btn fd-btn--call">📞 Call</a>` : ''}
              <a href="${escHtml(d.maps_url)}" target="_blank" rel="noopener" class="fd-btn fd-btn--map">🗺 Map</a>
              ${d.website ? `<a href="${escHtml(d.website)}" target="_blank" rel="noopener" class="fd-btn fd-btn--web">🌐 Site</a>` : ''}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────────────────── */
function escHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, c => map[c]);
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL CSS — injected once on boot
───────────────────────────────────────────────────────────────────────── */
function injectModalStyles() {
  if (document.getElementById('mc-modal-styles')) return;
  const style = document.createElement('style');
  style.id    = 'mc-modal-styles';
  style.textContent = `
@keyframes mcSpin { to { transform: rotate(360deg); } }

.mc-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.72); backdrop-filter: blur(10px) saturate(120%);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  opacity: 0; transition: opacity 0.3s ease;
}
.mc-modal-overlay.mc-modal-visible { opacity: 1; }
.mc-modal {
  width: 100%; max-height: 88vh;
  background: #111410; border: 1px solid rgba(255,252,240,0.12); border-radius: 22px;
  display: flex; flex-direction: column;
  box-shadow: 0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(200,169,110,0.07) inset;
  transform: translateY(18px); transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
  overflow: hidden;
}
.mc-modal-overlay.mc-modal-visible .mc-modal { transform: translateY(0); }
.mc-modal-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 24px 28px 18px; border-bottom: 1px solid rgba(255,252,240,0.07); flex-shrink: 0;
  position: relative;
}
.mc-modal-header::after {
  content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(200,169,110,0.15), transparent);
}
.mc-modal-title {
  font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 600;
  color: #f5f0e8; letter-spacing: 0.01em; margin-bottom: 3px;
}
.mc-modal-sub { font-size: 11.5px; font-weight: 300; color: rgba(245,240,232,0.32); letter-spacing: 0.03em; }
.mc-modal-close {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,252,240,0.08);
  color: rgba(245,240,232,0.4); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s;
}
.mc-modal-close:hover { background: rgba(176,92,92,0.12); color: #d98080; border-color: rgba(176,92,92,0.2); }
.mc-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
.mc-modal-body::-webkit-scrollbar { width: 4px; }
.mc-modal-body::-webkit-scrollbar-thumb { background: rgba(200,169,110,0.15); border-radius: 2px; }

.mc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 64px 20px; text-align: center; }
.mc-loading p     { font-size: 13px; font-weight: 300; color: rgba(245,240,232,0.5); }
.mc-loading small { font-size: 11px; color: rgba(245,240,232,0.25); letter-spacing: 0.03em; }
.mc-spinner { width: 38px; height: 38px; border-radius: 50%; border: 2px solid rgba(200,169,110,0.12); border-top-color: #c8a96e; animation: mcSpin 0.8s linear infinite; }
.mc-error { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 52px 20px; text-align: center; }
.mc-error span { font-size: 30px; }
.mc-error p { font-size: 13px; color: rgba(245,240,232,0.45); font-weight: 300; max-width: 320px; line-height: 1.6; }
.mc-retry { padding: 8px 20px; background: rgba(200,169,110,0.1); border: 1px solid rgba(200,169,110,0.25); border-radius: 8px; color: #e2c99a; font-size: 12px; cursor: pointer; font-family: 'Jost', sans-serif; letter-spacing: 0.04em; transition: background 0.2s; }
.mc-retry:hover { background: rgba(200,169,110,0.18); }

.dp-wrap { display: flex; flex-direction: column; gap: 24px; }
.dp-summary-card { background: rgba(200,169,110,0.05); border: 1px solid rgba(200,169,110,0.14); border-radius: 14px; padding: 18px 20px; }
.dp-summary-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.dp-summary-meta span { font-size: 11.5px; font-weight: 300; color: rgba(245,240,232,0.6); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,252,240,0.08); padding: 4px 10px; border-radius: 6px; }
.dp-condition-tag { background: rgba(200,169,110,0.12) !important; border-color: rgba(200,169,110,0.22) !important; color: #e2c99a !important; }
.dp-summary-text { font-size: 13px; font-weight: 300; color: rgba(245,240,232,0.65); line-height: 1.75; }
.dp-section-title { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 600; color: #f5f0e8; letter-spacing: 0.01em; padding-bottom: 8px; border-bottom: 1px solid rgba(255,252,240,0.07); }
.dp-meals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dp-meal-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,252,240,0.07); border-radius: 12px; padding: 14px 16px; }
.dp-meal-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #c8a96e; margin-bottom: 10px; }
.dp-meal-list { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 0; }
.dp-meal-list li { font-size: 12px; font-weight: 300; color: rgba(245,240,232,0.7); line-height: 1.5; padding-left: 12px; position: relative; }
.dp-meal-list li::before { content: '·'; position: absolute; left: 0; color: #c8a96e; }
.dp-avoid-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.dp-avoid-tag { font-size: 10px; color: #d98080; background: rgba(176,92,92,0.08); border: 1px solid rgba(176,92,92,0.18); padding: 2px 8px; border-radius: 4px; font-family: 'DM Mono', monospace; }
.dp-sample-card { background: rgba(0,0,0,0.18); border: 1px solid rgba(255,252,240,0.07); border-radius: 12px; overflow: hidden; }
.dp-sample-row { display: flex; align-items: baseline; gap: 16px; padding: 11px 16px; border-bottom: 1px solid rgba(255,252,240,0.05); }
.dp-sample-row:last-child { border-bottom: none; }
.dp-sample-time { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; text-transform: capitalize; color: #c8a96e; letter-spacing: 0.04em; min-width: 90px; flex-shrink: 0; }
.dp-sample-meal { font-size: 12.5px; font-weight: 300; color: rgba(245,240,232,0.7); line-height: 1.5; }
.dp-nutrients-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dp-nutrient { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 12px 14px; }
.dp-nutrient--good  { border: 1px solid rgba(122,158,142,0.22); }
.dp-nutrient--limit { border: 1px solid rgba(176,92,92,0.22); }
.dp-nutrient strong { display: block; font-size: 12.5px; font-weight: 500; color: #f5f0e8; margin-bottom: 4px; }
.dp-nutrient span   { font-size: 11px; font-weight: 300; color: rgba(245,240,232,0.5); line-height: 1.5; display: block; margin-bottom: 8px; }
.dp-sources { display: flex; flex-wrap: wrap; gap: 4px; }
.dp-sources span { font-size: 10px; color: #a3c4b5; background: rgba(122,158,142,0.1); border: 1px solid rgba(122,158,142,0.2); padding: 2px 7px; border-radius: 4px; }
.dp-limit-badge { font-family: 'DM Mono', monospace; font-size: 10px; color: #d98080; background: rgba(176,92,92,0.1); border: 1px solid rgba(176,92,92,0.2); padding: 3px 8px; border-radius: 4px; display: inline-block; }
.dp-avoid-list { display: flex; flex-direction: column; gap: 6px; }
.dp-avoid-item { font-size: 12.5px; font-weight: 300; color: rgba(245,240,232,0.6); background: rgba(176,92,92,0.06); border: 1px solid rgba(176,92,92,0.12); border-radius: 8px; padding: 10px 14px; }
.dp-hydration-card { background: rgba(110,138,158,0.06); border: 1px solid rgba(110,138,158,0.2); border-radius: 12px; padding: 16px 18px; }
.dp-hydration-card strong { display: block; font-size: 13.5px; color: #a3c4b5; margin-bottom: 10px; }
.dp-hydration-card ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.dp-hydration-card li { font-size: 12px; font-weight: 300; color: rgba(245,240,232,0.6); padding-left: 14px; position: relative; }
.dp-hydration-card li::before { content: '·'; position: absolute; left: 0; color: #6e8a9e; }
.dp-tips-list { display: flex; flex-direction: column; gap: 8px; }
.dp-tip { font-size: 12.5px; font-weight: 300; color: rgba(245,240,232,0.65); padding: 10px 14px; background: rgba(200,169,110,0.04); border: 1px solid rgba(200,169,110,0.1); border-radius: 8px; }
.dp-disclaimer { font-size: 10.5px; font-weight: 300; color: rgba(245,240,232,0.25); text-align: center; letter-spacing: 0.02em; line-height: 1.65; padding-top: 6px; }

.fd-search-row { display: flex; gap: 10px; align-items: flex-end; margin-bottom: 14px; }
.fd-field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.fd-field label { font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(245,240,232,0.32); }
.fd-input { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,252,240,0.1); border-radius: 10px; padding: 10px 14px; font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 300; color: #f5f0e8; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.fd-input::placeholder { color: rgba(245,240,232,0.2); }
.fd-input:focus { border-color: rgba(200,169,110,0.4); box-shadow: 0 0 0 3px rgba(200,169,110,0.07); }
.fd-search-btn { display: flex; align-items: center; gap: 7px; padding: 10px 20px; background: linear-gradient(135deg, #8a6e3d, #c8a96e); border: none; border-radius: 10px; font-family: 'Jost', sans-serif; font-size: 12.5px; font-weight: 500; letter-spacing: 0.05em; color: #0d0f0e; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; white-space: nowrap; flex-shrink: 0; box-shadow: 0 4px 14px rgba(200,169,110,0.25); }
.fd-search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(200,169,110,0.35); }
.fd-suggested { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 18px; font-size: 11px; color: rgba(245,240,232,0.3); }
.fd-spec-tag { font-size: 11px; color: rgba(245,240,232,0.5); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,252,240,0.1); padding: 3px 10px; border-radius: 6px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.fd-spec-tag:hover { background: rgba(200,169,110,0.1); color: #e2c99a; }
.fd-results { min-height: 40px; }
.fd-meta { font-size: 11.5px; font-weight: 300; color: rgba(245,240,232,0.35); margin-bottom: 12px; }
.fd-meta strong { color: rgba(245,240,232,0.55); }
.fd-list { display: flex; flex-direction: column; gap: 9px; }
.fd-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,252,240,0.07); border-radius: 12px; padding: 14px 16px; transition: border-color 0.2s, background 0.2s; }
.fd-card:hover { border-color: rgba(200,169,110,0.2); background: rgba(200,169,110,0.03); }
.fd-card-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
.fd-icon { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; background: rgba(200,169,110,0.08); border: 1px solid rgba(200,169,110,0.15); display: flex; align-items: center; justify-content: center; color: #c8a96e; }
.fd-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fd-name { font-size: 13.5px; font-weight: 500; color: #f5f0e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.fd-type { font-size: 11px; color: rgba(245,240,232,0.35); font-weight: 300; letter-spacing: 0.02em; }
.fd-address { font-size: 11.5px; color: rgba(245,240,232,0.42); font-weight: 300; display: block; margin-top: 2px; line-height: 1.4; }
.fd-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
.fd-dist { font-family: 'DM Mono', monospace; font-size: 11px; color: #c8a96e; font-weight: 500; white-space: nowrap; }
.fd-actions { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.fd-btn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 7px; font-size: 11px; font-family: 'Jost', sans-serif; font-weight: 400; letter-spacing: 0.02em; text-decoration: none; cursor: pointer; white-space: nowrap; border: 1px solid rgba(255,252,240,0.1); color: rgba(245,240,232,0.55); background: rgba(255,255,255,0.04); transition: background 0.2s, color 0.2s; }
.fd-btn:hover    { background: rgba(255,255,255,0.09); color: #f5f0e8; }
.fd-btn--map  { border-color: rgba(200,169,110,0.2);   color: #c8a96e; background: rgba(200,169,110,0.06); }
.fd-btn--map:hover  { background: rgba(200,169,110,0.14); }
.fd-btn--call { border-color: rgba(122,158,142,0.25);  color: #a3c4b5; background: rgba(122,158,142,0.06); }
.fd-btn--call:hover { background: rgba(122,158,142,0.14); }
.fd-btn--web  { border-color: rgba(110,138,158,0.2);   color: #8aaecc; background: rgba(110,138,158,0.06); }
.fd-btn--web:hover  { background: rgba(110,138,158,0.14); }

@media (max-width: 600px) {
  .mc-modal-header { padding: 18px 20px 14px; }
  .mc-modal-body   { padding: 16px 18px; }
  .dp-meals-grid   { grid-template-columns: 1fr; }
  .dp-nutrients-grid { grid-template-columns: 1fr; }
  .fd-search-row   { flex-direction: column; }
  .fd-card         { flex-direction: column; gap: 10px; }
  .fd-card-right   { align-items: flex-start; flex-direction: row; flex-wrap: wrap; }
  .fd-dist         { order: -1; }
}

/* ── Cream mode modal overrides ── */
[data-theme="cream"] .mc-modal {
  background: #ede4ce; border-color: rgba(42,28,8,0.15);
  box-shadow: 0 40px 100px rgba(42,28,8,0.18), 0 0 0 1px rgba(138,94,40,0.08) inset;
}
[data-theme="cream"] .mc-modal-header { border-bottom-color: rgba(42,28,8,0.1); }
[data-theme="cream"] .mc-modal-title  { color: #1c1206; }
[data-theme="cream"] .mc-modal-sub    { color: rgba(28,18,6,0.38); }
[data-theme="cream"] .mc-modal-close  { background: rgba(42,28,8,0.05); border-color: rgba(42,28,8,0.1); color: rgba(28,18,6,0.4); }
[data-theme="cream"] .mc-modal-close:hover { background: rgba(138,48,48,0.1); color: #8a3030; }
[data-theme="cream"] .mc-loading p    { color: rgba(28,18,6,0.55); }
[data-theme="cream"] .mc-loading small{ color: rgba(28,18,6,0.3); }
[data-theme="cream"] .mc-spinner      { border-color: rgba(138,94,40,0.15); border-top-color: #8a5e28; }
[data-theme="cream"] .mc-error p      { color: rgba(28,18,6,0.5); }
[data-theme="cream"] .dp-section-title{ color: #1c1206; border-bottom-color: rgba(42,28,8,0.1); }
[data-theme="cream"] .dp-summary-card { background: rgba(138,94,40,0.06); border-color: rgba(138,94,40,0.18); }
[data-theme="cream"] .dp-summary-meta span { color: rgba(28,18,6,0.6); background: rgba(42,28,8,0.04); border-color: rgba(42,28,8,0.1); }
[data-theme="cream"] .dp-summary-text { color: rgba(28,18,6,0.65); }
[data-theme="cream"] .dp-meal-card    { background: rgba(42,28,8,0.04); border-color: rgba(42,28,8,0.1); }
[data-theme="cream"] .dp-meal-label   { color: #8a5e28; }
[data-theme="cream"] .dp-meal-list li { color: rgba(28,18,6,0.7); }
[data-theme="cream"] .dp-meal-list li::before { color: #8a5e28; }
[data-theme="cream"] .dp-sample-card  { background: rgba(42,28,8,0.03); border-color: rgba(42,28,8,0.08); }
[data-theme="cream"] .dp-sample-row   { border-bottom-color: rgba(42,28,8,0.06); }
[data-theme="cream"] .dp-sample-time  { color: #8a5e28; }
[data-theme="cream"] .dp-sample-meal  { color: rgba(28,18,6,0.7); }
[data-theme="cream"] .dp-nutrient     { background: rgba(42,28,8,0.04); }
[data-theme="cream"] .dp-nutrient strong { color: #1c1206; }
[data-theme="cream"] .dp-nutrient span   { color: rgba(28,18,6,0.5); }
[data-theme="cream"] .dp-avoid-item   { background: rgba(138,48,48,0.05); border-color: rgba(138,48,48,0.14); color: rgba(28,18,6,0.65); }
[data-theme="cream"] .dp-hydration-card { background: rgba(58,112,96,0.06); border-color: rgba(58,112,96,0.22); }
[data-theme="cream"] .dp-hydration-card li { color: rgba(28,18,6,0.6); }
[data-theme="cream"] .dp-tip          { background: rgba(138,94,40,0.05); border-color: rgba(138,94,40,0.12); color: rgba(28,18,6,0.65); }
[data-theme="cream"] .dp-disclaimer   { color: rgba(28,18,6,0.3); }
[data-theme="cream"] .fd-field label  { color: rgba(28,18,6,0.4); }
[data-theme="cream"] .fd-input        { background: rgba(42,28,8,0.05); border-color: rgba(42,28,8,0.14); color: #1c1206; }
[data-theme="cream"] .fd-input::placeholder { color: rgba(28,18,6,0.25); }
[data-theme="cream"] .fd-suggested    { color: rgba(28,18,6,0.35); }
[data-theme="cream"] .fd-spec-tag     { color: rgba(28,18,6,0.5); background: rgba(42,28,8,0.04); border-color: rgba(42,28,8,0.12); }
[data-theme="cream"] .fd-meta         { color: rgba(28,18,6,0.4); }
[data-theme="cream"] .fd-meta strong  { color: rgba(28,18,6,0.6); }
[data-theme="cream"] .fd-card         { background: rgba(42,28,8,0.04); border-color: rgba(42,28,8,0.09); }
[data-theme="cream"] .fd-card:hover   { border-color: rgba(138,94,40,0.22); background: rgba(138,94,40,0.04); }
[data-theme="cream"] .fd-icon         { background: rgba(138,94,40,0.09); border-color: rgba(138,94,40,0.18); color: #8a5e28; }
[data-theme="cream"] .fd-name         { color: #1c1206; }
[data-theme="cream"] .fd-type         { color: rgba(28,18,6,0.38); }
[data-theme="cream"] .fd-address      { color: rgba(28,18,6,0.45); }
[data-theme="cream"] .fd-dist         { color: #8a5e28; }
  `;
  document.head.appendChild(style);
}
