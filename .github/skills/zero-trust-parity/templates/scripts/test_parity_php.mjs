#!/usr/bin/env node
/**
 * scripts/test_parity_php.mjs — шаблон (skill: zero-trust-parity v2.0)
 *   node scripts/test_parity_php.mjs [N=300] [--security] [--mutate]
 * Запускает ВЛАДЕЛЕЦ вручную или CI. Агент Copilot этот файл создаёт, но НЕ запускает.
 * Требует php-cli с mbstring. Работает в os.tmpdir(), репозиторий не пишет.
 *
 * ADAPT: всё, что помечено «ADAPT», меняется под проект (файлы, формула, генератор кейсов).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calcTotals } from "../js/domain/totals.js"; // ADAPT: ваша доменная функция

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a))) || 300;
const SECURITY = argv.includes("--security");
const MUTATE = argv.includes("--mutate");

// ADAPT ────────────────────────────────────────────────────────────────────
const SANDBOX_FILES = ["send.php", "data/app.json", "data/catalog.json"]; // всё, что читает send.php
const MUTATION = { marker: "/*M1*/", replacement: " + 1" }; // маркер в формуле send.php (см. «M1»)
const TOTAL_KEYS = ["goods_kop", "fee_kop", "grand_kop", "vat_kop"]; // ключи response.totals
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const cfg = readJson("data/app.json");
const catalog = readJson("data/catalog.json");
const codes = Object.keys(catalog);
const optionKeys = Object.keys(cfg.options);
const baseRequest = () => ({
  customer: { name: "Тест Тестов", phone: "+79991234567", email: "a@b.ru" },
  option: optionKeys[0],
  payment: cfg.payment_methods[0],
  consents: Object.fromEntries(cfg.required_consents.map((c) => [c, true])),
  items: [{ code: codes[0], qty: 1 }],
});
// ───────────────────────────────────────────────────────────────────────────

let failures = 0;
const fail = (msg) => { failures++; console.log(`  [FAIL] ${msg}`); };
const pass = (msg) => console.log(`  [OK  ] ${msg}`);

function makeSandbox(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zt-par-"));
  for (const f of SANDBOX_FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  let src = fs.readFileSync(path.join(dir, "send.php"), "utf8");
  const n = src.split("php://input").length - 1;
  if (n < 1) throw new Error("В send.php нет 'php://input': подмена на stdin невозможна, тест был бы недействителен");
  src = src.replaceAll("php://input", "php://stdin");
  if (mutation) {
    if (!src.includes(MUTATION.marker)) throw new Error(`В send.php нет маркера ${MUTATION.marker} для --mutate`);
    src = src.replace(MUTATION.marker, MUTATION.replacement);
  }
  fs.writeFileSync(path.join(dir, "send.php"), src);
  fs.writeFileSync(
    path.join(dir, "pre.php"),
    '<?php $s=json_decode(getenv("T_SERVER")?:"{}",true)?:[]; $_SERVER["REQUEST_METHOD"]="POST";' +
      'foreach($s as $k=>$v){ if($v===null){unset($_SERVER[$k]);} else {$_SERVER[$k]=$v;} }',
  );
  const storage = path.join(dir, "storage");
  return { dir, storage };
}

function run(sb, input, server = {}, rawBody = null) {
  const p = spawnSync("php", ["-d", "auto_prepend_file=pre.php", "send.php"], {
    cwd: sb.dir,
    input: rawBody ?? JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, APP_STORAGE_DIR: sb.storage, T_SERVER: JSON.stringify(server) },
  });
  if (p.error) throw new Error("php-cli не найден: " + p.error.message);
  let body = null;
  try { body = JSON.parse(p.stdout); } catch { /* не JSON */ }
  return { body, stdout: p.stdout, stderr: p.stderr };
}

let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function randomCase() {
  const k = 1 + Math.floor(rnd() * 4);
  const items = Array.from({ length: k }, () => ({ code: pick(codes), qty: 1 + Math.floor(rnd() * 5) })); // дубли кодов допустимы
  return { ...baseRequest(), items, option: pick(optionKeys), payment: pick(cfg.payment_methods) };
}

