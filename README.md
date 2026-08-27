# Modern Slides, Kevin A. Bryan, August 2025 [August 26 2026 Update], MIT License

This is a modern, very computationally light slideshow maker. It completely separates style rules from content. You can edit it completely online or download the code from github.com/kevincure/ModernSlides
 or find more similar tools at kevinbryanecon.com/tools.html
 and create your slides locally in your browser. Once your slides are set, click Download. You can upload that json file anywhere and open it with a URL query of the form ?deck=.... For example: https://kevinbryanecon.com/ModernSlides/?deck=Progress2025Class1.  I just toss my slides (in subfolders), the index.html Modern Slides program, and the style-gallery on my website and now never need a USB key. The site loads packages and fonts from the internet in real time.

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
