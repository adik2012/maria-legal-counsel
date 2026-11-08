<?php
declare(strict_types=1);

/**
 * send.php — шаблон Zero-Trust обработчика (skill: zero-trust-parity v2.0).
 * Совместим с PHP 8.0+. Маркеры ADAPT показывают, что менять в проекте.
 * Деньги — только целые копейки. Тарифы/лимиты/ставки — только из data/app.json.
 */

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_JSON_DEPTH = 8;

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string ...$codes): void
{
    respond($status, ['ok' => false, 'errors' => array_values(array_unique($codes))]);
}

set_exception_handler(function (Throwable $e): void {
    error_log('send.php: ' . $e->getMessage());
    fail(500, 'SERVER_ERROR');
});

// ── 1. Окружение, метод ─────────────────────────────────────────────────────
if (!extension_loaded('mbstring')) {
    error_log('send.php: mbstring extension is required');
    fail(500, 'SERVER_ERROR');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'METHOD_NOT_ALLOWED');
}

// ── 2. Конфиг: отсутствующий ключ = 500, запасных значений нет ──────────────
$cfg = json_decode((string)@file_get_contents(__DIR__ . '/data/app.json'), true);
$catalog = json_decode((string)@file_get_contents(__DIR__ . '/data/catalog.json'), true); // ADAPT: ваш справочник
if (!is_array($cfg) || !is_array($catalog)) {
    error_log('send.php: config/catalog unreadable');
    fail(500, 'CONFIG_ERROR');
}
function cfg(string $key)
{
    global $cfg;
    if (!array_key_exists($key, $cfg)) {
        error_log("send.php: config key missing: $key");
        fail(500, 'CONFIG_ERROR');
    }
    return $cfg[$key];
}

// В бою APP_STORAGE_DIR указывает ВНЕ веб-корня. Права: каталоги 0750, файлы 0640.
define('STORAGE_DIR', getenv('APP_STORAGE_DIR') ?: (__DIR__ . '/data/private'));
if (!is_dir(STORAGE_DIR)) {
    @mkdir(STORAGE_DIR, 0750, true);
}

// ── 3. Размер тела, Origin, rate-limit ──────────────────────────────────────
$maxBody = (int)cfg('max_body_bytes');
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $maxBody) {
    fail(413, 'PAYLOAD_TOO_LARGE');
}
$raw = (string)file_get_contents('php://input', false, null, 0, $maxBody + 1);
if (strlen($raw) > $maxBody) {
    fail(413, 'PAYLOAD_TOO_LARGE');
}

$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $host = parse_url($origin, PHP_URL_HOST);
    $allowed = array_map('strtolower', (array)cfg('allowed_hosts')); // НЕ сравниваем с HTTP_HOST: он приходит от клиента
    if (!is_string($host) || !in_array(strtolower($host), $allowed, true)) {
        fail(403, 'ORIGIN_MISMATCH');
    }
}

if (!empty($_SERVER['REMOTE_ADDR'])) {
    $secretFile = STORAGE_DIR . '/.secret';
    if (!is_file($secretFile)) {
        @file_put_contents($secretFile, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($secretFile, 0600);
    }
    // HMAC с серверным секретом: IP — это ПДн, голый sha256 по IPv4 обратим перебором.
    $key = substr(hash_hmac('sha256', (string)$_SERVER['REMOTE_ADDR'], (string)@file_get_contents($secretFile)), 0, 24);
    $fh = @fopen(STORAGE_DIR . "/rl_$key.json", 'c+');
    if ($fh !== false) {
        flock($fh, LOCK_EX);
        $times = json_decode((string)stream_get_contents($fh), true);
        $now = time();
        $times = array_values(array_filter(is_array($times) ? $times : [], fn($t) => is_int($t) && $t > $now - 60));
        if (count($times) >= (int)cfg('rate_limit_per_minute')) {
            flock($fh, LOCK_UN);
            fclose($fh);
            fail(429, 'RATE_LIMIT_EXCEEDED');
        }
        $times[] = $now;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($times));
        fflush($fh);
        flock($fh, LOCK_UN);
        fclose($fh);
    }
    if (random_int(1, 100) === 1) { // редкая уборка устаревших счётчиков
        foreach (glob(STORAGE_DIR . '/rl_*.json') ?: [] as $f) {
            if (filemtime($f) < time() - 3600) {
                @unlink($f);
            }
        }
    }
}

