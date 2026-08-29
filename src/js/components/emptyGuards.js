// emptyGuards.js — evita que páginas tentem renderizar dados sem uma
// escola/série selecionada, mostrando um estado vazio orientando o usuário.

import db from '../db.js';

export function needsSelection(root) {
  const d = db.getData();
  if (d.settings.selectedSchoolId && d.settings.selectedSerieId) return false;
  root.innerHTML = `
    <div class="empty-state empty-state--block empty-state--big">
      <div class="empty-state__icon">🏫</div>
      <h2>Selecione uma escola e uma série</h2>
      <p>Para ver esta página, primeiro cadastre e selecione uma escola e uma série em <strong>Escolas</strong>.</p>
      <a class="btn btn--primary" href="#/escolas">Ir para Escolas</a>
    </div>`;
  return true;
}
