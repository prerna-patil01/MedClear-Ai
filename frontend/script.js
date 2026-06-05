/* ═══════════════════════════════════════════
   MedClear — script.js
   ═══════════════════════════════════════════ */

/* ─────────────────────────────────────────
   1. DNA HELIX GENERATOR
   ───────────────────────────────────────── */
function buildDNA(svgId) {
  const svg  = document.getElementById(svgId);
  const W    = 200, H = 2000, cx = 100, amp = 55, steps = 80;
  const pts1 = [], pts2 = [];
  let   html = '';

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const y1 = t * H;
    const x1 = cx + amp * Math.sin(t * Math.PI * 10);
    const x2 = cx - amp * Math.sin(t * Math.PI * 10);

    const col1 = i % 3 === 0 ? '#38BDF8' : i % 3 === 1 ? '#818CF8' : '#34D399';
    const col2 = i % 3 === 0 ? '#34D399' : i % 3 === 1 ? '#38BDF8' : '#818CF8';

    html += `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="5" fill="${col1}" opacity="0.8"/>`;
    html += `<circle cx="${x2.toFixed(1)}" cy="${y1.toFixed(1)}" r="5" fill="${col2}" opacity="0.8"/>`;

    if (i % 3 === 0) {
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${col1}" stroke-width="1.5" opacity="0.35"/>`;
    }

    pts1.push(`${x1.toFixed(1)},${y1.toFixed(1)}`);
    pts2.push(`${x2.toFixed(1)},${y1.toFixed(1)}`);
  }

  svg.innerHTML =
    `<polyline points="${pts1.join(' ')}" fill="none" stroke="#38BDF8" stroke-width="1.5" opacity="0.4"/>` +
    `<polyline points="${pts2.join(' ')}" fill="none" stroke="#818CF8" stroke-width="1.5" opacity="0.4"/>` +
    html;
}

buildDNA('dnasvg');
buildDNA('dnasvg2');


/* ─────────────────────────────────────────
   2. CANVAS DNA LOADER ANIMATION
   ───────────────────────────────────────── */
function drawLoader() {
  const canvas = document.getElementById('loaderCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let t = 0;

  function frame() {
    ctx.clearRect(0, 0, 60, 120);
    for (let i = 0; i < 8; i++) {
      const y  = (i / 7) * 100 + 10;
      const x1 = 30 + 18 * Math.sin((t + i * 0.4) * 2);
      const x2 = 30 - 18 * Math.sin((t + i * 0.4) * 2);

      ctx.beginPath();
      ctx.arc(x1, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#38BDF8';
      ctx.globalAlpha = 0.9;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x2, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#818CF8';
      ctx.fill();

      if (i < 7) {
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.strokeStyle = 'rgba(56,189,248,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    t += 0.06;
    requestAnimationFrame(frame);
  }

  frame();
}

drawLoader();


/* ─────────────────────────────────────────
   3. FILE HANDLING (drag-and-drop + picker)
   ───────────────────────────────────────── */
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
let   uploadedFile = null;

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  uploadedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('filePill').style.display = 'block';

  // For PDFs, don't try to read as text in the browser —
  // send the raw file to the backend instead.
  if (file.name.toLowerCase().endsWith('.pdf')) {
    document.getElementById('reportText').value = '';
    document.getElementById('reportText').placeholder =
      `📄 "${file.name}" ready — click Analyze to process.`;
    return;
  }

  // Plain text / CSV: preview in textarea
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('reportText').value = e.target.result;
    uploadedFile = null; // text is now in the textarea, no need to re-upload
  };
  reader.readAsText(file);
}


/* ─────────────────────────────────────────
   4. MAIN ANALYSIS
   ───────────────────────────────────────── */
const LOADING_STEPS = [
  'Reading values and reference ranges…',
  'Identifying abnormal findings…',
  'Generating plain-language explanations…',
  'Preparing doctor questions…',
];

async function analyzeReport() {
  const text = document.getElementById('reportText').value.trim();

  // Must have either pasted text or an uploaded PDF
  if (!text && !uploadedFile) {
    const ta = document.getElementById('reportText');
    ta.style.borderColor = 'var(--danger)';
    setTimeout(() => (ta.style.borderColor = ''), 1800);
    return;
  }

  // ── UI: show loading ──
  document.getElementById('analyzeBtn').disabled        = true;
  document.getElementById('inputSection').style.display = 'none';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('results').style.display      = 'none';

  // Cycle loading step text
  let stepIdx = 0;
  const stepEl    = document.getElementById('loadingStep');
  const stepTimer = setInterval(() => {
    stepIdx = (stepIdx + 1) % LOADING_STEPS.length;
    stepEl.textContent = LOADING_STEPS[stepIdx];
  }, 2200);

  try {
    let response;

    if (uploadedFile && uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      // ── Send PDF as multipart form data ──
      const formData = new FormData();
      formData.append('file', uploadedFile);

      response = await fetch('https://medclear-ai.onrender.com/analyze', {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — browser sets it with boundary automatically
      });

    } else {
      // ── Send pasted / plain-text content as JSON ──
      response = await fetch('https://medclear-ai.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: text }),
      });
    }

    clearInterval(stepTimer);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }

    const parsed = await response.json();
    renderResults(parsed);

  } catch (err) {
    clearInterval(stepTimer);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('inputSection').style.display = 'block';
    document.getElementById('analyzeBtn').disabled = false;
    alert('Something went wrong analyzing your report. Please try again.');
    console.error(err);
  }
}


