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
  const dot = document.getElementById('cursor-dot');
  const glow = document.getElementById('cursor-glow');
  let mx = 0, my = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';
    glow.style.left = mx + 'px';
    glow.style.top = my + 'px';
  });
}

/* ════════════════════════════════════
   SCREENS
════════════════════════════════════ */
function initScreens() {
  const uploadScreen = document.getElementById('upload-screen');
  const resultsScreen = document.getElementById('results-screen');
  
  window.showScreen = function(name) {
    uploadScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    if (name === 'upload') uploadScreen.classList.add('active');
    if (name === 'results') resultsScreen.classList.add('active');
  };
}

/* ════════════════════════════════════
   UPLOAD SCREEN
════════════════════════════════════ */
function initUploadScreen() {
  const uploadTabs = document.querySelectorAll('.upload-tab');
  const fileArea = document.getElementById('upload-file-area');
  const textArea = document.getElementById('upload-text-area');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
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
    dropZone.style.borderColor = 'var(--cyan)';
    dropZone.style.background = 'rgba(0,212,255,0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.background = '';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.background = '';
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
    }
  });

  analyzeBtn.addEventListener('click', handleAnalyze);
}

async function handleAnalyze() {
  const fileInput = document.getElementById('file-input');
  const reportText = document.getElementById('report-text');
  const activeTab = document.querySelector('.upload-tab.active');

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
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--red)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    zIndex: '9999',
    fontFamily: 'var(--font-d)',
    fontWeight: '600',
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
    chatHistory = [];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('file-input').value = '';
    document.getElementById('report-text').value = '';
    window.showScreen('upload');
  });
}

function renderResults(data) {
  document.getElementById('report-name').textContent = data.title || 'Medical Analysis';
  document.getElementById('report-date').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
  const grid = document.getElementById('findings-grid');
  const count = document.getElementById('findings-count');

  count.textContent = findings.length;
  grid.innerHTML = '';

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
    const cat = typeof r === 'object' ? (r.category || '') : '';
    const text = typeof r === 'object' ? (r.suggestion || '') : String(r);
    item.innerHTML = `<strong>${escHtml(cat)}</strong>: ${icon} ${escHtml(text)}`;
    list.appendChild(item);
  });
}

function renderQuestions(data) {
  const questions = data.questions || [];
  const list = document.getElementById('questions-list');
  const count = document.getElementById('questions-count');

  count.textContent = questions.length;
  list.innerHTML = '';

  questions.forEach((q, i) => {
    const li = document.createElement('li');
    li.textContent = q;
    list.appendChild(li);
  });
}

function renderRiskBadge(data) {
  const badge = document.querySelector('.risk-badge');
  const level = (data.risk?.level || 'Unknown').toLowerCase();
  
  if (level.includes('low')) {
    badge.style.background = 'rgba(52,211,153,0.15)';
    badge.style.color = 'var(--green)';
    badge.textContent = 'Low Risk';
  } else if (level.includes('high') || level.includes('critical')) {
    badge.style.background = 'rgba(255,77,109,0.15)';
    badge.style.color = 'var(--red)';
    badge.textContent = 'High Risk';
  } else {
    badge.style.background = 'rgba(255,165,0,0.15)';
    badge.style.color = 'var(--amber)';
    badge.textContent = 'Moderate Risk';
  }
}

/* ════════════════════════════════════
   ANATOMY / WIREFRAME BODY
════════════════════════════════════ */
function initAnatomy() {
  // Mouse tracking for body rotation
  document.addEventListener('mousemove', (e) => {
    const svg = document.getElementById('anatomy-svg');
    if (!svg) return;
    
    const x = (e.clientX / window.innerWidth - 0.5) * 10;
    const y = (e.clientY / window.innerHeight - 0.5) * 5;
    svg.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  });
}

