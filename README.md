# Modern Slides, Kevin Bryan, August 2025, MIT License

This is a modern, very computationally light, slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from <a href="https://github.com/kevincure/ModernSlides">github.com/kevincure/ModernSlides</a> or find more similar tools at <a href="https://kevinbryanecon.com/tools.html">kevinbryanecon.com/tools.html</a> and create your slides locally in your browser. Once your slides are set, click download. You can upload that text file to anywhere you like, then open it with a url query of the form ?xml=...: e.g., <a href="https://kevinbryanecon.com/ModernSlides?xml=Progress2025Class1/Class1Slides.txt">this one here</a></p> 

Each slide is defined by directives in a Markdown type format. A directive starts a line, ends with a colon `:`, and its value is all text that follows until the next directive.
      
Press 'e' to toggle between edit and present, 'f' to go to full screen mode, and 'p' to open a presenter mode window.

# --- METADATA (place at the top) ---
Hidden: true (hides the slide, can be set with eye open/closed button)
Background: image-url.jpg
FullScreenImage: image-url.jpg
Header: Small text in corner


# --- CONTENT DIRECTIVES ---
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

Break: 1 (or 2.2 or .7), provides a break of a set size

Notes: For notes at the bottom of the slide.
  These appear in a special position.

SpeakerNote: For notes for yourself in presentation mode

PrintNote: notes about the slide to appear only when printed from the 'print' button in Edit (if you print from the slides, you won't get these)

Image: image-url.jpg (or a weblink to jpg/png/gif), An optional caption for image after the comma

FullScreenWebsite: https://example.com

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

*some text* is italic, **some text** is bold, ***some text*** is bold italic.

# --- NOTES ---
# - Download Raw Deck and Load Deck give you your slides but you
#      will still need any images referred to in the same folder
# - If no directive is given, text defaults to `Text:`.
# - If you print from your browser, it will give slides with PrintNotes. 
# - If you print from the print icon in Edit mode, it will show the PrintNotes.
# - In `Columns` and `Table`, use `---` on its own line
#       to separate sections/rows.
# - You cannot nest directives (e.g., a Table inside a Column).
# - Notes appear at the bottom in a special color and shift other content up.
# - 9 different styles are given, but you can create your own also
