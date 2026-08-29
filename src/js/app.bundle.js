
const Utils = (function() {
// utils.js — helpers de formatação, datas e validação usados em toda a aplicação.

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'Concluído') return false;
  return daysUntil(dueDate) < 0;
}

function fmtNota(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

function clampNota(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.min(10, Math.max(0, v));
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toast(message, kind = 'success') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast__icon">${kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i'}</span><span>${escapeHTML(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${escapeHTML(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn--ghost" data-act="cancel">Cancelar</button>
          <button class="btn btn--danger" data-act="ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    overlay.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act === 'ok' || act === 'cancel' || e.target === overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 200);
        resolve(act === 'ok');
      }
    });
  });
}

const SUBJECT_COLORS = [
  '#3457D5', '#D64550', '#2E9E6B', '#F5C400', '#8E44AD',
  '#E07A2F', '#1F9DA8', '#C2437A', '#5B6ABF', '#7A8B4E',
];

function pickColor(index) {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

return { fmtDate, todayISO, daysUntil, isOverdue, fmtNota, clampNota, escapeHTML, toast, confirmDialog, SUBJECT_COLORS, pickColor };
})();

const DB = (function() {
// db.js — camada de persistência (localStorage). Todo o estado da agenda
// vive num único objeto serializado em JSON, o que torna export/import triviais.

const STORAGE_KEY = 'agendaEscolar:v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyData() {
  return {
    version: 1,
    schools: [],       // {id, name}
    series: [],        // {id, schoolId, name}
    subjects: [],       // {id, schoolId, serieId, name, teacher, color}
    grades: [],         // {id, subjectId, bimestre(1-4), av1, av2, av3}
    homework: [],        // {id, schoolId, serieId, subjectId, title, description, createdAt, dueDate, status}
    works: [],           // {id, schoolId, serieId, subjectId, title, description, startDate, dueDate, status}
    events: [],          // eventos manuais do calendário {id, schoolId, serieId, title, date, type, notes}
    settings: {
      minGrade: 6.0,
      selectedSchoolId: null,
      selectedSerieId: null,
    },
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = emptyData();
      return cache;
    }
    const parsed = JSON.parse(raw);
    // merge defensivo para lidar com versões futuras / campos ausentes
    cache = Object.assign(emptyData(), parsed);
    cache.settings = Object.assign(emptyData().settings, parsed.settings || {});
    return cache;
  } catch (e) {
    console.error('Falha ao carregar dados salvos, iniciando do zero.', e);
    cache = emptyData();
    return cache;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  document.dispatchEvent(new CustomEvent('agenda:changed'));
}

function getData() {
  return load();
}

function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

function importJSON(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.schools)) {
    throw new Error('Arquivo inválido: estrutura de dados não reconhecida.');
  }
  cache = Object.assign(emptyData(), parsed);
  cache.settings = Object.assign(emptyData().settings, parsed.settings || {});
  save();
}

function resetAll() {
  cache = emptyData();
  save();
}

// ---------- Escolas ----------
function addSchool(name) {
  const d = load();
  const school = { id: uid(), name: name.trim() };
  d.schools.push(school);
  if (!d.settings.selectedSchoolId) d.settings.selectedSchoolId = school.id;
  save();
  return school;
}
function updateSchool(id, name) {
  const d = load();
  const s = d.schools.find((x) => x.id === id);
  if (s) { s.name = name.trim(); save(); }
}
function deleteSchool(id) {
  const d = load();
  d.schools = d.schools.filter((x) => x.id !== id);
  const serieIds = d.series.filter((x) => x.schoolId === id).map((x) => x.id);
  d.series = d.series.filter((x) => x.schoolId !== id);
  d.subjects = d.subjects.filter((x) => x.schoolId !== id);
  d.homework = d.homework.filter((x) => x.schoolId !== id);
  d.works = d.works.filter((x) => x.schoolId !== id);
  d.events = d.events.filter((x) => x.schoolId !== id);
  const subjIds = new Set(d.subjects.filter(s2 => serieIds.includes(s2.serieId)).map(s2 => s2.id));
  d.grades = d.grades.filter((g) => !subjIds.has(g.subjectId) || d.subjects.some(s2 => s2.id === g.subjectId));
  if (d.settings.selectedSchoolId === id) {
    d.settings.selectedSchoolId = d.schools[0]?.id || null;
    d.settings.selectedSerieId = null;
  }
  save();
}

// ---------- Séries ----------
function addSerie(schoolId, name) {
  const d = load();
  const serie = { id: uid(), schoolId, name: name.trim() };
  d.series.push(serie);
  if (!d.settings.selectedSerieId) d.settings.selectedSerieId = serie.id;
  save();
  return serie;
}
function updateSerie(id, name) {
  const d = load();
  const s = d.series.find((x) => x.id === id);
  if (s) { s.name = name.trim(); save(); }
}
function deleteSerie(id) {
  const d = load();
  d.series = d.series.filter((x) => x.id !== id);
  const subjIds = d.subjects.filter((x) => x.serieId === id).map((x) => x.id);
  d.subjects = d.subjects.filter((x) => x.serieId !== id);
  d.grades = d.grades.filter((g) => !subjIds.includes(g.subjectId));
  d.homework = d.homework.filter((x) => x.serieId !== id);
  d.works = d.works.filter((x) => x.serieId !== id);
  d.events = d.events.filter((x) => x.serieId !== id);
  if (d.settings.selectedSerieId === id) d.settings.selectedSerieId = null;
  save();
}

// ---------- Matérias ----------
function addSubject(schoolId, serieId, { name, teacher, color }) {
  const d = load();
  const subject = { id: uid(), schoolId, serieId, name: name.trim(), teacher: (teacher || '').trim(), color: color || '#3457D5' };
  d.subjects.push(subject);
  save();
  return subject;
}
function updateSubject(id, fields) {
  const d = load();
  const s = d.subjects.find((x) => x.id === id);
  if (s) { Object.assign(s, fields); save(); }
}
function deleteSubject(id) {
  const d = load();
  d.subjects = d.subjects.filter((x) => x.id !== id);
  d.grades = d.grades.filter((g) => g.subjectId !== id);
  d.homework = d.homework.filter((h) => h.subjectId !== id);
  d.works = d.works.filter((w) => w.subjectId !== id);
  save();
}

// ---------- Notas ----------
function getGradeRow(subjectId, bimestre) {
  const d = load();
  return d.grades.find((g) => g.subjectId === subjectId && g.bimestre === bimestre) || null;
}
function setGrade(subjectId, bimestre, field, value) {
  const d = load();
  let row = d.grades.find((g) => g.subjectId === subjectId && g.bimestre === bimestre);
  if (!row) {
    row = { id: uid(), subjectId, bimestre, av1: null, av2: null, av3: null };
    d.grades.push(row);
  }
  row[field] = value === '' || value === null || value === undefined ? null : Number(value);
  save();
  return row;
}
function computeAverage(row) {
  if (!row) return null;
  const { av1, av2, av3 } = row;
  if (av1 == null || av2 == null || av3 == null) return null;
  // Soma direta dos pontos obtidos (AV1 até 3, AV2 até 5, AV3 até 2 = até 10).
  // Não é média ponderada: cada avaliação já vale seus próprios pontos.
  return av1 + av2 + av3;
}

// ---------- Deveres ----------
function addHomework(fields) {
  const d = load();
  const hw = { id: uid(), createdAt: new Date().toISOString().slice(0, 10), status: 'Pendente', ...fields };
  d.homework.push(hw);
  save();
  return hw;
}
function updateHomework(id, fields) {
  const d = load();
  const h = d.homework.find((x) => x.id === id);
  if (h) { Object.assign(h, fields); save(); }
}
function deleteHomework(id) {
  const d = load();
  d.homework = d.homework.filter((x) => x.id !== id);
  save();
}

// ---------- Trabalhos ----------
function addWork(fields) {
  const d = load();
  const w = { id: uid(), status: 'Não iniciado', ...fields };
  d.works.push(w);
  save();
  return w;
}
function updateWork(id, fields) {
  const d = load();
  const w = d.works.find((x) => x.id === id);
  if (w) { Object.assign(w, fields); save(); }
}
function deleteWork(id) {
  const d = load();
  d.works = d.works.filter((x) => x.id !== id);
  save();
}

