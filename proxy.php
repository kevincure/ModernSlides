<?php
// Very simple, unrestricted proxy to load remote slide decks
if (!isset($_GET['url'])) {
    http_response_code(400);
    echo "Missing URL";
    exit;
}

$url = $_GET['url'];
$url = filter_var($url, FILTER_VALIDATE_URL);

if (!$url) {
    http_response_code(400);
    echo "Invalid URL";
    exit;
}

$context = stream_context_create([
    'http' => ['header' => "User-Agent: ModernSlidesProxy\r\n"]
]);

$contents = @file_get_contents($url, false, $context);

if ($contents === false) {
    http_response_code(404);
    echo "Could not load file.";
    exit;
}

header("Content-Type: text/plain");
echo $contents;
?>
