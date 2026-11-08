#!/usr/bin/env node
/**
 * scripts/check_static.mjs — статическая проверка правил скилла zero-trust-parity v2.0
 *   node scripts/check_static.mjs
 * Не требует php и сети. Код выхода 1, если есть ERROR. WARN — только предупреждение.
 * ADAPT: пути ниже под структуру проекта.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_DIR = "js/domain"; // ADAPT
const PHP_FILES = ["send.php"]; // ADAPT
const CONFIG_FILES = ["data/app.json"]; // ADAPT (проверяется, если файл существует)
const SKIP = new Set([".git", "node_modules", "fonts", "images", "templates", "storage"]);

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");
const read = (p) => fs.readFileSync(p, "utf8");
const all = walk(ROOT);
const byExt = (...exts) => all.filter((f) => exts.includes(path.extname(f)));
const isComment = (l) => /^\s*(\/\/|\*|\/\*|#)/.test(l);

const findings = [];
const add = (level, rule, file, line, msg) => findings.push({ level, rule, file: rel(file), line, msg });
const scan = (files, re, level, rule, msg, { skipComments = true } = {}) => {
  for (const f of files)
    read(f).split("\n").forEach((l, i) => {
      if (skipComments && isComment(l)) return;
      if (re.test(l)) add(level, rule, f, i + 1, msg + " → " + l.trim().slice(0, 110));
    });
};

const jsDomain = all.filter((f) => rel(f).startsWith(DOMAIN_DIR + "/") && f.endsWith(".js"));
const php = PHP_FILES.map((f) => path.join(ROOT, f)).filter(fs.existsSync);
const html = byExt(".html");
const clientJs = byExt(".js", ".mjs").filter((f) => !rel(f).startsWith("scripts/"));

// S1 запасные числа в формулах (|| 5000, ?? 20, ?: 31). Ноль допустим как защита от NaN/null.
scan([...jsDomain, ...php], /(\|\||\?\?|\?:)\s*-?(?!0\b)\d/, "ERROR", "S1-fallback-number", "запасное число вместо ключа конфига");
// S2 чистота доменного слоя
scan(jsDomain, /\b(window|document|localStorage|sessionStorage|fetch|navigator|location)\b/, "ERROR", "S2-domain-purity", "доменный слой трогает браузерное API");
// S3 внешние шрифты и CDN
scan([...html, ...byExt(".css"), ...clientJs], /fonts\.(googleapis|gstatic)\.com/, "ERROR", "S3-external-fonts", "внешние шрифты (утечка IP посетителя)", { skipComments: false });
scan([...html, ...clientJs], /(cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)/, "WARN", "S3-cdn", "внешний CDN (CSP script-src 'self' его заблокирует)");
// S4 CSP во всех html
for (const f of html) if (!/Content-Security-Policy/i.test(read(f))) add("ERROR", "S4-csp", f, 1, "нет meta Content-Security-Policy");
// S5 server читает цену клиента
scan(php, /\[\s*['"]client_(price|total|sum|amount)['"]\s*\]/, "ERROR", "S5-client-price", "сервер читает значение, присланное клиентом");
// S6 ПДн в браузерном хранилище
scan(clientJs, /(local|session)Storage\.setItem\(\s*[^,)]*(name|fio|phone|tel|e-?mail|address|inn|passport|snils)[^,)]*,/i, "ERROR", "S6-pii-storage", "возможное сохранение ПДн в браузерное хранилище");
// S7 innerHTML с подстановкой без esc (построчная эвристика)
scan(clientJs, /(innerHTML|insertAdjacentHTML)[^\n]*\$\{(?![^}]*esc\()/, "WARN", "S7-innerhtml", "подстановка в innerHTML без esc() в той же строке");
// S8 обязательные элементы серверной части. Проверяются по ОБЪЕДИНЕНИЮ PHP_FILES (защиты могут жить в server/lib/bootstrap.php).
if (php.length) {
  const t = php.map(read).join("\n");
  const need = [
    [/declare\(strict_types=1\)/, "declare(strict_types=1)"],
    [/extension_loaded\(\s*['"]mbstring['"]\s*\)/, "проверка mbstring"],
    [/random_bytes\(/, "random_bytes для идентификаторов"],
    [/fopen\([^;]*['"]x['"]\s*\)/, "атомарная запись fopen(..., 'x')"],
    [/JSON_THROW_ON_ERROR/, "json_decode с JSON_THROW_ON_ERROR"],
    [/APP_STORAGE_DIR/, "STORAGE_DIR через APP_STORAGE_DIR"],
    [/hash_hmac\(/, "HMAC для хэша IP"],
    [/X-Content-Type-Options/, "заголовок X-Content-Type-Options"],
  ];
  for (const [re, name] of need) if (!re.test(t)) add("ERROR", "S8-send-php", php[0], 1, "в серверной части нет: " + name);
  if (/display_errors['"]?\s*,\s*['"]?1/.test(t)) add("ERROR", "S8-send-php", php[0], 1, "display_errors включён");
}
// S9 конфиг
for (const c of CONFIG_FILES) {
  const p = path.join(ROOT, c);
  if (!fs.existsSync(p)) continue;
  const cfg = JSON.parse(read(p));
  for (const k of ["mode", "legal_doc_version"]) if (!(k in cfg)) add("ERROR", "S9-config", p, 1, `нет ключа ${k}`);
  if (cfg.mode === "live") add("WARN", "S9-config", p, 1, 'в репозитории mode="live": на публичной витрине должно быть "demo"');
}

for (const f of findings) console.log(`${f.level.padEnd(5)} ${f.rule.padEnd(20)} ${f.file}:${f.line}  ${f.msg}`);
const errors = findings.filter((f) => f.level === "ERROR").length;
console.log(`\ncheck_static: ERROR ${errors}, WARN ${findings.length - errors}`);
process.exit(errors ? 1 : 0);
