// modal.js — modal genérico reutilizável para formulários de cadastro/edição.

export function openModal({ title, bodyHTML, onMount, onSubmit, submitLabel = 'Salvar' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="modal-box__header">
        <h3>${title}</h3>
        <button type="button" class="icon-btn" data-act="close" aria-label="Fechar">✕</button>
      </header>
      <form class="modal-box__form">
        <div class="modal-box__body">${bodyHTML}</div>
        <footer class="modal-box__footer">
          <button type="button" class="btn btn--ghost" data-act="close">Cancelar</button>
          <button type="submit" class="btn btn--primary">${submitLabel}</button>
        </footer>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector('form');

  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  function close() {
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-act="close"]')) close();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  if (onMount) onMount(overlay);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const result = onSubmit ? onSubmit(Object.fromEntries(data.entries()), overlay) : true;
    if (result !== false) close();
  });

  return { close, overlay };
}
