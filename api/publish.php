<?php

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

ms_security_headers();
ms_require_https();
ms_start_session($config);

if (
    $_SERVER['REQUEST_METHOD']
    !== 'POST'
) {
    header('Allow: POST');

    ms_json_error(
        405,
        'POST required.'
    );
}

ms_require_same_origin($config);
ms_require_authenticated($config);

if (
    (
        $_SERVER[
            'HTTP_X_MODERNSLIDES_PUBLISH'
        ]
        ?? ''
    ) !== '1'
) {
    ms_json_error(
        403,
        'Missing ModernSlides publishing header.'
    );
}

$contentType =
    strtolower(
        trim(
            explode(
                ';',
                (string)(
                    $_SERVER[
                        'CONTENT_TYPE'
                    ]
                    ?? ''
                )
            )[0]
        )
    );

if (
    $contentType !==
    'application/json'
) {
    ms_json_error(
        415,
        'Content-Type must be application/json.'
    );
}

$name =
    trim(
        (string)(
            $_SERVER[
                'HTTP_X_MODERNSLIDES_NAME'
            ]
            ?? ''
        )
    );

/*
 * The name can never contain:
 *
 * slash
 * backslash
 * dot
 * whitespace
 * URL path escapes
 *
 * It therefore cannot escape the publishing root.
 */
if (
    !preg_match(
        '/\A[A-Za-z0-9][A-Za-z0-9_-]{0,63}\z/D',
        $name
    )
) {
    ms_json_error(
        400,
        'Invalid deck name.'
    );
}

if (
    strcasecmp(
        $name,
        'api'
    ) === 0
) {
    ms_json_error(
        400,
        'That deck name is reserved.'
    );
}

$maxBytes =
    (int)$config['max_bytes'];

$contentLength =
    isset(
        $_SERVER[
            'CONTENT_LENGTH'
        ]
    )
        ? (int)
          $_SERVER[
              'CONTENT_LENGTH'
          ]
        : 0;

if (
    $contentLength > 0 &&
    $contentLength > $maxBytes
) {
    ms_json_error(
        413,
        'Deck is too large to publish.'
    );
}

$body =
    file_get_contents(
        'php://input'
    );

if ($body === false) {
    ms_json_error(
        400,
        'Could not read request body.'
    );
}

if (
    strlen($body) >
    $maxBytes
) {
    ms_json_error(
        413,
        'Deck is too large to publish.'
    );
}

/*
 * Confirm this is actual Format-2 ModernSlides JSON.
 */
try {
    $deck =
        json_decode(
            $body,
            true,
            512,
            JSON_THROW_ON_ERROR
        );
} catch (JsonException $error) {
    ms_json_error(
        422,
        'Deck contains invalid JSON.'
    );
}

if (!is_array($deck)) {
    ms_json_error(
        422,
        'Deck root must be an object.'
    );
}

if (
    ($deck['format'] ?? null)
    !== 'modernslides'
) {
    ms_json_error(
        422,
        'Not a ModernSlides deck.'
    );
}

if (
    ($deck['version'] ?? null)
    !== 2
) {
    ms_json_error(
        422,
        'Only ModernSlides Format 2 may be published.'
    );
}

if (
    !isset($deck['slides']) ||
    !is_array($deck['slides']) ||
    count($deck['slides']) < 1
) {
    ms_json_error(
        422,
        'Deck contains no slides.'
    );
}

/*
 * publish.php is:
 *
 *   ModernSlides/api/publish.php
 *
 * Therefore dirname(__DIR__) is always exactly the
 * ModernSlides folder, regardless of how deeply the
 * domain itself is nested beneath public_html.
 */
$root =
    realpath(
        dirname(__DIR__)
    );

if (
    $root === false ||
    !is_dir($root) ||
    !is_writable($root)
) {
    ms_json_error(
        500,
        'ModernSlides publishing directory is unavailable or not writable.'
    );
}

$targetDir =
    $root .
    DIRECTORY_SEPARATOR .
    $name;

$marker =
    $targetDir .
    DIRECTORY_SEPARATOR .
    '.modernslides-managed';

$targetFile =
    $targetDir .
    DIRECTORY_SEPARATOR .
    $name .
    '.json';

$legacyFile =
    $targetDir .
    DIRECTORY_SEPARATOR .
    $name .
    '.txt';

/*
 * NEW DIRECTORY
 */
