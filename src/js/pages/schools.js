import db from '../db.js';
import { seriesForCurrentSchool } from '../selectors.js';
import { openModal } from '../components/modal.js';
import { toast, confirmDialog, escapeHTML } from '../utils.js';

export function render(root) {
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
