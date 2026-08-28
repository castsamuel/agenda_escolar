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
  return (av1 * 3 + av2 * 5 + av3 * 2) / 10;
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

export default {
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
