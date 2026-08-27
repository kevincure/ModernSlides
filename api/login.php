<?php

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

ms_security_headers();
ms_require_https();
ms_start_session($config);

if (
    !isset(
        $_SESSION[
            'modernslides_login_csrf'
        ]
    )
) {
    $_SESSION[
        'modernslides_login_csrf'
    ] =
        bin2hex(
            random_bytes(24)
        );
}

$error = '';

if (
    $_SERVER['REQUEST_METHOD']
    === 'POST'
) {

    $csrf =
        (string)(
            $_POST['csrf']
            ?? ''
        );

    $expectedCsrf =
        (string)(
            $_SESSION[
                'modernslides_login_csrf'
            ]
            ?? ''
        );

    if (
        $csrf === '' ||
        $expectedCsrf === '' ||
        !hash_equals(
            $expectedCsrf,
            $csrf
        )
    ) {
        http_response_code(403);
        $error =
            'The authorization form expired. Reload this window and try again.';

    } else {
        $provided =
            (string)(
                $_POST['key']
                ?? ''
            );

        /*
         * Avoid accepting absurdly large form input.
         */
        if (
            strlen($provided) <= 512 &&
            hash_equals(
                $config['secret'],
                $provided
            )
        ) {
            session_regenerate_id(true);

            ms_mark_authenticated(
                $config
            );

            $_SESSION[
                'modernslides_login_failures'
            ] = 0;

            $_SESSION[
                'modernslides_login_csrf'
            ] =
                bin2hex(
                    random_bytes(24)
                );

        } else {
            $failures =
                min(
                    6,
                    (int)(
                        $_SESSION[
                            'modernslides_login_failures'
                        ]
                        ?? 0
                    ) + 1
                );

            $_SESSION[
                'modernslides_login_failures'
            ] = $failures;

            /*
             * Increasing delay for repeated mistakes.
             * The long random secret remains the primary defense.
             */
            usleep(
                min(
                    2000000,
                    150000 *
                    (2 ** ($failures - 1))
                )
            );

            $error =
                'Incorrect publishing key.';
        }
    }
}

$authenticated =
    ms_is_authenticated();

$nonce =
    base64_encode(
        random_bytes(18)
    );

header(
    "Content-Security-Policy: " .
    "default-src 'none'; " .
    "style-src 'nonce-{$nonce}'; " .
    "script-src 'nonce-{$nonce}'; " .
    "form-action 'self'; " .
    "base-uri 'none'; " .
    "frame-ancestors 'none'"
);

$targetOrigin =
    json_encode(
        $config['origin'],
        JSON_HEX_TAG |
        JSON_HEX_AMP |
        JSON_HEX_APOS |
        JSON_HEX_QUOT
    );

$csrfValue =
    htmlspecialchars(
        (string)(
            $_SESSION[
                'modernslides_login_csrf'
            ]
            ?? ''
        ),
        ENT_QUOTES,
        'UTF-8'
    );

?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ModernSlides Publish</title>

<style nonce="<?= htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') ?>">
* {
    box-sizing: border-box;
}

html {
    min-height: 100%;
    background: #f1efe8;
    color: #222;
    font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
}

.card {
    width: min(420px, 100%);
    padding: 28px;
    border: 1px solid #d4d0c7;
    border-radius: 8px;
    background: #fff;
    box-shadow:
        0 18px 50px
        rgba(0,0,0,.12);
}

h1 {
    margin: 0 0 8px;
    font-size: 1.45rem;
    line-height: 1.15;
}

p {
    margin: .55rem 0;
    color: #555;
    line-height: 1.48;
}

form {
    display: grid;
    gap: 10px;
    margin-top: 22px;
}

label {
    font-size: .82rem;
    font-weight: 700;
}

input {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid #aaa;
    border-radius: 5px;
    font: inherit;
}

input:focus {
    outline: 2px solid #222;
    outline-offset: 1px;
}

button {
    margin-top: 6px;
    padding: 11px 14px;
    border: 1px solid #222;
    border-radius: 5px;
    background: #222;
    color: #fff;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
}

.error {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #d7aaaa;
    border-radius: 5px;
    background: #fff1f1;
    color: #8a2020;
}

.help {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #ddd;
    font-size: .82rem;
}

a {
    color: #222;
    font-weight: 700;
}
</style>
</head>

<body>

<div class="card">

<?php if ($authenticated): ?>

    <h1>Authorized</h1>

    <p>
        ModernSlides is authorized to publish.
        This window will close automatically.
    </p>

    <script nonce="<?= htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') ?>">
    if (window.opener) {
        window.opener.postMessage(
            {
                type:
                    'modernslides-publish-auth'
            },
            <?= $targetOrigin ?>
        );

        window.close();
    }
    </script>

<?php else: ?>

    <h1>Authorize Publish</h1>

    <p>
        Enter the publishing key for this website.
        The key is not stored in the presentation.
    </p>

    <?php if ($error !== ''): ?>
        <div class="error">
            <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
        </div>
    <?php endif; ?>

    <form method="post" action="">
        <input
            type="hidden"
            name="csrf"
            value="<?= $csrfValue ?>"
        >

        <label for="key">
            Publishing key
        </label>

        <input
            id="key"
            name="key"
            type="password"
            maxlength="512"
            required
            autofocus
            autocomplete="current-password"
        >

        <button type="submit">
            Authorize
        </button>
    </form>

    <p class="help">
        First time using Publish?
        <a
            href="../README.md"
            target="_blank"
            rel="noopener"
        >Read the ModernSlides README.</a>
    </p>

<?php endif; ?>

</div>

</body>
</html>