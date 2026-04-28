// ===== StudyGenius AI - Application Logic =====

const MODES = [
  { id:'summarize', icon:'📝', label:'Summarize', placeholder:'Paste your notes, article, or any text you want summarized...', fields:['textarea'] },
  { id:'quiz', icon:'❓', label:'Quiz', placeholder:'Paste text or enter a topic to generate quiz questions...', fields:['textarea'] },
  { id:'plan', icon:'📅', label:'Study Plan', placeholder:'Enter the subject or topic you need to study...', fields:['textarea','topic','date'] },
  { id:'flashcards', icon:'🃏', label:'Flashcards', placeholder:'Paste notes or enter a topic to create flashcards...', fields:['textarea'] },
  { id:'difficulty', icon:'📊', label:'Analyze', placeholder:'Enter a topic or paste content to analyze its difficulty...', fields:['textarea'] }
];

let currentMode = 'summarize';
let apiKey = localStorage.getItem('sg_api_key') || '';
let isGenerating = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderModeTabs();
  updateApiDot();
  setupEventListeners();
  setMode('summarize');
});

function setupEventListeners() {
  document.getElementById('apiKeyBtn').addEventListener('click', openModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('generateBtn').addEventListener('click', generate);
  document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey();
  });
}

// ===== MODE TABS =====
function renderModeTabs() {
  const container = document.getElementById('modeTabs');
  container.innerHTML = MODES.map(m =>
    `<button class="mode-tab" data-mode="${m.id}" onclick="setMode('${m.id}')">
      <span class="tab-icon">${m.icon}</span>
      <span class="tab-label">${m.label}</span>
    </button>`
  ).join('');
}

function setMode(mode) {
  currentMode = mode;
  const m = MODES.find(x => x.id === mode);

  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

  const textarea = document.getElementById('mainInput');
  textarea.placeholder = m.placeholder;

  // Show/hide extra fields
  const extraFields = document.getElementById('extraFields');
  if (mode === 'plan') {
    extraFields.style.display = 'grid';
  } else {
    extraFields.style.display = 'none';
  }

  // Update button text
  const btnTexts = { summarize:'Generate Summary', quiz:'Generate Quiz', plan:'Build Study Plan', flashcards:'Create Flashcards', difficulty:'Analyze Difficulty' };
  document.getElementById('btnText').textContent = btnTexts[mode];

  // Hide results
  document.getElementById('resultsPanel').classList.remove('visible');
}

// ===== API KEY MODAL =====
function openModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('visible');
  const input = document.getElementById('apiKeyInput');
  input.value = apiKey;
  setTimeout(() => input.focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('visible');
}

function saveApiKey() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val) { showToast('Please enter an API key', 'error'); return; }
  apiKey = val;
  localStorage.setItem('sg_api_key', apiKey);
  updateApiDot();
  closeModal();
  showToast('API key saved successfully!', 'success');
}

function updateApiDot() {
  const dot = document.querySelector('.api-key-btn .dot');
  dot.classList.toggle('active', !!apiKey);
}

// ===== TOAST =====
function showToast(msg, type='success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== COPY TO CLIPBOARD =====
function copyResults() {
  const el = document.getElementById('resultContent');
  const text = el.innerText;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
}

// ===== GENERATE =====
async function generate() {
  if (isGenerating) return;

  const input = document.getElementById('mainInput').value.trim();
  if (!input) { showToast('Please enter some text or a topic', 'error'); return; }
  if (!apiKey) { openModal(); showToast('Please set your Gemini API key first', 'error'); return; }

  isGenerating = true;
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;

  // Show progress
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  progressWrap.classList.add('active');
  progressBar.style.width = '0%';

  // Show loader in results
  const panel = document.getElementById('resultsPanel');
  const content = document.getElementById('resultContent');
  panel.classList.add('visible');
  content.innerHTML = `<div class="loader"><div class="brain-loader">🧠✨</div><div class="loader-text">AI is thinking...</div></div>`;

  // Animate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;
    progressBar.style.width = progress + '%';
  }, 400);

  try {
    const prompt = buildPrompt(input);
    const response = await callGemini(prompt);

    clearInterval(progressInterval);
    progressBar.style.width = '100%';

    renderResult(response);
    showToast('Generated successfully! ✨', 'success');
  } catch (err) {
    clearInterval(progressInterval);
    progressBar.style.width = '0%';
    content.innerHTML = `<div class="loader"><div style="font-size:2rem">😕</div><div class="loader-text" style="color:#fca5a5">${err.message || 'Something went wrong. Check your API key and try again.'}</div></div>`;
    showToast(err.message || 'Generation failed', 'error');
  } finally {
    isGenerating = false;
    btn.disabled = false;
    setTimeout(() => { progressWrap.classList.remove('active'); progressBar.style.width = '0%'; }, 1000);
  }
}