// ---------- Eventos manuais do calendário ----------
function addEvent(fields) {
  const d = load();
  const ev = { id: uid(), type: 'evento', ...fields };
  d.events.push(ev);
  save();
  return ev;
}
function deleteEvent(id) {
  const d = load();
  d.events = d.events.filter((x) => x.id !== id);
  save();
}

// ---------- Configurações ----------
function setSetting(key, value) {
  const d = load();
  d.settings[key] = value;
  save();
}

return {
  getData, save, exportJSON, importJSON, resetAll,
  addSchool, updateSchool, deleteSchool,
  addSerie, updateSerie, deleteSerie,
  addSubject, updateSubject, deleteSubject,
  getGradeRow, setGrade, computeAverage,
  addHomework, updateHomework, deleteHomework,
  addWork, updateWork, deleteWork,
  addEvent, deleteEvent,
  setSetting,
  uid,
};

})();

const Selectors = (function() {
const db = DB;
// selectors.js — funções de leitura derivadas do estado, filtrando sempre
// pela escola/série atualmente selecionada (regra da seção 3 do briefing:
// nada de uma escola deve vazar para outra).

function currentSchool() {
  const d = db.getData();
  return d.schools.find((s) => s.id === d.settings.selectedSchoolId) || null;
}

function currentSerie() {
  const d = db.getData();
  return d.series.find((s) => s.id === d.settings.selectedSerieId) || null;
}

function seriesForCurrentSchool() {
  const d = db.getData();
  if (!d.settings.selectedSchoolId) return [];
  return d.series.filter((s) => s.schoolId === d.settings.selectedSchoolId);
}

function currentSubjects() {
  const d = db.getData();
  if (!d.settings.selectedSerieId) return [];
  return d.subjects.filter((s) => s.serieId === d.settings.selectedSerieId);
}

function currentHomework() {
  const d = db.getData();
  return d.homework.filter((h) => h.serieId === d.settings.selectedSerieId);
}

function currentWorks() {
  const d = db.getData();
  return d.works.filter((w) => w.serieId === d.settings.selectedSerieId);
}

function currentEvents() {
  const d = db.getData();
  return d.events.filter((e) => e.serieId === d.settings.selectedSerieId);
}

function subjectById(id) {
  return db.getData().subjects.find((s) => s.id === id) || null;
}

function yearAverageForSubject(subjectId) {
  const d = db.getData();
  const rows = d.grades.filter((g) => g.subjectId === subjectId);
  const meds = [1, 2, 3, 4].map((b) => {
    const row = rows.find((r) => r.bimestre === b);
    return db.computeAverage(row);
  }).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

function bimesterAverageAllSubjects(bimestre) {
  const subs = currentSubjects();
  const meds = subs.map((s) => db.computeAverage(db.getGradeRow(s.id, bimestre))).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

function generalAverage() {
  const subs = currentSubjects();
  const meds = subs.map((s) => yearAverageForSubject(s.id)).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

function situacaoAcademica(avg, minGrade) {
  if (avg == null) return { label: 'Sem notas', tone: 'neutral' };
  if (avg >= minGrade) return { label: 'Aprovado', tone: 'success' };
  if (avg >= minGrade - 1.5) return { label: 'Recuperação', tone: 'warning' };
  return { label: 'Reprovado', tone: 'danger' };
}

return { currentSchool, currentSerie, seriesForCurrentSchool, currentSubjects, currentHomework, currentWorks, currentEvents, subjectById, yearAverageForSubject, bimesterAverageAllSubjects, generalAverage, situacaoAcademica };
})();

const Modal = (function() {
// modal.js — modal genérico reutilizável para formulários de cadastro/edição.

function openModal({ title, bodyHTML, onMount, onSubmit, submitLabel = 'Salvar' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="modal-box__header">
        <h3>${title}</h3>
        <button type="button" class="icon-btn" data-act="close" aria-label="Fechar">✕</button>
      </header>
      <form class="modal-box__form">
        <div class="modal-box__body">${bodyHTML}</div>
        <footer class="modal-box__footer">
          <button type="button" class="btn btn--ghost" data-act="close">Cancelar</button>
          <button type="submit" class="btn btn--primary">${submitLabel}</button>
        </footer>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector('form');

  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  function close() {
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-act="close"]')) close();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  if (onMount) onMount(overlay);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const result = onSubmit ? onSubmit(Object.fromEntries(data.entries()), overlay) : true;
    if (result !== false) close();
  });

  return { close, overlay };
}

return { openModal };
})();

const Charts = (function() {
// charts.js — wrapper fino sobre Chart.js (carregado via CDN no index.html).
// Mantém uma referência por canvas para poder destruir/recriar sem vazar memória.

const instances = new Map();

const PALETTE_GRID = 'rgba(43,43,61,0.08)';
const INK = '#2B2B3D';

function baseOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: INK, font: { family: 'Inter, sans-serif' } } },
    },
    scales: {
      x: { grid: { color: PALETTE_GRID }, ticks: { color: INK } },
      y: { grid: { color: PALETTE_GRID }, ticks: { color: INK } },
    },
  }, extra);
}

function renderLineChart(canvas, { labels, datasets }, opts = {}) {
  destroy(canvas);
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: datasets.map(ds => ({ tension: 0.35, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, ...ds })) },
    options: baseOptions({ scales: { y: { min: 0, max: 10, grid: { color: PALETTE_GRID }, ticks: { color: INK } }, x: { grid: { display: false }, ticks: { color: INK } } }, ...opts }),
  });
  instances.set(canvas, chart);
  return chart;
}

function renderBarChart(canvas, { labels, datasets }, opts = {}) {
  destroy(canvas);
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: datasets.map(ds => ({ borderRadius: 6, maxBarThickness: 42, ...ds })) },
    options: baseOptions({ scales: { y: { min: 0, max: 10, grid: { color: PALETTE_GRID }, ticks: { color: INK } }, x: { grid: { display: false }, ticks: { color: INK } } }, ...opts }),
  });
  instances.set(canvas, chart);
  return chart;
}

function destroy(canvas) {
  const existing = instances.get(canvas);
  if (existing) { existing.destroy(); instances.delete(canvas); }
}

return { renderLineChart, renderBarChart, destroy };
})();

const EmptyGuards = (function() {
const db = DB;
// emptyGuards.js — evita que páginas tentem renderizar dados sem uma
// escola/série selecionada, mostrando um estado vazio orientando o usuário.

function needsSelection(root) {
  const d = db.getData();
  if (d.settings.selectedSchoolId && d.settings.selectedSerieId) return false;
  root.innerHTML = `
    <div class="empty-state empty-state--block empty-state--big">
      <div class="empty-state__icon">🏫</div>
      <h2>Selecione uma escola e uma série</h2>
      <p>Para ver esta página, primeiro cadastre e selecione uma escola e uma série em <strong>Escolas</strong>.</p>
      <a class="btn btn--primary" href="#/escolas">Ir para Escolas</a>
    </div>`;
  return true;
}

return { needsSelection };
})();

