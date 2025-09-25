# Modern Slides, Kevin Bryan, August 2025, MIT License

This is a modern, very computationally light slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from github.com/kevincure/ModernSlides
 or find more similar tools at kevinbryanecon.com/tools.html
 and create your slides locally in your browser. Once your slides are set, click Download. You can upload that text file anywhere and open it with a URL query of the form ?xml=.... For example: https://kevinbryanecon.com/ModernSlides?xml=Progress2025Class1/Class1Slides.txt.  I just toss my slides and the index.html Modern Slides program on my website and now never need a USB key.

Press e to toggle between edit and present, f to go full screen, and p to open presenter mode.

Each slide is defined by directives in a Markdown type format. A directive starts a line, ends with a colon `:`, and its value is all text that follows until the next directive. In the text editor, you can use abbrevations, noted like [B:]. That is, if you type B: at the start of a line, Background: will automatically pop up
 
# Slide format overview

Each slide is defined by directives in a Markdown-like format.
A directive starts a line, ends with a colon (:), and its value is all text that follows until the next directive.

Examples and common directives are shown below (use the exact directive names):

      # --- METADATA (place at the top) ---
      Background: image-url.jpg (B:)
      FullScreenImage: image-url.jpg (F:)

      # --- CONTENT DIRECTIVES ---
      Title: The Main Title of The Slide (t:)
        Supports $LaTeX$ and
        manual line breaks.

      Header: Small text in corner (h:)

      BigText: For large, prominent text.  Within all standard text (b:)
      <<< Text on Left <<<, 
      >>> Text on Right >>>, and 
      ||| Text is centered ||| can be used.

      Text: For standard body text. (x:)
        A blank line between text...

        ...and a skipped line creates a new paragraph.

      SmallText: For smaller body text. (s:)

      TinyText: For footnote-sized text. (t:)

      Break: 1 (or 2.2 or .7), provides a break of a set size

      Notes: For notes at the bottom of the slide. (n:)
        These appear in a special position.

      SpeakerNote: For notes for yourself in presentation mode (S:)

      PrintNote: notes about the slide to appear only when printed from the 'print' button in Edit (if you print from the slides, you won't get these) (P:)

      Image: image-url.jpg (or a weblink to jpg/png/gif), An optional caption for image after the comma (I:)

      FullScreenWebsite: https://example.com. If the website shows as broken, it is being blocked on the other website's end. Your personal website should work fine. You can use this to embed a Youtube video including the start time by clicking 'share' and then 'embed' and copying the embed url on Youtube. (F:)

      Columns: (C:)
        This is the left column. Can contain any
        amount of text, paragraphs, and $math$.
        ---
        This is the right column. You can put an
        image here using the 'image, caption' syntax:
        test.jpg, A caption for the image in the column.
        ...or you can just have more text.
        ---
        Third column

      Table: (T:)
        Header 1 & Header 2 & Header 3
        ---
        Cell 1.1 & Cell 1.2 & Cell 1.3
        ---
        Cell 2.1 & Cell 2.2 & $math$ is fine

      *some text* is italic, **some text** is bold, ***some text*** is bold italic.

      # --- NOTES ---
      # - Download Raw Deck and Load Deck give you your slides but you
      #      will still need any images referred to in the same folder
      # - If you print from your browser, it will give slides with PrintNotes. 
      # - If you print from the print icon in Edit mode, it will show the PrintNotes.
      # - If no directive is given, text defaults to `Text:`.
      # - In `Columns` and `Table`, use `---` on its own line
      #       to separate sections/rows.
      # - You cannot nest some directives (e.g., a Table inside a Column).
      # - As you edit, your most-recently-edited slides are stored in LocalStorage via your browser, and can be recovered by reopening ModernSlides
      # - 9 different styles are given, but you can create your own alsospecial color and shift other content up.
