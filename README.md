# Modern Slides, Kevin A. Bryan, August 2025 [August 27 2026 Update], MIT License

This is a modern, very computationally light slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from github.com/kevincure/ModernSlides
 or find more similar tools at kevinbryanecon.com/tools.html
 and create your slides locally in your browser. Once your slides are set, click Download. You can upload that json file anywhere and open it with a URL query of the form ?deck=.... For example: https://kevinbryanecon.com/ModernSlides/?deck=Progress2025Class1.  I just toss my slides (in subfolders), the index.html Modern Slides program, and the style-gallery on my website and now never need a USB key. The site loads packages and fonts from the internet in real time.

We will begin with the format and syntax. If you don't mind downloading your slides and then manually uploading them to your website, all you need is the index.html file placed in a subfolder (e.g., yourwebsite.com/ModernSlides). Then for every slide deck, create a subsubfolder (/ModernSlides/TalkJan42027) and in that folder put the .json your downloaded (/ModernSlides/TalkJan42027/TalkJan42027.json). After you upload it, you are done. However, if you are willing to do ten minutes of work putting the attached .php files on your website, you can actually upload your slides to your website. with one click ("Publish") with a password entry. This is *highly* secure, and what I do. See the final part of this readme for details.

Press **e** to toggle between edit and present, **f** to go full screen, and **s** to open or focus speaker view.  Autosave keeps a
copy of your current deck; the clock icon restores the most recent deck from a prior session (if different from the one already
open).  Undo/redo keeps a five-step history of recent edits.  You advance slides with Left/Right arrows, Page Up/Down, Space, Home, and End.

