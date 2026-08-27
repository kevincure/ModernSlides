<?php

    // CHANGE THE FOLLOWING THREE
    // your exact HTTPS origin, with no trailing slash, e.g.
    // 'origin' => 'https://www.YOUR-DOMAIN.example',

    // the folder where you put the modernslides file and api folder (recommend /ModernSlides)
    // 'base_path' => '/ModernSlides',

    // the UNIQUE 16 CHARACTER OR MORE PASSWORD
    // 'secret' => 'CHANGE-ME-TO-A-UNIQUE-PUBLISHING-KEY',
return [
    /*
     * Exact public origin where index.html runs.
     * No trailing slash.
     */
    'origin' => 'https://www.YOUR-DOMAIN.com',

    /*
     * Public URL path containing index.html and api/.
     */
    'base_path' => '/ModernSlides',

    /*
     * TYPE YOUR OWN LONG UNIQUE KEY HERE.
     *
     * Use at least 16 characters.
     * Do not reuse a cPanel, HostGator, FTP, SSH,
     * email, or any other account password.
     */
    'secret' => 'YourPasswordGoesHere16CharactersOrMore',

    /*
     * Maximum complete JSON deck accepted by Publish.
     * 48 MiB.
     */
    'max_bytes' => 48 * 1024 * 1024,

    /*
     * Publishing authorization lifetime, in seconds.
     * Two hours.
     */
    'session_seconds' => 2 * 60 * 60
];
