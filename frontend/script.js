/* ══════════════════════════════════════════════════
   MEDCLEAR — FRONTEND v3
   API contracts:
     POST /api/analyze → { title, summary, risk:{level,score,reason}, findings[], questions[], lifestyle[], specialists[] }
     POST /api/chat    → { response }
     POST /api/doctors → { doctors[] }
══════════════════════════════════════════════════ */

const API_BASE = "https://medclearai.onrender.com";; // ← your Render URL

/* ── State ──────────────────────────────────────── */
let currentAnalysis  = null;
let chatHistory      = [];
let allFindings      = [];
let findingsExpanded = false;

/* ── DOM ────────────────────────────────────────── */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const screens = {
  upload:  $('#upload-screen'),
  loading: $('#loading-screen'),
  results: $('#results-screen'),
};

/* ══════════════════════════════════════════════════
   DARK MODE
══════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('medclear_theme', theme);

  // sync both toggle buttons
  $$('.icon-moon').forEach(el => { el.hidden = theme === 'dark'; });
  $$('.icon-sun').forEach(el  => { el.hidden = theme !== 'dark'; });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Init theme from localStorage
applyTheme(localStorage.getItem('medclear_theme') || 'light');

$('#dark-toggle').addEventListener('click', toggleTheme);
$('#dark-toggle-results').addEventListener('click', toggleTheme);

/* ══════════════════════════════════════════════════
   SCREEN TRANSITIONS
══════════════════════════════════════════════════ */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

