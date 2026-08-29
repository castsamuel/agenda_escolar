import db from '../db.js';
import { currentSubjects, currentSerie } from '../selectors.js';
import { openModal } from '../components/modal.js';
import { toast, confirmDialog, escapeHTML, SUBJECT_COLORS, pickColor } from '../utils.js';
import { needsSelection } from '../components/emptyGuards.js';

export function render(root) {
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