/* ─────────────────────────────────────────
   5. RENDER RESULTS
   ───────────────────────────────────────── */
function renderResults(data) {
  document.getElementById('loadingState').style.display = 'none';

  // Summary
  document.getElementById('summaryTitle').textContent = data.title   || 'Report Analysis';
  document.getElementById('summaryText').textContent  = data.summary || '';

  // Findings
  const grid = document.getElementById('findingsGrid');
  grid.innerHTML = '';
  (data.findings || []).forEach((f, i) => {
    const label  = { normal: 'Normal', high: 'High', low: 'Low', info: 'Info' }[f.status] || 'Info';
    const status = f.status || 'info';
    const card   = document.createElement('div');
    card.className            = `finding-card ${status}`;
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="finding-header">
        <span class="finding-name">${esc(f.name)}</span>
        <span class="status-badge badge-${status}">${label}</span>
      </div>
      <div class="finding-value">${esc(f.value || '—')}</div>
      <div class="finding-range">Reference: ${esc(f.reference || 'N/A')}</div>
      <div class="finding-desc">${esc(f.explanation || '')}</div>
    `;
    grid.appendChild(card);
  });

  // Questions
  const qList = document.getElementById('questionsList');
  qList.innerHTML = '';
  (data.questions || []).forEach((q, i) => {
    const item = document.createElement('div');
    item.className            = 'question-item';
    item.style.animationDelay = `${i * 0.08}s`;
    item.innerHTML = `<span class="q-num">${i + 1}</span><span>${esc(q)}</span>`;
    qList.appendChild(item);
  });

  // Show results panel
  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';
  setTimeout(() => resultsEl.classList.add('show'), 10);
}


/* ─────────────────────────────────────────
   6. RESET
   ───────────────────────────────────────── */
function resetApp() {
  const resultsEl = document.getElementById('results');
  resultsEl.classList.remove('show');
  resultsEl.style.display = 'none';

  document.getElementById('reportText').value           = '';
  document.getElementById('reportText').placeholder     = 'Paste your lab report, prescription, blood work results, or discharge summary here...';
  document.getElementById('filePill').style.display     = 'none';
  document.getElementById('analyzeBtn').disabled        = false;
  document.getElementById('inputSection').style.display = 'block';

  uploadedFile = null;
  fileInput.value = '';
}


/* ─────────────────────────────────────────
   7. UTILITIES
   ───────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}


/* ─────────────────────────────────────────
   8. EVENT LISTENERS
   ───────────────────────────────────────── */
document.getElementById('analyzeBtn').addEventListener('click', analyzeReport);
document.getElementById('resetBtn').addEventListener('click', resetApp);