function createWireframeBody() {
  const svg = document.getElementById('anatomy-svg');
  if (!svg) return;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // Gradients
  const grad1 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad1.id = 'bodyGrad';
  grad1.setAttribute('x1', '0%');
  grad1.setAttribute('y1', '0%');
  grad1.setAttribute('x2', '100%');
  grad1.setAttribute('y2', '0%');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', '#00d4ff');
  stop1.setAttribute('stop-opacity', '0.8');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#00e5b0');
  stop2.setAttribute('stop-opacity', '0.8');
  
  grad1.appendChild(stop1);
  grad1.appendChild(stop2);
  defs.appendChild(grad1);
  svg.appendChild(defs);

  // Head
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  head.setAttribute('cx', '150');
  head.setAttribute('cy', '50');
  head.setAttribute('r', '25');
  head.setAttribute('stroke', 'url(#bodyGrad)');
  head.setAttribute('stroke-width', '1.5');
  head.setAttribute('fill', 'none');
  head.id = 'org-brain';
  head.classList.add('organ');
  head.dataset.organ = 'Brain';
  svg.appendChild(head);

  // Brain outline
  const brain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  brain.setAttribute('d', 'M130 45 Q130 35, 150 35 Q170 35, 170 45');
  brain.setAttribute('stroke', 'rgba(0,212,255,0.4)');
  brain.setAttribute('stroke-width', '1');
  brain.setAttribute('fill', 'none');
  svg.appendChild(brain);

  // Neck
  const neck = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  neck.setAttribute('d', 'M140 75 L140 95 Q150 93, 160 95 L160 75');
  neck.setAttribute('stroke', 'url(#bodyGrad)');
  neck.setAttribute('stroke-width', '1.5');
  neck.setAttribute('fill', 'none');
  svg.appendChild(neck);

  // Thorax outline
  const thorax = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  thorax.setAttribute('d', 'M120 95 Q120 110, 130 130 L170 130 Q180 110, 180 95');
  thorax.setAttribute('stroke', 'url(#bodyGrad)');
  thorax.setAttribute('stroke-width', '1.5');
  thorax.setAttribute('fill', 'none');
  svg.appendChild(thorax);

  // Left lung
  const lungL = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  lungL.setAttribute('cx', '132');
  lungL.setAttribute('cy', '120');
  lungL.setAttribute('rx', '12');
  lungL.setAttribute('ry', '20');
  lungL.setAttribute('stroke', '#00e5ff');
  lungL.setAttribute('stroke-width', '1');
  lungL.setAttribute('fill', 'none');
  lungL.id = 'org-lung-l';
  lungL.classList.add('organ');
  lungL.dataset.organ = 'Left Lung';
  svg.appendChild(lungL);

  // Right lung
  const lungR = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  lungR.setAttribute('cx', '168');
  lungR.setAttribute('cy', '120');
  lungR.setAttribute('rx', '12');
  lungR.setAttribute('ry', '20');
  lungR.setAttribute('stroke', '#00e5ff');
  lungR.setAttribute('stroke-width', '1');
  lungR.setAttribute('fill', 'none');
  lungR.id = 'org-lung-r';
  lungR.classList.add('organ');
  lungR.dataset.organ = 'Right Lung';
  svg.appendChild(lungR);

  // Heart
  const heart = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  heart.setAttribute('d', 'M150 115 L145 110 Q140 108, 137 112 Q135 115, 140 120 L150 128 L160 120 Q165 115, 163 112 Q160 108, 155 110 Z');
  heart.setAttribute('stroke', '#ff4d6d');
  heart.setAttribute('stroke-width', '1');
  heart.setAttribute('fill', 'rgba(255,77,109,0.2)');
  heart.id = 'org-heart';
  heart.classList.add('organ');
  heart.dataset.organ = 'Heart';
  svg.appendChild(heart);

  // Thyroid
  const thyroid = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  thyroid.setAttribute('cx', '150');
  thyroid.setAttribute('cy', '85');
  thyroid.setAttribute('rx', '8');
  thyroid.setAttribute('ry', '5');
  thyroid.setAttribute('stroke', '#ffa500');
  thyroid.setAttribute('stroke-width', '0.8');
  thyroid.setAttribute('fill', 'none');
  thyroid.id = 'org-thyroid';
  thyroid.classList.add('organ');
  thyroid.dataset.organ = 'Thyroid';
  svg.appendChild(thyroid);

  // Liver
  const liver = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  liver.setAttribute('cx', '168');
  liver.setAttribute('cy', '150');
  liver.setAttribute('rx', '16');
  liver.setAttribute('ry', '18');
  liver.setAttribute('stroke', '#ffa500');
  liver.setAttribute('stroke-width', '1');
  liver.setAttribute('fill', 'none');
  liver.id = 'org-liver';
  liver.classList.add('organ');
  liver.dataset.organ = 'Liver';
  svg.appendChild(liver);

  // Stomach
  const stomach = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stomach.setAttribute('d', 'M140 150 Q135 160, 140 170 Q145 175, 150 173 Q155 175, 160 170 Q165 160, 160 150');
  stomach.setAttribute('stroke', '#00e5b0');
  stomach.setAttribute('stroke-width', '1');
  stomach.setAttribute('fill', 'none');
  stomach.id = 'org-stomach';
  stomach.classList.add('organ');
  stomach.dataset.organ = 'Stomach';
  svg.appendChild(stomach);

  // Left kidney
  const kidneyL = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  kidneyL.setAttribute('cx', '130');
  kidneyL.setAttribute('cy', '175');
  kidneyL.setAttribute('rx', '8');
  kidneyL.setAttribute('ry', '12');
  kidneyL.setAttribute('stroke', '#00d4ff');
  kidneyL.setAttribute('stroke-width', '1');
  kidneyL.setAttribute('fill', 'none');
  kidneyL.id = 'org-kidney-l';
  kidneyL.classList.add('organ');
  kidneyL.dataset.organ = 'Left Kidney';
  svg.appendChild(kidneyL);

  // Right kidney
  const kidneyR = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  kidneyR.setAttribute('cx', '170');
  kidneyR.setAttribute('cy', '175');
  kidneyR.setAttribute('rx', '8');
  kidneyR.setAttribute('ry', '12');
  kidneyR.setAttribute('stroke', '#00d4ff');
  kidneyR.setAttribute('stroke-width', '1');
  kidneyR.setAttribute('fill', 'none');
  kidneyR.id = 'org-kidney-r';
  kidneyR.classList.add('organ');
  kidneyR.dataset.organ = 'Right Kidney';
  svg.appendChild(kidneyR);

  // Body outline (full)
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute('d', 'M120 95 L115 180 Q115 210, 130 240 L170 240 Q185 210, 185 180 L180 95');
  body.setAttribute('stroke', 'url(#bodyGrad)');
  body.setAttribute('stroke-width', '1.5');
  body.setAttribute('fill', 'none');
  body.setAttribute('opacity', '0.6');
  svg.appendChild(body);

  // Spine
  const spine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  spine.setAttribute('d', 'M150 95 Q149.5 150, 150 240');
  spine.setAttribute('stroke', 'rgba(0,229,176,0.3)');
  spine.setAttribute('stroke-width', '0.8');
  spine.setAttribute('fill', 'none');
  svg.appendChild(spine);

  // Legs
  const legL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  legL.setAttribute('x1', '130');
  legL.setAttribute('y1', '240');
  legL.setAttribute('x2', '125');
  legL.setAttribute('y2', '340');
  legL.setAttribute('stroke', 'url(#bodyGrad)');
  legL.setAttribute('stroke-width', '1.5');
  svg.appendChild(legL);

  const legR = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  legR.setAttribute('x1', '170');
  legR.setAttribute('y1', '240');
  legR.setAttribute('x2', '175');
  legR.setAttribute('y2', '340');
  legR.setAttribute('stroke', 'url(#bodyGrad)');
  legR.setAttribute('stroke-width', '1.5');
  svg.appendChild(legR);

  // Organ tooltips
  document.querySelectorAll('.organ').forEach(organ => {
    organ.addEventListener('mouseenter', (e) => {
      const tooltip = document.querySelector('.organ-tooltip');
      const name = organ.dataset.organ;
      tooltip.textContent = name;
      tooltip.classList.add('visible');
    });

    organ.addEventListener('mousemove', (e) => {
      const tooltip = document.querySelector('.organ-tooltip');
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    });

    organ.addEventListener('mouseleave', () => {
      const tooltip = document.querySelector('.organ-tooltip');
      tooltip.classList.remove('visible');
    });
  });
}

