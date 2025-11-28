# Modern Slides, Kevin Bryan, August 2025, MIT License

This is a modern, very computationally light slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from github.com/kevincure/ModernSlides
 or find more similar tools at kevinbryanecon.com/tools.html
 and create your slides locally in your browser. Once your slides are set, click Download. You can upload that text file anywhere and open it with a URL query of the form ?xml=.... For example: https://kevinbryanecon.com/ModernSlides?xml=Progress2025Class1/Class1Slides.txt.  I just toss my slides and the index.html Modern Slides program on my website and now never need a USB key.

Press **e** to toggle between edit and present, **f** to go full screen, and **p** to open presenter mode.  Autosave keeps a
copy of your current deck; the clock icon restores the most recent deck from a prior session (if different from the one already
open).  Undo/redo controls sit next to the style selector and keep a five-step history of recent edits.  Slide thumbnails include
inline **+** and trash controls so you can insert or delete slides directly from the preview strip.

Each slide is defined by directives in a Markdown type format. A directive starts a line, ends with a colon `:`, and its value is all text that follows until the next directive. In the text editor, you can use abbrevations, noted like [B:]. That is, if you type B: at the start of a line, Background: will automatically pop up
 
# Slide format overview

Each slide is defined by directives in a Markdown-like format.
A directive starts a line, ends with a colon (:), and its value is all text that follows until the next directive.

Examples and common directives are shown below (use the exact directive names):

      # --- METADATA (place at the top) ---
      Background: image-url.jpg (B:)
        Appears behind the slide in all views (including print, presenter, and fullscreen).
      FullScreenImage: image-url.jpg (F:)
        Expands the image to fill the slide.  Prints and presenter view use the same opaque rendering as the main deck.

      # --- CONTENT DIRECTIVES ---
      Title: The Main Title of The Slide (t:)
        Supports $LaTeX$ and
        manual line breaks.

      Header: Small text in corner (h:)

      BigText: For large, prominent text. (b:)
      Text: For standard body text. (x:)
        Add a number to Text (e.g., Text2:, Text.6:) to scale relative to the slide height (0.2–5 works).
      SmallText: For smaller body text. (s:)
      TinyText: For footnote-sized text. (y:)
      Break: 1 (or 2.2 or .7), provides a break of a set size.
      <<< Text on Left <<<, >>> Text on Right >>>, and ||| Text is centered ||| align any paragraph, even when using Text# or
      inline modes.  
      *some text* is italic, **some text** is bold, and ***some text*** is bold italic.
      You can also highlight text and choose any of these features.

      Notes: For notes seen on presented slide. (n:)
        These appear in a special position.

      SpeakerNote: For notes for yourself in presentation mode (S:)

      PrintNote: notes about the slide to appear only when printed from the 'print' button in Edit (if you print directly from the slides, you won't get these) (P:)

      Image: image-url.jpg (or a weblink to jpg/png/gif), An optional caption for image after the comma (I:). Images can also be pasted in with Ctrl-C, in which case they will saved browser-side and will download with your slide text automatically in a .zip. You can click the "images" list to delete any of these if you no longer need them.

      FullScreenWebsite: https://example.com. If the website shows as broken, it is being blocked on the other website's end. Your personal website should work fine. You can use this to embed a Youtube video including the start time by clicking 'share' and then 'embed' and copying the embed url on Youtube. (F:)

      Columns: (C:)
        This is the left column. Can contain any
        amount of text, paragraphs, and $math$.
        ---
        Image: whatever.txt, this is the middle column and this text is a caption
        ---
        Third column
        Inside columns you can use inline modes like [[BigText]], [[SmallText]], [[TinyText]], [[Text1.2]], and [[Break:0.5]] and you can also use >>>, <<<, ||| for right, left and center-justified.
        The mode persists until another inline directive overrides it.

      Table: (T:)
        Header 1 & Header 2 & Header 3
        ---
        Cell 1.1 & Cell 1.2 & Cell 1.3
        ---
        Cell 2.1 & Cell 2.2 & $math$ is fine
        Inline modes like [[BigText]] or [[Text.75]] work within any table cell.

      To include a link, write !http... with the exclamation point in front.

      # --- NOTES ---
      # - Download Raw Deck and Load Deck give you your slides but you will still need any images referred to in the same folder
      # - If you want images that are not web-linked, you can paste images into the textbox, and when you download, it will include those images. Keep all in the same folder wherever you store your offline slide text and images.
      # - Ctrl-B makes a bullet point.
      # - If you have browser-side spellcheck turned on, this will work in the slide editor box.
      # - If you print from your browser, it will give slides with PrintNotes. 
      # - If you print from the print icon in Edit mode, it will show the PrintNotes.
      # - If no directive is given, text defaults to `Text:`.
      # - In `Columns` and `Table`, use `---` on its own line to separate sections/rows.
      # - You cannot nest some directives (e.g., a Table inside a Column).
      # - A thin badge appears when content overflows the 16×9 frame.  Hover to see the first 20 characters that spill off the slide.
      # - As you edit, your most-recently-edited slides are stored in LocalStorage via your browser.  Use the restore button to reopen the last deck from a prior session.
      # - The status note in the lower-right reminds you about help on the default deck and reports when decks are restored.
      # - 11 different styles are given, but you can create your own. style-example.css shows you some options for how to do it.
