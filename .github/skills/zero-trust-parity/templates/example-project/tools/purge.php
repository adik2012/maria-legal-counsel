<?php
// Удаление файлов ПДн старше retention_days. Запуск по cron: php tools/purge.php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$cfg = json_decode((string)file_get_contents(__DIR__ . '/../data/app.json'), true);
if (!is_array($cfg) || !isset($cfg['retention_days'])) { fwrite(STDERR, "retention_days missing\n"); exit(1); }
$dir = (getenv('APP_STORAGE_DIR') ?: (__DIR__ . '/../data/private')) . '/pdn';
$limit = time() - (int)$cfg['retention_days'] * 86400;
$n = 0;
foreach (glob($dir . '/*.json') ?: [] as $f) {
    if (filemtime($f) < $limit) { unlink($f); $n++; }
}
echo "purged: $n\n";
