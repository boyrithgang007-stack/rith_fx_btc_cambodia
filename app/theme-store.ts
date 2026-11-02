export type AppTheme = "light" | "dark";
export const THEME_KEY = "market-theme";
let fallback: AppTheme = "light";

export function readAppTheme(): AppTheme {
  try { return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
  catch { return fallback; }
}
export function serverAppTheme(): AppTheme { return "light"; }
export function setAppTheme(theme: AppTheme) {
  if (theme !== "light" && theme !== "dark") return;
  fallback = theme;
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* The selection still works for this tab. */ }
  window.dispatchEvent(new CustomEvent("market-storage-change", { detail: THEME_KEY }));
}
export function toggleAppTheme() { setAppTheme(readAppTheme() === "dark" ? "light" : "dark"); }
export function subscribeAppTheme(callback: () => void) {
  const onStorage = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== null && event.key !== THEME_KEY) return;
    callback();
  };
  const onLocal = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === THEME_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("market-storage-change", onLocal);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("market-storage-change", onLocal); };
}
