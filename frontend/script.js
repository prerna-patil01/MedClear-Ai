/* ══════════════════════════════════════════════════
   MEDCLEAR — FRONTEND LOGIC
   Preserves all original API contracts:
     POST /api/analyze  →  { summary, findings, lifestyle, questions, risk_assessment }
     POST /api/chat     →  { response }
     POST /api/doctors  →  { doctors: [...] }
   ══════════════════════════════════════════════════ */

const API_BASE = "https://medclear-ai.onrender.com";

/* ──────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────── */
let currentAnalysis = null;   // Stores last API /analyze response
let chatHistory     = [];     // Running conversation for /api/chat
let allFindings     = [];     // All parsed findings (for progressive disclosure)
let findingsExpanded = false;

/* ──────────────────────────────────────────────────
   DOM REFS
────────────────────────────────────────────────── */
const $  = (sel)    => document.querySelector(sel);
const $$ = (sel)    => document.querySelectorAll(sel);

const screens = {
  upload:  $('#upload-screen'),
  loading: $('#loading-screen'),
  results: $('#results-screen'),
};

/* ──────────────────────────────────────────────────
   SCREEN TRANSITIONS
────────────────────────────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

/* ──────────────────────────────────────────────────
   UPLOAD — file / drag-drop
────────────────────────────────────────────────── */
const fileInput  = $('#file-input');
const dropZone   = $('#drop-zone');
const reportText = $('#report-text');
const analyzeBtn = $('#analyze-btn');

