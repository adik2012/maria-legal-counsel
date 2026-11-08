// ADAPT: доменная формула. Чистая функция: без window/document/localStorage/fetch.
// Деньги — ТОЛЬКО целые копейки. Округление — одна функция half-up (см. vatIncluded).
// Конфиг читаем строго: отсутствующий ключ = ошибка, а не запасное число.
export function need(cfg, key) {
  if (!(key in cfg)) throw new Error(`config key missing: ${key}`);
  return cfg[key];
}

// НДС, включённый в сумму: round_half_up(total * r / (100 + r)) целочисленно.
export function vatIncluded(totalKop, ratePct) {
  return Math.floor((2 * totalKop * ratePct + (100 + ratePct)) / (2 * (100 + ratePct)));
}

export function calcTotals(items, catalog, cfg, optionKey) {
  const merged = new Map();
  for (const it of items) merged.set(it.code, (merged.get(it.code) || 0) + it.qty);
  let goods = 0;
  for (const [code, qty] of merged) goods += catalog[code].price_kop * qty;
  const fee = need(cfg, "options")[optionKey].fee_kop;
  const grand = goods + fee;
  return { goods_kop: goods, fee_kop: fee, grand_kop: grand, vat_kop: vatIncluded(grand, need(cfg, "vat_rate")) };
}
