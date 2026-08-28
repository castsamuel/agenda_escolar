import db from '../db.js';
import { currentHomework, currentSubjects, subjectById } from '../selectors.js';
import { openModal } from '../components/modal.js';
import { toast, confirmDialog, escapeHTML, fmtDate, isOverdue, todayISO } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';

let filters = { subject: '', status: '', search: '', sort: 'prazo' };

export function render(root) {
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