// File chosen
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  // Show chosen file chip inside upload card
  let chip = dropZone.querySelector('.file-chosen');
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'file-chosen';
    dropZone.insertBefore(chip, dropZone.querySelector('.or-divider'));
  }
  chip.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/>
      <path d="M4 5h6M4 7h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
    ${file.name}
  `;
});

// Drag-drop
dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && (file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.txt'))) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

/* ──────────────────────────────────────────────────
   ANALYZE
────────────────────────────────────────────────── */
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
  showScreen('loading');
  startLoadingMessages();

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

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    currentAnalysis = data;

    renderResults(data);
    initMeddieWithContext(data);
    showScreen('results');

  } catch (err) {
    console.error('Analysis failed:', err);
    showScreen('upload');
    analyzeBtn.disabled = false;
    showError('Analysis failed. Please check your connection and try again.');
  } finally {
    analyzeBtn.disabled = false;
  }
}

/* Loading messages cycle */
const LOADING_MSGS = [
  'Reading values and cross-referencing references…',
  'Identifying abnormal findings…',
  'Assessing risk indicators…',
  'Generating plain-language summary…',
  'Preparing your insights…',
];
let loadingMsgInterval = null;

function startLoadingMessages() {
  let i = 0;
  const el = $('#loading-sub-text');
  if (el) el.textContent = LOADING_MSGS[0];
  loadingMsgInterval = setInterval(() => {
    i = (i + 1) % LOADING_MSGS.length;
    if (el) el.textContent = LOADING_MSGS[i];
  }, 2200);
}

function stopLoadingMessages() {
  clearInterval(loadingMsgInterval);
}

/* ──────────────────────────────────────────────────
   RENDER RESULTS
────────────────────────────────────────────────── */
function renderResults(data) {
  stopLoadingMessages();

  renderRiskBanner(data.risk_assessment);
  renderSummary(data.summary);
  renderFindings(data.findings);
  renderLifestyle(data.lifestyle || data.lifestyle_recommendations);
  renderQuestions(data.questions || data.doctor_questions);
}

/* ── Risk Banner ── */
function renderRiskBanner(riskText) {
  if (!riskText) return;

  const banner   = $('#risk-banner');
  const levelEl  = $('#risk-level-text');
  const badgeEl  = $('#risk-badge');

  const raw = (riskText || '').toLowerCase();
  let level = 'default';
  let label = 'Unknown';
  let display = riskText;

  if (raw.includes('critical') || raw.includes('very high')) {
    level = 'critical'; label = 'Immediate Attention Needed';
  } else if (raw.includes('high')) {
    level = 'high'; label = 'High Risk';
  } else if (raw.includes('moderate') || raw.includes('medium')) {
    level = 'moderate'; label = 'Moderate Risk';
  } else if (raw.includes('low') || raw.includes('normal') || raw.includes('minimal')) {
    level = 'low'; label = 'Low Risk';
  }

  banner.className = `risk-banner risk--${level}`;
  levelEl.textContent = display;
  badgeEl.textContent = label;
}

/* ── Summary ── */
function renderSummary(text) {
  const el = $('#summary-content');
  if (!el) return;
  el.innerHTML = '';
  if (!text) { el.textContent = 'No summary available.'; return; }
  const p = document.createElement('p');
  p.textContent = text;
  el.appendChild(p);
}

/* ── Findings ── */
const STATUS_PRIORITY = { high: 0, abnormal: 0, critical: 0, moderate: 1, borderline: 1, low: 2, normal: 3, informational: 4 };

function renderFindings(findings) {
  if (!findings || !findings.length) return;

  // Sort by priority (high/abnormal first)
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
        // Remove extra findings
        const items = list.querySelectorAll('.finding-item');
        items.forEach((item, idx) => { if (idx >= showCount) item.remove(); });
        moreBtn.textContent = `Show all ${allFindings.length} findings ↓`;
        findingsExpanded = false;
      }
    };
  }
}

function getStatusKey(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('high') || s.includes('abnormal') || s.includes('critical')) return 'high';
  if (s.includes('moderate') || s.includes('borderline'))                      return 'moderate';
  if (s.includes('low'))                                                        return 'low';
  if (s.includes('normal'))                                                     return 'normal';
  return 'informational';
}

function buildFindingItem(f) {
  const status = getStatusKey(f.status || f.flag);
  const div = document.createElement('div');
  div.className = `finding-item status--${status}`;

  const name  = f.name  || f.test   || '';
  const value = f.value || f.result || '';
  const badge = (f.status || f.flag || 'Info');
  const isBadgeNeutral = ['normal', 'informational'].includes(status);

  div.innerHTML = `
    <div class="finding-status-dot"></div>
    <div class="finding-content">
      <div class="finding-name">${escapeHtml(name)}</div>
      ${value ? `<div class="finding-value">${escapeHtml(value)}</div>` : ''}
    </div>
    <span class="finding-badge ${isBadgeNeutral ? 'badge--info' : ''}">${escapeHtml(badge)}</span>
  `;
  return div;
}

/* ── Lifestyle ── */
function renderLifestyle(items) {
  const list = $('#lifestyle-list');
  if (!list || !items) return;
  list.innerHTML = '';

  const arr = Array.isArray(items) ? items : parseList(items);
  arr.forEach(item => {
    const li = document.createElement('li');
    li.className = 'lifestyle-item';
    li.textContent = item;
    list.appendChild(li);
  });
}

/* ── Questions ── */
function renderQuestions(items) {
  const list = $('#questions-list');
  if (!list || !items) return;
  list.innerHTML = '';

  const arr = Array.isArray(items) ? items : parseList(items);
  arr.forEach(item => {
    const li = document.createElement('li');
    li.className = 'question-item';
    li.textContent = item;
    list.appendChild(li);
  });
}

/* ──────────────────────────────────────────────────
   SECTION TOGGLES
────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────
   QUICK ACTIONS
────────────────────────────────────────────────── */
$('#qa-meddie-btn').addEventListener('click', () => {
  const meddieSection = $('#meddie-section');
  meddieSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#chat-input').focus(), 600);
});

$('#qa-doctor-btn').addEventListener('click', () => {
  const doctorSection = $('#doctor-section');
  doctorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#doctor-location').focus(), 600);
});

$('#qa-download-btn').addEventListener('click', downloadPDF);
$('#download-btn-top').addEventListener('click', downloadPDF);

/* ──────────────────────────────────────────────────
   MEDDIE CHAT
────────────────────────────────────────────────── */
function initMeddieWithContext(data) {
  chatHistory = [];

  const riskNote = data.risk_assessment
    ? ` Based on the risk level (${data.risk_assessment}), I can help clarify what this means for you.`
    : '';

  addChatMessage('ai',
    `Hello! I'm Meddie, your AI health companion. I've reviewed your medical report.${riskNote} Feel free to ask me anything — about specific findings, what values mean, or what to discuss with your doctor.`
  );
}

const chatInput   = $('#chat-input');
const chatSendBtn = $('#chat-send-btn');
const chatMessages = $('#chat-messages');

// Send on Enter
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

chatSendBtn.addEventListener('click', sendChat);

// Starter chips
$$('.starter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const msg = chip.dataset.msg;
    chatInput.value = msg;
    sendChat();
    // Hide starters after first use
    chip.closest('.chat-starters').style.display = 'none';
  });
});

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  chatInput.value = '';
  chatSendBtn.disabled = true;
  addChatMessage('user', msg);

  // Show typing indicator
  const typingEl = createTypingIndicator();
  chatMessages.appendChild(typingEl);
  scrollChatToBottom();

  // Build context from current analysis
  const reportContext = currentAnalysis
    ? `The user has received the following medical report analysis:\n
