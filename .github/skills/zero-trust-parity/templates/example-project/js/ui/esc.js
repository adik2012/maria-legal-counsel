const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Экранирование для вставки в innerHTML. Любая динамическая переменная — только через esc(). */
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => MAP[c]);
}
