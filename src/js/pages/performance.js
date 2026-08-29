import db from '../db.js';
import { currentSubjects, bimesterAverageAllSubjects, yearAverageForSubject, generalAverage, situacaoAcademica } from '../selectors.js';
import { fmtNota } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';
import { renderLineChart, renderBarChart } from '../components/charts.js';

export function render(root) {
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
