# Modern Slides, Kevin Bryan, August 2025, MIT License
Powerpoint is super annoying to use and to get your slides in a nice format. Beamer gives you control, separating design from content, but it's ugly. Both use way too much compute.  

This is a slideshow program, running in your browser, under an MIT license that you can edit/share as you like.  You can add your own house style - once you have one you like, you are done (see the example css for what you will need). Then, in edit mode (press 'e' to toggle back and forth), you can edit your slides as you like using a simple interface. 

This is a modern, very computationally light, slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from <a href="https://github.com/kevincure/ModernSlides">github.com/kevincure/ModernSlides</a> or find more similar tools at <a href="http://kevinbryanecon.com/tools.html">kevinbryanecon.com/tools.html</a> and create your slides locally in your browser. Once your slides are set, click download to get the pure text version of your slides. You can upload that text file to anywhere you like, then open it with a url query of the form ?xml=...: e.g., <a href="https://kevinbryanecon.com/ModernSlides/?xml=http://www.inastrangetown.com/testslides.txt">this one here</a></p>. That url query uses the index.html and styles from my website, but you can of course use a url query on your own website as well. 

Each slide is defined by directives in a Markdown type format. A directive starts a line, ends with a colon `:`, and its value is all text that follows until the next directive.  That's it! You can of course link to images or animated gifs online, and really quite cool, you can **include whole websites that you can operate on** if they do not block themselves from being iframed. Your personal website and any tools there is almost certainly going to work. You can just click to the site of the framed website to be able to scroll back and forth again between slides.

Press 'e' to toggle between edit and present, 'f' to go to full screen mode, and 'p' to open a presenter mode window. Left/right scrolls through slides.

--- METADATA (place at the top on a slide) ---

Hidden: true (hides the slide, can be set with eye open/closed button)
Background: image-url.jpg (image made light so you can read text on top)
FullScreenImage: image-url.jpg (image made full screen, expanded to fit shortest dimension)
Header: Small text in corner


--- CONTENT DIRECTIVES ---

Title: The Main Title of The Slide 
  Supports $LaTeX$ and
  manual line breaks.

BigText: For large, prominent text.
  Also supports line breaks and paragraphs.

Text: For standard body text.
  A blank line between text...

  ...and a skipped line creates a new paragraph.

SmallText: For smaller body text.

TinyText: For footnote-sized text.

Notes: For notes at the bottom of the slide.
  These appear in a special position. I use them for after-class notes.

SpeakerNote: For notes for yourself in presentation mode

Image: image-url.jpg (or a weblink to jpg/png/gif), An optional caption for image after the comma

FullScreenWebsite: https://example.com (operable websites embedded in slides)

Columns:
  Left column, with text, paragraphs, $math$
  &#45;&#45;&#45;
  This is the right column. You can put an
  image here using the 'image, caption' syntax:
  test.jpg, A caption for the image in the column.
  ...or you can just have more text.
  &#45;&#45;&#45;
  Third column

Table:
  Header 1 & Header 2 & Header 3
  &#45;&#45;&#45;
  Cell 1.1 & Cell 1.2 & Cell 1.3
  &#45;&#45;&#45;
  Cell 2.1 & Cell 2.2 & $math$ is fine

*some text* is italic, **some text** is bold, ***some text*** is bold italic.

--- NOTES ---

- Download Raw Deck and Load Deck give you your slides but you will still need any images referred to in the same folder, or else pointed to using a fixed url
- If no directive is given, text defaults to `Text:`.
- In `Columns` and `Table`, use ```---``` on its own line to separate sections/rows.
- You cannot nest directives (e.g., a Table inside a Column).
- Notes appear at the bottom in a special color and shift other content up.
- 7 different styles are given, but you can create your own also. The David Carson 90s look is the fun one!
