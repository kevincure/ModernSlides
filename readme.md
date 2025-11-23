# Modern Slides, Kevin Bryan, August 2025 [Last Update Nov 22 2025], MIT License

This is a modern, very computationally light slideshow maker. The critical idea is to completely separate style rules from content. I have included a dozen designed slideshow options built-in. You can add your own (create the css rules in the same manner as the existing ones, then add the css style name to const AVAILABLE_THEMES in index.html). I find it *much* faster to write slides - I just type BigText: blah blah blah, Image: blah.jpg, Caption and so on, and I know all of the design is handled for me automatically.  Plus since it runs in a browser, you can do things like embed working websites and videos.

To use this slideshow program, download the index.html, css files, and proxy.php from this Git, load them onto your personal website (say, in a subfolder /slideshows), and make sure php is supported (simple on most hosted websites). You can then go to yourwebsite.com/slideshows/index.html and begin editing. When you want to save, click the download button, and you'll get a .txt with your slides plus any local images. Upload those to your website (say, yourwebsite.com/slideshows/presentationNov6/mypresentation.txt) and you can then open the slides on any computer with yourwebsite.com/slideshows/index.html?xml=presentationNov6/mypresentation.txt. Everything is local - no data is uploaded to any other server and it is fully private.

You can find more similar tools at kevinbryanecon.com/tools.html

For example: https://kevinbryanecon.com/ModernSlides?xml=Progress2025Class9/Class9Slides.txt.  I just toss my slides and the index.html Modern Slides program on my website before I teach or present and now never need a USB key.

Press **e** to toggle between edit and present, **f** to go full screen, and **p** to open presenter mode.  Autosave keeps a copy of your current deck; the clock icon restores the most recent deck from a prior session (if different from the one already open).  Undo/redo controls sit next to the style selector and keep a five-step history of recent edits.

Each slide is defined by directives in a Markdown type format. A directive starts a line, ends with a colon `:`, and its value is all text that follows until the next directive. In the text editor, you can use abbreviations, noted like [B:]. That is, if you type B: at the start of a line, Background: will automatically pop up
 
# Slide format overview

Each slide is defined by directives in a Markdown-like format.
A directive starts a line, ends with a colon (:), and its value is all text that follows until the next directive.

Examples and common directives are shown below (use the exact directive names):

      # --- METADATA (place at the top) ---
      Background: image-url.jpg (B:)
        Full screen image somewhat transparent, so text can be on top
      FullScreenImage: image-url.jpg (F:)
        Full size image

      # --- CONTENT DIRECTIVES ---
      Title: The Main Title of The Slide (t:)
        Supports $LaTeX$ and
        manual line breaks. If you just type without any category, it default to Text:

      Header: Small text in corner (h:)

      BigText: For large, prominent text. (b:)
      Text: For standard body text. (x:)
        Add a number to Text (e.g., Text2:, Text.6:) to scale relative to the slide height (0.2–5 works).
      SmallText: For smaller body text. (s:)
      TinyText: For footnote-sized text. (y:)
      Blockquote(caption): Creates a blockquote with a caption below (q:)
      Break: 1 (or 2.2 or .7), provides a break of a set size.
      <<< Text on Left <<<, >>> Text on Right >>>, and ||| Text is centered ||| align any line of text. You can highlight a line of text and click on the menu that pops up to do it.
      *some text* is italic, **some text** is bold, and ***some text*** is bold italic.
      You can also highlight text and choose any of these features.

      Notes: For notes seen on presented slide. (n:)
        These appear in a special position.

      SpeakerNote: For notes for yourself in presentation mode (S:)

      PrintNote: notes about the slide to appear only when printed from the 'print' button in Edit (if you print directly from the slides, you won't get these). I use these for student information following a class when I hand out the slides. (P:)

      Image: image-url.jpg (or a weblink to jpg/png/gif), An optional caption for image after the comma (I:). Images can also be pasted in with Ctrl-C, in which case they will saved browser-side and will download with your slide text automatically in a .zip. They can also be drag-and-dropped in. You can click the "images" list to delete any of these if you no longer need them.

      FullScreenWebsite: https://example.com. If the website shows as broken, it is being blocked on the other website's end. Your personal website should work fine. You can use this to embed a Youtube video including the start time by clicking 'share' on Youtube, and then 'embed', and then copying the embed url (the time stamp works as well) from Youtube. (F:)

      Columns: (C:)
        This is the left column. Can contain any
        amount of text, paragraphs, and $math$.
        ---
        Image: whatever.txt, this is the middle column and this text is a caption
        ---
        Third column
        
        Inside columns you can use one inline modes like BigText:, SmallText:, Text1.2: and you can also use >>>, <<<, ||| for right, left and center-justified.
        
        ---- instead of --- after a column makes it double-width; after the final column, you normally can omit --- but can use ---- there still if you want double-width

      Table: (T:)
        Header 1 & Header 2 & Header 3
        ---
        Cell 1.1 & Cell 1.2 & Cell 1.3
        ---
        Cell 2.1 & Cell 2.2 & $math$ is fine


      # --- NOTES ---
      # - Download give you your slides; if any local image it will be a zip. You can click Load slide to open it instead of using the xml= method, but make sure the images and .txt are all in the same folder. Some features (embedded videos and websites) will not work if you run this locally, but will work if you run it from your website; this is for security reasons.
      # - If you want images that are not web-linked, you can paste images into the textbox, and when you download, it will include those images. Keep all in the same folder wherever you store your offline slide text and images.
      # - Ctrl-B makes a bullet point.
      # - Numbered lists (1. blah blah 2. blah blah blah, etc., on sequential lines) will form an ordered list. Sequential lines with bullet points or * at the start will form unordered lists.
      # - If you have browser-side spellcheck turned on, this will work in the slide editor box.
      # - If you print from your browser, it will give slides without PrintNotes. 
      # - If you print from the print icon in Edit mode, it will show the PrintNotes.
      # - If no directive is given, text defaults to `Text:`.
      # - In `Columns` and `Table`, use `---` on its own line to separate sections/rows.
      # - You cannot nest some directives (e.g., a Table inside a Column).
      # - A thin badge appears when content overflows the 16×9 frame.  Hover to see the first 20 characters that spill off the slide. This is conservative, so usually are fine with a little overflow when you are presenting in fullscreen.
      # - As you edit, your most-recently-edited slides are stored in LocalStorage via your browser.  Use the restore button to reopen the last deck from a prior session (so no problems if you have a browser crash).
      # - The status note in the lower-right reminds you about help on the default deck and reports when decks are restored.
      # - 11 different styles are given, but you can create your own if you know how stylesheets work. All you need to do is to add the .css name to const AVAILABLE_THEMES in index.html.
