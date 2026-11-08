#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calcCase4Price } from "../js/domain/case4-pricing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const countArg = argv.find((argument) => /^\d+$/.test(argument));
const N = countArg ? Number(countArg) : 300;
const SECURITY = argv.includes("--security");
const MUTATE = argv.includes("--mutate");
const SANDBOX_FILES = ["send.php", "data/app.json"];
const MUTATION = { marker: "/*M1*/", replacement: " + 1" };
const TOTAL_KEYS = ["document_kop", "format_kop", "subtotal_kop", "total_kop"];
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const cfg = readJson("data/app.json");
const codes = Object.keys(cfg.calculator.base_price_kop);
const categoryCodes = Object.keys(cfg.calculator.category_multiplier);
const urgencyCodes = Object.keys(cfg.calculator.urgency_multiplier);
const workFormats = Object.keys(cfg.options);
let requestSequence = 0;
let ipSequence = 0;

const nextRequestId = () => {
  requestSequence++;
  return `00000000-0000-4000-8000-${requestSequence.toString(16).padStart(12, "0")}`;
};
const baseRequest = () => ({
  customer: {
    name: "Тест Тестов",
    phone: "+79991234567",
    email: "a@b.ru",
    comment: ""
  },
  city: "Иркутск",
  contact_slot: cfg.time_slots[0].value,
  deadline: "",
  disputeCategory: categoryCodes[0],
  workFormat: workFormats[0],
  urgency: urgencyCodes[0],
  items: [{ code: codes[0], qty: 1 }],
  request_id: nextRequestId(),
  consents: Object.fromEntries(cfg.required_consents.map((consent) => [consent, true]))
});

let failures = 0;
const fail = (message) => { failures++; console.log(`  [FAIL] ${message}`); };
const pass = (message) => console.log(`  [OK  ] ${message}`);

function makeSandbox(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "case4-zt-"));
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "case4-zt-storage-"));
  for (const relativePath of SANDBOX_FILES) {
    const destination = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relativePath), destination);
  }

  const sandboxConfigPath = path.join(dir, "data", "app.json");
  const sandboxConfig = JSON.parse(fs.readFileSync(sandboxConfigPath, "utf8"));
  sandboxConfig.mode = "live";
  sandboxConfig.allowed_hosts = ["case4.example.test"];
  fs.writeFileSync(sandboxConfigPath, JSON.stringify(sandboxConfig, null, 2));

  let source = fs.readFileSync(path.join(dir, "send.php"), "utf8");
  if (!source.includes("php://input")) throw new Error("send.php не использует php://input; тестовая подмена невозможна");
  source = source.replaceAll("php://input", "php://stdin");
  if (mutation) {
    if (!source.includes(MUTATION.marker)) throw new Error(`В send.php нет маркера ${MUTATION.marker}`);
    source = source.replace(MUTATION.marker, MUTATION.replacement);
  }
  fs.writeFileSync(path.join(dir, "send.php"), source);
  fs.writeFileSync(
    path.join(dir, "pre.php"),
    '<?php $s=json_decode(getenv("T_SERVER")?:"{}",true)?:[]; $_SERVER["REQUEST_METHOD"]="POST";' +
      'foreach($s as $k=>$v){ if($v===null){unset($_SERVER[$k]);} else {$_SERVER[$k]=$v;} }'
  );
  return { dir, storage };
}

function cleanupSandbox(sandbox) {
  fs.rmSync(sandbox.dir, { recursive: true, force: true });
  fs.rmSync(sandbox.storage, { recursive: true, force: true });
}

function nextTestIp() {
  const thirdOctet = Math.floor(ipSequence / 250);
  const fourthOctet = (ipSequence % 250) + 1;
  ipSequence++;
  return `198.51.${thirdOctet}.${fourthOctet}`;
}

function run(sandbox, input, server = {}, rawBody = null) {
  const serverEnvironment = {
    REMOTE_ADDR: nextTestIp(),
    HTTP_ORIGIN: "https://case4.example.test",
    ...server
  };
  const processResult = spawnSync("php", ["-d", "auto_prepend_file=pre.php", "send.php"], {
    cwd: sandbox.dir,
    input: rawBody ?? JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      APP_STORAGE_DIR: sandbox.storage,
      T_SERVER: JSON.stringify(serverEnvironment)
    }
  });
  if (processResult.error) throw new Error(`php-cli недоступен: ${processResult.error.message}`);
  let body = null;
  try {
    body = JSON.parse(processResult.stdout);
  } catch {
    // Keep raw output for the diagnostic below.
  }
  return { body, stdout: processResult.stdout, stderr: processResult.stderr };
}

