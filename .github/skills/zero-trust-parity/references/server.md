# references/server.md — серверный стандарт send.php

## Порядок защит (менять нельзя: дешёвые проверки раньше дорогих)
1. `mbstring` есть, метод POST, иначе `405 METHOD_NOT_ALLOWED`.
2. Конфиг и справочник читаются строго: нет ключа = `500 CONFIG_ERROR`, запасных значений нет.
3. Размер тела: `CONTENT_LENGTH` и фактическое чтение `max_body_bytes + 1` → `413 PAYLOAD_TOO_LARGE`.
4. Origin (если есть) строго из `allowed_hosts` конфига → `403 ORIGIN_MISMATCH`. `HTTP_HOST` не используется: его присылает клиент. Пустой `allowed_hosts` на боевом хосте блокирует все запросы с Origin, поэтому заполните его до запуска.
5. Rate-limit: файл на HMAC(IP, серверный секрет), окно 60 с, `429 RATE_LIMIT_EXCEEDED`.
6. JSON с `JSON_THROW_ON_ERROR` и глубиной 8 → `400 BAD_JSON`.
7. Honeypot (`website`) → `400 REJECTED`.
8. Валидация с накоплением кодов → `422`.
9. Серверный пересчёт, идемпотентность, атомарная запись, журнал без ПДн.

## Таблица кодов
| Код | HTTP | Причина |
|---|---|---|
| METHOD_NOT_ALLOWED | 405 | не POST |
| PAYLOAD_TOO_LARGE | 413 | тело > `max_body_bytes` |
| ORIGIN_MISMATCH | 403 | Origin не из `allowed_hosts` |
| RATE_LIMIT_EXCEEDED | 429 | больше `rate_limit_per_minute` |
| BAD_JSON / REJECTED | 400 | не JSON / honeypot |
| INVALID_NAME / PHONE / EMAIL / COMMENT / CUSTOMER | 422 | поля клиента |
| INVALID_OPTION / PAYMENT / ITEMS / QTY / REQUEST_ID | 422 | не из белого списка или вне диапазона |
| UNKNOWN_CODE | 422 | код не найден в справочнике |
| CONSENT_MISSING_<KEY> | 422 | нет конкретного обязательного согласия |
| CONFIG_ERROR / STORAGE_ERROR / SERVER_ERROR | 500 | подробности только в `error_log` |

Клиентам и в логи ответа не отдаём тексты исключений, пути и версии.

## Деньги
Только целые копейки. НДС, включённый в сумму: `intdiv(2*total*r + (100+r), 2*(100+r))` в PHP и `Math.floor(...)` в JS (half-up). Построчный НДС (если нужен чек) считается по каждой строке одной функцией, итог = сумма строк, а не НДС от общей суммы. Ставки и их даты действия лежат в конфиге, не в коде.

## Файлы и права
- `APP_STORAGE_DIR` вне веб-корня; каталоги 0750, файлы 0640, секрет 0600.
- ПДн: `pdn/<ORDER>.json` через `fopen('x')`, до 5 попыток при коллизии.
- Без ПДн: `events.jsonl` (id, суммы, флаги согласий, версия документов), `req/` (ответы для идемпотентности), `rl_*.json` (счётчики).
- Если ПДн лежат в `data/private` внутри веб-корня (только демо), закройте каталог: Apache 2.4 `Require all denied` в `.htaccess`; nginx `location ^~ /data/private { deny all; }`. `.htaccess` на nginx не работает.

## Конфиг (схема)
Обязательные ключи примера: `mode`, `legal_doc_version`, `vat_rate`, `max_qty`, `max_items`, `max_body_bytes`, `rate_limit_per_minute`, `allowed_hosts`, `required_consents`, `payment_methods`, `options`, `legal_docs`, `retention_days`. Секретов в конфиге нет: он публично доступен клиенту.

## Заголовки
`Content-Type: application/json`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `display_errors=0`, общий обработчик исключений. На боевом хосте также HSTS и CSP как HTTP-заголовки.

## Адаптация под проект
Меняются: блок валидации полей (`ADAPT: option`), справочник (`catalog.json`), формула итога (одновременно с `js/domain/totals.js`) и список ключей `totals`. Не меняются: порядок защит, атомарная запись, журнал, идемпотентность. Маркер `/*M1*/` в формуле итога сохраняйте: на нём держится `--mutate`.