function parity(sb, n) {
  const orders = new Set();
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = randomCase();
    const exp = calcTotals(c.items, catalog, cfg, c.option); // ADAPT: ожидаемое из клиентского домена
    const res = run(sb, c);
    if (!res.body?.ok) { bad++; if (bad <= 3) console.log(`    #${i}: сервер отклонил валидный набор: ${res.stdout.slice(0, 120)} ${res.stderr.slice(0, 120)}`); continue; }
    orders.add(res.body.order_number);
    for (const k of TOTAL_KEYS) {
      if (exp[k] !== res.body.totals[k]) { bad++; if (bad <= 3) console.log(`    #${i} ${k}: JS=${exp[k]} PHP=${res.body.totals[k]}`); }
    }
  }
  return { bad, orders };
}

// ── Мета-тест ───────────────────────────────────────────────────────────────
if (MUTATE) {
  console.log("Мета-тест (--mutate): намеренно ломаем формулу в копии send.php, тест обязан это заметить");
  const sb = makeSandbox(true);
  const { bad } = parity(sb, 30);
  fs.rmSync(sb.dir, { recursive: true, force: true });
  if (bad === 0) fail("тест СЛЕП: мутация формулы не обнаружена");
  else pass(`мутация обнаружена (${bad} расхождений)`);
  process.exit(failures ? 1 : 0);
}

const sb = makeSandbox(false);
console.log(`Паритет JS ⇄ PHP: ${N} случайных наборов`);
const { bad, orders } = parity(sb, N);
if (bad) fail(`расхождений/отказов: ${bad}`); else pass("итоги сервера совпали с клиентскими до копейки");
if (orders.size !== N) fail(`номера заказов не уникальны: ${orders.size} из ${N}`); else pass("все номера заказов уникальны");
const pdnDir = path.join(sb.storage, "pdn");
const files = fs.existsSync(pdnDir) ? fs.readdirSync(pdnDir) : [];
if (files.length !== N) fail(`файлов ПДн ${files.length}, ожидалось ${N} (перезапись?)`); else pass("файлов ПДн ровно по числу заказов");
if (process.platform !== "win32" && files.length) {
  const mode = fs.statSync(path.join(pdnDir, files[0])).mode & 0o777;
  if (mode & 0o007) fail(`права файла ПДн ${mode.toString(8)}: доступ «для всех»`); else pass(`права файла ПДн ${mode.toString(8)}`);
}
// границы округления НДС: JS и PHP на сетке сумм
{
  let diff = 0;
  for (let price = 1; price <= 400; price++) {
    // Через каталог цен нельзя задать любую сумму, поэтому гоним формулу JS и сверяем с эталоном на bigint
    const r = cfg.vat_rate;
    const ref = Number((2n * BigInt(price) * BigInt(r) + BigInt(100 + r)) / (2n * BigInt(100 + r)));
    const js = Math.floor((2 * price * r + (100 + r)) / (2 * (100 + r)));
    if (ref !== js) diff++;
  }
  if (diff) fail(`округление НДС: ${diff} расхождений с эталоном bigint`); else pass("округление НДС half-up совпадает с эталоном на 1..400 коп.");
}

