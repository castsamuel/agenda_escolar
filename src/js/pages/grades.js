import db from '../db.js';
import { currentSubjects, yearAverageForSubject, situacaoAcademica } from '../selectors.js';
import { toast, escapeHTML, fmtNota, clampNota } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';
import { renderLineChart } from '../components/charts.js';

let activeBimestre = 1;
let focusSubjectId = null;

// Pontuação máxima de cada avaliação — a soma dá o total do bimestre (10).
const AV_MAX = { av1: 3, av2: 5, av3: 2 };

export function render(root) {
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
