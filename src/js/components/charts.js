// charts.js — wrapper fino sobre Chart.js (carregado via CDN no index.html).
// Mantém uma referência por canvas para poder destruir/recriar sem vazar memória.

const instances = new Map();

const PALETTE_GRID = 'rgba(43,43,61,0.08)';
const INK = '#2B2B3D';

function baseOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: INK, font: { family: 'Inter, sans-serif' } } },
    },
    scales: {
      x: { grid: { color: PALETTE_GRID }, ticks: { color: INK } },
      y: { grid: { color: PALETTE_GRID }, ticks: { color: INK } },
    },
  }, extra);
}

export function renderLineChart(canvas, { labels, datasets }, opts = {}) {
  destroy(canvas);
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: datasets.map(ds => ({ tension: 0.35, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, ...ds })) },
    options: baseOptions({ scales: { y: { min: 0, max: 10, grid: { color: PALETTE_GRID }, ticks: { color: INK } }, x: { grid: { display: false }, ticks: { color: INK } } }, ...opts }),
  });
  instances.set(canvas, chart);
  return chart;
}

export function renderBarChart(canvas, { labels, datasets }, opts = {}) {
  destroy(canvas);
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: datasets.map(ds => ({ borderRadius: 6, maxBarThickness: 42, ...ds })) },
    options: baseOptions({ scales: { y: { min: 0, max: 10, grid: { color: PALETTE_GRID }, ticks: { color: INK } }, x: { grid: { display: false }, ticks: { color: INK } } }, ...opts }),
  });
  instances.set(canvas, chart);
  return chart;
}

export function destroy(canvas) {
  const existing = instances.get(canvas);
  if (existing) { existing.destroy(); instances.delete(canvas); }
}
