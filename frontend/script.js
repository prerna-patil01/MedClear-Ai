/**
 * MedClear v2 — script.js
 * Features: Analyze, Meddie Chat, Doctor Finder, Risk, Lifestyle, PDF Export, History
 */

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════

const API_BASE = "https://medclear-ai.onrender.com";

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

let currentReport = null;
let chatHistory = [];
let isChatLoading = false;
let fileSelected = null;

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  buildDNA("dnasvg");
  buildDNA("dnasvg2");
  drawLoader();
  updateHistoryBadge();
  setupDropZone();

  document.getElementById("analyzeBtn").addEventListener("click", analyzeReport);
  document.getElementById("resetBtn").addEventListener("click", resetApp);
});

// ═══════════════════════════════════════════════
// VIEW NAVIGATION
// ═══════════════════════════════════════════════

function showView(view) {
  document.getElementById("viewAnalyze").style.display = view === "analyze" ? "block" : "none";
  document.getElementById("viewHistory").style.display = view === "history" ? "block" : "none";
  document.getElementById("navAnalyze").classList.toggle("active", view === "analyze");
  document.getElementById("navHistory").classList.toggle("active", view === "history");
  if (view === "history") renderHistoryList();
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ═══════════════════════════════════════════════
// DROP ZONE & FILE HANDLING
// ═══════════════════════════════════════════════

function setupDropZone() {
  const zone = document.getElementById("dropZone");
  const input = document.getElementById("fileInput");

  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault(); zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  input.addEventListener("change", () => { if (input.files[0]) loadFile(input.files[0]); });
}

function loadFile(file) {
  const allowed = ["text/plain", "application/pdf"];
  if (!allowed.includes(file.type) && !file.name.match(/\.(txt|pdf)$/i)) {
    showToast("Only PDF and TXT files are supported.", "error"); return;
  }
  fileSelected = file;
  document.getElementById("fileName").textContent = file.name;
  document.getElementById("filePill").style.display = "block";
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById("reportText").value = e.target.result; };
    reader.readAsText(file);
  } else {
    document.getElementById("reportText").value = "";
    document.getElementById("reportText").placeholder = "PDF selected — text will be extracted automatically.";
  }
}

function clearFile() {
  fileSelected = null;
  document.getElementById("filePill").style.display = "none";
  document.getElementById("fileInput").value = "";
  document.getElementById("reportText").placeholder = "Paste your lab report…";
}

// ═══════════════════════════════════════════════
// ANALYZE REPORT
// ═══════════════════════════════════════════════

const LOADING_STEPS = [
  "Reading values and reference ranges…",
  "Identifying abnormal findings…",
  "Generating plain-language explanations…",
  "Calculating health risk score…",
  "Building lifestyle recommendations…",
  "Preparing doctor questions…",
];

async function analyzeReport() {
  clearInputError();
  const textVal = document.getElementById("reportText").value.trim();

  if (!fileSelected && textVal.length < 20) {
    showInputError("Please upload a file or paste your report text (at least 20 characters).");
    return;
  }

  document.getElementById("analyzeBtn").disabled = true;
  document.getElementById("inputSection").style.display = "none";
  document.getElementById("results").style.display = "none";
  const loadingEl = document.getElementById("loadingState");
  loadingEl.style.display = "block";

  let stepIdx = 0;
  const stepEl = document.getElementById("loadingStep");
  const stepTimer = setInterval(() => {
    stepIdx = (stepIdx + 1) % LOADING_STEPS.length;
    stepEl.textContent = LOADING_STEPS[stepIdx];
  }, 1800);

  try {
    let response;
    if (fileSelected) {
      const formData = new FormData();
      formData.append("file", fileSelected);
      response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
    } else {
      response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textVal })
      });
    }

    clearInterval(stepTimer);
    loadingEl.style.display = "none";

    const data = await response.json();

    if (!response.ok) {
      showInputError(data.error || "Analysis failed. Please try again.");
      document.getElementById("inputSection").style.display = "block";
      document.getElementById("analyzeBtn").disabled = false;
      return;
    }

    currentReport = data;
    chatHistory = [];
    renderResults(data);
    saveToHistory(data);
    showToast("Report analyzed successfully!", "success");

  } catch (err) {
    clearInterval(stepTimer);
    loadingEl.style.display = "none";
    document.getElementById("inputSection").style.display = "block";
    document.getElementById("analyzeBtn").disabled = false;
    showInputError("Could not connect to the server. Please check your connection and try again.");
  }
}

