// selectors.js — funções de leitura derivadas do estado, filtrando sempre
// pela escola/série atualmente selecionada (regra da seção 3 do briefing:
// nada de uma escola deve vazar para outra).

import db from './db.js';

export function currentSchool() {
  const d = db.getData();
  return d.schools.find((s) => s.id === d.settings.selectedSchoolId) || null;
}

export function currentSerie() {
  const d = db.getData();
  return d.series.find((s) => s.id === d.settings.selectedSerieId) || null;
}

export function seriesForCurrentSchool() {
  const d = db.getData();
  if (!d.settings.selectedSchoolId) return [];
  return d.series.filter((s) => s.schoolId === d.settings.selectedSchoolId);
}

export function currentSubjects() {
  const d = db.getData();
  if (!d.settings.selectedSerieId) return [];
  return d.subjects.filter((s) => s.serieId === d.settings.selectedSerieId);
}

export function currentHomework() {
  const d = db.getData();
  return d.homework.filter((h) => h.serieId === d.settings.selectedSerieId);
}

export function currentWorks() {
  const d = db.getData();
  return d.works.filter((w) => w.serieId === d.settings.selectedSerieId);
}

export function currentEvents() {
  const d = db.getData();
  return d.events.filter((e) => e.serieId === d.settings.selectedSerieId);
}

export function subjectById(id) {
  return db.getData().subjects.find((s) => s.id === id) || null;
}

export function yearAverageForSubject(subjectId) {
  const d = db.getData();
  const rows = d.grades.filter((g) => g.subjectId === subjectId);
  const meds = [1, 2, 3, 4].map((b) => {
    const row = rows.find((r) => r.bimestre === b);
    return db.computeAverage(row);
  }).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

export function bimesterAverageAllSubjects(bimestre) {
  const subs = currentSubjects();
  const meds = subs.map((s) => db.computeAverage(db.getGradeRow(s.id, bimestre))).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

export function generalAverage() {
  const subs = currentSubjects();
  const meds = subs.map((s) => yearAverageForSubject(s.id)).filter((m) => m != null);
  if (!meds.length) return null;
  return meds.reduce((a, b) => a + b, 0) / meds.length;
}

export function situacaoAcademica(avg, minGrade) {
  if (avg == null) return { label: 'Sem notas', tone: 'neutral' };
  if (avg >= minGrade) return { label: 'Aprovado', tone: 'success' };
  if (avg >= minGrade - 1.5) return { label: 'Recuperação', tone: 'warning' };
  return { label: 'Reprovado', tone: 'danger' };
}