const Page_Dashboard = (function() {
const db = DB;
const { currentSchool, currentSerie, currentHomework, currentWorks, generalAverage, situacaoAcademica, subjectById, currentSubjects, bimesterAverageAllSubjects } = Selectors;
const { fmtNota, fmtDate, daysUntil, escapeHTML, isOverdue } = Utils;
const { renderLineChart } = Charts;
function render(root) {
  const school = currentSchool();
  const serie = currentSerie();

  if (!school || !serie) {
    root.innerHTML = `
      <div class="empty-state empty-state--block empty-state--big">
        <div class="empty-state__icon">👋</div>
        <h2>Bem-vindo(a) à sua Agenda Escolar</h2>
        <p>Para começar, cadastre sua escola e sua série.</p>
        <a class="btn btn--primary" href="#/escolas">Cadastrar escola</a>
      </div>`;
    return;
  }

  const minGrade = db.getData().settings.minGrade;
  const geral = generalAverage();
  const situacao = situacaoAcademica(geral, minGrade);
  const subjects = currentSubjects();

  const pendentesHW = currentHomework().filter((h) => h.status !== 'Concluído');
  const pendentesWK = currentWorks().filter((w) => w.status !== 'Concluído');
  const emAndamentoWK = currentWorks().filter((w) => w.status === 'Em andamento');

  const proximos = [
    ...pendentesHW.map((h) => ({ label: subjectById(h.subjectId)?.name, title: h.title, date: h.dueDate, overdue: isOverdue(h.dueDate, h.status) })),
    ...pendentesWK.map((w) => ({ label: subjectById(w.subjectId)?.name, title: w.title, date: w.dueDate, overdue: isOverdue(w.dueDate, w.status) })),
  ].filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const bimMedias = [1, 2, 3, 4].map(bimesterAverageAllSubjects);

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Olá! 👋</h1>
        <p class="page-sub">🏫 ${escapeHTML(school.name)} &nbsp;·&nbsp; 🎓 ${escapeHTML(serie.name)}</p>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card"><span>Média geral</span><strong>${fmtNota(geral)}</strong></div>
      <div class="stat-card"><span>Nota mínima</span><strong>${fmtNota(minGrade)}</strong></div>
      <div class="stat-card"><span>Situação</span><strong class="badge badge--${situacao.tone}">${situacao.label}</strong></div>
      <div class="stat-card"><span>Matérias</span><strong>${subjects.length}</strong></div>
    </div>

    <div class="grid-2">
      <section class="panel">
        <h2>Próximos prazos</h2>
        <ul class="entity-list">
          ${proximos.length ? proximos.map(prazoRow).join('') : '<li class="empty-state">Nenhum prazo pendente. 🎉</li>'}
        </ul>
      </section>

      <section class="panel">
        <h2>Resumo</h2>
        <ul class="summary-list">
          <li>📝 <strong>${pendentesHW.length}</strong> dever(es) pendente(s)</li>
          <li>📑 <strong>${emAndamentoWK.length}</strong> trabalho(s) em andamento</li>
          <li>⏳ <strong>${pendentesWK.filter((w) => daysUntil(w.dueDate) != null && daysUntil(w.dueDate) <= 3 && daysUntil(w.dueDate) >= 0).length}</strong> trabalho(s) perto do prazo</li>
        </ul>
      </section>
    </div>

    <section class="panel">
      <h2>Evolução da média geral</h2>
      <div class="chart-box"><canvas id="dash-chart" height="220"></canvas></div>
    </section>
  `;

  renderLineChart(root.querySelector('#dash-chart'), {
    labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'],
    datasets: [{ label: 'Média geral', data: bimMedias, borderColor: '#3457D5', backgroundColor: '#3457D533', fill: true }],
  });
}

function prazoRow(p) {
  const d = daysUntil(p.date);
  const rel = p.overdue ? `<span class="badge badge--danger">Atrasado</span>` : d === 0 ? `<span class="badge badge--warning">Hoje</span>` : d === 1 ? `<span class="badge badge--warning">Amanhã</span>` : `<span class="badge badge--neutral">${fmtDate(p.date)}</span>`;
  return `<li class="entity-row"><span class="entity-row__name">${escapeHTML(p.label || '')} — ${escapeHTML(p.title)}</span>${rel}</li>`;
}

return { render };
})();

const Page_Schools = (function() {
const db = DB;
const { seriesForCurrentSchool } = Selectors;
const { openModal } = Modal;
const { toast, confirmDialog, escapeHTML } = Utils;
function render(root) {
  const d = db.getData();

  root.innerHTML = `
    <div class="page-head">
      <h1>Escolas &amp; séries</h1>
      <p class="page-sub">Cadastre cada escola e suas séries. Ao trocar de escola ou série, tudo o que você vê no resto da agenda muda junto.</p>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel__head">
          <h2>Escolas</h2>
          <button class="btn btn--primary btn--sm" id="btn-add-school">+ Nova escola</button>
        </div>
        <ul class="entity-list" id="school-list">
          ${d.schools.length ? d.schools.map(schoolRow).join('') : emptyState('Nenhuma escola cadastrada ainda.')}
        </ul>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h2>Séries ${currentSchoolLabel(d)}</h2>
          <button class="btn btn--primary btn--sm" id="btn-add-serie" ${d.settings.selectedSchoolId ? '' : 'disabled'}>+ Nova série</button>
        </div>
        <ul class="entity-list" id="serie-list">
          ${d.settings.selectedSchoolId
            ? (seriesForCurrentSchool().length ? seriesForCurrentSchool().map(serieRow).join('') : emptyState('Nenhuma série nesta escola ainda.'))
            : emptyState('Selecione uma escola para ver as séries.')}
        </ul>
      </section>
    </div>
  `;

  root.querySelector('#btn-add-school').addEventListener('click', () => schoolForm());
  root.querySelector('#btn-add-serie')?.addEventListener('click', () => serieForm());

  root.querySelectorAll('[data-act="select-school"]').forEach((el) => el.addEventListener('click', (e) => {
    db.setSetting('selectedSchoolId', e.currentTarget.dataset.id);
    db.setSetting('selectedSerieId', null);
    render(root);
  }));
  root.querySelectorAll('[data-act="edit-school"]').forEach((el) => el.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = d.schools.find((x) => x.id === e.currentTarget.dataset.id);
    schoolForm(s);
  }));
  root.querySelectorAll('[data-act="del-school"]').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await confirmDialog('Excluir esta escola? Todas as séries, matérias, notas, deveres e trabalhos vinculados serão apagados.')) {
      db.deleteSchool(e.currentTarget.dataset.id);
      toast('Escola excluída.');
      render(root);
    }
  }));

  root.querySelectorAll('[data-act="select-serie"]').forEach((el) => el.addEventListener('click', (e) => {
    db.setSetting('selectedSerieId', e.currentTarget.dataset.id);
    toast('Série selecionada.');
    render(root);
    document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
  }));
  root.querySelectorAll('[data-act="edit-serie"]').forEach((el) => el.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = db.getData().series.find((x) => x.id === e.currentTarget.dataset.id);
    serieForm(s);
  }));
  root.querySelectorAll('[data-act="del-serie"]').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await confirmDialog('Excluir esta série? Matérias, notas, deveres e trabalhos dela serão apagados.')) {
      db.deleteSerie(e.currentTarget.dataset.id);
      toast('Série excluída.');
      render(root);
      document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
    }
  }));
}

function currentSchoolLabel(d) {
  const s = d.schools.find((x) => x.id === d.settings.selectedSchoolId);
  return s ? `— ${escapeHTML(s.name)}` : '';
}

function schoolRow(s) {
  const d = db.getData();
  const active = d.settings.selectedSchoolId === s.id;
  return `<li class="entity-row ${active ? 'is-active' : ''}" data-act="select-school" data-id="${s.id}">
    <span class="entity-row__name">🏫 ${escapeHTML(s.name)}</span>
    <span class="entity-row__actions">
      <button class="icon-btn" data-act="edit-school" data-id="${s.id}" title="Editar">✎</button>
      <button class="icon-btn icon-btn--danger" data-act="del-school" data-id="${s.id}" title="Excluir">🗑</button>
    </span>
  </li>`;
}

function serieRow(s) {
  const d = db.getData();
  const active = d.settings.selectedSerieId === s.id;
  return `<li class="entity-row ${active ? 'is-active' : ''}" data-act="select-serie" data-id="${s.id}">
    <span class="entity-row__name">🎓 ${escapeHTML(s.name)}</span>
    <span class="entity-row__actions">
      <button class="icon-btn" data-act="edit-serie" data-id="${s.id}" title="Editar">✎</button>
      <button class="icon-btn icon-btn--danger" data-act="del-serie" data-id="${s.id}" title="Excluir">🗑</button>
    </span>
  </li>`;
}

function emptyState(msg) {
  return `<li class="empty-state">${msg}</li>`;
}

function schoolForm(existing) {
  openModal({
    title: existing ? 'Editar escola' : 'Nova escola',
    submitLabel: existing ? 'Salvar alterações' : 'Criar escola',
    bodyHTML: `
      <label class="field">
        <span>Nome da escola</span>
        <input name="name" required maxlength="80" placeholder="Ex: Colégio Exemplo" value="${existing ? escapeHTML(existing.name) : ''}" />
      </label>`,
    onSubmit: (data) => {
      if (!data.name.trim()) { toast('O nome da escola é obrigatório.', 'error'); return false; }
      if (existing) { db.updateSchool(existing.id, data.name); toast('Escola atualizada.'); }
      else { db.addSchool(data.name); toast('Escola criada.'); }
      renderCurrent();
    },
  });
}

function serieForm(existing) {
  const d = db.getData();
  openModal({
    title: existing ? 'Editar série' : 'Nova série',
    submitLabel: existing ? 'Salvar alterações' : 'Criar série',
    bodyHTML: `
      <label class="field">
        <span>Nome da série</span>
        <input name="name" required maxlength="60" placeholder="Ex: 7º Ano" value="${existing ? escapeHTML(existing.name) : ''}" />
      </label>`,
    onSubmit: (data) => {
      if (!data.name.trim()) { toast('O nome da série é obrigatório.', 'error'); return false; }
      if (existing) { db.updateSerie(existing.id, data.name); toast('Série atualizada.'); }
      else { db.addSerie(d.settings.selectedSchoolId, data.name); toast('Série criada.'); }
      renderCurrent();
    },
  });
}

function renderCurrent() {
  const root = document.getElementById('view-root');
  if (root) render(root);
}

return { render };
})();

const Page_Subjects = (function() {
const db = DB;
const { currentSubjects, currentSerie } = Selectors;
const { openModal } = Modal;
const { toast, confirmDialog, escapeHTML, SUBJECT_COLORS, pickColor } = Utils;
const { needsSelection } = EmptyGuards;
function render(root) {
  if (needsSelection(root)) return;
  const subjects = currentSubjects();

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Matérias</h1>
        <p class="page-sub">Matérias de ${escapeHTML(currentSerie()?.name || '')}.</p>
      </div>
      <button class="btn btn--primary" id="btn-add-subject">+ Nova matéria</button>
    </div>
    <div class="card-grid">
      ${subjects.length ? subjects.map(subjectCard).join('') : '<div class="empty-state empty-state--block">Nenhuma matéria cadastrada. Comece adicionando a primeira.</div>'}
    </div>
  `;

  root.querySelector('#btn-add-subject').addEventListener('click', () => subjectForm());
  root.querySelectorAll('[data-act="edit"]').forEach((el) => el.addEventListener('click', () => {
    subjectForm(subjects.find((s) => s.id === el.dataset.id));
  }));
  root.querySelectorAll('[data-act="del"]').forEach((el) => el.addEventListener('click', async () => {
    if (await confirmDialog('Excluir esta matéria? Notas e deveres vinculados a ela serão apagados.')) {
      db.deleteSubject(el.dataset.id);
      toast('Matéria excluída.');
      render(root);
    }
  }));
}

function subjectCard(s) {
  return `<div class="subject-card" style="--subj-color:${s.color}">
    <div class="subject-card__bar"></div>
    <div class="subject-card__body">
      <h3>${escapeHTML(s.name)}</h3>
      <p>${s.teacher ? '👤 ' + escapeHTML(s.teacher) : 'Sem professor definido'}</p>
    </div>
    <div class="subject-card__actions">
      <button class="icon-btn" data-act="edit" data-id="${s.id}" title="Editar">✎</button>
      <button class="icon-btn icon-btn--danger" data-act="del" data-id="${s.id}" title="Excluir">🗑</button>
    </div>
  </div>`;
}

function subjectForm(existing) {
  const swatches = SUBJECT_COLORS.map((c) => `
    <label class="swatch" style="--c:${c}">
      <input type="radio" name="color" value="${c}" ${(existing ? existing.color === c : c === SUBJECT_COLORS[0]) ? 'checked' : ''} />
    </label>`).join('');

  openModal({
    title: existing ? 'Editar matéria' : 'Nova matéria',
    submitLabel: existing ? 'Salvar alterações' : 'Criar matéria',
    bodyHTML: `
      <label class="field">
        <span>Nome da matéria</span>
        <input name="name" required maxlength="60" placeholder="Ex: Matemática" value="${existing ? escapeHTML(existing.name) : ''}" />
      </label>
      <label class="field">
        <span>Professor (opcional)</span>
        <input name="teacher" maxlength="60" placeholder="Ex: Profª. Ana" value="${existing ? escapeHTML(existing.teacher || '') : ''}" />
      </label>
      <label class="field">
        <span>Cor de identificação</span>
        <div class="swatch-row">${swatches}</div>
      </label>`,
    onSubmit: (data) => {
      if (!data.name.trim()) { toast('O nome da matéria é obrigatório.', 'error'); return false; }
      const d = db.getData();
      const dup = d.subjects.some((s) => s.serieId === d.settings.selectedSerieId && s.name.trim().toLowerCase() === data.name.trim().toLowerCase() && s.id !== existing?.id);
      if (dup) { toast('Já existe uma matéria com este nome nesta série.', 'error'); return false; }
      if (existing) {
        db.updateSubject(existing.id, { name: data.name, teacher: data.teacher, color: data.color });
        toast('Matéria atualizada.');
      } else {
        db.addSubject(d.settings.selectedSchoolId, d.settings.selectedSerieId, { name: data.name, teacher: data.teacher, color: data.color || pickColor(d.subjects.length) });
        toast('Matéria criada.');
      }
      const root = document.getElementById('view-root');
      if (root) render(root);
    },
  });
}

return { render };
})();

