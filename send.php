<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_JSON_DEPTH = 16;

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function fail(int $status, string ...$codes): void
{
    respond($status, ['ok' => false, 'errors' => array_values(array_unique($codes))]);
}

set_exception_handler(static function (Throwable $error): void {
    $message = $error->getMessage();
    error_log('send.php: ' . $message);
    if (str_starts_with($message, 'CONFIG_ERROR:')) {
        fail(500, 'CONFIG_ERROR');
    }
    if (str_starts_with($message, 'STORAGE_ERROR:')) {
        fail(500, 'STORAGE_ERROR');
    }
    fail(500, 'SERVER_ERROR');
});

function readJsonFile(string $path, string $errorCode): array
{
    $contents = file_get_contents($path);
    if (!is_string($contents)) {
        throw new RuntimeException($errorCode . ': cannot read ' . $path);
    }
    try {
        $decoded = json_decode($contents, true, MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException($errorCode . ': invalid JSON in ' . $path, 0, $error);
    }
    if (!is_array($decoded)) {
        throw new RuntimeException($errorCode . ': JSON root must be an object');
    }
    return $decoded;
}

function configValue(string $key): mixed
{
    global $config;
    if (!array_key_exists($key, $config)) {
        throw new RuntimeException('CONFIG_ERROR: missing key ' . $key);
    }
    return $config[$key];
}

function configInteger(string $key, int $minimum): int
{
    $value = configValue($key);
    if (!is_int($value) || $value < $minimum) {
        throw new RuntimeException('CONFIG_ERROR: invalid integer ' . $key);
    }
    return $value;
}

function checkedMultiply(int $left, int $right, string $label): int
{
    if ($left < 0 || $right < 0 || ($left !== 0 && $right > intdiv(PHP_INT_MAX, $left))) {
        throw new RuntimeException('SERVER_ERROR: integer overflow in ' . $label);
    }
    return $left * $right;
}

function checkedAdd(int $left, int $right, string $label): int
{
    if ($left < 0 || $right < 0 || $right > PHP_INT_MAX - $left) {
        throw new RuntimeException('SERVER_ERROR: integer overflow in ' . $label);
    }
    return $left + $right;
}

function isAbsoluteStoragePath(string $path): bool
{
    return str_starts_with($path, DIRECTORY_SEPARATOR)
        || (DIRECTORY_SEPARATOR === '\\' && preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1);
}

function roundHalfUpToIncrement(int $numerator, int $denominator, int $incrementKop): int
{
    if ($numerator < 0 || $denominator < 1 || $incrementKop < 1) {
        throw new RuntimeException('CONFIG_ERROR: invalid rounding input');
    }
    $scaledDenominator = checkedMultiply($denominator, $incrementKop, 'rounding denominator');
    $doubleNumerator = checkedMultiply($numerator, 2, 'rounding numerator');
    $halfIncrement = checkedAdd($scaledDenominator, $doubleNumerator, 'rounding numerator');
    $roundedUnits = intdiv($halfIncrement, checkedMultiply($scaledDenominator, 2, 'rounding denominator'));
    return checkedMultiply($roundedUnits, $incrementKop, 'rounded amount');
}

function ensureStorageDirectory(): string
{
    $configured = getenv('APP_STORAGE_DIR');
    if (!is_string($configured) || $configured === '' || !isAbsoluteStoragePath($configured)) {
        throw new RuntimeException('STORAGE_ERROR: APP_STORAGE_DIR must be an absolute path');
    }
    if (!is_dir($configured) && !mkdir($configured, 0750, true) && !is_dir($configured)) {
        throw new RuntimeException('STORAGE_ERROR: cannot create APP_STORAGE_DIR');
    }
    if (!chmod($configured, 0750)) {
        throw new RuntimeException('STORAGE_ERROR: cannot set APP_STORAGE_DIR permissions');
    }
    $storagePath = realpath($configured);
    $webRoot = realpath(__DIR__);
    if (!is_string($storagePath) || !is_string($webRoot)) {
        throw new RuntimeException('STORAGE_ERROR: cannot resolve storage paths');
    }
    $rootPrefix = rtrim($webRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if ($storagePath === $webRoot || str_starts_with($storagePath . DIRECTORY_SEPARATOR, $rootPrefix)) {
        throw new RuntimeException('STORAGE_ERROR: APP_STORAGE_DIR must be outside the web root');
    }
    return $storagePath;
}

function writeAll($handle, string $contents): void
{
    $offset = 0;
    $length = strlen($contents);
    while ($offset < $length) {
        $written = fwrite($handle, substr($contents, $offset));
        if ($written === false || $written === 0) {
            throw new RuntimeException('STORAGE_ERROR: incomplete file write');
        }
        $offset += $written;
    }
    if (!fflush($handle)) {
        throw new RuntimeException('STORAGE_ERROR: cannot flush file');
    }
    if (function_exists('fsync') && !fsync($handle)) {
        throw new RuntimeException('STORAGE_ERROR: cannot sync file');
    }
}

function encodeJson(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function writeExclusiveJson(string $path, array $value): bool
{
    $handle = @fopen($path, 'x');
    if ($handle === false) {
        return false;
    }
    try {
        writeAll($handle, encodeJson($value));
    } catch (Throwable $error) {
        fclose($handle);
        @unlink($path);
        throw $error;
    }
    fclose($handle);
    if (!chmod($path, 0640)) {
        @unlink($path);
        throw new RuntimeException('STORAGE_ERROR: cannot set file permissions');
    }
    return true;
}

function ensurePrivateDirectory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0750, true) && !is_dir($path)) {
        throw new RuntimeException('STORAGE_ERROR: cannot create private directory');
    }
    if (!chmod($path, 0750)) {
        throw new RuntimeException('STORAGE_ERROR: cannot set private directory permissions');
    }
}

