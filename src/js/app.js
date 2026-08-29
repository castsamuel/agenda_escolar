import db from './db.js';
import { seriesForCurrentSchool } from './selectors.js';
import { escapeHTML } from './utils.js';

import * as Dashboard from './pages/dashboard.js';
import * as Schools from './pages/schools.js';
import * as Subjects from './pages/subjects.js';
import * as Homework from './pages/homework.js';
import * as Works from './pages/works.js';
import * as Grades from './pages/grades.js';
import * as Performance from './pages/performance.js';
import * as CalendarPage from './pages/calendar.js';
import * as Settings from './pages/settings.js';

const ROUTES = {
  '#/dashboard': { title: 'Dashboard', mod: Dashboard, icon: '🏠' },
  '#/notas': { title: 'Notas', mod: Grades, icon: '📚' },
  '#/deveres': { title: 'Deveres', mod: Homework, icon: '📝' },
  '#/trabalhos': { title: 'Trabalhos', mod: Works, icon: '📑' },
  '#/calendario': { title: 'Calendário', mod: CalendarPage, icon: '📅' },
  '#/desempenho': { title: 'Desempenho', mod: Performance, icon: '📊' },
  '#/materias': { title: 'Matérias', mod: Subjects, icon: '📖' },
  '#/escolas': { title: 'Escolas', mod: Schools, icon: '🏫' },
  '#/configuracoes': { title: 'Configurações', mod: Settings, icon: '⚙️' },
};

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <span class="sidebar__logo">📔</span>
          <span class="sidebar__title">Agenda<br/>Escolar</span>
        </div>
        <nav class="sidebar__nav" id="nav-links"></nav>
        <div class="sidebar__selector" id="context-selector"></div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <button class="icon-btn topbar__menu" id="menu-toggle" aria-label="Abrir menu">☰</button>
          <div class="topbar__context" id="topbar-context"></div>
        </header>
        <main class="view" id="view-root"></main>
        <nav class="bottom-nav" id="bottom-nav"></nav>
      </div>
    </div>
    <div id="toast-host" class="toast-host"></div>
  `;

  const navHTML = Object.entries(ROUTES).map(([hash, r]) =>
    `<a href="${hash}" class="nav-link" data-hash="${hash}"><span class="nav-link__icon">${r.icon}</span>${r.title}</a>`).join('');
  document.getElementById('nav-links').innerHTML = navHTML;

  const bottomHTML = ['#/dashboard', '#/notas', '#/deveres', '#/calendario', '#/desempenho']
    .map((hash) => `<a href="${hash}" class="bottom-nav__link" data-hash="${hash}"><span>${ROUTES[hash].icon}</span></a>`).join('');
  document.getElementById('bottom-nav').innerHTML = bottomHTML;

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('is-open');
  });
  document.getElementById('view-root').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('is-open');
  });
}

function renderContextSelector() {
  const d = db.getData();
  const host = document.getElementById('context-selector');
  const topbar = document.getElementById('topbar-context');
  const schoolOptions = d.schools.map((s) => `<option value="${s.id}" ${d.settings.selectedSchoolId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');
  const series = seriesForCurrentSchool();
  const serieOptions = series.map((s) => `<option value="${s.id}" ${d.settings.selectedSerieId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');

  const html = `
    <label class="ctx-field">
      <span>Escola</span>
      <select id="ctx-school">${d.schools.length ? schoolOptions : '<option value="">Nenhuma cadastrada</option>'}</select>
    </label>
    <label class="ctx-field">
      <span>Série</span>
      <select id="ctx-serie">${series.length ? serieOptions : '<option value="">Nenhuma cadastrada</option>'}</select>
    </label>
  `;
  host.innerHTML = html;
  topbar.innerHTML = d.schools.length
    ? `<strong>${escapeHTML(d.schools.find((s) => s.id === d.settings.selectedSchoolId)?.name || 'Selecione uma escola')}</strong>${series.length ? ' · ' + escapeHTML(series.find((s) => s.id === d.settings.selectedSerieId)?.name || 'Selecione uma série') : ''}`
    : '<em>Cadastre sua primeira escola em "Escolas"</em>';

  host.querySelector('#ctx-school')?.addEventListener('change', (e) => {
    db.setSetting('selectedSchoolId', e.target.value || null);
    db.setSetting('selectedSerieId', null);
    renderContextSelector();
    renderRoute();
  });
  host.querySelector('#ctx-serie')?.addEventListener('change', (e) => {
    db.setSetting('selectedSerieId', e.target.value || null);
    renderRoute();
  });
}

function highlightNav() {
  const hash = location.hash || '#/dashboard';
  document.querySelectorAll('.nav-link, .bottom-nav__link').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.hash === hash);
  });
}

function renderRoute() {
  const hash = ROUTES[location.hash] ? location.hash : '#/dashboard';
  if (location.hash !== hash) { location.hash = hash; return; }
  const route = ROUTES[hash];
  const root = document.getElementById('view-root');
  root.scrollTop = 0;
  route.mod.render(root);
  highlightNav();
}

function boot() {
  buildShell();
  renderContextSelector();
  renderRoute();

  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('agenda:changed', () => renderContextSelector());
  document.addEventListener('agenda:selection-changed', () => { renderContextSelector(); renderRoute(); });
}

document.addEventListener('DOMContentLoaded', boot);
