import db from '../db.js';
import { toast, confirmDialog } from '../utils.js';

export function render(root) {
  const d = db.getData();

  root.innerHTML = `
    <div class="page-head"><h1>Configurações</h1><p class="page-sub">Ajustes gerais da agenda e backup dos seus dados.</p></div>

    <section class="panel">
      <h2>Critério de aprovação</h2>
      <label class="field field--inline">
        <span>Nota mínima para aprovação</span>
        <input type="number" id="min-grade" min="0" max="10" step="0.1" value="${d.settings.minGrade}" style="max-width:120px" />
      </label>
      <p class="field-hint">Usada para calcular a situação acadêmica (🟢 Aprovado / 🟡 Recuperação / 🔴 Reprovado) em Notas e Desempenho.</p>
    </section>

    <section class="panel">
      <h2>Backup dos dados</h2>
      <p class="field-hint">Como a agenda funciona 100% no seu navegador, faça backups regulares para não perder informações ao trocar de computador ou navegador.</p>
      <div class="btn-row">
        <button class="btn btn--primary" id="btn-export">⬇ Exportar dados (.json)</button>
        <label class="btn btn--ghost file-btn">⬆ Importar dados (.json)
          <input type="file" id="file-import" accept="application/json" hidden />
        </label>
      </div>
    </section>

    <section class="panel panel--danger">
      <h2>Zona de risco</h2>
      <p class="field-hint">Isso apaga permanentemente todas as escolas, séries, matérias, notas, deveres e trabalhos deste navegador.</p>
      <button class="btn btn--danger" id="btn-reset">Apagar todos os dados</button>
    </section>
  `;

  root.querySelector('#min-grade').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (Number.isNaN(v) || v < 0 || v > 10) { toast('A nota mínima deve estar entre 0 e 10.', 'error'); render(root); return; }
    db.setSetting('minGrade', v);
    toast('Nota mínima atualizada.');
  });

  root.querySelector('#btn-export').addEventListener('click', () => {
    const blob = new Blob([db.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-escolar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exportado.');
  });

  root.querySelector('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmDialog('Importar este arquivo substituirá todos os dados atuais. Continuar?'))) { e.target.value = ''; return; }
    try {
      const text = await file.text();
      db.importJSON(text);
      toast('Dados importados com sucesso.');
      document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
    } catch (err) {
      toast('Não foi possível importar: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  root.querySelector('#btn-reset').addEventListener('click', async () => {
    if (await confirmDialog('Tem certeza? Esta ação não pode ser desfeita.')) {
      db.resetAll();
      toast('Todos os dados foram apagados.');
      document.dispatchEvent(new CustomEvent('agenda:selection-changed'));
      location.hash = '#/dashboard';
    }
  });
}
