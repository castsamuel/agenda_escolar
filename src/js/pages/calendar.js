import db from '../db.js';
import { currentHomework, currentWorks, currentEvents, subjectById, currentSubjects } from '../selectors.js';
import { openModal } from '../components/modal.js';
import { toast, confirmDialog, escapeHTML, fmtDate } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';

let viewDate = new Date();
let selectedDay = null;

export function render(root) {
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
