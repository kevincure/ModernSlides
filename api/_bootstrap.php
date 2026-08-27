<?php

declare(strict_types=1);

/*
 * ModernSlides publishing bootstrap.
 *
 * This file deliberately finds the HostGator account root by walking
 * upward until it reaches the directory named "public_html".
 *
 * Therefore both of these layouts work:
 *
 *   /home/user/public_html/ModernSlides/api/
 *
 * and:
 *
 *   /home/user/public_html/kevinbryanecon.com/ModernSlides/api/
 */

function ms_fail_bootstrap(string $message): never
{
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function ms_account_root(): string
{
    $dir = realpath(__DIR__);

    if ($dir === false) {
        ms_fail_bootstrap('Could not resolve the ModernSlides API directory.');
    }

    for ($i = 0; $i < 12; $i++) {
        if (basename($dir) === 'public_html') {
            return dirname($dir);
        }

        $parent = dirname($dir);

        if ($parent === $dir) {
            break;
        }

        $dir = $parent;
    }

    ms_fail_bootstrap(
        'ModernSlides publishing must be installed somewhere beneath public_html.'
    );
}

$configFile =
    ms_account_root() .
    DIRECTORY_SEPARATOR .
    '.modernslides-publish.php';

if (
    !is_file($configFile) ||
    is_link($configFile)
) {
    ms_fail_bootstrap(
        'Publishing configuration was not found outside public_html.'
    );
}

$config = require $configFile;

if (!is_array($config)) {
    ms_fail_bootstrap('Publishing configuration is invalid.');
}

$requiredConfig = [
    'origin',
    'base_path',
    'secret',
    'max_bytes',
    'session_seconds'
];

foreach ($requiredConfig as $key) {
    if (!array_key_exists($key, $config)) {
        ms_fail_bootstrap(
            'Publishing configuration is missing: ' . $key
        );
    }
}

$config['origin'] = rtrim(
    (string)$config['origin'],
    '/'
);

$config['base_path'] =
    '/' .
    trim(
        (string)$config['base_path'],
        '/'
    );

$config['secret'] =
    (string)$config['secret'];

$config['max_bytes'] =
    (int)$config['max_bytes'];

$config['session_seconds'] =
    (int)$config['session_seconds'];

if (
    !filter_var(
        $config['origin'],
        FILTER_VALIDATE_URL
    ) ||
    parse_url(
        $config['origin'],
        PHP_URL_SCHEME
    ) !== 'https'
) {
    ms_fail_bootstrap(
        'Publishing origin must be a valid HTTPS origin.'
    );
}

if (
    str_contains($config['base_path'], '..') ||
    !preg_match(
        '#\A/[A-Za-z0-9/_-]*\z#D',
        $config['base_path']
    )
) {
    ms_fail_bootstrap(
        'Publishing base_path is invalid.'
    );
}

if (strlen($config['secret']) < 16) {
    ms_fail_bootstrap(
        'Publishing secret must contain at least 32 characters.'
    );
}

if (
    $config['max_bytes'] < 1024 ||
    $config['max_bytes'] > 128 * 1024 * 1024
) {
    ms_fail_bootstrap(
        'Publishing max_bytes is outside the permitted range.'
    );
}

if (
    $config['session_seconds'] < 300 ||
    $config['session_seconds'] > 24 * 60 * 60
) {
    ms_fail_bootstrap(
        'Publishing session_seconds is outside the permitted range.'
    );
}

function ms_security_headers(): void
{
    header('Cache-Control: no-store, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header('Cross-Origin-Resource-Policy: same-origin');
}

function ms_json_error(
    int $status,
    string $message
): never {
    http_response_code($status);

    header(
        'Content-Type: application/json; charset=utf-8'
    );

    echo json_encode(
        [
            'ok' => false,
            'error' => $message
        ],
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

function ms_is_https(): bool
{
    $https =
        strtolower(
            (string)($_SERVER['HTTPS'] ?? '')
        );

    if (
        $https !== '' &&
        $https !== 'off'
    ) {
        return true;
    }

    /*
     * Some hosts put PHP behind a local proxy.
     */
    $forwarded =
        strtolower(
            trim(
                explode(
                    ',',
                    (string)(
                        $_SERVER['HTTP_X_FORWARDED_PROTO']
                        ?? ''
                    )
                )[0]
            )
        );

    return $forwarded === 'https';
}

function ms_require_https(): void
{
    if (!ms_is_https()) {
        ms_json_error(
            403,
            'Publishing requires HTTPS.'
        );
    }
}

function ms_require_same_origin(
    array $config
): void {
    $origin =
        rtrim(
            (string)(
                $_SERVER['HTTP_ORIGIN']
                ?? ''
            ),
            '/'
        );

    if (
        $origin === '' ||
        !hash_equals(
            $config['origin'],
            $origin
        )
    ) {
        ms_json_error(
            403,
            'Cross-origin publishing is not permitted.'
        );
    }

    $fetchSite =
        strtolower(
            (string)(
                $_SERVER['HTTP_SEC_FETCH_SITE']
                ?? ''
            )
        );

    if (
        $fetchSite !== '' &&
        $fetchSite !== 'same-origin'
    ) {
        ms_json_error(
            403,
            'Cross-site publishing is not permitted.'
        );
    }
}

function ms_start_session(
    array $config
): void {
    ini_set(
        'session.use_strict_mode',
        '1'
    );

    ini_set(
        'session.use_only_cookies',
        '1'
    );

    session_name(
        'MSPUBSESSID'
    );

    session_set_cookie_params([
        'lifetime' => 0,
        'path' =>
            rtrim(
                $config['base_path'],
                '/'
            ) .
            '/api/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);

    session_start();
}

function ms_is_authenticated(): bool
{
    return
        (
            $_SESSION['modernslides_publish']
            ?? false
        ) === true
        &&
        (
            (int)(
                $_SESSION[
                    'modernslides_publish_until'
                ]
                ?? 0
            )
        ) >= time();
}

function ms_mark_authenticated(
    array $config
): void {
    $_SESSION['modernslides_publish'] =
        true;

    $_SESSION[
        'modernslides_publish_until'
    ] =
        time() +
        $config['session_seconds'];
}

function ms_require_authenticated(
    array $config
): void {
    if (!ms_is_authenticated()) {
        unset(
            $_SESSION[
                'modernslides_publish'
            ],
            $_SESSION[
                'modernslides_publish_until'
            ]
        );

        ms_json_error(
            401,
            'Publishing authorization required.'
        );
    }

    /*
     * Active use refreshes the timeout.
     */
    $_SESSION[
        'modernslides_publish_until'
    ] =
        time() +
        $config['session_seconds'];
}