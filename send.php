<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanText(mixed $value, int $maxLength): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim(strip_tags($value));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    preg_match('/^.{0,' . $maxLength . '}/us', $value, $matches);
    return $matches[0] ?? '';
}

function csvSafe(string $value): string
{
    return preg_match('/^\s*[=+\-@]/u', $value) === 1 ? "'" . $value : $value;
}

function getSalt(string $path): string
{
    if (!is_file($path)) {
        $handle = @fopen($path, 'x');
        if ($handle !== false) {
            $salt = bin2hex(random_bytes(32));
            if (fwrite($handle, $salt) === false) {
                fclose($handle);
                respond(500, ['ok' => false, 'error' => 'Не удалось подготовить защиту формы. Попробуйте позже.']);
            }
            fflush($handle);
            if (function_exists('fsync')) {
                fsync($handle);
            }
            fclose($handle);
            @chmod($path, 0600);
        }
    }

    $salt = @file_get_contents($path);
    if (!is_string($salt) || strlen(trim($salt)) < 32) {
        respond(500, ['ok' => false, 'error' => 'Защита формы временно недоступна. Попробуйте позже.']);
    }

    return trim($salt);
}

function checkRateLimit(string $path, string $salt, string $ip): void
{
    $key = hash_hmac('sha256', $ip, $salt);
    $now = time();
    $handle = @fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        respond(500, ['ok' => false, 'error' => 'Не удалось проверить частоту заявок. Попробуйте позже.']);
    }

    $contents = stream_get_contents($handle);
    $records = $contents === '' ? [] : json_decode($contents, true);
    if (!is_array($records)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(500, ['ok' => false, 'error' => 'Хранилище ограничения заявок повреждено. Обратитесь к администратору сайта.']);
    }

    foreach ($records as $recordKey => $timestamps) {
        if (!is_array($timestamps)) {
            unset($records[$recordKey]);
            continue;
        }
        $records[$recordKey] = array_values(array_filter(
            $timestamps,
            static fn ($timestamp): bool => is_int($timestamp) && $timestamp > $now - 600
        ));
        if ($records[$recordKey] === []) {
            unset($records[$recordKey]);
        }
    }

    $recent = $records[$key] ?? [];
    if ($recent !== [] && $now - end($recent) < 15) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(429, ['ok' => false, 'error' => 'Подождите 15 секунд перед повторной отправкой.']);
    }
    if (count($recent) >= 5) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(429, ['ok' => false, 'error' => 'Достигнут лимит заявок: не более пяти за 10 минут. Попробуйте позже.']);
    }

    $records[$key][] = $now;
    rewind($handle);
    if (!ftruncate($handle, 0) || fwrite($handle, json_encode($records, JSON_UNESCAPED_SLASHES)) === false || !fflush($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(500, ['ok' => false, 'error' => 'Не удалось сохранить ограничение заявок. Попробуйте позже.']);
    }

    flock($handle, LOCK_UN);
    fclose($handle);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Поддерживаются только POST-запросы.']);
}

$rawBody = file_get_contents('php://input');
if (!is_string($rawBody) || strlen($rawBody) > 32768) {
    respond(413, ['ok' => false, 'error' => 'Размер обращения превышает допустимый.']);
}

$data = json_decode($rawBody, true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'error' => 'Не удалось прочитать данные формы. Обновите страницу и повторите отправку.']);
}

if (cleanText($data['website'] ?? '', 200) !== '') {
    respond(200, ['ok' => true]);
}

$name = cleanText($data['name'] ?? '', 80);
$phone = cleanText($data['phone'] ?? '', 32);
$message = cleanText($data['message'] ?? '', 2000);
$contactSlot = cleanText($data['contactSlot'] ?? '', 40);
$city = cleanText($data['city'] ?? '', 100);
$deadline = cleanText($data['deadline'] ?? '', 10);
$consent = ($data['consent'] ?? false) === true;
$docType = cleanText($data['docType'] ?? '', 40);
$category = cleanText($data['disputeCategory'] ?? '', 40);
$format = cleanText($data['workFormat'] ?? '', 40);
$urgency = cleanText($data['urgency'] ?? '', 40);