// ═══════════════════════════════════════════════
// RENDER RESULTS
// ═══════════════════════════════════════════════

function renderResults(data) {
  renderRiskBanner(data.risk);

  document.getElementById("summaryTitle").textContent = data.title || "Report Analysis";
  document.getElementById("summaryText").textContent = data.summary || "";

  const grid = document.getElementById("findingsGrid");
  grid.innerHTML = "";
  (data.findings || []).forEach((f, i) => {
    const label = { normal: "Normal", high: "High", low: "Low", info: "Info" }[f.status] || "Info";
    const card = document.createElement("div");
    card.className = `finding-card ${f.status || "info"}`;
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="finding-header">
        <span class="finding-name">${esc(f.name)}</span>
        <span class="status-badge badge-${f.status || "info"}">${label}</span>
      </div>
      <div class="finding-value">${esc(f.value || "—")}</div>
      <div class="finding-range">Reference: ${esc(f.reference || "N/A")}</div>
      <div class="finding-desc">${esc(f.explanation || "")}</div>
    `;
    grid.appendChild(card);
  });

  const lgGrid = document.getElementById("lifestyleGrid");
  lgGrid.innerHTML = "";
  (data.lifestyle || []).forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "lifestyle-card";
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="lifestyle-icon">${esc(item.icon || "✨")}</div>
      <div class="lifestyle-category">${esc(item.category || "Wellness")}</div>
      <div class="lifestyle-text">${esc(item.suggestion || "")}</div>
    `;
    lgGrid.appendChild(card);
  });

  const qList = document.getElementById("questionsList");
  qList.innerHTML = "";
  (data.questions || []).forEach((q, i) => {
    const item = document.createElement("div");
    item.className = "question-item";
    item.style.animationDelay = `${i * 0.08}s`;
    item.innerHTML = `<span class="q-num">${i + 1}</span><span>${esc(q)}</span>`;
    qList.appendChild(item);
  });

  const specs = (data.specialists || ["General Physician"]).join(", ");
  document.getElementById("doctorsSpecialtySub").textContent = `Recommended: ${specs}`;

  resetMeddieGreeting();

  const resultsEl = document.getElementById("results");
  resultsEl.style.display = "block";
  resultsEl.style.animation = "none";
  void resultsEl.offsetWidth;
  resultsEl.style.animation = "fadeUp 0.5s ease";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderRiskBanner(risk) {
  const banner = document.getElementById("riskBanner");
  if (!risk) { banner.style.display = "none"; return; }

  const level = (risk.level || "low").toLowerCase();
  const icons = { low: "💚", moderate: "⚠️", high: "🚨" };
  const labels = { low: "Low Risk", moderate: "Moderate Risk", high: "High Risk" };

  banner.className = `risk-banner ${level}`;
  banner.innerHTML = `
    <div class="risk-icon">${icons[level] || "💚"}</div>
    <div>
      <div class="risk-label ${level}">${labels[level] || "Low Risk"}</div>
      <div class="risk-reason">${esc(risk.reason || "")}</div>
    </div>
    <div class="risk-score-ring">
      <div class="risk-score-num ${level}">${risk.score || 0}</div>
      <div class="risk-score-sub">/ 100</div>
    </div>
  `;
  banner.style.display = "flex";
}

// ═══════════════════════════════════════════════
// MEDDIE CHAT
// ═══════════════════════════════════════════════

function resetMeddieGreeting() {
  const window_el = document.getElementById("chatWindow");
  window_el.innerHTML = `
    <div class="chat-msg meddie-msg">
      <div class="msg-avatar">🤖</div>
      <div class="msg-bubble">
        Hi! I've reviewed your report. Ask me anything — like <em>"Why is my hemoglobin low?"</em> or <em>"Is my blood pressure concerning?"</em>
      </div>
    </div>
  `;
  chatHistory = [];
}

async function sendChat() {
  if (isChatLoading) return;
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  if (!currentReport) { showToast("Please analyze a report first.", "info"); return; }

  input.value = "";
  appendChatMsg("user", msg);
  chatHistory.push({ role: "user", content: msg });

  isChatLoading = true;
  document.getElementById("chatSendBtn").disabled = true;
  document.getElementById("chatTyping").style.display = "flex";
  scrollChat();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        reportContext: currentReport,
        history: chatHistory.slice(-10)
      })
    });

    const data = await res.json();
    document.getElementById("chatTyping").style.display = "none";

    if (!res.ok || data.error) {
      appendChatMsg("meddie", data.error || "I'm having trouble right now. Please try again.");
    } else {
      appendChatMsg("meddie", data.reply);
      chatHistory.push({ role: "assistant", content: data.reply });
    }
  } catch {
    document.getElementById("chatTyping").style.display = "none";
    appendChatMsg("meddie", "I can't reach the server right now. Please check your connection and try again.");
  }

  isChatLoading = false;
  document.getElementById("chatSendBtn").disabled = false;
  scrollChat();
}

