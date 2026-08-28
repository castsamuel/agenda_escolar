import db from '../db.js';
import { currentSchool, currentSerie, currentHomework, currentWorks, generalAverage, situacaoAcademica, subjectById, currentSubjects, bimesterAverageAllSubjects } from '../selectors.js';
import { fmtNota, fmtDate, daysUntil, escapeHTML, isOverdue } from '../utils.js';
import { renderLineChart } from '../components/charts.js';

export function render(root) {
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
