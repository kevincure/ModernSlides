# Modern Slides, Kevin Bryan, August 2025, MIT License

This is a modern, very computationally light slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from github.com/kevincure/ModernSlides
 or find more similar tools at kevinbryanecon.com/tools.html
 and create your slides locally in your browser. Once your slides are set, click Download. You can upload that text file anywhere and open it with a URL query of the form ?xml=.... For example: https://kevinbryanecon.com/ModernSlides?xml=Progress2025Class1/Class1Slides.txt

Press e to toggle between edit and present, f to go full screen, and p to open presenter mode.

# Slide format overview

Each slide is defined by directives in a Markdown-like format.
A directive starts a line, ends with a colon (:), and its value is all text that follows until the next directive.

Examples and common directives are shown below (use the exact directive names):

# METADATA (at top for each slide)
```
Hidden: true          # hides the slide (can be toggled with eye button)
Background: image-url.jpg
FullScreenImage: image-url.jpg
Header: Small text in corner
```

# CONTENT DIRECTIVES
```
Title: The Main Title of The Slide
  Supports $LaTeX$ and
  manual line breaks.

BigText: For large, prominent text.  Within all standard text
  <<< Text on Left <<<,
  >>> Text on Right >>>, and
  ||| Text is centered ||| can be used.

Text: For standard body text.
  A blank line between text...

  ...and a skipped line creates a new paragraph.

SmallText: For smaller body text.

TinyText: For footnote-sized text.

Break: 1    # or 2.2 or .7 — provides a break of a set size

Notes: For notes at the bottom of the slide.
  These appear in a special position.

SpeakerNote: For notes for yourself in presentation mode

PrintNote: Notes to appear only when printed from the Edit -> Print button

Image: image-url.jpg, An optional caption for the image after the comma

FullScreenWebsite: https://example.com

Columns and Table use --- to separate sections/rows; include them verbatim (example below):

Columns:
  This is the left column. Can have text, images, $math
  ---

Columns:
  This is the left column. Can contain any
  amount of text, paragraphs, and $math$.
  ---
  This is the right column. You can put an
  image here using the 'image, caption' syntax:
  test.jpg, A caption for the image in the column.
  ...or you can just have more text.
  ---
  Third column

Table:
  Header 1 & Header 2 & Header 3
  ---
  Cell 1.1 & Cell 1.2 & Cell 1.3
  ---
  Cell 2.1 & Cell 2.2 & $math$ is fine
```

# Inline formatting:
```
*some text* is italic

**some text** is bold

***some text*** is bold italic
```

# Short notes & tips

Download Raw Deck and Load Deck give you your slides but you will still need any images referred to in the same folder.

If no directive is given, text defaults to Text:.

If an inline website does not display it is being blocked by that website. You can embed Youtube videos using the normal video-specific Embed url without issue.

If you print from your browser, it will include PrintNotes. If you print from the Print icon in Edit mode, it will show the PrintNotes as well.

In Columns and Table, use --- on its own line to separate sections/rows.

You cannot nest directives (e.g., a Table inside a Column).

Notes: appear at the bottom in a special color and shift other content up.

There are 9 example styles included; you can create your own.