if (!file_exists($targetDir)) {

    if (
        !mkdir(
            $targetDir,
            0755,
            false
        )
    ) {
        ms_json_error(
            500,
            'Could not create deck directory.'
        );
    }

    if (
        file_put_contents(
            $marker,
            "ModernSlides managed directory\n",
            LOCK_EX
        ) === false
    ) {
        @rmdir($targetDir);

        ms_json_error(
            500,
            'Could not create deck management marker.'
        );
    }

    @chmod(
        $marker,
        0600
    );

/*
 * EXISTING DIRECTORY
 */
} else {

    if (
        is_link($targetDir) ||
        !is_dir($targetDir)
    ) {
        ms_json_error(
            409,
            'Publish destination exists but is not a safe directory.'
        );
    }

    $realTarget =
        realpath(
            $targetDir
        );

    if ($realTarget === false) {
        ms_json_error(
            500,
            'Could not resolve publish destination.'
        );
    }

    $rootPrefix =
        rtrim(
            $root,
            DIRECTORY_SEPARATOR
        ) .
        DIRECTORY_SEPARATOR;

    if (
        !str_starts_with(
            $realTarget .
            DIRECTORY_SEPARATOR,
            $rootPrefix
        )
    ) {
        ms_json_error(
            403,
            'Publish destination escaped the ModernSlides directory.'
        );
    }

    /*
     * Existing old ModernSlides folders can be adopted automatically,
     * but ONLY if they contain nothing except:
     *
     *     Name.txt
     *     Name.json
     *
     * This handles existing legacy folders such as BSE/BSE.txt.
     *
     * Anything else causes publication to refuse rather than delete it.
     */
    if (!file_exists($marker)) {

        $entries =
            scandir(
                $targetDir
            );

        if ($entries === false) {
            ms_json_error(
                500,
                'Could not inspect existing deck directory.'
            );
        }

        foreach ($entries as $entry) {

            if (
                $entry === '.' ||
                $entry === '..'
            ) {
                continue;
            }

            if (
                $entry !==
                    $name . '.txt'
                &&
                $entry !==
                    $name . '.json'
            ) {
                ms_json_error(
                    409,
                    'That folder already contains files not owned by ModernSlides. Nothing was changed.'
                );
            }

            $existing =
                $targetDir .
                DIRECTORY_SEPARATOR .
                $entry;

            if (
                is_link($existing) ||
                !is_file($existing)
            ) {
                ms_json_error(
                    409,
                    'Existing deck folder contains an unsafe file.'
                );
            }
        }

        if (
            file_put_contents(
                $marker,
                "ModernSlides managed directory\n",
                LOCK_EX
            ) === false
        ) {
            ms_json_error(
                500,
                'Could not mark the existing deck directory as managed.'
            );
        }

        @chmod(
            $marker,
            0600
        );
    }
}

/*
 * A managed folder is allowed to contain only:
 *
 *   .modernslides-managed
 *   Name.json
 *   Name.txt        (legacy, removed after successful publish)
 *   our temporary publish files
 *
 * Anything else is a hard stop.
 */
if (
    !is_file($marker) ||
    is_link($marker)
) {
    ms_json_error(
        409,
        'Deck directory does not contain a valid ModernSlides management marker.'
    );
}

$entries =
    scandir(
        $targetDir
    );

if ($entries === false) {
    ms_json_error(
        500,
        'Could not inspect managed deck directory.'
    );
}

foreach ($entries as $entry) {

    if (
        $entry === '.' ||
        $entry === '..' ||
        $entry ===
            '.modernslides-managed' ||
        $entry ===
            $name . '.json' ||
        $entry ===
            $name . '.txt'
    ) {
        continue;
    }

    /*
     * Only our own stale temporary files may be removed.
     */
    if (
        str_starts_with(
            $entry,
            '.modernslides-tmp-'
        )
    ) {
        $stale =
            $targetDir .
            DIRECTORY_SEPARATOR .
            $entry;

        if (
            is_file($stale) &&
            !is_link($stale)
        ) {
            @unlink($stale);
            continue;
        }
    }

    ms_json_error(
        409,
        'Managed deck folder contains an unexpected file. Nothing was overwritten.'
    );
}

if (
    file_exists($targetFile) &&
    (
        is_link($targetFile) ||
        !is_file($targetFile)
    )
) {
    ms_json_error(
        409,
        'Existing JSON destination is unsafe to overwrite.'
    );
}

if (
    file_exists($legacyFile) &&
    (
        is_link($legacyFile) ||
        !is_file($legacyFile)
    )
) {
    ms_json_error(
        409,
        'Existing legacy deck is unsafe to replace.'
    );
}

/*
 * Write a completely new temporary file first.
 */
$tempFile =
    $targetDir .
    DIRECTORY_SEPARATOR .
    '.modernslides-tmp-' .
    bin2hex(
        random_bytes(12)
    );

$written =
    file_put_contents(
        $tempFile,
        $body,
        LOCK_EX
    );

if (
    $written === false ||
    $written !== strlen($body)
) {
    @unlink($tempFile);

    ms_json_error(
        500,
        'Could not write the complete temporary deck.'
    );
}

@chmod(
    $tempFile,
    0644
);

/*
 * Atomic replacement on the same HostGator filesystem.
 *
 * Visitors see either the old complete JSON or the new
 * complete JSON, never a half-uploaded deck.
 */
if (
    !rename(
        $tempFile,
        $targetFile
    )
) {
    @unlink($tempFile);

    ms_json_error(
        500,
        'Could not replace the published deck.'
    );
}

@chmod(
    $targetFile,
    0644
);

/*
 * If this was an old Format-1 folder containing Name.txt,
 * remove that legacy file only AFTER the Format-2 JSON
 * has been written successfully.
 */
$legacyRemoved = null;

if (file_exists($legacyFile)) {
    $legacyRemoved =
        @unlink(
            $legacyFile
        );
}

$basePath =
    rtrim(
        $config['base_path'],
        '/'
    );

$encoded =
    rawurlencode(
        $name
    );

$deckUrl =
    $config['origin'] .
    $basePath .
    '/' .
    $encoded .
    '/' .
    $encoded .
    '.json';

$viewUrl =
    $config['origin'] .
    $basePath .
    '/index.html?deck=' .
    $encoded;

header(
    'Content-Type: application/json; charset=utf-8'
);

echo json_encode(
    [
        'ok' => true,
        'name' => $name,
        'path' =>
            $name .
            '/' .
            $name .
            '.json',
        'deck_url' =>
            $deckUrl,
        'view_url' =>
            $viewUrl,
        'sha256' =>
            hash(
                'sha256',
                $body
            ),
        'legacy_txt_removed' =>
            $legacyRemoved
    ],
    JSON_UNESCAPED_SLASHES
);