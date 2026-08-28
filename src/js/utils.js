// utils.js — helpers de formatação, datas e validação usados em toda a aplicação.

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

export function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'Concluído') return false;
  return daysUntil(dueDate) < 0;
}

export function fmtNota(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

export function clampNota(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.min(10, Math.max(0, v));
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function toast(message, kind = 'success') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast__icon">${kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i'}</span><span>${escapeHTML(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${escapeHTML(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn--ghost" data-act="cancel">Cancelar</button>
          <button class="btn btn--danger" data-act="ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    overlay.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act === 'ok' || act === 'cancel' || e.target === overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 200);
        resolve(act === 'ok');
      }
    });
  });
}

export const SUBJECT_COLORS = [
  '#3457D5', '#D64550', '#2E9E6B', '#F5C400', '#8E44AD',
  '#E07A2F', '#1F9DA8', '#C2437A', '#5B6ABF', '#7A8B4E',
];

export function pickColor(index) {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}
