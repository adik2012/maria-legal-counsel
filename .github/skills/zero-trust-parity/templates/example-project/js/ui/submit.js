// ADAPT: клиентская отправка. Режим «демо» по умолчанию (fail-closed): сеть вызывается только при mode === "live" и https.
import { esc } from "./esc.js";

const ERR = {
  UNKNOWN_CODE: "Позиция не найдена в каталоге",
  INVALID_QTY: "Недопустимое количество",
  INVALID_EMAIL: "Проверьте email",
  RATE_LIMIT_EXCEEDED: "Слишком много запросов, повторите через минуту",
  ORIGIN_MISMATCH: "Запрос отклонён (источник)",
  PAYLOAD_TOO_LARGE: "Слишком большой запрос",
};
const errText = (code) => ERR[code] || (code.startsWith("CONSENT_MISSING_") ? "Нужно обязательное согласие" : `Ошибка: ${code}`);

export async function submit({ cfg, payload, resultEl, button, timeoutMs = 10000 }) {
  const IS_LIVE = cfg.mode === "live" && location.protocol === "https:";
  if (!IS_LIVE) {
    // ПДн не покидают браузер: fetch не вызывается вообще.
    resultEl.innerHTML = '<p class="notice"><strong>УЧЕБНАЯ ЭМУЛЯЦИЯ:</strong> заявка не создана, данные не отправлялись.</p>';
    return { ok: false, demo: true };
  }
  const requestId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
  button.disabled = true;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch("send.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, request_id: requestId }),
      signal: ctl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.ok !== true) {
      const codes = (body && body.errors) || ["SERVER_UNAVAILABLE"];
      resultEl.innerHTML = `<ul class="errors">${codes.map((c) => `<li>${esc(errText(c))}</li>`).join("")}</ul>`;
      return { ok: false }; // форму и корзину НЕ очищаем, номер заказа НЕ выдумываем
    }
    const rub = (k) => (k / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
    resultEl.innerHTML = `<p>Заказ <b>${esc(body.order_number)}</b> принят. Итого: ${esc(rub(body.totals.grand_kop))}</p>`;
    return { ok: true, body };
  } catch {
    resultEl.innerHTML = "<p>Сервер недоступен, заказ не оформлен.</p>";
    return { ok: false };
  } finally {
    clearTimeout(timer);
    button.disabled = false;
  }
}
