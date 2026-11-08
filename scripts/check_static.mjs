#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_DIR = "js/domain";
const PHP_FILES = ["send.php"];
const CONFIG_FILES = ["data/app.json"];
const SKIP = new Set([
  ".git",
  ".github",
  ".claude",
  "node_modules",
  "fonts",
  "images",
  "templates",
  "storage"
]);

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else out.push(file);
  }
  return out;
};
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/");
const read = (file) => fs.readFileSync(file, "utf8");
const all = walk(ROOT);
const byExt = (...extensions) => all.filter((file) => extensions.includes(path.extname(file)));
const isComment = (line) => /^\s*(\/\/|\*|\/\*|#)/.test(line);

const findings = [];
const add = (level, rule, file, line, message) => findings.push({ level, rule, file: rel(file), line, message });
const scan = (files, expression, level, rule, message, { skipComments = true } = {}) => {
  for (const file of files) {
    read(file).split("\n").forEach((line, index) => {
      if (skipComments && isComment(line)) return;
      if (expression.test(line)) {
        add(level, rule, file, index + 1, `${message} → ${line.trim().slice(0, 110)}`);
      }
    });
  }
};

const jsDomain = all.filter((file) => rel(file).startsWith(`${DOMAIN_DIR}/`) && file.endsWith(".js"));
const php = PHP_FILES.map((file) => path.join(ROOT, file)).filter(fs.existsSync);
const html = byExt(".html");
const clientJs = byExt(".js", ".mjs").filter((file) => !rel(file).startsWith("scripts/"));

scan([...jsDomain, ...php], /(\|\||\?\?|\?:)\s*-?(?!0\b)\d/, "ERROR", "S1-fallback-number", "запасное число вместо ключа конфига");
scan(jsDomain, /\b(window|document|localStorage|sessionStorage|fetch|navigator|location)\b/, "ERROR", "S2-domain-purity", "доменный слой трогает браузерное API");
scan([...html, ...byExt(".css"), ...clientJs], /fonts\.(googleapis|gstatic)\.com/, "ERROR", "S3-external-fonts", "внешние шрифты (утечка IP посетителя)", { skipComments: false });
scan([...html, ...clientJs], /(cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)/, "WARN", "S3-cdn", "внешний CDN (CSP script-src 'self' его заблокирует)");

for (const file of html) {
  if (!/Content-Security-Policy/i.test(read(file))) add("ERROR", "S4-csp", file, 1, "нет meta Content-Security-Policy");
}

scan(php, /\[\s*['"]client_(price|total|sum|amount)['"]\s*\]/, "ERROR", "S5-client-price", "сервер читает значение, присланное клиентом");
scan(clientJs, /(local|session)Storage\.setItem\(\s*[^,)]*(name|fio|phone|tel|e-?mail|address|inn|passport|snils)[^,)]*,/i, "ERROR", "S6-pii-storage", "возможное сохранение ПДн в браузерное хранилище");
scan(clientJs, /(innerHTML|insertAdjacentHTML)[^\n]*\$\{(?![^}]*esc\()/, "WARN", "S7-innerhtml", "подстановка в innerHTML без esc() в той же строке");

if (php.length) {
  const source = php.map(read).join("\n");
  const required = [
    [/declare\(strict_types=1\)/, "declare(strict_types=1)"],
    [/extension_loaded\(\s*['"]mbstring['"]\s*\)/, "проверка mbstring"],
    [/random_bytes\(/, "random_bytes для идентификаторов"],
    [/fopen\([^;]*['"]x['"]\s*\)/, "атомарная запись fopen(..., 'x')"],
    [/JSON_THROW_ON_ERROR/, "JSON_THROW_ON_ERROR"],
    [/APP_STORAGE_DIR/, "хранилище через APP_STORAGE_DIR"],
    [/hash_hmac\(/, "HMAC для хэша IP"],
    [/X-Content-Type-Options/, "заголовок X-Content-Type-Options"]
  ];
  for (const [expression, label] of required) {
    if (!expression.test(source)) add("ERROR", "S8-send-php", php[0], 1, `нет: ${label}`);
  }
  if (/display_errors['"]?\s*,\s*['"]?1/.test(source)) {
    add("ERROR", "S8-send-php", php[0], 1, "display_errors включён");
  }
}

for (const configFile of CONFIG_FILES) {
  const file = path.join(ROOT, configFile);
  if (!fs.existsSync(file)) continue;
  const config = JSON.parse(read(file));
  for (const key of ["mode", "legal_doc_version"]) {
    if (!(key in config)) add("ERROR", "S9-config", file, 1, `нет ключа ${key}`);
  }
  if (config.mode === "live") {
    add("WARN", "S9-config", file, 1, 'в репозитории mode="live": публичная витрина должна оставаться в demo');
  }
}

for (const finding of findings) {
  console.log(`${finding.level.padEnd(5)} ${finding.rule.padEnd(20)} ${finding.file}:${finding.line}  ${finding.message}`);
}
const errors = findings.filter((finding) => finding.level === "ERROR").length;
console.log(`\ncheck_static: ERROR ${errors}, WARN ${findings.length - errors}`);
process.exit(errors ? 1 : 0);