if (!$consent) {
    respond(400, ['ok' => false, 'error' => 'Необходимо согласие на обработку персональных данных.']);
}
if ($name === '' || $phone === '') {
    respond(400, ['ok' => false, 'error' => 'Укажите имя и телефон для связи.']);
}
if (preg_match('/^\+7\d{10}$/', preg_replace('/[\s()\-]/', '', $phone) ?? '') !== 1) {
    respond(400, ['ok' => false, 'error' => 'Укажите корректный российский номер телефона.']);
}
if ($deadline !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline) !== 1) {
    respond(400, ['ok' => false, 'error' => 'Проверьте формат даты процессуального срока.']);
}
if ($deadline !== '') {
    $parsedDeadline = DateTimeImmutable::createFromFormat('!Y-m-d', $deadline);
    if (!$parsedDeadline || $parsedDeadline->format('Y-m-d') !== $deadline) {
        respond(400, ['ok' => false, 'error' => 'Укажите существующую дату процессуального срока.']);
    }
}

$basePrices = [
    'order_cancel' => 3000,
    'koap_kas' => 5000,
    'claim' => 7000,
    'objection' => 7000,
    'appeal' => 10000,
];
$categoryMultipliers = [
    'debt_contract' => 1.0,
    'consumer' => 1.0,
    'auto_fssp' => 1.1,
    'family_inherit' => 1.15,
    'realty_land' => 1.25,
    'arbitration' => 1.4,
];
$formatAddons = [
    'doc_only' => 0,
    'doc_filing' => 2500,
    'turnkey_irkutsk' => 15000,
];
$urgencyMultipliers = [
    'standard' => 1.0,
    'urgent' => 1.3,
];

if (!isset($basePrices[$docType], $categoryMultipliers[$category], $formatAddons[$format], $urgencyMultipliers[$urgency])) {
    respond(400, ['ok' => false, 'error' => 'Выберите допустимые параметры документа, категории, формата и срочности.']);
}

$docCost = (int) (round(($basePrices[$docType] * $categoryMultipliers[$category]) / 100) * 100);
$subtotal = $docCost + $formatAddons[$format];
$serverTotal = (int) (round(($subtotal * $urgencyMultipliers[$urgency]) / 100) * 100);
$priority = $urgency === 'urgent' ? '[СРОЧНО]' : '[ШТАТНО]';

$dataDirectory = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDirectory) || !is_writable($dataDirectory)) {
    respond(500, ['ok' => false, 'error' => 'Хранилище обращений временно недоступно. Попробуйте позже.']);
}

$salt = getSalt($dataDirectory . DIRECTORY_SEPARATOR . '.salt');
$ip = cleanText($_SERVER['REMOTE_ADDR'] ?? 'unknown', 64);
checkRateLimit($dataDirectory . DIRECTORY_SEPARATOR . '.rate-limit.json', $salt, $ip);

$csvPath = $dataDirectory . DIRECTORY_SEPARATOR . 'orders.csv';
$csv = @fopen($csvPath, 'c+');
if ($csv === false || !flock($csv, LOCK_EX)) {
    if (is_resource($csv)) {
        fclose($csv);
    }
    respond(500, ['ok' => false, 'error' => 'Не удалось сохранить обращение. Попробуйте позже.']);
}

if (fseek($csv, 0, SEEK_END) !== 0) {
    flock($csv, LOCK_UN);
    fclose($csv);
    respond(500, ['ok' => false, 'error' => 'Не удалось подготовить журнал обращений.']);
}
if (ftell($csv) === 0) {
    if (fwrite($csv, "\xEF\xBB\xBF") === false ||
        fputcsv($csv, ['Дата UTC', 'Приоритет', 'Имя', 'Телефон', 'Город / суд', 'Время связи Иркутск', 'Документ', 'Категория', 'Формат', 'Срочность', 'Крайний срок', 'Расчет сервера ₽', 'Описание'], ',', '"', '') === false) {
        flock($csv, LOCK_UN);
        fclose($csv);
        respond(500, ['ok' => false, 'error' => 'Не удалось создать журнал обращений.']);
    }
}

$row = [
    gmdate('c'),
    $priority,
    csvSafe($name),
    csvSafe($phone),
    csvSafe($city),
    csvSafe($contactSlot),
    $docType,
    $category,
    $format,
    $urgency,
    $deadline,
    (string) $serverTotal,
    csvSafe($message),
];
$written = fputcsv($csv, $row, ',', '"', '');
$flushed = fflush($csv);
flock($csv, LOCK_UN);
fclose($csv);
if ($written === false || !$flushed) {
    respond(500, ['ok' => false, 'error' => 'Не удалось завершить запись обращения. Попробуйте позже.']);
}

@chmod($csvPath, 0600);
respond(200, ['ok' => true, 'serverTotal' => $serverTotal, 'priority' => $priority]);