function getRateLimitSecret(string $storageDir): string
{
    $path = $storageDir . DIRECTORY_SEPARATOR . '.secret';
    if (!is_file($path)) {
        $secret = bin2hex(random_bytes(32));
        $handle = @fopen($path, 'x');
        if ($handle !== false) {
            try {
                writeAll($handle, $secret);
            } catch (Throwable $error) {
                fclose($handle);
                @unlink($path);
                throw $error;
            }
            fclose($handle);
            if (!chmod($path, 0600)) {
                throw new RuntimeException('STORAGE_ERROR: cannot set secret permissions');
            }
        }
    }
    $secret = file_get_contents($path);
    if (!is_string($secret) || strlen($secret) !== 64 || !ctype_xdigit($secret)) {
        throw new RuntimeException('STORAGE_ERROR: invalid rate limit secret');
    }
    return $secret;
}

function checkRateLimit(string $storageDir, string $ip, string $secret, int $limit): void
{
    $key = hash_hmac('sha256', $ip, $secret);
    $path = $storageDir . DIRECTORY_SEPARATOR . 'rl_' . $key . '.json';
    $handle = @fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('STORAGE_ERROR: cannot lock rate limit file');
    }
    if (!chmod($path, 0640)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw new RuntimeException('STORAGE_ERROR: cannot set rate limit permissions');
    }
    rewind($handle);
    $contents = stream_get_contents($handle);
    try {
        $timestamps = $contents === '' ? [] : json_decode($contents, true, MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw new RuntimeException('STORAGE_ERROR: invalid rate limit data', 0, $error);
    }
    if (!is_array($timestamps) || array_values($timestamps) !== $timestamps) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw new RuntimeException('STORAGE_ERROR: invalid rate limit data');
    }
    $now = time();
    foreach ($timestamps as $timestamp) {
        if (!is_int($timestamp)) {
            flock($handle, LOCK_UN);
            fclose($handle);
            throw new RuntimeException('STORAGE_ERROR: invalid rate limit timestamp');
        }
    }
    $timestamps = array_values(array_filter($timestamps, static fn (int $timestamp): bool => $timestamp > $now - 60));
    if (count($timestamps) >= $limit) {
        flock($handle, LOCK_UN);
        fclose($handle);
        fail(429, 'RATE_LIMIT_EXCEEDED');
    }
    $timestamps[] = $now;
    rewind($handle);
    if (!ftruncate($handle, 0)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw new RuntimeException('STORAGE_ERROR: cannot truncate rate limit file');
    }
    writeAll($handle, encodeJson($timestamps));
    flock($handle, LOCK_UN);
    fclose($handle);
}

