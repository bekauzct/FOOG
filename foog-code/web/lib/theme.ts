'use client';
export type Theme = 'dark' | 'light';
export const getTheme = (): Theme => {
  try { return (localStorage.getItem('foog-theme') as Theme) || 'dark'; } catch { return 'dark'; }
};
export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('foog-theme', t); } catch { /* xususiy rejim */ }
  window.dispatchEvent(new CustomEvent('foog-theme', { detail: t }));
}
/** <head> da bo‘yashdan oldin ishlaydi – oq chaqnashsiz */
export const themeScript = `try{var t=localStorage.getItem('foog-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;