let seed = 12345;
const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (values) => values[Math.floor(random() * values.length)];

function randomCase() {
  const count = 1 + Math.floor(random() * 4);
  const items = Array.from({ length: count }, () => ({
    code: pick(codes),
    qty: 1 + Math.floor(random() * 5)
  }));
  return {
    ...baseRequest(),
    items,
    disputeCategory: pick(categoryCodes),
    workFormat: pick(workFormats),
    urgency: pick(urgencyCodes)
  };
}

function expectedTotals(request) {
  const totals = calcCase4Price(cfg, request);
  return {
    document_kop: totals.documentCostKop,
    format_kop: totals.formatAddonKop,
    subtotal_kop: totals.subtotalKop,
    total_kop: totals.totalKop
  };
}

function parity(sandbox, count) {
  const orders = new Set();
  let mismatches = 0;
  for (let index = 0; index < count; index++) {
    const request = randomCase();
    const expected = expectedTotals(request);
    const result = run(sandbox, request);
    if (!result.body?.ok) {
      mismatches++;
      if (mismatches <= 3) {
        console.log(`    #${index}: сервер отклонил запрос: ${(result.stdout || result.stderr).slice(0, 180)}`);
      }
      continue;
    }
    orders.add(result.body.order_number);
    for (const key of TOTAL_KEYS) {
      if (expected[key] !== result.body.totals?.[key]) {
        mismatches++;
        if (mismatches <= 3) console.log(`    #${index} ${key}: JS=${expected[key]} PHP=${result.body.totals?.[key]}`);
      }
    }
  }
  return { mismatches, orders };
}

if (MUTATE) {
  console.log("Мета-тест: изменяем только копию send.php; расчёт должен перестать совпадать.");
  const sandbox = makeSandbox(true);
  const { mismatches } = parity(sandbox, 30);
  cleanupSandbox(sandbox);
  if (mismatches === 0) fail("мутация формулы не обнаружена");
  else pass(`мутация обнаружена (${mismatches} расхождений)`);
  process.exit(failures ? 1 : 0);
}

const sandbox = makeSandbox(false);
console.log(`Паритет JS ⇄ PHP: ${N} случайных наборов`);
const { mismatches, orders } = parity(sandbox, N);
if (mismatches) fail(`расхождений или отказов: ${mismatches}`);
else pass("серверные totals совпали с доменным расчётом до копейки");
if (orders.size !== N) fail(`уникальных номеров заказов ${orders.size} из ${N}`);
else pass("номера заказов уникальны");

const pdnDir = path.join(sandbox.storage, "pdn");
const pdnFiles = fs.existsSync(pdnDir) ? fs.readdirSync(pdnDir) : [];
if (pdnFiles.length !== N) fail(`файлов ПДн ${pdnFiles.length}, ожидалось ${N}`);
else pass("создано по одному файлу ПДн на принятый запрос");
if (process.platform !== "win32" && pdnFiles.length) {
  const permissions = fs.statSync(path.join(pdnDir, pdnFiles[0])).mode & 0o777;
  if (permissions !== 0o640) fail(`права файла ПДн ${permissions.toString(8)}, ожидалось 640`);
  else pass("права файла ПДн — 0640");
}