Summary: ${currentAnalysis.summary || ''}\n
Risk Assessment: ${currentAnalysis.risk_assessment || ''}\n
Key Findings: ${JSON.stringify(currentAnalysis.findings || [])}`
    : '';

  chatHistory.push({ role: 'user', content: msg });

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: reportContext,
        history: chatHistory.slice(-10),  // Keep last 10 turns
      }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    const reply = data.response || data.message || 'I could not generate a response. Please try again.';

    chatHistory.push({ role: 'assistant', content: reply });

    typingEl.remove();
    addChatMessage('ai', reply);

  } catch (err) {
    console.error('Chat error:', err);
    typingEl.remove();
    addChatMessage('ai', 'Sorry, I encountered an error. Please check your connection and try again.');
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

function addChatMessage(role, text) {
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
  bubble.textContent = text;

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
    <div class="chat-typing" aria-label="Meddie is typing">
      <span></span><span></span><span></span>
    </div>
  `;
  return div;
}

function scrollChatToBottom() {
  const win = chatMessages;
  requestAnimationFrame(() => { win.scrollTop = win.scrollHeight; });
}

/* ──────────────────────────────────────────────────
   DOCTOR FINDER
────────────────────────────────────────────────── */
$('#find-doctors-btn').addEventListener('click', handleFindDoctors);
$('#doctor-location').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleFindDoctors();
});

async function handleFindDoctors() {
  const location = $('#doctor-location').value.trim();
  if (!location) {
    $('#doctor-location').focus();
    return;
  }

  const list   = $('#doctor-list');
  const btn    = $('#find-doctors-btn');

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="spin" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="20 15"/>
    </svg>
    Finding…
  `;

  list.innerHTML = '<div class="doctor-placeholder"><p>Searching for specialists near you…</p></div>';

  // Derive specialty from findings
  const specialty = deriveSpecialtyFromAnalysis();

  try {
    const response = await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location,
        specialty,
        report_context: currentAnalysis?.summary || '',
      }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    renderDoctors(data.doctors || []);

  } catch (err) {
    console.error('Doctor search error:', err);
    list.innerHTML = '<div class="doctor-placeholder"><p>Could not fetch doctors. Please try again.</p></div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      Find Doctors
    `;
  }
}

function renderDoctors(doctors) {
  const list = $('#doctor-list');
  list.innerHTML = '';

  if (!doctors.length) {
    list.innerHTML = '<div class="doctor-placeholder"><p>No specialists found. Try a different location.</p></div>';
    return;
  }

  doctors.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doctor-card';

    const initials = getInitials(doc.name || 'Dr');
    const rating   = doc.rating ? `${'★'.repeat(Math.round(doc.rating))}${'☆'.repeat(5 - Math.round(doc.rating))} ${doc.rating}` : '';

    card.innerHTML = `
      <div class="doctor-avatar">${escapeHtml(initials)}</div>
      <div class="doctor-info">
        <div class="doctor-name">${escapeHtml(doc.name || 'Unknown')}</div>
        <div class="doctor-specialty">${escapeHtml(doc.specialty || doc.type || '')}</div>
        <div class="doctor-meta">${escapeHtml(doc.address || doc.location || '')}</div>
        ${rating ? `<div class="doctor-rating">${rating}</div>` : ''}
      </div>
    `;

    list.appendChild(card);
  });
}