function appendChatMsg(role, text) {
  const win = document.getElementById("chatWindow");
  const isUser = role === "user";
  const div = document.createElement("div");
  div.className = `chat-msg ${isUser ? "user-msg" : "meddie-msg"}`;
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? "👤" : "🤖"}</div>
    <div class="msg-bubble">${esc(text).replace(/\n/g, "<br>")}</div>
  `;
  win.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const win = document.getElementById("chatWindow");
  win.scrollTop = win.scrollHeight;
}

// ═══════════════════════════════════════════════
// NEARBY DOCTORS
// ═══════════════════════════════════════════════

async function findDoctors() {
  const btn = document.getElementById("locateBtn");
  const loadingEl = document.getElementById("doctorsLoading");
  const listEl = document.getElementById("doctorsList");
  const emptyEl = document.getElementById("doctorsEmpty");

  btn.disabled = true;
  btn.textContent = "Locating…";
  loadingEl.style.display = "flex";
  listEl.innerHTML = "";
  emptyEl.style.display = "none";

  if (!navigator.geolocation) {
    showToast("Geolocation is not supported by your browser.", "error");
    resetDoctorsBtn(); return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const specialists = currentReport?.specialists || ["general physician"];

      try {
        const res = await fetch(`${API_BASE}/api/doctors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, specialists })
        });
        const data = await res.json();
        loadingEl.style.display = "none";

        if (!res.ok) {
          showToast(data.error || "Could not fetch doctors.", "error");
          resetDoctorsBtn(); return;
        }

        if (!data.doctors || data.doctors.length === 0) {
          emptyEl.style.display = "block";
          const link = document.getElementById("gmapsLink");
          if (link && data.maps_search_url) link.href = data.maps_search_url;
        } else {
          renderDoctors(data.doctors);
        }
        resetDoctorsBtn();

      } catch {
        loadingEl.style.display = "none";
        showToast("Could not connect to server.", "error");
        resetDoctorsBtn();
      }
    },
    (err) => {
      loadingEl.style.display = "none";
      const msgs = {
        1: "Location access denied. Please allow location in your browser settings.",
        2: "Location unavailable. Please try again.",
        3: "Location request timed out. Please try again."
      };
      showToast(msgs[err.code] || "Could not get your location.", "error");
      resetDoctorsBtn();
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function renderDoctors(doctors) {
  const listEl = document.getElementById("doctorsList");
  listEl.innerHTML = "";
  doctors.forEach((doc, i) => {
    const item = document.createElement("div");
    item.className = "doctor-item";
    item.style.animationDelay = `${i * 0.06}s`;
    const phone = doc.phone ? `<span> · 📞 ${esc(doc.phone)}</span>` : "";
    const hours = doc.opening_hours ? `<div style="margin-top:2px;font-size:11px;color:var(--muted)">🕐 ${esc(doc.opening_hours)}</div>` : "";
    item.innerHTML = `
      <div class="doctor-icon">🏥</div>
      <div class="doctor-info">
        <div class="doctor-name">${esc(doc.name)}</div>
        <div class="doctor-specialty">${esc(doc.specialty)}</div>
        <div class="doctor-meta">${esc(doc.address || "")}${phone}</div>
        ${hours}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <div class="doctor-distance">${doc.distance_km} km</div>
        <a href="${esc(doc.maps_url)}" target="_blank" rel="noopener" class="btn-directions">Directions →</a>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function resetDoctorsBtn() {
  const btn = document.getElementById("locateBtn");
  btn.disabled = false;
  btn.textContent = "📍 Use My Location";
}

// ═══════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════

function exportPDF() {
  if (!currentReport) { showToast("No report to export.", "info"); return; }
  showToast("Generating PDF…", "info");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, margin = 20, contentW = pageW - margin * 2;
  let y = 20;

  const addText = (text, size, bold, color, indent) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(color || [232, 244, 255]));
    const x = margin + (indent || 0);
    const lines = doc.splitTextToSize(String(text), contentW - (indent || 0));
    lines.forEach(line => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, x, y);
      y += size * 0.45;
    });
    y += 2;
  };

  const addLine = () => {
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  doc.setFillColor(3, 8, 15);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(10, 18, 32);
  doc.roundedRect(margin, y - 5, contentW, 22, 3, 3, "F");
  addText("⚕  MedClear Health Report", 16, true, [56, 189, 248]);
  addText(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, 9, false, [123, 168, 196]);
  y += 4;
  addLine();

  if (currentReport.risk) {
    const riskColors = { low: [52, 211, 153], moderate: [251, 191, 36], high: [248, 113, 113] };
    const c = riskColors[currentReport.risk.level] || [52, 211, 153];
    doc.setFillColor(...c);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, "F");
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(3, 8, 15);
    doc.text(`Health Risk: ${(currentReport.risk.level || "low").toUpperCase()}   Score: ${currentReport.risk.score}/100   ${currentReport.risk.reason || ""}`, margin + 4, y + 8);
    y += 18;
  }

  addText(currentReport.title || "Medical Report Analysis", 14, true, [232, 244, 255]);
  addText(currentReport.summary || "", 10, false, [176, 212, 236]);
  y += 2; addLine();

  addText("Findings", 12, true, [56, 189, 248]);
  (currentReport.findings || []).forEach(f => {
    const statusColor = { normal: [52, 211, 153], high: [248, 113, 113], low: [251, 191, 36], info: [129, 140, 248] };
    const c = statusColor[f.status] || [129, 140, 248];
    if (y > 260) { doc.addPage(); doc.setFillColor(3, 8, 15); doc.rect(0, 0, 210, 297, "F"); y = 20; }
    doc.setFillColor(10, 18, 32);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...c);
    doc.text(`${f.name}  [${(f.status || "info").toUpperCase()}]`, margin + 4, y + 6);
    doc.setFont("helvetica", "normal"); doc.setTextColor(232, 244, 255);
    doc.text(`${f.value || ""}   Ref: ${f.reference || "N/A"}`, margin + 4, y + 11);
    const expLines = doc.splitTextToSize(f.explanation || "", contentW - 8);
    doc.setTextColor(176, 212, 236);
    doc.text(expLines[0] || "", margin + 4, y + 16);
    y += 22;
  });

  y += 2; addLine();

  if (currentReport.lifestyle?.length) {
    addText("Lifestyle Recommendations", 12, true, [56, 189, 248]);
    (currentReport.lifestyle || []).forEach(item => {
      addText(`${item.icon || "✨"} ${item.category}: ${item.suggestion}`, 9, false, [176, 212, 236], 4);
    });
    y += 2; addLine();
  }

  addText("Questions for Your Doctor", 12, true, [56, 189, 248]);
  (currentReport.questions || []).forEach((q, i) => {
    addText(`${i + 1}. ${q}`, 9, false, [176, 212, 236], 4);
  });

  y += 4;
  addText("⚠ This report is for educational purposes only. Always consult a qualified healthcare professional.", 8, false, [160, 128, 64]);

  const filename = `MedClear_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  showToast("PDF downloaded!", "success");
}

// ═══════════════════════════════════════════════
// HEALTH HISTORY
// ═══════════════════════════════════════════════

const HISTORY_KEY = "medclear_history";

function saveToHistory(data) {
  const history = getHistory();
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    title: data.title || "Medical Report",
    summary: data.summary || "",
    risk: data.risk || null,
    data: data
  };
  history.unshift(entry);
  const trimmed = history.slice(0, 20);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed.slice(0, 5)));
  }
  updateHistoryBadge();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function updateHistoryBadge() {
  const count = getHistory().length;
  const badge = document.getElementById("historyBadge");
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

function renderHistoryList() {
  const history = getHistory();
  const listEl = document.getElementById("historyList");
  const emptyEl = document.getElementById("historyEmpty");

  if (history.length === 0) {
    emptyEl.style.display = "flex";
    listEl.innerHTML = "";
    return;
  }
  emptyEl.style.display = "none";
  listEl.innerHTML = "";

  history.forEach((entry, idx) => {
    const riskLevel = entry.risk?.level || "low";
    const riskLabel = { low: "Low Risk", moderate: "Moderate Risk", high: "High Risk" }[riskLevel] || "Low Risk";
    const dateStr = new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const item = document.createElement("div");
    item.className = "history-item";
    item.style.animationDelay = `${idx * 0.06}s`;
    item.innerHTML = `
      <div class="history-icon">📋</div>
      <div class="history-info" onclick="loadFromHistory(${entry.id})">
        <div class="history-title">${esc(entry.title)}</div>
        <div class="history-date">${dateStr}</div>
        <div class="history-summary">${esc(entry.summary)}</div>
      </div>
      <div class="history-actions">
        <span class="history-risk-pill ${riskLevel}">${riskLabel}</span>
        <button class="btn-history-del" onclick="deleteHistory(${entry.id}, event)" title="Delete">🗑</button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function loadFromHistory(id) {
  const history = getHistory();
  const entry = history.find(e => e.id === id);
  if (!entry) return;
  currentReport = entry.data;
  chatHistory = [];
  showView("analyze");
  document.getElementById("inputSection").style.display = "none";
  renderResults(entry.data);
  showToast("Report loaded from history.", "info");
}

function deleteHistory(id, event) {
  event.stopPropagation();
  const history = getHistory().filter(e => e.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  updateHistoryBadge();
  renderHistoryList();
}

// ═══════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════

function resetApp() {
  currentReport = null;
  chatHistory = [];
  fileSelected = null;
  document.getElementById("results").style.display = "none";
  document.getElementById("reportText").value = "";
  document.getElementById("filePill").style.display = "none";
  document.getElementById("fileInput").value = "";
  document.getElementById("analyzeBtn").disabled = false;
  document.getElementById("chatWindow").innerHTML = "";
  document.getElementById("doctorsList").innerHTML = "";
  document.getElementById("doctorsEmpty").style.display = "none";
  document.getElementById("findingsGrid").innerHTML = "";
  document.getElementById("lifestyleGrid").innerHTML = "";
  document.getElementById("questionsList").innerHTML = "";
  clearInputError();
  document.getElementById("inputSection").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ═══════════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════════

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

function showInputError(msg) {
  const el = document.getElementById("inputError");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("reportText").classList.add("error");
  document.getElementById("inputSection").style.display = "block";
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("analyzeBtn").disabled = false;
}

function clearInputError() {
  document.getElementById("inputError").style.display = "none";
  document.getElementById("reportText").classList.remove("error");
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════
// DNA HELIX ANIMATION
// ═══════════════════════════════════════════════

function buildDNA(svgId) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const W = 200, H = 2000, cx = 100, amp = 55, steps = 80;
  const pts1 = [], pts2 = [];
  let html = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x1 = cx + amp * Math.sin(t * Math.PI * 10);
    const x2 = cx - amp * Math.sin(t * Math.PI * 10);
    const y = t * H;
    pts1.push(`${x1.toFixed(1)},${y.toFixed(1)}`);
    pts2.push(`${x2.toFixed(1)},${y.toFixed(1)}`);
    const col1 = i % 3 === 0 ? "#38BDF8" : i % 3 === 1 ? "#818CF8" : "#34D399";
    const col2 = i % 3 === 0 ? "#34D399" : i % 3 === 1 ? "#38BDF8" : "#818CF8";
    html += `<circle cx="${x1.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${col1}" opacity="0.8"/>`;
    html += `<circle cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${col2}" opacity="0.8"/>`;
    if (i % 3 === 0) {
      html += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col1}" stroke-width="1.5" opacity="0.3"/>`;
    }
  }
  const strands = `<polyline points="${pts1.join(" ")}" fill="none" stroke="#38BDF8" stroke-width="1.5" opacity="0.4"/>
    <polyline points="${pts2.join(" ")}" fill="none" stroke="#818CF8" stroke-width="1.5" opacity="0.4"/>`;
  svg.innerHTML = strands + html;
}

// ═══════════════════════════════════════════════
// CANVAS LOADER ANIMATION
// ═══════════════════════════════════════════════

function drawLoader() {
  const canvas = document.getElementById("loaderCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let t = 0;
  function frame() {
    if (document.getElementById("loadingState").style.display === "none") { requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, 60, 120);
    for (let i = 0; i < 8; i++) {
      const y = (i / 7) * 100 + 10;
      const x1 = 30 + 18 * Math.sin((t + i * 0.4) * 2);
      const x2 = 30 - 18 * Math.sin((t + i * 0.4) * 2);
      ctx.beginPath(); ctx.arc(x1, y, 4, 0, Math.PI * 2); ctx.fillStyle = "#38BDF8"; ctx.globalAlpha = 0.9; ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y, 4, 0, Math.PI * 2); ctx.fillStyle = "#818CF8"; ctx.fill();
      if (i < 7) { ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.strokeStyle = "rgba(56,189,248,0.3)"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    t += 0.06;
    requestAnimationFrame(frame);
  }
  frame();
}