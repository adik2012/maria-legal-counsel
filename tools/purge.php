<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function purgeFail(string $message): void
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

function isAbsoluteStoragePath(string $path): bool
{
    return str_starts_with($path, DIRECTORY_SEPARATOR)
        || (DIRECTORY_SEPARATOR === '\\' && preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1);
}

try {
    $configPath = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'app.json';
    $configText = file_get_contents($configPath);
    if (!is_string($configText)) {
        purgeFail('CONFIG_ERROR: cannot read data/app.json');
    }
    $config = json_decode($configText, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    purgeFail('CONFIG_ERROR: invalid data/app.json');
}
if (!is_array($config) || !isset($config['retention_days'])
    || !is_int($config['retention_days']) || $config['retention_days'] < 1) {
    purgeFail('CONFIG_ERROR: retention_days must be a positive integer');
}

$configuredStorage = getenv('APP_STORAGE_DIR');
if (!is_string($configuredStorage) || $configuredStorage === '' || !isAbsoluteStoragePath($configuredStorage)) {
    purgeFail('STORAGE_ERROR: APP_STORAGE_DIR must be an absolute path');
}
if (!is_dir($configuredStorage) && !mkdir($configuredStorage, 0750, true) && !is_dir($configuredStorage)) {
    purgeFail('STORAGE_ERROR: cannot create APP_STORAGE_DIR');
}
$storageDir = realpath($configuredStorage);
$webRoot = realpath(dirname(__DIR__));
if (!is_string($storageDir) || !is_string($webRoot)) {
    purgeFail('STORAGE_ERROR: cannot resolve storage paths');
}
$rootPrefix = rtrim($webRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
if ($storageDir === $webRoot || str_starts_with($storageDir . DIRECTORY_SEPARATOR, $rootPrefix)) {
    purgeFail('STORAGE_ERROR: APP_STORAGE_DIR must be outside the web root');
}

$pdnDir = $storageDir . DIRECTORY_SEPARATOR . 'pdn';
$requestDir = $storageDir . DIRECTORY_SEPARATOR . 'req';
$cutoff = time() - $config['retention_days'] * 86400;
$purged = 0;
foreach ([$pdnDir, $requestDir] as $directory) {
    if (!is_dir($directory)) {
        continue;
    }
    $files = glob($directory . DIRECTORY_SEPARATOR . '*.json');
    if ($files === false) {
        purgeFail('STORAGE_ERROR: cannot list retention directory');
    }
    foreach ($files as $file) {
        $modifiedAt = filemtime($file);
        if ($modifiedAt === false) {
            purgeFail('STORAGE_ERROR: cannot read file timestamp');
        }
        if ($modifiedAt < $cutoff) {
            if (!unlink($file)) {
                purgeFail('STORAGE_ERROR: cannot remove expired file');
            }
            $purged++;
        }
    }
}

fwrite(STDOUT, 'purged: ' . $purged . PHP_EOL);