function deriveSpecialtyFromAnalysis() {
  if (!currentAnalysis) return '';
  const text = [
    currentAnalysis.summary || '',
    currentAnalysis.risk_assessment || '',
    JSON.stringify(currentAnalysis.findings || []),
  ].join(' ').toLowerCase();

  if (text.includes('cardiac') || text.includes('heart') || text.includes('ecg') || text.includes('cholesterol')) return 'cardiologist';
  if (text.includes('blood sugar') || text.includes('glucose') || text.includes('diabetes') || text.includes('hba1c')) return 'endocrinologist';
  if (text.includes('thyroid') || text.includes('tsh') || text.includes('t3') || text.includes('t4')) return 'endocrinologist';
  if (text.includes('kidney') || text.includes('renal') || text.includes('creatinine')) return 'nephrologist';
  if (text.includes('liver') || text.includes('hepatic') || text.includes('bilirubin')) return 'hepatologist';
  if (text.includes('lung') || text.includes('respiratory') || text.includes('pulmonary')) return 'pulmonologist';
  if (text.includes('bone') || text.includes('joint') || text.includes('arthritis')) return 'rheumatologist';
  return 'general physician';
}

/* ──────────────────────────────────────────────────
   PDF DOWNLOAD
────────────────────────────────────────────────── */
function downloadPDF() {
  if (!currentAnalysis) return;
  window.print();
}

/* ──────────────────────────────────────────────────
   BACK / NEW REPORT
────────────────────────────────────────────────── */
$('#back-btn').addEventListener('click', () => {
  // Reset state
  currentAnalysis   = null;
  chatHistory       = [];
  allFindings       = [];
  findingsExpanded  = false;
  fileInput.value   = '';
  reportText.value  = '';

  // Reset chat
  $('#chat-messages').innerHTML = '';

  // Reset doctor list
  $('#doctor-list').innerHTML = `
    <div class="doctor-placeholder">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="18" r="8" stroke="currentColor" stroke-width="1.2" opacity=".3"/>
        <path d="M8 34c0-5 5-9 12-9s12 4 12 9" stroke="currentColor" stroke-width="1.2" opacity=".3" stroke-linecap="round"/>
      </svg>
      <p>Enter your location to find specialists recommended based on your report findings.</p>
    </div>
  `;

  // Reset findings
  $('#findings-list').innerHTML = '';
  $('#lifestyle-list').innerHTML = '';
  $('#questions-list').innerHTML = '';

  // Re-collapse sections
  ['findings-body', 'lifestyle-body', 'questions-body'].forEach(id => {
    const el = $(`#${id}`);
    if (el && id !== 'findings-body') el.classList.add('collapsed');
  });

  // Reset toggles
  [['findings-toggle', 'true'], ['lifestyle-toggle', 'false'], ['questions-toggle', 'false']].forEach(([id, val]) => {
    const t = $(`#${id}`);
    if (t) t.setAttribute('aria-expanded', val);
  });

  // Remove file chip
  const chip = dropZone.querySelector('.file-chosen');
  if (chip) chip.remove();

  showScreen('upload');
});

/* ──────────────────────────────────────────────────
   CHAT STARTERS — hide after first interaction
────────────────────────────────────────────────── */
chatInput.addEventListener('input', () => {
  if (chatInput.value.trim()) {
    const starters = $('#chat-starters');
    if (starters) starters.style.opacity = '0.4';
  } else {
    const starters = $('#chat-starters');
    if (starters) starters.style.opacity = '1';
  }
});

/* ──────────────────────────────────────────────────
   ERROR HANDLING
────────────────────────────────────────────────── */
function showError(msg) {
  const existing = $('.error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.setAttribute('role', 'alert');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--red); color: #fff; padding: 12px 20px;
    border-radius: var(--r-lg); font-size: 13.5px; font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 9999;
    animation: slide-up 0.3s ease; max-width: 90vw; text-align: center;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ──────────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────────── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // Handle numbered lists, bullet lists, or newline-separated strings
  return String(value)
    .split(/\n+/)
    .map(line => line.replace(/^[\d\.\-\*•\s]+/, '').trim())
    .filter(Boolean);
}

/* Spin animation for loading state */
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 0.8s linear infinite; }
`;
document.head.appendChild(style);