function requestString(array $payload, string $key, bool $required, int $maxLength): ?string
{
    if (!array_key_exists($key, $payload)) {
        if ($required) {
            return null;
        }
        return '';
    }
    $value = $payload[$key];
    if (!is_string($value) || mb_strlen($value, 'UTF-8') > $maxLength) {
        return null;
    }
    return trim($value);
}

function readRequiredRequestConfig(): array
{
    global $config;
    $requiredKeys = [
        'mode',
        'legal_doc_version',
        'allowed_hosts',
        'max_body_bytes',
        'rate_limit_per_minute',
        'retention_days',
        'required_consents',
        'time_slots',
        'max_qty',
        'max_items',
        'min_name_chars',
        'max_name_chars',
        'min_phone_digits',
        'max_phone_chars',
        'max_email_chars',
        'max_city_chars',
        'max_request_id_chars',
        'order_id_attempts',
        'request_id_ttl_seconds',
        'max_comment_chars',
        'vat_rate',
        'options',
        'legal_docs',
        'payment_methods',
        'calculator',
    ];
    foreach ($requiredKeys as $key) {
        if (!array_key_exists($key, $config)) {
            throw new RuntimeException('CONFIG_ERROR: missing key ' . $key);
        }
    }
    foreach (['allowed_hosts', 'required_consents', 'time_slots', 'options', 'legal_docs', 'payment_methods', 'calculator'] as $key) {
        if (!is_array($config[$key])) {
            throw new RuntimeException('CONFIG_ERROR: invalid object/list ' . $key);
        }
    }
    foreach ([
        'max_body_bytes' => 1,
        'rate_limit_per_minute' => 1,
        'retention_days' => 1,
        'max_qty' => 1,
        'max_items' => 1,
        'min_name_chars' => 1,
        'max_name_chars' => 2,
        'min_phone_digits' => 1,
        'max_phone_chars' => 1,
        'max_email_chars' => 1,
        'max_city_chars' => 1,
        'max_request_id_chars' => 36,
        'order_id_attempts' => 1,
        'request_id_ttl_seconds' => 1,
        'max_comment_chars' => 0,
        'vat_rate' => 0,
    ] as $key => $minimum) {
        configInteger($key, $minimum);
    }
    if (!is_string($config['mode']) || !in_array($config['mode'], ['demo', 'live'], true)
        || !is_string($config['legal_doc_version']) || $config['legal_doc_version'] === '') {
        throw new RuntimeException('CONFIG_ERROR: invalid mode or legal_doc_version');
    }
    foreach ($config['allowed_hosts'] as $host) {
        if (!is_string($host) || $host === '' || strtolower($host) !== $host
            || preg_match('/^[a-z0-9.-]+$/', $host) !== 1) {
            throw new RuntimeException('CONFIG_ERROR: invalid allowed host');
        }
    }
    foreach ($config['required_consents'] as $consent) {
        if (!is_string($consent) || preg_match('/^[a-z][a-z0-9_]{0,39}$/', $consent) !== 1) {
            throw new RuntimeException('CONFIG_ERROR: invalid required consent');
        }
    }
    foreach ($config['payment_methods'] as $paymentMethod) {
        if (!is_string($paymentMethod) || $paymentMethod === '') {
            throw new RuntimeException('CONFIG_ERROR: invalid payment method');
        }
    }
    if ($config['time_slots'] === []) {
        throw new RuntimeException('CONFIG_ERROR: time_slots must not be empty');
    }
    $knownTimeSlots = [];
    foreach ($config['time_slots'] as $slot) {
        if (!is_array($slot) || !isset($slot['value'], $slot['label'])
            || !is_string($slot['value']) || $slot['value'] === ''
            || !is_string($slot['label']) || $slot['label'] === ''
            || in_array($slot['value'], $knownTimeSlots, true)) {
            throw new RuntimeException('CONFIG_ERROR: invalid time slot');
        }
        $knownTimeSlots[] = $slot['value'];
    }
    $calculator = $config['calculator'];
    foreach (['rounding_increment_kop', 'base_price_kop', 'category_multiplier', 'urgency_multiplier'] as $key) {
        if (!array_key_exists($key, $calculator) || (!is_array($calculator[$key]) && $key !== 'rounding_increment_kop')) {
            throw new RuntimeException('CONFIG_ERROR: invalid calculator config ' . $key);
        }
    }
    if (!is_int($calculator['rounding_increment_kop']) || $calculator['rounding_increment_kop'] < 1
        || !is_string($config['legal_doc_version'])) {
        throw new RuntimeException('CONFIG_ERROR: invalid calculator rounding');
    }
    foreach ($config['options'] as $key => $option) {
        if (!is_string($key) || !is_array($option) || !isset($option['fee_kop'])
            || !is_int($option['fee_kop']) || $option['fee_kop'] < 0) {
            throw new RuntimeException('CONFIG_ERROR: invalid option');
        }
    }
    foreach ($calculator['base_price_kop'] as $code => $price) {
        if (!is_string($code) || !is_int($price) || $price < 0) {
            throw new RuntimeException('CONFIG_ERROR: invalid base price');
        }
    }
    foreach (['category_multiplier', 'urgency_multiplier'] as $group) {
        foreach ($calculator[$group] as $ratio) {
            if (!is_array($ratio) || !isset($ratio['numerator'], $ratio['denominator'])
                || !is_int($ratio['numerator']) || $ratio['numerator'] < 1
                || !is_int($ratio['denominator']) || $ratio['denominator'] < 1) {
                throw new RuntimeException('CONFIG_ERROR: invalid multiplier');
            }
        }
    }
    return $config;
}