// ===== PROMPT BUILDER =====
function buildPrompt(input) {
  const topic = document.getElementById('topicField')?.value?.trim() || '';
  const examDate = document.getElementById('examDate')?.value || '';

  const prompts = {
    summarize: `You are a study assistant. Analyze the following content and provide a structured response in this EXACT JSON format (no markdown, just raw JSON):
{
  "tldr": "A 1-2 sentence TLDR summary",
  "detailed": "A detailed 3-5 paragraph summary covering all key points",
  "concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "difficulty": "easy|medium|hard",
  "difficultyScore": 30-100
}

Content: ${input}`,

    quiz: `You are a quiz generator. Create 6 quiz questions from the following content. Return ONLY valid JSON in this EXACT format (no markdown):
{
  "questions": [
    {"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":0,"explanation":"..."},
    {"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":1,"explanation":"..."},
    {"type":"tf","question":"... (True or False)","options":["True","False"],"answer":0,"explanation":"..."},
    {"type":"tf","question":"... (True or False)","options":["True","False"],"answer":1,"explanation":"..."},
    {"type":"fib","question":"Complete: ___ is ...","options":[],"answer":-1,"explanation":"The answer is: ..."},
    {"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":2,"explanation":"..."}
  ],
  "difficulty": "easy|medium|hard",
  "difficultyScore": 30-100
}

Content: ${input}`,

    plan: `You are a study planner. Create a detailed day-by-day study plan. ${examDate ? 'Exam date: ' + examDate + '.' : 'Assume 7 days.'} Return ONLY valid JSON (no markdown):
{
  "title": "Study Plan: ...",
  "totalDays": 7,
  "days": [
    {"day":1,"title":"Day 1: ...","tasks":["task1","task2","task3"],"duration":"2-3 hours","tip":"..."},
    {"day":2,"title":"Day 2: ...","tasks":["task1","task2","task3"],"duration":"2-3 hours","tip":"..."}
  ],
  "difficulty": "easy|medium|hard",
  "difficultyScore": 30-100
}

Topic: ${input}${topic ? '\nSpecific focus: ' + topic : ''}`,

    flashcards: `You are a flashcard creator. Create 8 flashcards from the content. Return ONLY valid JSON (no markdown):
{
  "cards": [
    {"front":"Question or term","back":"Answer or definition"},
    {"front":"Question or term","back":"Answer or definition"}
  ],
  "difficulty": "easy|medium|hard",
  "difficultyScore": 30-100
}

Content: ${input}`,

    difficulty: `You are a difficulty analyzer. Analyze the complexity of this topic/content. Return ONLY valid JSON (no markdown):
{
  "topic": "...",
  "difficulty": "easy|medium|hard",
  "difficultyScore": 30-100,
  "factors": ["factor1","factor2","factor3"],
  "prerequisites": ["prereq1","prereq2"],
  "estimatedStudyHours": 10,
  "tips": ["tip1","tip2","tip3"],
  "breakdown": "A 2-3 paragraph analysis of why this topic is rated at this difficulty level"
}

Content: ${input}`
  };

  return prompts[currentMode];
}

// ===== GEMINI API CALL =====

// Cache the discovered model so we don't re-discover on every call
let _cachedModel = null;
let _cachedModelKey = null; // track which API key the cache is for

// Preferred models in priority order (newest/best first)
const MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

// API versions to try for each model
const API_VERSIONS = ['v1beta', 'v1'];

/**
 * Discover the best available model by calling ListModels,
 * then picking the first match from our priority list.
 */