/* ══════════════════════════════════════════════════
   UPLOAD
══════════════════════════════════════════════════ */
const fileInput  = $('#file-input');
const dropZone   = $('#drop-zone');
const reportText = $('#report-text');
const analyzeBtn = $('#analyze-btn');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  let chip = dropZone.querySelector('.file-chosen');
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'file-chosen';
    dropZone.insertBefore(chip, dropZone.querySelector('.or-divider'));
  }

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      chip.innerHTML = `<img src="${e.target.result}" class="file-preview-img" alt="Preview" /><span>${escapeHtml(file.name)}</span>`;
    };
    reader.readAsDataURL(file);
  } else {
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M4 5h6M4 7h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      <span>${escapeHtml(file.name)}</span>`;
  }
});

// Drag-drop
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const allowed = ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (allowed.includes(ext) || file.type.startsWith('image/') || file.type === 'text/plain' || file.type === 'application/pdf') {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

/* ══════════════════════════════════════════════════
   ANALYZE
══════════════════════════════════════════════════ */
analyzeBtn.addEventListener('click', handleAnalyze);

async function handleAnalyze() {
  const file = fileInput.files[0];
  const text = reportText.value.trim();

  if (!file && !text) {
    reportText.focus();
    reportText.style.borderColor = 'var(--red)';
    setTimeout(() => { reportText.style.borderColor = ''; }, 2000);
    return;
  }

  analyzeBtn.disabled = true;
  const isImage = file && file.type.startsWith('image/');
  showScreen('loading');
  startLoadingMessages(isImage);

  try {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else {
      formData.append('text', text);
    }

    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `Server error ${response.status}`);
    }

    currentAnalysis = data;
    renderResults(data);
    initMeddieWithContext(data);
    saveToHistory(data);
    showScreen('results');

  } catch (err) {
    console.error('Analysis failed:', err);
    showScreen('upload');
    showError(err.message || 'Analysis failed. Please try again.');
  } finally {
    analyzeBtn.disabled = false;
  }
}

/* ── Loading messages ── */
const LOADING_TEXT = [
  'Reading values and cross-referencing references…',
  'Identifying abnormal findings…',
  'Assessing risk indicators…',
  'Generating plain-language summary…',
  'Preparing your insights…',
];
const LOADING_IMAGE = [
  'Reading medical image…',
  'Extracting values with AI vision…',
  'Identifying test results…',
  'Generating your analysis…',
];
let _loadingInterval = null;

function startLoadingMessages(isImage = false) {
  const msgs = isImage ? LOADING_IMAGE : LOADING_TEXT;
  let i = 0;
  const el = $('#loading-sub-text');
  if (el) el.textContent = msgs[0];
  _loadingInterval = setInterval(() => {
    i = (i + 1) % msgs.length;
    if (el) el.textContent = msgs[i];
  }, 2200);
}

function stopLoadingMessages() { clearInterval(_loadingInterval); }

/* ══════════════════════════════════════════════════
   RENDER RESULTS
══════════════════════════════════════════════════ */
function renderResults(data) {
  stopLoadingMessages();
  renderRiskBanner(data.risk);
  renderSummary(data.summary);
  renderFindings(data.findings);
  renderLifestyle(data.lifestyle);
  renderQuestions(data.questions);
  renderSpecialists(data.specialists);
}

/* ── Risk Banner ── */
function renderRiskBanner(risk) {
  if (!risk) return;

  const banner  = $('#risk-banner');
  const levelEl = $('#risk-level-text');
  const badgeEl = $('#risk-badge');
  const scoreEl = $('#risk-score-num');
  const reasonEl = $('#risk-reason-text');

  const raw = (risk.level || '').toLowerCase();
  let level = 'default';
  let label = 'Unknown';

  if (raw.includes('critical') || raw.includes('very high')) { level = 'critical'; label = 'Immediate Attention'; }
  else if (raw.includes('high'))     { level = 'high';     label = 'High Risk'; }
  else if (raw.includes('moderate')) { level = 'moderate'; label = 'Moderate Risk'; }
  else if (raw.includes('low') || raw.includes('normal') || raw.includes('minimal')) { level = 'low'; label = 'Low Risk'; }

  banner.className = `risk-banner risk--${level}`;
  levelEl.textContent = risk.level
    ? risk.level.charAt(0).toUpperCase() + risk.level.slice(1) + ' Risk'
    : '—';
  badgeEl.textContent = label;
  if (scoreEl) scoreEl.textContent = risk.score != null ? risk.score : '—';
  if (reasonEl) reasonEl.textContent = risk.reason || '';
}

/* ── Summary ── */
function renderSummary(text) {
  const el = $('#summary-content');
  if (!el) return;
  el.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = text || 'No summary available.';
  el.appendChild(p);
}

/* ── Findings ── */
const STATUS_PRIORITY = { high: 0, abnormal: 0, critical: 0, moderate: 1, borderline: 1, low: 2, normal: 3, info: 4, informational: 4 };

function getStatusKey(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('high') || s.includes('abnormal') || s.includes('critical')) return 'high';
  if (s.includes('moderate') || s.includes('borderline'))                      return 'moderate';
  if (s.includes('low'))                                                        return 'low';
  if (s.includes('normal'))                                                     return 'normal';
  return 'informational';
}

function renderFindings(findings) {
  if (!findings || !findings.length) return;

  allFindings = [...findings].sort((a, b) => {
    const sa = getStatusKey(a.status || a.flag);
    const sb = getStatusKey(b.status || b.flag);
    return (STATUS_PRIORITY[sa] ?? 5) - (STATUS_PRIORITY[sb] ?? 5);
  });

  const list = $('#findings-list');
  list.innerHTML = '';

  const showCount = Math.min(allFindings.length, 5);
  allFindings.slice(0, showCount).forEach(f => list.appendChild(buildFindingItem(f)));

  const moreBtn = $('#findings-show-more');
  if (allFindings.length > showCount) {
    moreBtn.hidden = false;
    moreBtn.textContent = `Show all ${allFindings.length} findings ↓`;
    moreBtn.onclick = () => {
      if (!findingsExpanded) {
        allFindings.slice(showCount).forEach(f => list.appendChild(buildFindingItem(f)));
        moreBtn.textContent = 'Show fewer ↑';
        findingsExpanded = true;
      } else {
        list.querySelectorAll('.finding-item').forEach((item, idx) => { if (idx >= showCount) item.remove(); });
        moreBtn.textContent = `Show all ${allFindings.length} findings ↓`;
        findingsExpanded = false;
      }
    };
  } else {
    moreBtn.hidden = true;
  }
}

function buildFindingItem(f) {
  const status = getStatusKey(f.status || f.flag);
  const div = document.createElement('div');
  div.className = `finding-item status--${status}`;

  const name  = f.name  || f.test   || '';
  const value = f.value || f.result || '';
  const badge = f.status || f.flag || 'Info';
  const isBadgeNeutral = ['normal', 'informational', 'info'].includes(status);

  div.innerHTML = `
    <div class="finding-status-dot"></div>
    <div class="finding-content">
      <div class="finding-row">
        <div>
          <div class="finding-name">${escapeHtml(name)}</div>
          ${value
            ? `<div class="finding-value">${escapeHtml(value)}${f.reference ? `<span class="finding-ref"> · ref: ${escapeHtml(f.reference)}</span>` : ''}</div>`
            : ''}
        </div>
        <span class="finding-badge ${isBadgeNeutral ? 'badge--info' : ''}">${escapeHtml(badge)}</span>
      </div>
      ${f.explanation ? `<div class="finding-explanation">${escapeHtml(f.explanation)}</div>` : ''}
    </div>
  `;
  return div;
}

/* ── Lifestyle ── */
function renderLifestyle(items) {
  const list = $('#lifestyle-list');
  if (!list || !items || !items.length) return;
  list.innerHTML = '';

  const arr = Array.isArray(items) ? items : parseList(items);
  arr.forEach(item => {
    const li = document.createElement('li');
    li.className = 'lifestyle-item';

    if (typeof item === 'object' && item !== null) {
      li.innerHTML = `
        <span class="lifestyle-item-icon">${item.icon || '→'}</span>
        <div class="lifestyle-item-text">
          <div class="lifestyle-item-cat">${escapeHtml(item.category || '')}</div>
          <div>${escapeHtml(item.suggestion || '')}</div>
        </div>`;
    } else {
      li.innerHTML = `<span class="lifestyle-item-icon">→</span><div class="lifestyle-item-text">${escapeHtml(String(item))}</div>`;
    }
    list.appendChild(li);
  });
}

/* ── Questions ── */
function renderQuestions(items) {
  const list = $('#questions-list');
  if (!list || !items || !items.length) return;
  list.innerHTML = '';

  const arr = Array.isArray(items) ? items : parseList(items);
  arr.forEach(item => {
    const li = document.createElement('li');
    li.className = 'question-item';
    li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
    list.appendChild(li);
  });
}

/* ── Specialists ── */
function renderSpecialists(specialists) {
  const list    = $('#specialists-list');
  const section = $('#specialists-section');
  if (!list || !section) return;

  if (!specialists || !specialists.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  list.innerHTML = '';

  specialists.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'specialist-chip';
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM2.5 12c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      ${escapeHtml(s)}`;

    // Auto-populate doctor search with this specialty
    chip.addEventListener('click', () => {
      const locInput = $('#doctor-location');
      const doctorSection = $('#doctor-section');
      if (locInput) {
        // pre-fill specialty context; user still provides location
        locInput.placeholder = `Find a ${s} near…`;
        locInput.focus();
      }
      if (doctorSection) doctorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    list.appendChild(chip);
  });
}