if (!extension_loaded('mbstring')) {
    error_log('send.php: mbstring extension is required');
    fail(500, 'SERVER_ERROR');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'METHOD_NOT_ALLOWED');
}

try {
    $config = readJsonFile(__DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'app.json', 'CONFIG_ERROR');
    readRequiredRequestConfig();
} catch (Throwable $error) {
    error_log('send.php: ' . $error->getMessage());
    fail(500, 'CONFIG_ERROR');
}
if ($config['mode'] !== 'live') {
    fail(503, 'DEMO_MODE');
}

$maxBodyBytes = configInteger('max_body_bytes', 1);
$contentLength = $_SERVER['CONTENT_LENGTH'] ?? null;
if ($contentLength !== null && (!is_string($contentLength) && !is_int($contentLength)
    || preg_match('/^\d+$/', (string)$contentLength) !== 1)) {
    fail(400, 'BAD_CONTENT_LENGTH');
}
if ($contentLength !== null && (int)$contentLength > $maxBodyBytes) {
    fail(413, 'PAYLOAD_TOO_LARGE');
}
$rawBody = file_get_contents('php://input', false, null, 0, $maxBodyBytes + 1);
if (!is_string($rawBody) || strlen($rawBody) > $maxBodyBytes) {
    fail(413, 'PAYLOAD_TOO_LARGE');
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!is_string($origin)) {
    fail(403, 'ORIGIN_MISMATCH');
}
if ($origin !== '') {
    $originParts = parse_url($origin);
    if (!is_array($originParts)) {
        fail(403, 'ORIGIN_MISMATCH');
    }
    $originHost = $originParts['host'] ?? null;
    $originScheme = $originParts['scheme'] ?? null;
    $originPort = $originParts['port'] ?? null;
    $allowedHosts = array_map('strtolower', $config['allowed_hosts']);
    if (!is_string($originHost) || !in_array(strtolower($originHost), $allowedHosts, true)
        || !in_array($originScheme, ['https', 'http'], true)
        || isset($originParts['user']) || isset($originParts['pass'])
        || isset($originParts['path']) || isset($originParts['query']) || isset($originParts['fragment'])
        || ($originScheme === 'https' && $originPort !== null && $originPort !== 443)
        || ($originScheme === 'http' && $originPort !== null && $originPort !== 80)) {
        fail(403, 'ORIGIN_MISMATCH');
    }
}

try {
    $storageDir = ensureStorageDirectory();
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;
    if (!is_string($remoteIp) || filter_var($remoteIp, FILTER_VALIDATE_IP) === false) {
        fail(500, 'SERVER_ERROR');
    }
    checkRateLimit(
        $storageDir,
        $remoteIp,
        getRateLimitSecret($storageDir),
        configInteger('rate_limit_per_minute', 1)
    );
} catch (Throwable $error) {
    error_log('send.php: ' . $error->getMessage());
    if (str_starts_with($error->getMessage(), 'CONFIG_ERROR:')) {
        fail(500, 'CONFIG_ERROR');
    }
    fail(500, 'STORAGE_ERROR');
}