// ── 4. Разбор JSON, honeypot ────────────────────────────────────────────────
try {
    $payload = json_decode($raw, true, MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    fail(400, 'BAD_JSON');
}
if (!is_array($payload)) {
    fail(400, 'BAD_JSON');
}
if (!empty($payload['website'])) { // антиспам-поле (скрытое в форме)
    fail(400, 'REJECTED');
}

// ── 5. Валидация: белые списки, без подстановок по умолчанию ────────────────
$errors = [];
$okStr = fn($v, int $min, int $max): bool => is_string($v) && mb_strlen($v) >= $min && mb_strlen($v) <= $max;

$cust = $payload['customer'] ?? null;
if (!is_array($cust)) {
    $errors[] = 'INVALID_CUSTOMER';
    $cust = [];
}
if (!$okStr($cust['name'] ?? null, 2, 100)) { $errors[] = 'INVALID_NAME'; }
if (!is_string($cust['phone'] ?? null) || !preg_match('/^\+?[0-9()\s-]{10,20}$/', $cust['phone'])) { $errors[] = 'INVALID_PHONE'; }
// Email: без < > " ' ` и пробелов (осознанный компромисс: отсекает редкие адреса вида o'brien@…).
if (!is_string($cust['email'] ?? null) || strlen($cust['email']) > 254
    || !preg_match('/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/', $cust['email'])) { $errors[] = 'INVALID_EMAIL'; }
if (isset($cust['comment']) && !$okStr($cust['comment'], 0, 1000)) { $errors[] = 'INVALID_COMMENT'; }

$optionKey = $payload['option'] ?? null; // ADAPT: ваш переключатель (доставка/тариф/режим)
$options = (array)cfg('options');
if (!is_string($optionKey) || !array_key_exists($optionKey, $options)) { $errors[] = 'INVALID_OPTION'; }

$payment = $payload['payment'] ?? null;
if (!is_string($payment) || !in_array($payment, (array)cfg('payment_methods'), true)) { $errors[] = 'INVALID_PAYMENT'; }

$consents = is_array($payload['consents'] ?? null) ? $payload['consents'] : [];
foreach ((array)cfg('required_consents') as $c) { // каждое согласие проверяется отдельно
    if (($consents[$c] ?? false) !== true) { $errors[] = 'CONSENT_MISSING_' . strtoupper((string)$c); }
}

$requestId = $payload['request_id'] ?? null;
if ($requestId !== null && (!is_string($requestId) || !preg_match('/^[A-Za-z0-9-]{8,64}$/', $requestId))) { $errors[] = 'INVALID_REQUEST_ID'; }

$maxQty = (int)cfg('max_qty');
$items = $payload['items'] ?? null;
$merged = [];
if (!is_array($items) || $items !== array_values($items) || count($items) < 1 || count($items) > (int)cfg('max_items')) {
    $errors[] = 'INVALID_ITEMS';
} else {
    foreach ($items as $row) {
        if (!is_array($row)) { $errors[] = 'INVALID_ITEMS'; continue; }
        $code = $row['code'] ?? null;
        $qty = $row['qty'] ?? null;
        if (!is_string($code) || !preg_match('/^[A-Za-z0-9._-]{1,40}$/', $code) || !isset($catalog[$code])) { $errors[] = 'UNKNOWN_CODE'; continue; }
        // row['client_price'] / client_total НЕ читаются: цену знает только сервер.
        if (!is_int($qty) || $qty < 1 || $qty > $maxQty) { $errors[] = 'INVALID_QTY'; continue; }
        $merged[$code] = ($merged[$code] ?? 0) + $qty;
        if ($merged[$code] > $maxQty) { $errors[] = 'INVALID_QTY'; }
    }
}
if ($errors) {
    fail(422, ...$errors);
}

// ── 6. Серверный пересчёт (ADAPT: паритет с js/domain/totals.js) ────────────
$goods = 0;
foreach ($merged as $code => $qty) {
    $goods += (int)$catalog[$code]['price_kop'] * $qty;
}
$fee = (int)$options[$optionKey]['fee_kop'];
$grand = $goods + $fee /*M1*/;
$rate = (int)cfg('vat_rate');
$vat = intdiv(2 * $grand * $rate + (100 + $rate), 2 * (100 + $rate)); // half-up, целочисленно
$totals = ['goods_kop' => $goods, 'fee_kop' => $fee, 'grand_kop' => $grand, 'vat_kop' => $vat];

// ── 7. Идемпотентность по request_id ────────────────────────────────────────
$reqDir = STORAGE_DIR . '/req';
$reqFile = $requestId !== null ? $reqDir . '/' . substr(hash('sha256', $requestId), 0, 32) . '.json' : null;
if ($reqFile !== null && is_file($reqFile)) {
    $prev = json_decode((string)file_get_contents($reqFile), true);
    if (is_array($prev)) {
        respond(200, $prev + ['duplicate' => true]);
    }
}

// ── 8. Атомарная запись ПДн (fopen 'x', до 5 попыток) ───────────────────────
$pdnDir = STORAGE_DIR . '/pdn';
foreach ([$pdnDir, $reqDir] as $d) {
    if (!is_dir($d)) { @mkdir($d, 0750, true); }
}
$docVersion = (string)cfg('legal_doc_version'); // всегда серверная; значение клиента игнорируется
$docHashes = [];
foreach ((array)cfg('legal_docs') as $name => $rel) {
    $p = __DIR__ . '/' . $rel;
    $docHashes[$name] = is_file($p) ? hash_file('sha256', $p) : null;
}
$now = gmdate('c');

$orderId = null;
for ($try = 0; $try < 5 && $orderId === null; $try++) {
    $candidate = 'ORD-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $h = @fopen($pdnDir . '/' . $candidate . '.json', 'x');
    if ($h === false) { continue; } // коллизия: чужой файл не перезаписываем
    fwrite($h, json_encode([
        'order_number' => $candidate, 'created_at' => $now,
        'customer' => ['name' => $cust['name'], 'phone' => $cust['phone'], 'email' => $cust['email'], 'comment' => $cust['comment'] ?? ''],
        'option' => $optionKey, 'payment' => $payment, 'items' => $merged, 'totals' => $totals,
        'consents' => $consents, 'doc_version' => $docVersion, 'docs_sha256' => $docHashes,
    ], JSON_UNESCAPED_UNICODE));
    fclose($h);
    @chmod($pdnDir . '/' . $candidate . '.json', 0640);
    $orderId = $candidate;
}
if ($orderId === null) {
    error_log('send.php: could not allocate order id');
    fail(500, 'STORAGE_ERROR');
}

// Журнал событий — БЕЗ ПДн (только id, суммы, флаги согласий, версия документов).
@file_put_contents(STORAGE_DIR . '/events.jsonl', json_encode([
    'ts' => $now, 'order_number' => $orderId, 'grand_kop' => $grand, 'items' => count($merged),
    'doc_version' => $docVersion, 'consents' => array_map(fn($v) => $v === true, $consents),
], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

$response = ['ok' => true, 'order_number' => $orderId, 'totals' => $totals];
if ($reqFile !== null) {
    @file_put_contents($reqFile, json_encode($response), LOCK_EX);
}
respond(200, $response);
