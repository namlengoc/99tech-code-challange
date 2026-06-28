const STORAGE_KEY = 'problem2_theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme() {
  if (document.documentElement.getAttribute('data-theme')) return;

  const stored = localStorage.getItem(STORAGE_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(stored || (prefersLight ? 'light' : 'dark'));
}