const Page_Homework = (function() {
const db = DB;
const { currentHomework, currentSubjects, subjectById } = Selectors;
const { openModal } = Modal;
const { toast, confirmDialog, escapeHTML, fmtDate, isOverdue, todayISO } = Utils;
const { needsSelection } = EmptyGuards;
let filters = { subject: '', status: '', search: '', sort: 'prazo' };

function render(root) {
  if (needsSelection(root)) return;
  const subjects = currentSubjects();
  let items = currentHomework().map(applyAutoStatus);

  if (filters.subject) items = items.filter((h) => h.subjectId === filters.subject);
  if (filters.status) items = items.filter((h) => h.status === filters.status);
  if (filters.search) items = items.filter((h) => h.title.toLowerCase().includes(filters.search.toLowerCase()));
  items.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Deveres de casa</h1><p class="page-sub">${items.length} dever(es) encontrados.</p></div>
      <button class="btn btn--primary" id="btn-add" ${subjects.length ? '' : 'disabled title="Cadastre uma matéria primeiro"'}>+ Novo dever</button>
    </div>

    <div class="toolbar">
      <input type="search" id="f-search" placeholder="Pesquisar por título..." value="${escapeHTML(filters.search)}" />
      <select id="f-subject"><option value="">Todas as matérias</option>${subjects.map((s) => `<option value="${s.id}" ${filters.subject === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}</select>
      <select id="f-status">
        <option value="">Todos os status</option>
        ${['Pendente', 'Concluído', 'Atrasado'].map((s) => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>

    ${subjects.length ? '' : '<div class="empty-state empty-state--block">Cadastre ao menos uma matéria antes de criar deveres.</div>'}

    <div class="table-scroll">
      <table class="data-table" ${items.length ? '' : 'hidden'}>
        <thead><tr><th>Matéria</th><th>Título</th><th>Registrado em</th><th>Prazo</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(rowHTML).join('')}</tbody>
      </table>
      ${items.length ? '' : '<div class="empty-state empty-state--block">Nenhum dever encontrado com estes filtros.</div>'}
    </div>
  `;

  root.querySelector('#btn-add').addEventListener('click', () => homeworkForm());
  root.querySelector('#f-search').addEventListener('input', (e) => { filters.search = e.target.value; render(root); });
  root.querySelector('#f-subject').addEventListener('change', (e) => { filters.subject = e.target.value; render(root); });
  root.querySelector('#f-status').addEventListener('change', (e) => { filters.status = e.target.value; render(root); });

  root.querySelectorAll('[data-act="done"]').forEach((el) => el.addEventListener('click', () => {
    db.updateHomework(el.dataset.id, { status: 'Concluído' });
    toast('Dever marcado como concluído.');
    render(root);
  }));
  root.querySelectorAll('[data-act="edit"]').forEach((el) => el.addEventListener('click', () => {
    homeworkForm(items.find((h) => h.id === el.dataset.id));
  }));
  root.querySelectorAll('[data-act="del"]').forEach((el) => el.addEventListener('click', async () => {
    if (await confirmDialog('Excluir este dever?')) {
      db.deleteHomework(el.dataset.id);
      toast('Dever excluído.');
      render(root);
    }
  }));
}

function applyAutoStatus(h) {
  if (isOverdue(h.dueDate, h.status) && h.status === 'Pendente') {
    db.updateHomework(h.id, { status: 'Atrasado' });
    return { ...h, status: 'Atrasado' };
  }
  return h;
}

function rowHTML(h) {
  const subj = subjectById(h.subjectId);
  const badge = { Pendente: 'warning', Concluído: 'success', Atrasado: 'danger' }[h.status] || 'neutral';
  return `<tr>
    <td><span class="dot" style="--c:${subj?.color || '#999'}"></span>${escapeHTML(subj?.name || '—')}</td>
    <td>${escapeHTML(h.title)}</td>
    <td>${fmtDate(h.createdAt)}</td>
    <td>${fmtDate(h.dueDate)}</td>
    <td><span class="badge badge--${badge}">${h.status}</span></td>
    <td class="row-actions">
      ${h.status !== 'Concluído' ? `<button class="icon-btn" data-act="done" data-id="${h.id}" title="Marcar concluído">✓</button>` : ''}
      <button class="icon-btn" data-act="edit" data-id="${h.id}" title="Editar">✎</button>
      <button class="icon-btn icon-btn--danger" data-act="del" data-id="${h.id}" title="Excluir">🗑</button>
    </td>
  </tr>`;
}

function homeworkForm(existing) {
  const subjects = currentSubjects();
  openModal({
    title: existing ? 'Editar dever' : 'Novo dever',
    submitLabel: existing ? 'Salvar alterações' : 'Criar dever',
    bodyHTML: `
      <label class="field"><span>Matéria</span>
        <select name="subjectId" required>${subjects.map((s) => `<option value="${s.id}" ${existing?.subjectId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Título</span>
        <input name="title" required maxlength="100" value="${existing ? escapeHTML(existing.title) : ''}" placeholder="Ex: Exercícios página 42" />
      </label>
      <label class="field"><span>Descrição</span>
        <textarea name="description" rows="3" maxlength="500" placeholder="Detalhes do dever (opcional)">${existing ? escapeHTML(existing.description || '') : ''}</textarea>
      </label>
      <div class="field-row">
        <label class="field"><span>Prazo de entrega</span>
          <input type="date" name="dueDate" required value="${existing?.dueDate || todayISO()}" />
        </label>
        <label class="field"><span>Status</span>
          <select name="status">${['Pendente', 'Concluído', 'Atrasado'].map((s) => `<option ${existing?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </label>
      </div>`,
    onSubmit: (data) => {
      if (!data.title.trim()) { toast('O título é obrigatório.', 'error'); return false; }
      if (!data.dueDate) { toast('Informe um prazo válido.', 'error'); return false; }
      const d = db.getData();
      if (existing) {
        db.updateHomework(existing.id, data);
        toast('Dever atualizado.');
      } else {
        db.addHomework({ schoolId: d.settings.selectedSchoolId, serieId: d.settings.selectedSerieId, ...data });
        toast('Dever criado.');
      }
      const root = document.getElementById('view-root');
      if (root) render(root);
    },
  });
}

return { render };
})();

const Page_Works = (function() {
const db = DB;
const { currentWorks, currentSubjects, subjectById } = Selectors;
const { openModal } = Modal;
const { toast, confirmDialog, escapeHTML, fmtDate, isOverdue, todayISO } = Utils;
const { needsSelection } = EmptyGuards;
const STATUSES = ['Não iniciado', 'Em andamento', 'Concluído', 'Atrasado'];
let filters = { subject: '', status: '', search: '' };

function render(root) {
  if (needsSelection(root)) return;
  const subjects = currentSubjects();
  let items = currentWorks().map(applyAutoStatus);

  if (filters.subject) items = items.filter((w) => w.subjectId === filters.subject);
  if (filters.status) items = items.filter((w) => w.status === filters.status);
  if (filters.search) items = items.filter((w) => w.title.toLowerCase().includes(filters.search.toLowerCase()));
  items.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Trabalhos</h1><p class="page-sub">${items.length} trabalho(s) encontrado(s).</p></div>
      <button class="btn btn--primary" id="btn-add" ${subjects.length ? '' : 'disabled title="Cadastre uma matéria primeiro"'}>+ Novo trabalho</button>
    </div>

    <div class="toolbar">
      <input type="search" id="f-search" placeholder="Pesquisar por título..." value="${escapeHTML(filters.search)}" />
      <select id="f-subject"><option value="">Todas as matérias</option>${subjects.map((s) => `<option value="${s.id}" ${filters.subject === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}</select>
      <select id="f-status"><option value="">Todos os status</option>${STATUSES.map((s) => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>

    ${subjects.length ? '' : '<div class="empty-state empty-state--block">Cadastre ao menos uma matéria antes de criar trabalhos.</div>'}

    <div class="table-scroll">
      <table class="data-table" ${items.length ? '' : 'hidden'}>
        <thead><tr><th>Matéria</th><th>Título</th><th>Início</th><th>Prazo</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(rowHTML).join('')}</tbody>
      </table>
      ${items.length ? '' : '<div class="empty-state empty-state--block">Nenhum trabalho encontrado com estes filtros.</div>'}
    </div>
  `;

  root.querySelector('#btn-add').addEventListener('click', () => workForm());
  root.querySelector('#f-search').addEventListener('input', (e) => { filters.search = e.target.value; render(root); });
  root.querySelector('#f-subject').addEventListener('change', (e) => { filters.subject = e.target.value; render(root); });
  root.querySelector('#f-status').addEventListener('change', (e) => { filters.status = e.target.value; render(root); });

  root.querySelectorAll('[data-act="status"]').forEach((el) => el.addEventListener('change', (e) => {
    db.updateWork(el.dataset.id, { status: e.target.value });
    toast('Status atualizado.');
    render(root);
  }));
  root.querySelectorAll('[data-act="edit"]').forEach((el) => el.addEventListener('click', () => {
    workForm(items.find((w) => w.id === el.dataset.id));
  }));
  root.querySelectorAll('[data-act="del"]').forEach((el) => el.addEventListener('click', async () => {
    if (await confirmDialog('Excluir este trabalho?')) {
      db.deleteWork(el.dataset.id);
      toast('Trabalho excluído.');
      render(root);
    }
  }));
}

function applyAutoStatus(w) {
  if (isOverdue(w.dueDate, w.status) && w.status !== 'Em andamento' && w.status !== 'Não iniciado') return w;
  if (isOverdue(w.dueDate, w.status)) {
    db.updateWork(w.id, { status: 'Atrasado' });
    return { ...w, status: 'Atrasado' };
  }
  return w;
}

function rowHTML(w) {
  const subj = subjectById(w.subjectId);
  const badgeTone = { 'Não iniciado': 'neutral', 'Em andamento': 'warning', Concluído: 'success', Atrasado: 'danger' }[w.status];
  return `<tr>
    <td><span class="dot" style="--c:${subj?.color || '#999'}"></span>${escapeHTML(subj?.name || '—')}</td>
    <td>${escapeHTML(w.title)}</td>
    <td>${fmtDate(w.startDate)}</td>
    <td>${fmtDate(w.dueDate)}</td>
    <td>
      <select class="status-select badge badge--${badgeTone}" data-act="status" data-id="${w.id}">
        ${STATUSES.map((s) => `<option ${w.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </td>
    <td class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${w.id}" title="Editar">✎</button>
      <button class="icon-btn icon-btn--danger" data-act="del" data-id="${w.id}" title="Excluir">🗑</button>
    </td>
  </tr>`;
}

function workForm(existing) {
  const subjects = currentSubjects();
  openModal({
    title: existing ? 'Editar trabalho' : 'Novo trabalho',
    submitLabel: existing ? 'Salvar alterações' : 'Criar trabalho',
    bodyHTML: `
      <label class="field"><span>Matéria</span>
        <select name="subjectId" required>${subjects.map((s) => `<option value="${s.id}" ${existing?.subjectId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Título</span>
        <input name="title" required maxlength="100" value="${existing ? escapeHTML(existing.title) : ''}" placeholder="Ex: Trabalho sobre o ciclo da água" />
      </label>
      <label class="field"><span>Descrição</span>
        <textarea name="description" rows="3" maxlength="500" placeholder="Detalhes do trabalho (opcional)">${existing ? escapeHTML(existing.description || '') : ''}</textarea>
      </label>
      <div class="field-row">
        <label class="field"><span>Início</span>
          <input type="date" name="startDate" value="${existing?.startDate || todayISO()}" />
        </label>
        <label class="field"><span>Prazo de entrega</span>
          <input type="date" name="dueDate" required value="${existing?.dueDate || todayISO()}" />
        </label>
      </div>
      <label class="field"><span>Status</span>
        <select name="status">${STATUSES.map((s) => `<option ${existing?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </label>`,
    onSubmit: (data) => {
      if (!data.title.trim()) { toast('O título é obrigatório.', 'error'); return false; }
      if (!data.dueDate) { toast('Informe um prazo válido.', 'error'); return false; }
      if (data.startDate && data.dueDate < data.startDate) { toast('O prazo não pode ser anterior à data de início.', 'error'); return false; }
      const d = db.getData();
      if (existing) {
        db.updateWork(existing.id, data);
        toast('Trabalho atualizado.');
      } else {
        db.addWork({ schoolId: d.settings.selectedSchoolId, serieId: d.settings.selectedSerieId, ...data });
        toast('Trabalho criado.');
      }
      const root = document.getElementById('view-root');
      if (root) render(root);
    },
  });
}

return { render };
})();

const Page_Grades = (function() {
const db = DB;
const { currentSubjects, yearAverageForSubject, situacaoAcademica } = Selectors;
const { toast, escapeHTML, fmtNota, clampNota } = Utils;
const { needsSelection } = EmptyGuards;
const { renderLineChart } = Charts;
let activeBimestre = 1;
let focusSubjectId = null;

// Pontuação máxima de cada avaliação — a soma dá o total do bimestre (10).
const AV_MAX = { av1: 3, av2: 5, av3: 2 };

function render(root) {
  if (needsSelection(root)) return;
  const subjects = currentSubjects();
  const minGrade = db.getData().settings.minGrade;

  root.innerHTML = `
    <div class="page-head">
      <h1>Notas</h1>
      <p class="page-sub">Cada avaliação vale pontos: AV1 até 3, AV2 até 5, AV3 até 2 — o bimestre totaliza até 10 pontos. Clique numa nota para editá-la.</p>
    </div>

    <div class="bimestre-tabs" role="tablist">
      ${[1, 2, 3, 4].map((b) => `<button class="tab ${activeBimestre === b ? 'is-active' : ''}" data-b="${b}">${b}º Bimestre</button>`).join('')}
    </div>

    ${subjects.length ? '' : '<div class="empty-state empty-state--block">Cadastre matérias para lançar notas.</div>'}

    <div class="table-scroll">
      <table class="data-table grades-table" ${subjects.length ? '' : 'hidden'}>
        <thead><tr><th>Matéria</th><th>AV1 <small>(máx. 3)</small></th><th>AV2 <small>(máx. 5)</small></th><th>AV3 <small>(máx. 2)</small></th><th>Total</th><th></th></tr></thead>
        <tbody>${subjects.map((s) => subjectRow(s, activeBimestre, minGrade)).join('')}</tbody>
      </table>
    </div>

    <section class="panel annual-summary" ${subjects.length ? '' : 'hidden'}>
      <h2>Média anual</h2>
      <p class="page-sub">Nota final = (1º + 2º + 3º + 4º Bimestre) ÷ 4. A nota de cada bimestre continua sendo a soma de AV1+AV2+AV3, sem alteração.</p>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Matéria</th><th>1º Bim</th><th>2º Bim</th><th>3º Bim</th><th>4º Bim</th><th>Nota final</th><th>Situação</th></tr></thead>
          <tbody>${subjects.map((s) => annualRow(s, minGrade)).join('')}</tbody>
        </table>
      </div>
    </section>

    <div id="subject-detail"></div>
  `;

  root.querySelectorAll('.bimestre-tabs .tab').forEach((el) => el.addEventListener('click', () => {
    activeBimestre = Number(el.dataset.b);
    render(root);
  }));

  root.querySelectorAll('.grade-input').forEach((el) => {
    el.addEventListener('change', () => {
      const field = el.dataset.field;
      const max = AV_MAX[field];
      const val = el.value === '' ? null : clampNota(el.value);
      if (val !== null && (val < 0 || val > max)) {
        toast(`${field.toUpperCase()} deve estar entre 0 e ${max}.`, 'error');
        render(root);
        return;
      }
      db.setGrade(el.dataset.subject, activeBimestre, field, val);
      toast('Nota salva.');
      render(root);
      if (focusSubjectId) renderDetail(root, minGrade);
    });
  });

  root.querySelectorAll('[data-act="ver"]').forEach((el) => el.addEventListener('click', () => {
    focusSubjectId = focusSubjectId === el.dataset.id ? null : el.dataset.id;
    renderDetail(root, minGrade);
  }));

  if (focusSubjectId) renderDetail(root, minGrade);
}

function annualRow(s, minGrade) {
  // Total de cada bimestre já vem pronto de db.computeAverage (a soma
  // AV1+AV2+AV3 corrigida) — aqui só reaproveitamos, sem recalcular nada.
  const bimestres = [1, 2, 3, 4].map((b) => db.computeAverage(db.getGradeRow(s.id, b)));
  const notaFinal = yearAverageForSubject(s.id); // média dos 4 bimestres, já existente no app
  const situacao = situacaoAcademica(notaFinal, minGrade);
  return `<tr>
    <td><span class="dot" style="--c:${s.color}"></span>${escapeHTML(s.name)}</td>
    ${bimestres.map((b) => `<td>${fmtNota(b)}</td>`).join('')}
    <td><strong>${fmtNota(notaFinal)}</strong></td>
    <td><span class="badge badge--${situacao.tone}">${situacao.label}</span></td>
  </tr>`;
}

function subjectRow(s, bimestre, minGrade) {
  const row = db.getGradeRow(s.id, bimestre) || { av1: null, av2: null, av3: null };
  const media = db.computeAverage(row);
  const situacao = situacaoAcademica(media, minGrade);
  return `<tr>
    <td><span class="dot" style="--c:${s.color}"></span>${escapeHTML(s.name)}</td>
    <td><input class="grade-input" type="number" step="0.1" min="0" max="3" data-subject="${s.id}" data-field="av1" value="${row.av1 ?? ''}" /></td>
    <td><input class="grade-input" type="number" step="0.1" min="0" max="5" data-subject="${s.id}" data-field="av2" value="${row.av2 ?? ''}" /></td>
    <td><input class="grade-input" type="number" step="0.1" min="0" max="2" data-subject="${s.id}" data-field="av3" value="${row.av3 ?? ''}" /></td>
    <td><strong class="media-cell badge--${situacao.tone}">${fmtNota(media)}</strong></td>
    <td><button class="btn btn--ghost btn--sm" data-act="ver" data-id="${s.id}">Ver matéria</button></td>
  </tr>`;
}

function renderDetail(root, minGrade) {
  const host = root.querySelector('#subject-detail');
  const s = currentSubjects().find((x) => x.id === focusSubjectId);
  if (!s) { host.innerHTML = ''; return; }

  const bimestres = [1, 2, 3, 4].map((b) => db.computeAverage(db.getGradeRow(s.id, b)));
  const anual = yearAverageForSubject(s.id);
  const situacao = situacaoAcademica(anual, minGrade);

  host.innerHTML = `
    <section class="panel subject-detail" style="--subj-color:${s.color}">
      <div class="panel__head">
        <h2>${escapeHTML(s.name)} <span class="badge badge--${situacao.tone}">${situacao.label}</span></h2>
        <div class="subject-detail__stats">
          <div><span>Média anual</span><strong>${fmtNota(anual)}</strong></div>
          <div><span>Nota mínima</span><strong>${fmtNota(minGrade)}</strong></div>
          <div><span>Diferença</span><strong>${anual != null ? fmtNota(anual - minGrade) : '—'}</strong></div>
        </div>
      </div>
      <div class="chart-box"><canvas id="subject-chart" height="220"></canvas></div>
    </section>
  `;

  const canvas = host.querySelector('#subject-chart');
  renderLineChart(canvas, {
    labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'],
    datasets: [{ label: s.name, data: bimestres, borderColor: s.color, backgroundColor: s.color + '33', fill: true }],
  });
}

return { render };
})();

const Page_Performance = (function() {
const db = DB;
const { currentSubjects, bimesterAverageAllSubjects, yearAverageForSubject, generalAverage, situacaoAcademica } = Selectors;
const { fmtNota } = Utils;
const { needsSelection } = EmptyGuards;
const { renderLineChart, renderBarChart } = Charts;
function render(root) {
  if (needsSelection(root)) return;
  const subjects = currentSubjects();
  const minGrade = db.getData().settings.minGrade;
  const bimMedias = [1, 2, 3, 4].map(bimesterAverageAllSubjects);
  const geral = generalAverage();
  const situacao = situacaoAcademica(geral, minGrade);

  const withMedia = bimMedias.map((m, i) => ({ b: i + 1, m })).filter((x) => x.m != null);
  const melhor = withMedia.length ? withMedia.reduce((a, b) => (b.m > a.m ? b : a)) : null;
  const pior = withMedia.length ? withMedia.reduce((a, b) => (b.m < a.m ? b : a)) : null;

  const subjectTrend = subjects.map((s) => {
    const meds = [1, 2, 3, 4].map((b) => db.computeAverage(db.getGradeRow(s.id, b)));
    const filled = meds.filter((m) => m != null);
    const trend = filled.length >= 2 ? filled[filled.length - 1] - filled[0] : null;
    return { subject: s, meds, trend };
  });
  const melhoraram = subjectTrend.filter((x) => x.trend != null && x.trend > 0);
  const pioraram = subjectTrend.filter((x) => x.trend != null && x.trend < 0);

  root.innerHTML = `
    <div class="page-head">
      <h1>Desempenho</h1>
      <p class="page-sub">Comparativo entre os quatro bimestres de ${new Date().getFullYear()}.</p>
    </div>

    <div class="stat-cards">
      <div class="stat-card"><span>Média geral</span><strong>${fmtNota(geral)}</strong></div>
      <div class="stat-card"><span>Situação</span><strong class="badge badge--${situacao.tone}">${situacao.label}</strong></div>
      <div class="stat-card"><span>Melhor bimestre</span><strong>${melhor ? `${melhor.b}º (${fmtNota(melhor.m)})` : '—'}</strong></div>
      <div class="stat-card"><span>Pior bimestre</span><strong>${pior ? `${pior.b}º (${fmtNota(pior.m)})` : '—'}</strong></div>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Bimestre</th><th>Média</th></tr></thead>
        <tbody>${bimMedias.map((m, i) => `<tr><td>${i + 1}º</td><td>${fmtNota(m)}</td></tr>`).join('')}</tbody>
      </table>
    </div>

    <div class="grid-2">
      <section class="panel"><h2>Evolução da média geral</h2><div class="chart-box"><canvas id="chart-geral" height="240"></canvas></div></section>
      <section class="panel"><h2>Comparação entre matérias</h2><div class="chart-box"><canvas id="chart-subjects" height="240"></canvas></div></section>
    </div>

    <div class="grid-2">
      <section class="panel">
        <h2>📈 Matérias que melhoraram</h2>
        <ul class="entity-list">${melhoraram.length ? melhoraram.map((x) => `<li class="entity-row"><span class="dot" style="--c:${x.subject.color}"></span>${x.subject.name} <span class="badge badge--success">+${fmtNota(x.trend)}</span></li>`).join('') : '<li class="empty-state">Nenhuma matéria com dados suficientes ainda.</li>'}</ul>
      </section>
      <section class="panel">
        <h2>📉 Matérias que pioraram</h2>
        <ul class="entity-list">${pioraram.length ? pioraram.map((x) => `<li class="entity-row"><span class="dot" style="--c:${x.subject.color}"></span>${x.subject.name} <span class="badge badge--danger">${fmtNota(x.trend)}</span></li>`).join('') : '<li class="empty-state">Nenhuma matéria com dados suficientes ainda.</li>'}</ul>
      </section>
    </div>
  `;

  renderLineChart(root.querySelector('#chart-geral'), {
    labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'],
    datasets: [{ label: 'Média geral', data: bimMedias, borderColor: '#3457D5', backgroundColor: '#3457D533', fill: true }],
  });

  renderBarChart(root.querySelector('#chart-subjects'), {
    labels: subjects.map((s) => s.name),
    datasets: [{ label: 'Média anual', data: subjects.map((s) => yearAverageForSubject(s.id)), backgroundColor: subjects.map((s) => s.color) }],
  });
}

return { render };
})();

const Page_Calendar = (function() {
const db = DB;
const { currentHomework, currentWorks, currentEvents, subjectById, currentSubjects } = Selectors;
const { openModal } = Modal;
const { toast, confirmDialog, escapeHTML, fmtDate } = Utils;
const { needsSelection } = EmptyGuards;
let viewDate = new Date();
let selectedDay = null;

function render(root) {
  if (needsSelection(root)) return;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const items = collectItems();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push('<div class="cal-cell cal-cell--empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayItems = items.filter((it) => it.date === iso);
    const isToday = iso === new Date().toISOString().slice(0, 10);
    cells.push(`<button class="cal-cell ${isToday ? 'is-today' : ''} ${selectedDay === iso ? 'is-selected' : ''}" data-day="${iso}">
      <span class="cal-cell__num">${day}</span>
      <span class="cal-cell__dots">${dayItems.slice(0, 4).map((it) => `<i class="cal-dot cal-dot--${it.type}"></i>`).join('')}</span>
    </button>`);
  }

  root.innerHTML = `
    <div class="page-head">
      <h1>Calendário escolar</h1>
      <p class="page-sub">Deveres, trabalhos e eventos em um só lugar.</p>
    </div>

    <div class="calendar-layout">
      <section class="panel calendar-panel">
        <div class="calendar-nav">
          <button class="icon-btn" id="prev-month">‹</button>
          <h2>${capitalize(monthName)}</h2>
          <button class="icon-btn" id="next-month">›</button>
          <button class="btn btn--primary btn--sm" id="btn-add-event">+ Evento</button>
        </div>
        <div class="calendar-grid calendar-grid--head">
          ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div>${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">${cells.join('')}</div>
        <div class="calendar-legend">
          <span><i class="cal-dot cal-dot--dever"></i> Dever</span>
          <span><i class="cal-dot cal-dot--trabalho"></i> Trabalho</span>
          <span><i class="cal-dot cal-dot--evento"></i> Evento</span>
        </div>
      </section>

      <section class="panel calendar-day">
        <h2>${selectedDay ? fmtDate(selectedDay) : 'Selecione um dia'}</h2>
        <ul class="entity-list">
          ${selectedDay ? dayItemsHTML(items.filter((it) => it.date === selectedDay)) : '<li class="empty-state">Clique numa data para ver os detalhes.</li>'}
        </ul>
      </section>
    </div>
  `;

  root.querySelector('#prev-month').addEventListener('click', () => { viewDate = new Date(year, month - 1, 1); render(root); });
  root.querySelector('#next-month').addEventListener('click', () => { viewDate = new Date(year, month + 1, 1); render(root); });
  root.querySelector('#btn-add-event').addEventListener('click', () => eventForm());
  root.querySelectorAll('.cal-cell[data-day]').forEach((el) => el.addEventListener('click', () => {
    selectedDay = el.dataset.day;
    render(root);
  }));
  root.querySelectorAll('[data-act="del-event"]').forEach((el) => el.addEventListener('click', async () => {
    if (await confirmDialog('Excluir este evento?')) { db.deleteEvent(el.dataset.id); toast('Evento excluído.'); render(root); }
  }));
}

function collectItems() {
  const hw = currentHomework().map((h) => ({ date: h.dueDate, type: 'dever', title: `Dever: ${h.title}`, subjectId: h.subjectId, id: h.id }));
  const wk = currentWorks().map((w) => ({ date: w.dueDate, type: 'trabalho', title: `Trabalho: ${w.title}`, subjectId: w.subjectId, id: w.id }));
  const ev = currentEvents().map((e) => ({ date: e.date, type: 'evento', title: e.title, id: e.id, manual: true, notes: e.notes }));
  return [...hw, ...wk, ...ev].filter((it) => it.date);
}

function dayItemsHTML(items) {
  if (!items.length) return '<li class="empty-state">Nenhum evento nesta data.</li>';
  return items.map((it) => {
    const subj = it.subjectId ? subjectById(it.subjectId) : null;
    return `<li class="entity-row">
      <span class="entity-row__name"><i class="cal-dot cal-dot--${it.type}"></i> ${escapeHTML(it.title)} ${subj ? `<small>(${escapeHTML(subj.name)})</small>` : ''}</span>
      ${it.manual ? `<button class="icon-btn icon-btn--danger" data-act="del-event" data-id="${it.id}" title="Excluir">🗑</button>` : ''}
    </li>`;
  }).join('');
}

function eventForm() {
  const d = db.getData();
  openModal({
    title: 'Novo evento escolar',
    submitLabel: 'Criar evento',
    bodyHTML: `
      <label class="field"><span>Título</span><input name="title" required maxlength="80" placeholder="Ex: Reunião de pais" /></label>
      <label class="field"><span>Data</span><input type="date" name="date" required value="${selectedDay || ''}" /></label>
      <label class="field"><span>Observações</span><textarea name="notes" rows="2" maxlength="300"></textarea></label>`,
    onSubmit: (data) => {
      if (!data.title.trim() || !data.date) { toast('Preencha título e data.', 'error'); return false; }
      db.addEvent({ schoolId: d.settings.selectedSchoolId, serieId: d.settings.selectedSerieId, title: data.title, date: data.date, notes: data.notes, type: 'evento' });
      toast('Evento criado.');
      selectedDay = data.date;
      const root = document.getElementById('view-root');
      if (root) render(root);
    },
  });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

return { render };
})();

const Page_Settings = (function() {
const db = DB;
const { toast, confirmDialog } = Utils;
function render(root) {
  const d = db.getData();

  root.innerHTML = `
    <div class="page-head"><h1>Configurações</h1><p class="page-sub">Ajustes gerais da agenda e backup dos seus dados.</p></div>

    <section class="panel">
      <h2>Critério de aprovação</h2>
      <label class="field field--inline">
        <span>Nota mínima para aprovação</span>
        <input type="number" id="min-grade" min="0" max="10" step="0.1" value="${d.settings.minGrade}" style="max-width:120px" />
      </label>
      <p class="field-hint">Usada para calcular a situação acadêmica (🟢 Aprovado / 🟡 Recuperação / 🔴 Reprovado) em Notas e Desempenho.</p>
    </section>

    <section class="panel">
      <h2>Backup dos dados</h2>
      <p class="field-hint">Como a agenda funciona 100% no seu navegador, faça backups regulares para não perder informações ao trocar de computador ou navegador.</p>
      <div class="btn-row">
        <button class="btn btn--primary" id="btn-export">⬇ Exportar dados (.json)</button>
        <label class="btn btn--ghost file-btn">⬆ Importar dados (.json)
          <input type="file" id="file-import" accept="application/json" hidden />
        </label>
      </div>
    </section>

    <section class="panel panel--danger">
      <h2>Zona de risco</h2>
      <p class="field-hint">Isso apaga permanentemente todas as escolas, séries, matérias, notas, deveres e trabalhos deste navegador.</p>
      <button class="btn btn--danger" id="btn-reset">Apagar todos os dados</button>
    </section>
  `;

  root.querySelector('#min-grade').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (Number.isNaN(v) || v < 0 || v > 10) { toast('A nota mínima deve estar entre 0 e 10.', 'error'); render(root); return; }
    db.setSetting('minGrade', v);
    toast('Nota mínima atualizada.');
  });

  root.querySelector('#btn-export').addEventListener('click', () => {
    const blob = new Blob([db.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-escolar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exportado.');
  });

  root.querySelector('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmDialog('Importar este arquivo substituirá todos os dados atuais. Continuar?'))) { e.target.value = ''; return; }
    try {
      const text = await file.text();
      db.importJSON(text);
      toast('Dados importados com sucesso.');
      document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
    } catch (err) {
      toast('Não foi possível importar: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  root.querySelector('#btn-reset').addEventListener('click', async () => {
    if (await confirmDialog('Tem certeza? Esta ação não pode ser desfeita.')) {
      db.resetAll();
      toast('Todos os dados foram apagados.');
      document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
      location.hash = '#/dashboard';
    }
  });
}

return { render };
})();
(function() {
const db = DB;
const { seriesForCurrentSchool } = Selectors;
const { escapeHTML } = Utils;
const Dashboard = Page_Dashboard;
const Schools = Page_Schools;
const Subjects = Page_Subjects;
const Homework = Page_Homework;
const Works = Page_Works;
const Grades = Page_Grades;
const Performance = Page_Performance;
const CalendarPage = Page_Calendar;
const Settings = Page_Settings;

const ROUTES = {
  '#/dashboard': { title: 'Dashboard', mod: Dashboard, icon: '🏠' },
  '#/notas': { title: 'Notas', mod: Grades, icon: '📚' },
  '#/deveres': { title: 'Deveres', mod: Homework, icon: '📝' },
  '#/trabalhos': { title: 'Trabalhos', mod: Works, icon: '📑' },
  '#/calendario': { title: 'Calendário', mod: CalendarPage, icon: '📅' },
  '#/desempenho': { title: 'Desempenho', mod: Performance, icon: '📊' },
  '#/materias': { title: 'Matérias', mod: Subjects, icon: '📖' },
  '#/escolas': { title: 'Escolas', mod: Schools, icon: '🏫' },
  '#/configuracoes': { title: 'Configurações', mod: Settings, icon: '⚙️' },
};

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <span class="sidebar__logo">📔</span>
          <span class="sidebar__title">Agenda<br/>Escolar</span>
        </div>
        <nav class="sidebar__nav" id="nav-links"></nav>
        <div class="sidebar__selector" id="context-selector"></div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <button class="icon-btn topbar__menu" id="menu-toggle" aria-label="Abrir menu">☰</button>
          <div class="topbar__context" id="topbar-context"></div>
        </header>
        <main class="view" id="view-root"></main>
        <nav class="bottom-nav" id="bottom-nav"></nav>
      </div>
    </div>
    <div id="toast-host" class="toast-host"></div>
  `;

  const navHTML = Object.entries(ROUTES).map(([hash, r]) =>
    `<a href="${hash}" class="nav-link" data-hash="${hash}"><span class="nav-link__icon">${r.icon}</span>${r.title}</a>`).join('');
  document.getElementById('nav-links').innerHTML = navHTML;

  const bottomHTML = ['#/dashboard', '#/notas', '#/deveres', '#/calendario', '#/desempenho']
    .map((hash) => `<a href="${hash}" class="bottom-nav__link" data-hash="${hash}"><span>${ROUTES[hash].icon}</span></a>`).join('');
  document.getElementById('bottom-nav').innerHTML = bottomHTML;

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('is-open');
  });
  document.getElementById('view-root').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('is-open');
  });
}

function renderContextSelector() {
  const d = db.getData();
  const host = document.getElementById('context-selector');
  const topbar = document.getElementById('topbar-context');
  const schoolOptions = d.schools.map((s) => `<option value="${s.id}" ${d.settings.selectedSchoolId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');
  const series = seriesForCurrentSchool();
  const serieOptions = series.map((s) => `<option value="${s.id}" ${d.settings.selectedSerieId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');

  const html = `
    <label class="ctx-field">
      <span>Escola</span>
      <select id="ctx-school">${d.schools.length ? schoolOptions : '<option value="">Nenhuma cadastrada</option>'}</select>
    </label>
    <label class="ctx-field">
      <span>Série</span>
      <select id="ctx-serie">${series.length ? serieOptions : '<option value="">Nenhuma cadastrada</option>'}</select>
    </label>
  `;
  host.innerHTML = html;
  topbar.innerHTML = d.schools.length
    ? `<strong>${escapeHTML(d.schools.find((s) => s.id === d.settings.selectedSchoolId)?.name || 'Selecione uma escola')}</strong>${series.length ? ' · ' + escapeHTML(series.find((s) => s.id === d.settings.selectedSerieId)?.name || 'Selecione uma série') : ''}`
    : '<em>Cadastre sua primeira escola em "Escolas"</em>';

  host.querySelector('#ctx-school')?.addEventListener('change', (e) => {
    db.setSetting('selectedSchoolId', e.target.value || null);
    db.setSetting('selectedSerieId', null);
    renderContextSelector();
    renderRoute();
  });
  host.querySelector('#ctx-serie')?.addEventListener('change', (e) => {
    db.setSetting('selectedSerieId', e.target.value || null);
    renderRoute();
  });
}

function highlightNav() {
  const hash = location.hash || '#/dashboard';
  document.querySelectorAll('.nav-link, .bottom-nav__link').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.hash === hash);
  });
}

function renderRoute() {
  const hash = ROUTES[location.hash] ? location.hash : '#/dashboard';
  if (location.hash !== hash) { location.hash = hash; return; }
  const route = ROUTES[hash];
  const root = document.getElementById('view-root');
  root.scrollTop = 0;
  route.mod.render(root);
  highlightNav();
}

function boot() {
  buildShell();
  renderContextSelector();
  renderRoute();

  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('agenda:changed', () => renderContextSelector());
  document.addEventListener('agenda:selection-changed', () => { renderContextSelector(); renderRoute(); });
}

document.addEventListener('DOMContentLoaded', boot);

})();