/* ══════════════════════════════════════════════════
   SECTION TOGGLES
══════════════════════════════════════════════════ */
function setupToggle(toggleId, bodyId) {
  const btn  = $(`#${toggleId}`);
  const body = $(`#${bodyId}`);
  if (!btn || !body) return;
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    body.classList.toggle('collapsed', expanded);
  });
}
setupToggle('findings-toggle',  'findings-body');
setupToggle('lifestyle-toggle', 'lifestyle-body');
setupToggle('questions-toggle', 'questions-body');

/* ══════════════════════════════════════════════════
   QUICK ACTIONS
══════════════════════════════════════════════════ */
$('#qa-meddie-btn').addEventListener('click', () => {
  $('#meddie-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#chat-input').focus(), 600);
});
$('#qa-doctor-btn').addEventListener('click', () => {
  $('#doctor-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#doctor-location').focus(), 600);
});
$('#qa-download-btn').addEventListener('click', downloadPDF);
$('#download-btn-top').addEventListener('click', downloadPDF);

/* ══════════════════════════════════════════════════
   MEDDIE CHAT
══════════════════════════════════════════════════ */
const chatInput    = $('#chat-input');
const chatSendBtn  = $('#chat-send-btn');
const chatMessages = $('#chat-messages');

function initMeddieWithContext(data) {
  chatHistory = [];
  chatMessages.innerHTML = '';

  const risk = data.risk || {};
  const riskNote = risk.level
    ? ` Your risk level is <strong>${risk.level}</strong> (${risk.score}/10).`
    : '';

  addChatMessage('ai',
    `Hello! I'm Meddie, your AI health companion. I've reviewed your report — <em>${escapeHtml(data.title || 'your medical report')}</em>.${riskNote} Feel free to ask me anything about the findings, what values mean, or what to discuss with your doctor.`
  , true);
}

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
chatSendBtn.addEventListener('click', sendChat);

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
  chatSendBtn.disabled = true;
  addChatMessage('user', msg);

  const typingEl = createTypingIndicator();
  chatMessages.appendChild(typingEl);
  scrollChatToBottom();

  chatHistory.push({ role: 'user', content: msg });

  try {
    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: currentAnalysis,
        history: chatHistory.slice(-10),
      }),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `Error ${resp.status}`);

    const reply = data.response || 'I could not generate a response. Please try again.';
    chatHistory.push({ role: 'assistant', content: reply });

    typingEl.remove();
    addChatMessage('ai', reply);

  } catch (err) {
    console.error('Chat error:', err);
    typingEl.remove();
    addChatMessage('ai', 'Sorry, I encountered an error. Please try again.');
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

function addChatMessage(role, text, asHTML = false) {
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role === 'ai' ? 'ai' : 'user'}`;

  const avatarEl = document.createElement('div');
  avatarEl.className = 'chat-msg-avatar';
  avatarEl.setAttribute('aria-hidden', 'true');

  if (role === 'ai') {
    avatarEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v.3H4.5V7z" stroke="currentColor" stroke-width="1.1"/><circle cx="7" cy="6" r=".9" fill="currentColor"/></svg>`;
  } else {
    avatarEl.textContent = 'You';
    avatarEl.style.fontSize = '9px';
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  if (asHTML) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }

  div.appendChild(avatarEl);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  scrollChatToBottom();
}

function createTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--ai';
  div.innerHTML = `
    <div class="chat-msg-avatar" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/></svg>
    </div>
    <div class="chat-typing" aria-label="Meddie is typing"><span></span><span></span><span></span></div>`;
  return div;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
}

/* ══════════════════════════════════════════════════
   DOCTOR FINDER
══════════════════════════════════════════════════ */
$('#find-doctors-btn').addEventListener('click', handleFindDoctors);
$('#doctor-location').addEventListener('keydown', e => { if (e.key === 'Enter') handleFindDoctors(); });

async function handleFindDoctors() {
  const location = $('#doctor-location').value.trim();
  if (!location) { $('#doctor-location').focus(); return; }

  const list = $('#doctor-list');
  const btn  = $('#find-doctors-btn');

  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="spin"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="20 15"/></svg> Finding…`;
  list.innerHTML = '<div class="doctor-placeholder"><p>Searching near you…</p></div>';

  try {
    const resp = await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, specialty: deriveSpecialty() }),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `Error ${resp.status}`);

    if (data.note && (!data.doctors || !data.doctors.length)) {
      list.innerHTML = `<div class="doctor-placeholder"><p>${escapeHtml(data.note)}</p></div>`;
      return;
    }

    renderDoctors(data.doctors || []);

  } catch (err) {
    console.error('Doctor search error:', err);
    list.innerHTML = `<div class="doctor-placeholder"><p>${escapeHtml(err.message || 'Search failed. Try a different location.')}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Find Doctors`;
  }
}

function renderDoctors(doctors) {
  const list = $('#doctor-list');
  list.innerHTML = '';

  if (!doctors.length) {
    list.innerHTML = '<div class="doctor-placeholder"><p>No specialists found. Try a larger city or more central area.</p></div>';
    return;
  }

  doctors.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doctor-card';
    const initials = getInitials(doc.name || 'Dr');
    const distText = doc.distance_km != null ? `${doc.distance_km} km away` : '';

    card.innerHTML = `
      <div class="doctor-avatar">${escapeHtml(initials)}</div>
      <div class="doctor-info">
        <div class="doctor-name">${escapeHtml(doc.name || 'Unknown')}</div>
        <div class="doctor-specialty">${escapeHtml(doc.specialty || doc.type || 'Medical Facility')}</div>
        <div class="doctor-meta">${escapeHtml([doc.address, distText].filter(Boolean).join(' · '))}</div>
        <div class="doctor-actions">
          ${doc.maps_url ? `<a href="${escapeHtml(doc.maps_url)}" target="_blank" rel="noopener" class="doctor-link">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.73 3.5 6.5 3.5 6.5s3.5-3.77 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="currentColor"/></svg>
            View on Maps</a>` : ''}
          ${doc.phone ? `<a href="tel:${escapeHtml(doc.phone)}" class="doctor-link">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2.5c0-.28.22-.5.5-.5h2l1 2.5-1.5 1c.69 1.38 1.5 2.19 2.88 2.88l1-1.5L10 8v2c0 .28-.22.5-.5.5C4.15 10.5 2 4.23 2 2.5z" fill="currentColor"/></svg>
            Call</a>` : ''}
          ${doc.website ? `<a href="${escapeHtml(doc.website)}" target="_blank" rel="noopener" class="doctor-link">Website</a>` : ''}
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function deriveSpecialty() {
  if (!currentAnalysis) return 'general physician';
  const text = [
    currentAnalysis.summary || '',
    JSON.stringify(currentAnalysis.findings || []),
    (currentAnalysis.specialists || []).join(' '),
  ].join(' ').toLowerCase();

  if (text.includes('cardio') || text.includes('heart') || text.includes('cholesterol')) return 'cardiologist';
  if (text.includes('glucose') || text.includes('diabetes') || text.includes('hba1c') || text.includes('thyroid') || text.includes('tsh')) return 'endocrinologist';
  if (text.includes('kidney') || text.includes('renal') || text.includes('creatinine')) return 'nephrologist';
  if (text.includes('liver') || text.includes('bilirubin') || text.includes('hepat')) return 'hepatologist';
  if (text.includes('lung') || text.includes('pulmonary') || text.includes('respiratory')) return 'pulmonologist';
  if (text.includes('bone') || text.includes('joint') || text.includes('arthritis')) return 'rheumatologist';
  if (text.includes('neuro') || text.includes('brain')) return 'neurologist';
  const specialists = currentAnalysis.specialists || [];
  if (specialists.length) return specialists[0].toLowerCase();
  return 'general physician';
}

/* ══════════════════════════════════════════════════
   PDF DOWNLOAD (real jsPDF, not window.print)
══════════════════════════════════════════════════ */
function downloadPDF() {
  if (!currentAnalysis) return;
  if (!window.jspdf) { window.print(); return; } // fallback if CDN fails

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const M    = 20;    // margin
  const PW   = doc.internal.pageSize.getWidth() - 2 * M;
  let   y    = M;

  const nl = (extra = 6) => {
    y += extra;
    if (y > 270) { doc.addPage(); y = M; }
  };

  const addText = (text, size, style = 'normal', color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), PW);
    lines.forEach(line => {
      if (y > 275) { doc.addPage(); y = M; }
      doc.text(line, M, y);
      y += size * 0.45;
    });
  };

  const addSection = title => {
    nl(6);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 158, 128);
    doc.text(title, M, y);
    y += 6;
    doc.setDrawColor(13, 158, 128);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + PW, y);
    y += 5;
  };

  // Header
  addText(currentAnalysis.title || 'Medical Report Analysis', 20, 'bold', [14, 17, 23]);
  nl(3);
  addText(`Generated by MedClear AI · ${new Date().toLocaleDateString()}`, 9, 'normal', [120, 120, 120]);
  nl(6);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(M, y, M + PW, y);
  nl(6);

  // Risk
  if (currentAnalysis.risk) {
    const r = currentAnalysis.risk;
    const levelColor = r.level === 'low' ? [30, 140, 90] : r.level === 'high' ? [201, 54, 54] : [212, 131, 10];
    addText(`Risk Level: ${(r.level || '').toUpperCase()}  ·  Score: ${r.score || 0}/10`, 13, 'bold', levelColor);
    if (r.reason) { nl(3); addText(r.reason, 10, 'normal', [80, 80, 80]); }
    nl(4);
  }

  // Summary
  addSection('Summary');
  addText(currentAnalysis.summary || '', 10, 'normal', [60, 60, 60]);

  // Findings
  if (currentAnalysis.findings && currentAnalysis.findings.length) {
    addSection('Key Findings');
    currentAnalysis.findings.forEach(f => {
      nl(2);
      const status = (f.status || 'info').toUpperCase();
      addText(`${f.name || ''}  ·  ${f.value || ''}  [${status}]${f.reference ? '  ref: ' + f.reference : ''}`, 10, 'bold', [14, 17, 23]);
      if (f.explanation) { nl(2); addText(f.explanation, 9, 'normal', [80, 80, 80]); }
      nl(2);
    });
  }

  // Specialists
  if (currentAnalysis.specialists && currentAnalysis.specialists.length) {
    addSection('Recommended Specialists');
    addText(currentAnalysis.specialists.join('  ·  '), 10, 'normal', [13, 158, 128]);
  }

  // Lifestyle
  if (currentAnalysis.lifestyle && currentAnalysis.lifestyle.length) {
    addSection('Lifestyle Recommendations');
    currentAnalysis.lifestyle.forEach(item => {
      nl(2);
      const text = typeof item === 'object' ? `${item.icon || ''} ${item.suggestion || ''}` : item;
      addText(`• ${text}`, 10, 'normal', [60, 60, 60]);
    });
  }

  // Questions
  if (currentAnalysis.questions && currentAnalysis.questions.length) {
    addSection('Questions for Your Doctor');
    currentAnalysis.questions.forEach((q, i) => {
      nl(2);
      addText(`${i + 1}. ${q}`, 10, 'normal', [60, 60, 60]);
    });
  }

  // Disclaimer
  nl(10);
  addText('MedClear AI is for educational purposes only. Always consult a qualified healthcare professional for medical decisions.', 8, 'italic', [150, 150, 150]);

  doc.save(`MedClear-${(currentAnalysis.title || 'Report').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ══════════════════════════════════════════════════
   UPLOAD HISTORY (localStorage)
══════════════════════════════════════════════════ */
const HISTORY_KEY = 'medclear_history_v1';

function saveToHistory(data) {
  if (!data || !data.title) return;
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const item = {
      id:        Date.now(),
      title:     data.title,
      date:      new Date().toISOString(),
      riskLevel: data.risk?.level || 'unknown',
      summary:   (data.summary || '').slice(0, 120),
      data:      data,
    };
    history.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
  } catch (e) { console.warn('History save failed:', e); }
}

function loadHistoryPanel() {
  const list = $('#history-list');
  if (!list) return;

  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) {}

  list.innerHTML = '';

  if (!history.length) {
    list.innerHTML = '<p class="history-empty">No past analyses yet.</p>';
    return;
  }

  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-item-title">${escapeHtml(item.title)}</div>
      <div class="history-item-meta">
        <span class="risk-chip risk-chip--${item.riskLevel || 'unknown'}">${item.riskLevel || 'unknown'}</span>
        <span style="font-size:12px;color:var(--ink-50)">${new Date(item.date).toLocaleDateString()}</span>
      </div>
      <div class="history-item-summary">${escapeHtml(item.summary)}…</div>`;

    div.addEventListener('click', () => {
      currentAnalysis = item.data;
      renderResults(item.data);
      initMeddieWithContext(item.data);
      closeHistoryPanel();
      showScreen('results');
    });

    list.appendChild(div);
  });
}

