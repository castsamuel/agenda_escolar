import db from '../db.js';
import { currentWorks, currentSubjects, subjectById } from '../selectors.js';
import { openModal } from '../components/modal.js';
import { toast, confirmDialog, escapeHTML, fmtDate, isOverdue, todayISO } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';

const STATUSES = ['Não iniciado', 'Em andamento', 'Concluído', 'Atrasado'];
let filters = { subject: '', status: '', search: '' };

export function render(root) {
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