if (SECURITY) {
  console.log("Проверки безопасности (ожидаются конкретные коды ошибок)");
  const maxItems = cfg.max_items;
  const maxBody = cfg.max_body_bytes;
  const expectErr = (name, code, mod, server = {}, raw = null) => {
    const req = baseRequest();
    mod?.(req);
    const res = run(sb, req, server, raw);
    if (res.body?.ok === false && res.body.errors?.includes(code)) pass(`${name} → ${code}`);
    else fail(`${name}: ожидали ${code}, получили ${res.stdout.slice(0, 140) || res.stderr.slice(0, 140)}`);
  };
  expectErr("неизвестный код + client_price=1", "UNKNOWN_CODE", (r) => { r.items = [{ code: "NOPE-0", qty: 1, client_price: 1 }]; });
  expectErr("qty = 1e9", "INVALID_QTY", (r) => { r.items[0].qty = 1e9; });
  expectErr("qty = -5", "INVALID_QTY", (r) => { r.items[0].qty = -5; });
  expectErr("qty строкой", "INVALID_QTY", (r) => { r.items[0].qty = "3"; });
  expectErr("qty дробное", "INVALID_QTY", (r) => { r.items[0].qty = 2.5; });
  expectErr("сумма дублей > max_qty", "INVALID_QTY", (r) => { r.items = [{ code: codes[0], qty: cfg.max_qty }, { code: codes[0], qty: 1 }]; });
  expectErr("мусорная опция", "INVALID_OPTION", (r) => { r.option = "<script>x</script>"; });
  expectErr("мусорная оплата", "INVALID_PAYMENT", (r) => { r.payment = "A".repeat(50); });
  expectErr("XSS в email", "INVALID_EMAIL", (r) => { r.customer.email = "<img/src=x>@a.bc"; });
  expectErr("пробел в email", "INVALID_EMAIL", (r) => { r.customer.email = "a b@c.ru"; });
  for (const c of cfg.required_consents)
    expectErr(`без согласия «${c}»`, "CONSENT_MISSING_" + c.toUpperCase(), (r) => { r.consents[c] = false; });
  expectErr("items — строка", "INVALID_ITEMS", (r) => { r.items = "x"; });
  expectErr("позиция — не массив", "INVALID_ITEMS", (r) => { r.items = ["x"]; });
  expectErr(`позиций > ${maxItems}`, "INVALID_ITEMS", (r) => { r.items = Array.from({ length: maxItems + 1 }, () => ({ code: codes[0], qty: 1 })); });
  expectErr("имя 5000 символов", "INVALID_NAME", (r) => { r.customer.name = "А".repeat(5000); });
  expectErr("чужой Origin", "ORIGIN_MISMATCH", null, { HTTP_ORIGIN: "https://evil.example" });
  expectErr("тело > max_body_bytes", "PAYLOAD_TOO_LARGE", null, {}, JSON.stringify({ ...baseRequest(), pad: "x".repeat(maxBody + 10) }));
  expectErr("honeypot", "REJECTED", (r) => { r.website = "http://spam"; });
  expectErr("метод GET", "METHOD_NOT_ALLOWED", null, { REQUEST_METHOD: "GET" });
  expectErr("битый JSON", "BAD_JSON", null, {}, "{");
  expectErr("request_id с мусором", "INVALID_REQUEST_ID", (r) => { r.request_id = "../../etc"; });

  // Положительные сценарии
  const okOrigin = run(sb, baseRequest(), { HTTP_ORIGIN: "https://" + cfg.allowed_hosts[0] });
  okOrigin.body?.ok ? pass("свой Origin принят") : fail("свой Origin отклонён: " + okOrigin.stdout.slice(0, 100));

  const rl = [];
  for (let i = 0; i < cfg.rate_limit_per_minute + 2; i++) rl.push(run(sb, baseRequest(), { REMOTE_ADDR: "203.0.113.7" }).body);
  const okCount = rl.filter((b) => b?.ok).length;
  const lastErr = rl.at(-1)?.errors?.[0];
  okCount === cfg.rate_limit_per_minute && lastErr === "RATE_LIMIT_EXCEEDED"
    ? pass(`rate-limit: ${okCount} пропущено, далее RATE_LIMIT_EXCEEDED`)
    : fail(`rate-limit: пропущено ${okCount}, последняя ошибка ${lastErr}`);

  const tampered = run(sb, { ...baseRequest(), doc_version: "v1999.01" });
  const events = fs.readFileSync(path.join(sb.storage, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  tampered.body?.ok && events.at(-1).doc_version === cfg.legal_doc_version
    ? pass("doc_version клиента проигнорирован, записана серверная")
    : fail("doc_version взят от клиента или запрос отклонён");

  const idem = { ...baseRequest(), request_id: "req-12345678-abcd" };
  const a = run(sb, idem).body, b = run(sb, idem).body;
  a?.ok && b?.ok && a.order_number === b.order_number && b.duplicate === true
    ? pass("идемпотентность: повтор request_id вернул тот же заказ")
    : fail("повтор request_id создал второй заказ");

  const evText = fs.readFileSync(path.join(sb.storage, "events.jsonl"), "utf8");
  ["Тест Тестов", "+79991234567", "a@b.ru"].some((s) => evText.includes(s))
    ? fail("в журнале событий найдены ПДн")
    : pass("журнал событий без ПДн");
}

fs.rmSync(sb.dir, { recursive: true, force: true });
console.log(failures ? `\nИТОГ: провалов ${failures}` : "\nИТОГ: всё зелёное");
process.exit(failures ? 1 : 0);