if (SECURITY) {
  console.log("Проверки отказов и защит");
  const expectError = (name, code, mutate, server = {}, rawBody = null) => {
    const request = baseRequest();
    mutate?.(request);
    const result = run(sandbox, request, server, rawBody);
    if (result.body?.ok === false && result.body.errors?.includes(code)) pass(`${name} → ${code}`);
    else fail(`${name}: ожидался ${code}, получено ${(result.stdout || result.stderr).slice(0, 160)}`);
  };

  expectError("неизвестный код услуги", "UNKNOWN_CODE", (request) => { request.items = [{ code: "UNKNOWN", qty: 1 }]; });
  expectError("qty 1e9", "INVALID_QTY", (request) => { request.items[0].qty = 1e9; });
  expectError("qty отрицательный", "INVALID_QTY", (request) => { request.items[0].qty = -5; });
  expectError("qty строкой", "INVALID_QTY", (request) => { request.items[0].qty = "2"; });
  expectError("qty дробный", "INVALID_QTY", (request) => { request.items[0].qty = 1.5; });
  expectError("сумма дубликатов выше max_qty", "INVALID_QTY", (request) => {
    request.items = [{ code: codes[0], qty: cfg.max_qty }, { code: codes[0], qty: 1 }];
  });
  expectError("недопустимая категория", "INVALID_DISPUTE_CATEGORY", (request) => { request.disputeCategory = "unknown"; });
  expectError("недопустимый формат", "INVALID_WORK_FORMAT", (request) => { request.workFormat = "unknown"; });
  expectError("недопустимая срочность", "INVALID_URGENCY", (request) => { request.urgency = "unknown"; });
  expectError("недопустимый временной слот", "INVALID_CONTACT_SLOT", (request) => { request.contact_slot = "00:00–01:00"; });
  expectError("XSS в email", "INVALID_EMAIL", (request) => { request.customer.email = "<img/src=x>@example.test"; });
  expectError("email с пробелом", "INVALID_EMAIL", (request) => { request.customer.email = "a b@example.test"; });
  expectError("слишком длинный комментарий", "INVALID_COMMENT", (request) => {
    request.customer.comment = "x".repeat(cfg.max_comment_chars + 1);
  });
  expectError("consents не объект", "INVALID_CONSENTS", (request) => { request.consents = "yes"; });
  expectError("согласие вне белого списка", "INVALID_CONSENTS", (request) => { request.consents = { unexpected: true }; });
  expectError("имя выше лимита", "INVALID_NAME", (request) => { request.customer.name = "А".repeat(cfg.max_name_chars + 1); });
  expectError("чужой Origin", "ORIGIN_MISMATCH", null, { HTTP_ORIGIN: "https://evil.example.test" });
  expectError(
    "тело больше max_body_bytes",
    "PAYLOAD_TOO_LARGE",
    null,
    {},
    JSON.stringify({ ...baseRequest(), padding: "x".repeat(cfg.max_body_bytes + 1) })
  );
  expectError("honeypot", "REJECTED", (request) => { request.website = "spam"; });
  expectError("метод GET", "METHOD_NOT_ALLOWED", null, { REQUEST_METHOD: "GET" });
  expectError("битый JSON", "BAD_JSON", null, {}, "{");
  expectError("неверный request_id", "INVALID_REQUEST_ID", (request) => { request.request_id = "../bad"; });

  const ownOrigin = run(sandbox, baseRequest(), { HTTP_ORIGIN: "https://case4.example.test" });
  ownOrigin.body?.ok ? pass("разрешённый Origin принят") : fail("разрешённый Origin отклонён");

  const rateResults = [];
  for (let index = 0; index < cfg.rate_limit_per_minute + 2; index++) {
    rateResults.push(run(sandbox, baseRequest(), { REMOTE_ADDR: "203.0.113.77" }).body);
  }
  const allowedCount = rateResults.filter((body) => body?.ok).length;
  const finalRateError = rateResults.at(-1)?.errors?.[0];
  if (allowedCount === cfg.rate_limit_per_minute && finalRateError === "RATE_LIMIT_EXCEEDED") {
    pass(`rate-limit: ${allowedCount} запросов разрешены, затем отказ`);
  } else {
    fail(`rate-limit: разрешены ${allowedCount}, последний код ${finalRateError}`);
  }

  const tampered = run(sandbox, { ...baseRequest(), doc_version: "tampered-version" });
  const eventPath = path.join(sandbox.storage, "events.jsonl");
  const events = fs.readFileSync(eventPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  if (tampered.body?.ok && events.at(-1).doc_version === cfg.legal_doc_version) {
    pass("doc_version взят из серверного конфига");
  } else {
    fail("doc_version клиента принят либо запрос отклонён");
  }

  const duplicateRequest = baseRequest();
  const first = run(sandbox, duplicateRequest).body;
  const duplicate = run(sandbox, duplicateRequest).body;
  if (first?.ok && duplicate?.ok && first.order_number === duplicate.order_number && duplicate.duplicate === true) {
    pass("повтор request_id возвращает тот же заказ");
  } else {
    fail("идемпотентность не сработала");
  }

  const eventText = fs.readFileSync(eventPath, "utf8");
  if (["Тест Тестов", "+79991234567", "a@b.ru"].some((value) => eventText.includes(value))) {
    fail("в events.jsonl обнаружены персональные данные");
  } else {
    pass("events.jsonl не содержит тестовых персональных данных");
  }

  const forgedPrices = run(sandbox, {
    ...baseRequest(),
    client_price: 1,
    client_total: 1
  });
  if (forgedPrices.body?.ok && forgedPrices.body.totals.total_kop !== 1) {
    pass("переданные клиентом суммы не влияют на серверный расчёт");
  } else {
    fail("сервер принял сумму клиента или отклонил валидный расчёт");
  }
}

cleanupSandbox(sandbox);
console.log(failures ? `\nИТОГ: провалов ${failures}` : "\nИТОГ: всё зелёное");
process.exit(failures ? 1 : 0);