async function discoverModel() {
  for (const ver of API_VERSIONS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`
      );
      if (!res.ok) continue;

      const data = await res.json();
      const modelNames = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));

      // Pick the first candidate that exists in the available models
      for (const candidate of MODEL_CANDIDATES) {
        if (modelNames.includes(candidate)) {
          return { model: candidate, apiVersion: ver };
        }
      }
      // If none of our preferred models matched, use the first available model
      if (modelNames.length > 0) {
        return { model: modelNames[0], apiVersion: ver };
      }
    } catch {
      // Network error on this version — try next
    }
  }
  return null;
}

/**
 * Try calling generateContent with a specific model + API version.
 * Returns the Response object, or null if the model is not found (404).
 * Throws on other HTTP errors.
 */
async function tryGenerate(model, apiVersion, prompt) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    })
  });

  if (res.ok) return res;

  // 404 means model not found — we should try the next one
  if (res.status === 404) return null;

  // Other errors are real failures
  const err = await res.json().catch(() => ({}));
  if (res.status === 400) throw new Error('Invalid API key. Please check and try again.');
  if (res.status === 403) throw new Error('API key does not have permission. Please check your key.');
  if (res.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
  throw new Error(err?.error?.message || `API error (${res.status})`);
}

async function callGemini(prompt) {
  // Invalidate cache if API key changed
  if (_cachedModelKey !== apiKey) {
    _cachedModel = null;
    _cachedModelKey = apiKey;
  }

  // 1) If we have a cached model, try it first
  if (_cachedModel) {
    const res = await tryGenerate(_cachedModel.model, _cachedModel.apiVersion, prompt);
    if (res) return await parseGeminiResponse(res);
    // Model disappeared — clear cache and re-discover
    _cachedModel = null;
  }

  // 2) Try auto-discovery via ListModels
  const discovered = await discoverModel();
  if (discovered) {
    const res = await tryGenerate(discovered.model, discovered.apiVersion, prompt);
    if (res) {
      _cachedModel = discovered;
      return await parseGeminiResponse(res);
    }
  }

  // 3) Brute-force fallback: try every candidate × every API version
  for (const model of MODEL_CANDIDATES) {
    for (const ver of API_VERSIONS) {
      try {
        const res = await tryGenerate(model, ver, prompt);
        if (res) {
          _cachedModel = { model, apiVersion: ver };
          return await parseGeminiResponse(res);
        }
      } catch (e) {
        // If it's a real error (not 404), rethrow
        if (e.message) throw e;
      }
    }
  }

  throw new Error('No compatible Gemini model found for your API key. Please verify your key at aistudio.google.com');
}

async function parseGeminiResponse(res) {
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from AI. Try again.');

  // Clean and parse JSON
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

// ===== RENDER RESULTS =====
function renderResult(data) {
  const content = document.getElementById('resultContent');
  const title = document.getElementById('resultTitle');

  // Difficulty bar (shown for all modes)
  const diffHtml = data.difficulty ? `
    <div class="difficulty-bar">
      <span class="diff-label">📊 Difficulty</span>
      <div class="diff-track"><div class="diff-fill ${data.difficulty}" style="width:${data.difficultyScore || 50}%"></div></div>
      <span class="diff-value" style="color:${data.difficulty === 'easy' ? '#86efac' : data.difficulty === 'medium' ? '#fde047' : '#fca5a5'}">${(data.difficultyScore || 50)}% — ${data.difficulty?.charAt(0).toUpperCase() + data.difficulty?.slice(1)}</span>
    </div>` : '';

  switch (currentMode) {
    case 'summarize':
      title.textContent = '📝 Summary Results';
      content.innerHTML = diffHtml + `
        <div class="summary-section">
          <div class="section-label">⚡ TLDR</div>
          <div class="section-content">${data.tldr}</div>
        </div>
        <div class="summary-section">
          <div class="section-label">📖 Detailed Summary</div>
          <div class="section-content">${formatText(data.detailed)}</div>
        </div>
        <div class="summary-section">
          <div class="section-label">🔑 Key Concepts</div>
          <div class="concepts-grid">${(data.concepts || []).map(c => `<span class="concept-chip">${c}</span>`).join('')}</div>
        </div>`;
      break;

    case 'quiz':
      title.textContent = '❓ Quiz Questions';
      content.innerHTML = diffHtml + (data.questions || []).map((q, i) => {
        const typeClass = q.type === 'mcq' ? 'mcq' : q.type === 'tf' ? 'tf' : 'fib';
        const typeLabel = q.type === 'mcq' ? 'Multiple Choice' : q.type === 'tf' ? 'True / False' : 'Fill in the Blank';
        let optionsHtml = '';
        if (q.options && q.options.length > 0) {
          optionsHtml = `<ul class="quiz-options">${q.options.map((o, oi) =>
            `<li class="quiz-option" data-q="${i}" data-o="${oi}" data-correct="${q.answer}" onclick="checkAnswer(this)">${o}</li>`
          ).join('')}</ul>`;
        }
        return `<div class="quiz-card">
          <span class="quiz-type ${typeClass}">${typeLabel}</span>
          <div class="quiz-question">${i + 1}. ${q.question}</div>
          ${optionsHtml}
          <div class="quiz-answer" id="answer-${i}">💡 ${q.explanation}</div>
        </div>`;
      }).join('');
      break;

    case 'plan':
      title.textContent = '📅 ' + (data.title || 'Study Plan');
      content.innerHTML = diffHtml + (data.days || []).map(d => `
        <div class="plan-day">
          <div class="day-marker">D${d.day}</div>
          <div class="day-content">
            <h4>${d.title} <span style="font-size:0.78rem;color:var(--text-secondary);font-weight:400">• ${d.duration}</span></h4>
            <ul>${d.tasks.map(t => `<li>${t}</li>`).join('')}</ul>
            ${d.tip ? `<p style="margin-top:8px;font-style:italic;color:#a78bfa">💡 ${d.tip}</p>` : ''}
          </div>
        </div>`).join('');
      break;

    case 'flashcards':
      title.textContent = '🃏 Flashcards';
      content.innerHTML = diffHtml + `<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">Click any card to flip it</p>
        <div class="flashcards-grid">${(data.cards || []).map((c, i) => `
          <div class="flashcard" onclick="this.classList.toggle('flipped')">
            <div class="flashcard-inner">
              <div class="flashcard-face flashcard-front">
                <div class="flashcard-label">Question ${i + 1}</div>
                <div class="flashcard-text">${c.front}</div>
                <div class="flashcard-hint">tap to reveal</div>
              </div>
              <div class="flashcard-face flashcard-back">
                <div class="flashcard-label">Answer</div>
                <div class="flashcard-text">${c.back}</div>
                <div class="flashcard-hint">tap to flip back</div>
              </div>
            </div>
          </div>`).join('')}
        </div>`;
      break;

    case 'difficulty':
      title.textContent = '📊 Difficulty Analysis';
      content.innerHTML = diffHtml + `
        <div class="summary-section">
          <div class="section-label">📋 Analysis</div>
          <div class="section-content">${formatText(data.breakdown)}</div>
        </div>
        <div class="summary-section">
          <div class="section-label">🔍 Complexity Factors</div>
          <div class="concepts-grid">${(data.factors || []).map(f => `<span class="concept-chip">${f}</span>`).join('')}</div>
        </div>
        <div class="summary-section">
          <div class="section-label">📚 Prerequisites</div>
          <div class="concepts-grid">${(data.prerequisites || []).map(p => `<span class="concept-chip" style="background:rgba(6,182,212,0.12);border-color:rgba(6,182,212,0.2);color:#67e8f9">${p}</span>`).join('')}</div>
        </div>
        <div class="summary-section">
          <div class="section-label">⏱ Estimated Study Time</div>
          <div class="section-content"><strong>${data.estimatedStudyHours} hours</strong> of focused study recommended</div>
        </div>
        <div class="summary-section">
          <div class="section-label">💡 Study Tips</div>
          <div class="section-content"><ul style="padding-left:18px">${(data.tips || []).map(t => `<li style="margin-bottom:6px">${t}</li>`).join('')}</ul></div>
        </div>`;
      break;
  }
}

function formatText(text) {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
}

function checkAnswer(el) {
  const qIndex = el.dataset.q;
  const optionIndex = parseInt(el.dataset.o);
  const correctIndex = parseInt(el.dataset.correct);

  // Disable all options for this question
  document.querySelectorAll(`.quiz-option[data-q="${qIndex}"]`).forEach(o => {
    o.style.pointerEvents = 'none';
    if (parseInt(o.dataset.o) === correctIndex) o.classList.add('correct');
  });

  if (optionIndex !== correctIndex) el.classList.add('wrong');

  // Show explanation
  const answer = document.getElementById(`answer-${qIndex}`);
  if (answer) answer.classList.add('visible');
}