try {
    $payload = json_decode($rawBody, true, MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    fail(400, 'BAD_JSON');
}
if (!is_array($payload)) {
    fail(400, 'BAD_JSON');
}
if (array_key_exists('website', $payload) && $payload['website'] !== null && $payload['website'] !== '') {
    fail(400, 'REJECTED');
}

$errors = [];
$customer = $payload['customer'] ?? null;
if (!is_array($customer)) {
    $errors[] = 'INVALID_CUSTOMER';
    $customer = [];
}
$name = requestString($customer, 'name', true, configInteger('max_name_chars', 2));
$phone = requestString($customer, 'phone', true, configInteger('max_phone_chars', 1));
$email = requestString($customer, 'email', true, configInteger('max_email_chars', 1));
$comment = requestString($customer, 'comment', false, configInteger('max_comment_chars', 0));
$city = requestString($payload, 'city', false, configInteger('max_city_chars', 1));
$timeSlotValues = array_column($config['time_slots'], 'value');
$maxTimeSlotLength = max(array_map(
    static fn (string $slot): int => mb_strlen($slot, 'UTF-8'),
    $timeSlotValues
));
$contactSlot = requestString($payload, 'contact_slot', true, $maxTimeSlotLength);
$deadline = requestString($payload, 'deadline', false, 10);

if ($name === null || mb_strlen($name, 'UTF-8') < configInteger('min_name_chars', 1)) {
    $errors[] = 'INVALID_NAME';
}
$phoneDigits = $phone === null ? null : preg_replace('/\D/', '', $phone);
if ($phone === null || preg_match('/^\+?[0-9()\s-]+$/', $phone) !== 1
    || !is_string($phoneDigits)
    || strlen($phoneDigits) < configInteger('min_phone_digits', 1)
    || strlen($phoneDigits) > configInteger('max_phone_chars', 1)) {
    $errors[] = 'INVALID_PHONE';
}
if ($email === null || strlen($email) > configInteger('max_email_chars', 1)
    || preg_match('/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/', $email) !== 1) {
    $errors[] = 'INVALID_EMAIL';
}
if ($comment === null) {
    $errors[] = 'INVALID_COMMENT';
}
if ($city === null) {
    $errors[] = 'INVALID_CITY';
}
if ($contactSlot === null || !in_array($contactSlot, $timeSlotValues, true)) {
    $errors[] = 'INVALID_CONTACT_SLOT';
}
if ($deadline === null || ($deadline !== '' && (
    preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline) !== 1
    || DateTimeImmutable::createFromFormat('!Y-m-d', $deadline)?->format('Y-m-d') !== $deadline
))) {
    $errors[] = 'INVALID_DEADLINE';
}

$calculatorConfig = $config['calculator'];
$docCodes = array_keys($calculatorConfig['base_price_kop']);
$categoryCodes = array_keys($calculatorConfig['category_multiplier']);
$urgencyCodes = array_keys($calculatorConfig['urgency_multiplier']);
$formatCodes = array_keys($config['options']);
$category = $payload['disputeCategory'] ?? null;
$workFormat = $payload['workFormat'] ?? null;
$urgency = $payload['urgency'] ?? null;
if (!is_string($category) || !in_array($category, $categoryCodes, true)) {
    $errors[] = 'INVALID_DISPUTE_CATEGORY';
}
if (!is_string($workFormat) || !in_array($workFormat, $formatCodes, true)) {
    $errors[] = 'INVALID_WORK_FORMAT';
}
if (!is_string($urgency) || !in_array($urgency, $urgencyCodes, true)) {
    $errors[] = 'INVALID_URGENCY';
}

$items = $payload['items'] ?? null;
$mergedItems = [];
$maxItems = configInteger('max_items', 1);
$maxQty = configInteger('max_qty', 1);
if (!is_array($items) || array_values($items) !== $items || count($items) < 1 || count($items) > $maxItems) {
    $errors[] = 'INVALID_ITEMS';
} else {
    foreach ($items as $item) {
        if (!is_array($item)) {
            $errors[] = 'INVALID_ITEMS';
            continue;
        }
        $code = $item['code'] ?? null;
        $qty = $item['qty'] ?? null;
        if (!is_string($code) || !in_array($code, $docCodes, true)) {
            $errors[] = 'UNKNOWN_CODE';
            continue;
        }
        if (!is_int($qty) || $qty < 1 || $qty > $maxQty) {
            $errors[] = 'INVALID_QTY';
            continue;
        }
        $mergedQty = isset($mergedItems[$code]) ? $mergedItems[$code] + $qty : $qty;
        if ($mergedQty > $maxQty) {
            $errors[] = 'INVALID_QTY';
            continue;
        }
        $mergedItems[$code] = $mergedQty;
    }
}