function openHistoryPanel() {
  loadHistoryPanel();
  $('#history-panel').hidden   = false;
  $('#history-overlay').hidden = false;
}

function closeHistoryPanel() {
  $('#history-panel').hidden   = true;
  $('#history-overlay').hidden = true;
}

$('#history-btn-upload').addEventListener('click', openHistoryPanel);
$('#history-btn-results').addEventListener('click', openHistoryPanel);
$('#history-close').addEventListener('click', closeHistoryPanel);
$('#history-overlay').addEventListener('click', closeHistoryPanel);

/* ══════════════════════════════════════════════════
   BACK BUTTON
══════════════════════════════════════════════════ */
$('#back-btn').addEventListener('click', () => {
  currentAnalysis  = null;
  chatHistory      = [];
  allFindings      = [];
  findingsExpanded = false;
  fileInput.value  = '';
  reportText.value = '';

  $('#chat-messages').innerHTML = '';
  $('#findings-list').innerHTML = '';
  $('#lifestyle-list').innerHTML = '';
  $('#questions-list').innerHTML = '';
  $('#specialists-list').innerHTML = '';
  $('#specialists-section').style.display = 'none';

  const chip = dropZone.querySelector('.file-chosen');
  if (chip) chip.remove();

  $('#doctor-list').innerHTML = `<div class="doctor-placeholder"><svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="18" r="8" stroke="currentColor" stroke-width="1.2" opacity=".3"/><path d="M8 34c0-5 5-9 12-9s12 4 12 9" stroke="currentColor" stroke-width="1.2" opacity=".3" stroke-linecap="round"/></svg><p>Enter your location to find specialists near you.</p></div>`;

  ['lifestyle-body', 'questions-body'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.classList.add('collapsed');
  });
  [['findings-toggle', 'true'], ['lifestyle-toggle', 'false'], ['questions-toggle', 'false']].forEach(([id, val]) => {
    const t = $(`#${id}`);
    if (t) t.setAttribute('aria-expanded', val);
  });

  showScreen('upload');
});

/* ══════════════════════════════════════════════════
   ERROR TOAST
══════════════════════════════════════════════════ */
function showError(msg) {
  const existing = $('.error-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.setAttribute('role', 'alert');
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--red)', color: '#fff', padding: '12px 20px',
    borderRadius: 'var(--r-lg)', fontSize: '13.5px', fontWeight: '500',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: '9999',
    maxWidth: '90vw', textAlign: 'center', fontFamily: 'var(--font-sans)',
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(/\n+/).map(l => l.replace(/^[\d.\-*•\s]+/, '').trim()).filter(Boolean);
}