Each slide is defined by simple text in the format below. A directive starts a line, optionally takes arguments in parentheses, ends with a colon `:`, and its value is all text that follows. A line with no directive is just ordinary text in the most recent structure. Use a backslash `\` if you want a command to appear as normal text.
 
# Slide format overview

A directive starts a line, ends with a colon (:), and its value is all text that follows. Arguments can be added in parentheses.

Examples and common directives are shown below:

      # --- METADATA (place at the top) ---
      Background: image-url.jpg
        Appears behind the slide in all views (including print, presenter, and fullscreen) using a tinted covering treatment.
      Background(full): diagram.png
        Uses an untinted contained image.

      # --- CONTENT DIRECTIVES ---
      Title: The Main Title of The Slide
        Supports $LaTeX$ and manual line breaks.

      Header: Small text in corner

      BigText: For large, prominent text.
      Text: For standard body text. 
        Add a number in parentheses (e.g., Text(1.4):) to scale relative to the normal size.
      SmallText: For smaller supporting text. 
      TinyText: For source or footnote-sized text. 
      Quote(Baumol and Bowen): The output per person-hour...  
      Break: 1.5 (provides a break of a set size).
      Rule: (adds a horizontal line).
      Aside: On-slide annotation.

      # --- ALIGNMENT & LISTS ---
      Alignment is written as an argument: Title(align=center):, Text(align=left):, or BigText(align=right):
      *italic* or _italic_ is italic, **bold** is bold, and ***bold italic*** is bold italic.
      Lists use standard -, +, or * markers followed by a space. Indent continuation lines beneath an item.
      Ordered lists starting with a number will preserve their starting number.
      Add the positional argument `steps` to any text role to reveal its list items one at a time: e.g., Text(steps):

      # --- NOTES ---
      SpeakerNote: For notes for yourself in the speaker window (opened with 's')
      PrintNote: Notes about the slide to appear only when printed with notes (opened with 'n')

      # --- PROGRESSIVE REVEAL ---
      You can reveal elements progressively like so
      [Step 1]
      Text: Explicit reveal steps can be blocked out like this.
      [End Step 1]
      [Step 2]
      And then this
      [End Step 2]
      Or can do inline via arguments: Image(55%; step=3): chart.png or Text(step=1-3):, where 1-3 means it will show whenever we are on steps 1, 2, or 3.

      # --- MEDIA ---
      Image: image.jpg (or a weblink to jpg/png/gif; I often just link directly). An optional caption goes after a pipe, e.g., Image: image.jpg | Caption.
      You can set width, fit, and focus: Image(60%; fit=cover; focus=65% 40%): image.jpg. Images/screengrabs can also be pasted in with Ctrl-V, in which case they will be saved browser-side and will download with your slide deck automatically in a .zip.

      Website: https://example.com. If the website shows as broken, it is being blocked on the other website's end. Your personal website should work fine. Common YouTube watch, shortened, Shorts, Live, and embed URLs are normalised to an embed URL automatically, retaining a start time where present (e.g., Website: https://youtu.be/JQ8ZiT1sn88?t=90).

      # --- COLUMNS, TABLES & CODE ---
      Columns(2,1; valign=top):
        BigText: This is the wider left column. Can contain any
        amount of text, paragraphs, and $math$.
        ---
        Text: The narrower right column.
      End
        Inside columns you can use reveal regions. The --- separates columns only while a Columns block is open.

      Table(widths=2,1,1; header=1; headercol=0; columnAlign=l,r,r):
        Name | Estimate | SE
        Baseline | 1.25 | 0.14
        Robustness | 1.10 | 0.18
      End
        A pipe inside mathematics is protected from table splitting. Escape a literal non-mathematical pipe as \|.

      Code(python):
        def square(x):
            return x * x
      End

      To include a link, use standard Markdown: [External Link](https://example.com).
      For internal links to slides, use [Internal Link](#slide-id) anywhere on a slide.

      # --- Autoexpand ---
      If you type any of the following at the start of a line, they will automatically expand into the code above:
t: Title      b: BigText
x: Text       s: SmallText
y: TinyText   I: Image
C: Columns    T: Table
q: Quote      F: Background(full)
W: Website

      # --- NOTES ---
      # - The Download button grabs your deck (.json) and any uploaded images as a zip file. Keep all in the same subfolder wherever you store your offline slide text and images.
      # - If you want images that are not web-linked, you can paste images into the textbox, and when you download, it will include those images.
      # - If you have browser-side spellcheck turned on, this will work in the slide editor box.
      # - If you press 'p', it will print the slides themselves.
      # - If you press 'n' in Edit mode, it will print slides with the PrintNotes.
      # - If no directive is given, it acts as ordinary text in the most recent structure.
      # - You cannot nest some directives (e.g., a Table inside a Column). Remember to close Columns, Tables, and Code with `End`.
      # - A thin badge appears when content overflows the 16×9 frame. Hover to see the first 20 characters that spill off the slide.
      # - As you edit, your most-recently-edited slides are stored in LocalStorage via your browser. Use the restore button to reopen the last deck from a prior session.
      # - The status note in the lower-right reminds you about help on the default deck and reports when decks are restored.
      # - The layout dropdown allows minor edits on the main theme (Auto, Top, Center, Statement, Data, Full frame). The design and context are completely separate: choose your style from the style-gallery and it will automatically map to all your slides.

## Optional one-click website publishing

ModernSlides can optionally publish the current deck directly to the website from which `index.html` is running. Publishing is completely optional. Normal local Save/Open behavior works without any server setup.  If you use Publish, you MUST be editing your slides FROM YOUR WEBSITE, not locally on your computer.

### First-time Publish setup

If this is your first time using Publish, read this entire section before enabling it. Create a subfolder named `ModernSlides` in your website file structure and put `index.html` and `style-gallery.html` files there.  We now need to upload six helper files, one of which we need to modify three lines on. That's it!

A typical HostGator installation may look like:

    /home/YOUR_CPANEL_USER/
    |
    +-- .modernslides-publish.php (YOU WILL MODIFY THREE LINES IN THIS FILE)
    |
    +-- public_html/
        |
        +-- yourdomain.com/
            |
            +-- ModernSlides/
                |
                +-- index.html
                +-- README.md
                +-- style-gallery.html
                +-- .htaccess (YOU WILL NEED TO UPLOAD THIS)
                |
                +-- api/ (YOU WILL NEED TO CREATE THIS SUBFOLDER AND UPLOAD THIS)
                    +-- .htaccess
                    +-- _bootstrap.php
                    +-- login.php
                    +-- publish.php

Some HostGator or other web hosting accounts use `public_html` itself as the domain root; others, including addon-domain configurations, use a directory such as:

    public_html/yourdomain.com/

Both are supported. 

STEP 1: 

Create:

    .modernslides-publish.php

in your account BEFORE `public_html`.

For example:

    /home/YOUR_CPANEL_USER/.modernslides-publish.php

Do NOT put this file anywhere inside `public_html`.

Its contents are:

    <?php

    return [
        'origin' => 'https://www.yourdomain.com',
        'base_path' => '/ModernSlides',
        'secret' => 'TYPE-A-LONG-UNIQUE-PUBLISHING-KEY-HERE',
        'max_bytes' => 48 * 1024 * 1024,
        'session_seconds' => 2 * 60 * 60
    ];

Replace the publishing key with your own long unique key. Replace the origin with your domain.

Use at least 16 characters - this is very very very hackable. We have other protections in the code that limit what they could put onto your server and where, but you still this secret and unique. A password-manager-generated password is ideal, or use several unrelated words plus numbers. Do not reuse your HostGator, cPanel, FTP, SFTP, SSH, email, or any other account password.

If your hosting control panel permits it, set the secret configuration file's permissions to 600. If PHP cannot read it with permission 600 on your host, use the least permissive setting required by the host, such as 640. Never make this file world-writable. Don't worry too much if you don't know what this paragraph means.

STEP 2:

Inside your public folder, create a subfolder called ModernSlides, and a subfolder in that called api. Upload the following seven files.  Note that there are two .htaccess files in this Github. One stays in the api folder, the other doesn't.

    ModernSlides/
        index.html
        style-gallery.html
        .htaccess

        api/
            .htaccess
            _bootstrap.php
            login.php
            publish.php

STEP 3:

After your make a slide deck, click the Publish button (it looks like a cloud with an arrow) in edit mode. You will be asked to choose a title if you don't have one - this determines the web address your slides will publish to. For example, entering:

    Econ101

publishes:

    ModernSlides/Econ101/Econ101.json

The deck can then be opened with:

    https://www.yourdomain.com/ModernSlides/index.html?deck=Econ101

The first time in a browser session that you try to publish, an authorization window will open asking for the password you set above. THIS IS NEVER SAVED OUTSIDE YOUR BROWSER. Pasted and dropped images need no separate upload - the whole deck is uploaded at once. You can then continue editing that same deck and can publish again, from any computer, with the publish button and your password. You MUST be at https://www.yourwebsite.com/ModernSlides/... when you are editing or the upload won't work.

SECURITY NOTES.

The publish endpoint has quite a lot of security to ensure nothing goes wrong. It:

- works only over HTTPS;
- accepts only same-origin requests;
- requires the separate publishing key;
- stores that key outside `public_html`;
- uses an HttpOnly, Secure, SameSite=Strict session cookie;
- accepts only ModernSlides JSON format;
- accepts only safe publication names;
- never accepts a filesystem path from the browser;
- can write only inside the `ModernSlides` folder;
- refuses symbolic links;
- refuses to overwrite unmanaged directories containing unrelated files;
- writes a complete temporary JSON file first and then atomically replaces
  the published deck;
- limits the maximum accepted deck size.