$requestId = $payload['request_id'] ?? null;
$maxRequestIdChars = configInteger('max_request_id_chars', 36);
if (!is_string($requestId) || strlen($requestId) !== $maxRequestIdChars
    || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $requestId) !== 1) {
    $errors[] = 'INVALID_REQUEST_ID';
}
$consents = $payload['consents'] ?? null;
if (!is_array($consents)) {
    $errors[] = 'INVALID_CONSENTS';
    $consents = [];
}
foreach ($consents as $consentName => $consentValue) {
    if (!is_string($consentName) || !in_array($consentName, $config['required_consents'], true)
        || !is_bool($consentValue)) {
        $errors[] = 'INVALID_CONSENTS';
        break;
    }
}
foreach ($config['required_consents'] as $consentName) {
    if (($consents[$consentName] ?? false) !== true) {
        $errors[] = 'CONSENT_MISSING_' . strtoupper($consentName);
    }
}
if ($errors !== []) {
    fail(422, ...$errors);
}

$documentCostKop = 0;
foreach ($mergedItems as $code => $qty) {
    $basePriceKop = $calculatorConfig['base_price_kop'][$code];
    $categoryRatio = $calculatorConfig['category_multiplier'][$category];
    $unitNumerator = checkedMultiply($basePriceKop, $categoryRatio['numerator'], 'unit price');
    $unitCostKop = roundHalfUpToIncrement(
        $unitNumerator,
        $categoryRatio['denominator'],
        $calculatorConfig['rounding_increment_kop']
    );
    $lineCostKop = checkedMultiply($unitCostKop, $qty, 'line total');
    $documentCostKop = checkedAdd($documentCostKop, $lineCostKop, 'document total');
}
$formatAddonKop = $config['options'][$workFormat]['fee_kop'];
$subtotalKop = checkedAdd($documentCostKop, $formatAddonKop, 'subtotal') /*M1*/;
$urgencyRatio = $calculatorConfig['urgency_multiplier'][$urgency];
$totalNumerator = checkedMultiply($subtotalKop, $urgencyRatio['numerator'], 'total price');
$totalKop = roundHalfUpToIncrement(
    $totalNumerator,
    $urgencyRatio['denominator'],
    $calculatorConfig['rounding_increment_kop']
);
$totals = [
    'document_kop' => $documentCostKop,
    'format_kop' => $formatAddonKop,
    'subtotal_kop' => $subtotalKop,
    'total_kop' => $totalKop,
];