function highlightOrgans(data) {
  const ORGAN_KEYWORDS = {
    'org-brain': ['brain', 'neuro', 'headache'],
    'org-thyroid': ['thyroid', 'tsh', 't3', 't4'],
    'org-heart': ['heart', 'cardiac', 'cholesterol', 'blood pressure'],
    'org-lung-l': ['lung', 'respiratory', 'oxygen', 'spo2'],
    'org-lung-r': ['lung', 'respiratory'],
    'org-liver': ['liver', 'bilirubin', 'alt', 'ast'],
    'org-stomach': ['glucose', 'diabetes', 'stomach'],
    'org-kidney-l': ['kidney', 'creatinine', 'urea', 'renal'],
    'org-kidney-r': ['kidney', 'creatinine'],
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
      organ.style.opacity = '0.4';
    }
  });
}

/* ════════════════════════════════════
   MEDDIE CHAT
════════════════════════════════════ */
function initChat() {
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const prompts = document.querySelectorAll('.prompt-chip');

  if (send) send.addEventListener('click', sendMessage);
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

  const risk = data.risk?.level || 'unknown';
  const greeting = `Hi! I've analyzed your ${data.title || 'medical report'}. Your risk level is <strong>${risk}</strong>. What would you like to know?`;
  addMessage('ai', greeting);
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const msg = input?.value?.trim();

  if (!msg) return;

  input.value = '';
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

    const data = await res.json();
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
  const msg = document.createElement('div');
  msg.className = 'message ' + role;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = text;

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
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str || '').replace(/[&<>"']/g, c => map[c]);
}