try {
    $requestDir = $storageDir . DIRECTORY_SEPARATOR . 'req';
    $pdnDir = $storageDir . DIRECTORY_SEPARATOR . 'pdn';
    ensurePrivateDirectory($requestDir);
    ensurePrivateDirectory($pdnDir);
    $requestKey = hash('sha256', $requestId);
    $requestLockPath = $requestDir . DIRECTORY_SEPARATOR . $requestKey . '.lock';
    $requestLock = fopen($requestLockPath, 'c');
    if ($requestLock === false || !flock($requestLock, LOCK_EX)) {
        if (is_resource($requestLock)) {
            fclose($requestLock);
        }
        throw new RuntimeException('STORAGE_ERROR: cannot lock request');
    }
    if (!chmod($requestLockPath, 0640)) {
        flock($requestLock, LOCK_UN);
        fclose($requestLock);
        throw new RuntimeException('STORAGE_ERROR: cannot set request lock permissions');
    }
    $cachedPath = $requestDir . DIRECTORY_SEPARATOR . $requestKey . '.json';
    if (is_file($cachedPath)) {
        $cachedAt = filemtime($cachedPath);
        if ($cachedAt === false) {
            throw new RuntimeException('STORAGE_ERROR: cannot read idempotency timestamp');
        }
        if ($cachedAt <= time() - configInteger('request_id_ttl_seconds', 1) && !unlink($cachedPath)) {
            throw new RuntimeException('STORAGE_ERROR: cannot expire idempotency response');
        }
    }
    if (is_file($cachedPath)) {
        $cachedResponse = readJsonFile($cachedPath, 'STORAGE_ERROR');
        flock($requestLock, LOCK_UN);
        fclose($requestLock);
        respond(200, $cachedResponse + ['duplicate' => true]);
    }

    $now = gmdate('c');
    $docVersion = $config['legal_doc_version'];
    $docHashes = [];
    foreach ($config['legal_docs'] as $docName => $relativePath) {
        if (!is_string($docName) || !is_string($relativePath)
            || str_contains($relativePath, '..') || str_starts_with($relativePath, '/')) {
            throw new RuntimeException('CONFIG_ERROR: invalid legal document path');
        }
        $docPath = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
        if (!is_file($docPath)) {
            throw new RuntimeException('CONFIG_ERROR: legal document is missing');
        }
        $hash = hash_file('sha256', $docPath);
        if (!is_string($hash)) {
            throw new RuntimeException('CONFIG_ERROR: cannot hash legal document');
        }
        $docHashes[$docName] = $hash;
    }

    $orderNumber = null;
    $orderPath = null;
    $attempts = configInteger('order_id_attempts', 1);
    for ($attempt = 0; $attempt < $attempts; $attempt++) {
        $candidate = 'C4-' . gmdate('Ym') . '-' . strtoupper(bin2hex(random_bytes(16)));
        $candidatePath = $pdnDir . DIRECTORY_SEPARATOR . $candidate . '.json';
        $orderRecord = [
            'order_number' => $candidate,
            'created_at' => $now,
            'customer' => [
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'comment' => $comment,
                'city' => $city,
                'contact_slot' => $contactSlot,
            ],
            'deadline' => $deadline,
            'items' => $mergedItems,
            'disputeCategory' => $category,
            'workFormat' => $workFormat,
            'urgency' => $urgency,
            'totals' => $totals,
            'consents' => $consents,
            'doc_version' => $docVersion,
            'docs_sha256' => $docHashes,
        ];
        if (writeExclusiveJson($candidatePath, $orderRecord)) {
            $orderNumber = $candidate;
            $orderPath = $candidatePath;
            break;
        }
        if (!file_exists($candidatePath)) {
            throw new RuntimeException('STORAGE_ERROR: cannot create order record');
        }
    }
    if ($orderNumber === null || $orderPath === null) {
        throw new RuntimeException('STORAGE_ERROR: order id allocation failed');
    }

    $eventsPath = $storageDir . DIRECTORY_SEPARATOR . 'events.jsonl';
    $events = fopen($eventsPath, 'ab');
    if ($events === false || !flock($events, LOCK_EX)) {
        if (is_resource($events)) {
            fclose($events);
        }
        throw new RuntimeException('STORAGE_ERROR: cannot lock event log');
    }
    $event = [
        'ts' => $now,
        'order_number' => $orderNumber,
        'item_count' => count($mergedItems),
        'total_kop' => $totalKop,
        'consents' => array_map(static fn ($value): bool => $value === true, $consents),
        'doc_version' => $docVersion,
    ];
    writeAll($events, encodeJson($event) . "\n");
    flock($events, LOCK_UN);
    fclose($events);
    if (!chmod($eventsPath, 0640)) {
        throw new RuntimeException('STORAGE_ERROR: cannot set event log permissions');
    }

    $response = ['ok' => true, 'order_number' => $orderNumber, 'totals' => $totals];
    if (!writeExclusiveJson($cachedPath, $response)) {
        throw new RuntimeException('STORAGE_ERROR: cannot persist idempotency response');
    }
    flock($requestLock, LOCK_UN);
    fclose($requestLock);
    respond(200, $response);
} catch (Throwable $error) {
    error_log('send.php: ' . $error->getMessage());
    if (isset($requestLock) && is_resource($requestLock)) {
        flock($requestLock, LOCK_UN);
        fclose($requestLock);
    }
    if (isset($orderPath) && is_string($orderPath) && is_file($orderPath)) {
        @unlink($orderPath);
    }
    if (str_starts_with($error->getMessage(), 'CONFIG_ERROR:')) {
        fail(500, 'CONFIG_ERROR');
    }
    fail(500, 'STORAGE_ERROR');
}
