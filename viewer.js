const isExtension = typeof chrome !== "undefined"
  && chrome.runtime
  && typeof chrome.runtime.getURL === "function";

// pdf.js UMD exposes either window.pdfjsLib or window['pdfjs-dist/build/pdf']
const pdfjsLib =
  window.pdfjsLib || window["pdfjs-dist/build/pdf"];

if (!pdfjsLib) {
  throw new Error("pdfjsLib not found. Make sure lib/pdf.min.js is loaded before viewer.js");
}

// Use extension URL when in extension; fallback to relative file path when opened directly
pdfjsLib.GlobalWorkerOptions.workerSrc = isExtension
  ? chrome.runtime.getURL("lib/pdf.worker.min.js")
  : "./lib/pdf.worker.min.js";
    let pdfDoc = null, pdfBytes = null, originalPdfBytes = null;
    let pages = [];
    let annotations = {};
    let currentTool = 'select';
    let currentScale = 1;
    const DEFAULT_WIDTH_FRACTION = 0.8;
    let defaultWidthScale = 1;
    const ZOOM_STEPS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
    const MIN_SCALE = ZOOM_STEPS[0];
    const MAX_SCALE = ZOOM_STEPS[ZOOM_STEPS.length - 1];
    const PRINT_RESOLUTION = 150;
    const PRINT_UNITS = PRINT_RESOLUTION / 72;
    let readerMode = false, readerPrevScale = 1, currentPageIndex = 0;
    let dpr = window.devicePixelRatio || 1;

    let signatureDataUrl = localStorage.getItem('userSignature') || null;
    let nextAnnoId = 1, openCommentTarget = null;
    let userName = localStorage.getItem('userName') || '';
    let queuedTool = null;
    let identityHasInk = !!signatureDataUrl;
    const TOOL_LABELS = {
      select: 'Read mode',
      selectText: 'Select text',
      textOnce: 'Annotate',
      commentOnce: 'Add Comment',
      signatureOnce: 'Signature'
    };

    let resizeTimer = null, selectedAnnoEl = null;
    let isRendering = false, rerenderQueued = false;
    let scrollTimer = null;
    let searchResults = [];
    let currentMatchIndex = -1;
    let lastSearchQuery = '';
    let searchDirty = false;
    const deletedPdfThreads = [];

    const el = (id) => document.getElementById(id);
    const pagesEl = el('pages'), mainEl = el('main');
    let printContainer = el('printContainer');
    document.addEventListener('DOMContentLoaded', () => {
      // viewer.html adds #printContainer after the script — grab it once DOM is ready
      printContainer = document.getElementById('printContainer');
    });

    // Handle Ctrl/Cmd+P forwarded from the content script
    window.addEventListener('message', (e) => {
      if (e?.data?.type === 'PDF_VIEWER_PRINT' && pdfDoc) {
        prepareForPrint().then(() => {
          document.body.classList.add('print-ready');
          window.print();
        });
      }
    });
    const modeIndicator = el('modeIndicator');
    const annotationLinkService = {
      externalLinkTarget: pdfjsLib?.LinkTarget?.BLANK ?? 0,
      externalLinkRel: 'noopener noreferrer nofollow',
      getDestinationHash(dest) {
        if (typeof dest === 'string') return dest;
        try { return JSON.stringify(dest); } catch (_) { return String(dest); }
      },
      getAnchorUrl(hash) {
        return `#${hash}`;
      },
      setHash() {},
      addLinkAttributes(element, data) {
        if (!element) return;
        const service = this;
        if (data?.url) {
          element.href = data.url;
          element.target = '_blank';
          element.rel = this.externalLinkRel;
          element.dataset.pdfExternalUrl = data.url;
          delete element.dataset.pdfDest;
        } else if (data?.dest) {
          element.dataset.pdfDest = JSON.stringify(data.dest);
          element.href = this.getAnchorUrl(this.getDestinationHash(data.dest));
          delete element.dataset.pdfExternalUrl;
        }
        if (!element.dataset.pdfLinkBound) {
          element.dataset.pdfLinkBound = '1';
          element.addEventListener('click', (ev) => {
            const external = element.dataset.pdfExternalUrl;
            const destJson = element.dataset.pdfDest;
            if (external) {
              ev.preventDefault();
              window.open(external, '_blank', 'noopener,noreferrer');
              return;
            }
            if (destJson) {
              ev.preventDefault();
              let destVal = destJson;
              try {
                destVal = JSON.parse(destJson);
              } catch (_) {
                // ignore parse errors, fall back to raw string
              }
              service.navigateTo(destVal);
            }
          });
        }
      },
      goToDestination(dest) {
        if (!pdfDoc) return;
        (async () => {
          try {
            const explicitDest = await pdfDoc.getDestination(dest);
            if (!explicitDest) return;
            const ref = explicitDest[0];
            const pageIndex = await pdfDoc.getPageIndex(ref);
            goToPageNumber(pageIndex + 1);
          } catch (err) {
            console.warn('Failed to follow destination', err);
          }
        })();
      },
      navigateTo(dest) {
        this.goToDestination(dest);
      }
    };
    let loadErrorBanner = document.getElementById('loadErrorBanner');
    let loadErrorMessage = document.getElementById('loadErrorMessage');
    let loadErrorCopy = document.getElementById('loadErrorCopy');
    let loadErrorCopyDefaultText = loadErrorCopy ? loadErrorCopy.textContent : 'Copy PDF link';
    let pendingLoadError = null;
    let loadErrorDomReadyListenerAttached = false;

const leftBar = document.getElementById('leftBar');

    function ensureLoadErrorElements() {
      if (!loadErrorBanner) {
        loadErrorBanner = document.getElementById('loadErrorBanner');
      }
      if (!loadErrorMessage) {
        loadErrorMessage = document.getElementById('loadErrorMessage');
      }
      if (!loadErrorCopy) {
        loadErrorCopy = document.getElementById('loadErrorCopy');
      }
      if (loadErrorCopy) {
        loadErrorCopyDefaultText = loadErrorCopy.textContent || loadErrorCopyDefaultText;
      }
    }

    function hideLoadError() {
      ensureLoadErrorElements();
      pendingLoadError = null;
      if (loadErrorBanner) {
        loadErrorBanner.classList.add('hidden');
      }
      if (loadErrorCopy) {
        loadErrorCopy.disabled = true;
        loadErrorCopy.dataset.sourceUrl = '';
        loadErrorCopy.textContent = loadErrorCopyDefaultText;
      }
    }

    function showLoadError(message, sourceUrl) {
      ensureLoadErrorElements();
      if (!loadErrorBanner || !loadErrorMessage) {
        pendingLoadError = { message, sourceUrl };
        if (!loadErrorDomReadyListenerAttached && document.readyState === 'loading') {
          loadErrorDomReadyListenerAttached = true;
          document.addEventListener('DOMContentLoaded', () => {
            const pending = pendingLoadError;
            pendingLoadError = null;
            if (pending) {
              showLoadError(pending.message, pending.sourceUrl);
            }
          }, { once: true });
        }
        return;
      }
      if (pendingLoadError && pendingLoadError.message === message && pendingLoadError.sourceUrl === sourceUrl) {
        pendingLoadError = null;
      }
      loadErrorMessage.textContent = message;
      if (loadErrorCopy) {
        if (sourceUrl) {
          loadErrorCopy.disabled = false;
          loadErrorCopy.dataset.sourceUrl = sourceUrl;
        } else {
          loadErrorCopy.disabled = true;
          loadErrorCopy.dataset.sourceUrl = '';
        }
        loadErrorCopy.textContent = loadErrorCopyDefaultText;
      }
      loadErrorBanner.classList.remove('hidden');
    }

    function sendRuntimeMessage(message) {
      return new Promise((resolve, reject) => {
        if (!chrome.runtime?.sendMessage) {
          reject(new Error('Extension messaging is unavailable.'));
          return;
        }
        try {
          chrome.runtime.sendMessage(message, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    function normalizePdfSourceUrl(url) {
      if (!url) return url;
      try {
        const parsed = new URL(url, location.href);
        const host = parsed.hostname.toLowerCase();
        if (host === 'www.dropbox.com' || host === 'dropbox.com') {
          parsed.hostname = 'dl.dropboxusercontent.com';
          parsed.searchParams.set('dl', '0');
          return parsed.toString();
        }
      } catch (err) {
        // Ignore URL parsing issues; fall through to returning the original value.
      }
      return url;
    }

    function clonePdfRect(rect) {
      if (!rect) return null;
      const left = Number(rect.left);
      const right = Number(rect.right);
      const top = Number(rect.top);
      const bottom = Number(rect.bottom);
      if (
        !Number.isFinite(left) ||
        !Number.isFinite(right) ||
        !Number.isFinite(top) ||
        !Number.isFinite(bottom)
      ) {
        return null;
      }
      return { left, right, top, bottom };
    }

    function markPdfThreadForDeletion(anno) {
      if (!anno || anno.type !== 'comment' || anno.origin !== 'pdf') return;
      deletedPdfThreads.push({
        page: anno.page,
        x: anno.x,
        y: anno.y,
        rect: clonePdfRect(anno.pdfRect)
      });
    }

    function safeCssEscape(value) {
      if (typeof value !== 'string') value = String(value ?? '');
      if (window.CSS?.escape) return window.CSS.escape(value);
      return value.replace(/[\0-\x1F\x7F"'\\]/g, (ch) => {
        const hex = ch.charCodeAt(0).toString(16).padStart(2, '0');
        return `\\${hex} `;
      });
    }

    function readWidgetDomState(widgetId) {
      if (!widgetId) return null;
      try {
        const selector = `[data-annotation-id="${safeCssEscape(widgetId)}"]`;
        const container = document.querySelector(selector);
        if (!container) return null;
        const field = container.matches('input, select, textarea')
          ? container
          : container.querySelector('input, select, textarea');
        if (!field) return null;
        if (field.type === 'checkbox' || field.type === 'radio') {
          return { type: field.type, checked: field.checked, value: field.value };
        }
        if (field.tagName === 'SELECT') {
          const selected = Array.from(field.selectedOptions || []).map(opt => opt.value);
          return { type: 'select', value: field.multiple ? selected : (selected[0] ?? '') };
        }
        return { type: 'text', value: field.value };
      } catch (err) {
        return null;
      }
    }

    function commitPdfJsFormEdits() {
      const active = document.activeElement;
      if (active && typeof active.blur === 'function' && active.closest('.pdf-annotation-layer')) {
        const changeEvent = new Event('change', { bubbles: true });
        try { active.dispatchEvent(changeEvent); } catch (_) {}
        active.blur();
      }
    }

    function attachLoadErrorCopyHandler() {
      ensureLoadErrorElements();
      if (!loadErrorCopy || loadErrorCopy.dataset.handlerAttached === '1') {
        return;
      }
      loadErrorCopy.dataset.handlerAttached = '1';
      loadErrorCopy.addEventListener('click', async () => {
        const url = loadErrorCopy.dataset.sourceUrl;
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          loadErrorCopy.textContent = 'Copied!';
          setTimeout(() => {
            loadErrorCopy.textContent = loadErrorCopyDefaultText;
          }, 1500);
        } catch (err) {
          console.warn('Clipboard copy failed, falling back to prompt', err);
          window.prompt('Copy PDF URL:', url);
        }
      });
    }

    attachLoadErrorCopyHandler();
    document.addEventListener('DOMContentLoaded', attachLoadErrorCopyHandler, { once: true });

    function setControlWidth() {
      const lb = leftBar?.getBoundingClientRect();

      if (mainEl && lb && leftBar) { // Added leftBar check
        const activeTool = document.body.classList.contains('tool-mode-active');
        leftBar.style.display = 'flex';
        leftBar.classList.toggle('tool-mode', activeTool);
        mainEl.style.cursor = activeTool ? 'crosshair' : 'auto';
        if (!activeTool) {
          const lbWidth = lb.width || 0;
          if (lbWidth > 0) {
            mainEl.style.paddingLeft = '';
          }
        }
      }

      // The control width logic
      const w = lb ? Math.max(120, Math.floor(lb.width / 2) - 8) : 180;
      document.documentElement.style.setProperty('--control-width', `${w}px`);
    }

    const fileInput = el('file'), saveBtn = el('saveBtn');
    const identityBtn = el('identityBtn'), textTool = el('textTool'), commentTool = el('commentTool'), signatureTool = el('signatureTool');
    const selectTextTool = el('selectTextTool');
    const zoomOutBtn = el('zoomOutBtn'), zoomInBtn = el('zoomInBtn'), fitWidthBtn = el('fitWidthBtn'), toggleReaderBtn = el('toggleReaderBtn');
    const prevPageBtn = el('prevPageBtn'), nextPageBtn = el('nextPageBtn');

    const helpBtn = el('helpBtn'), helpModal = el('helpModal'), helpClose = el('helpClose');

    const textStylePanel = el('textStylePanel'),
          textFontFamily = el('textFontFamily'),
          textFontSize = el('textFontSize'),
          textBoldBtn = el('textBoldBtn'),
          textItalicBtn = el('textItalicBtn'),
          textColor = el('textColor');

    const identityModal = el('identityModal'),
          identityName = el('identityName'),
          identityClose = el('identityClose'),
          identityClear = el('identityClear'),
          identitySave = el('identitySave'),
          identitySignatureCanvas = el('identitySignatureCanvas'),
          identityCtx = identitySignatureCanvas.getContext('2d');

    const cs = {
      panel: el('commentSidebar'),
      title: el('csTitle'),
      thread: el('csThread'),
      authorName: el('csAuthorName'),
      identityBtn: el('csIdentityBtn'),
      text: el('csText'),
      post: el('csPost'),
      hide: el('csReplyClose')
    };

    const searchInput = el('searchInput'),
          searchPrevBtn = el('searchPrevBtn'),
          searchNextBtn = el('searchNextBtn'),
          searchStatus = el('searchStatus');

    function clamp(i, min, max) {
      return Math.max(min, Math.min(max, i));
    }

function pageWindow(centerIndex){
  if(!pdfDoc) return [1,1];
  const pc = pdfDoc.numPages;
  const p = clamp(centerIndex+1, 1, pc); // 1-based page number
  const SPAN = 50; // how many pages around current to render
  return [Math.max(1, p-SPAN), Math.min(pc, p+SPAN)];
}

async function renderWindowAroundCurrent(){
  if(!pdfDoc) return;
  const [start, end] = pageWindow(currentPageIndex);

  // Ensure wrappers exist for layout stability
  for (let i = 1; i <= pdfDoc.numPages; i++) ensurePageSlot(i);

  // Paint only current page +/- predefined span above 
  const tasks = [];
  for (let i = start; i <= end; i++) {
    const slot = pages[i-1];
    const needsPaint = !slot._painted || slot._scale !== currentScale || slot._dpr !== dpr;
    if (needsPaint) {
      tasks.push(
        renderPage(i).then(async () => {
          slot._painted = true; slot._scale = currentScale; slot._dpr = dpr;
          if (currentTool === 'selectText') await renderTextLayer(i);
        })
      );
    }
  }
  await Promise.all(tasks);
}

// Track the most-visible page while scrolling and keep the window rendered
function updateCurrentPageFromScroll(){
  if(!pdfDoc) return;
  const wraps = pagesEl.querySelectorAll('.page');
  let bestIndex = currentPageIndex, bestDist = Infinity;
  const container = mainEl.getBoundingClientRect();
  const targetY = container.top + container.height/2;

  wraps.forEach(w=>{
    const r = w.getBoundingClientRect();
    const cy = r.top + r.height/2;
    const d = Math.abs(cy - targetY);
    if (d < bestDist) { bestDist = d; bestIndex = (parseInt(w.dataset.page,10) - 1); }
  });

  if (bestIndex !== currentPageIndex) {
    currentPageIndex = bestIndex;
    updatePageInfo();
  }
  renderWindowAroundCurrent();
}

// Lightly throttle the scroll-driven updates
let visTimer = null;
mainEl.addEventListener('scroll', ()=>{
  if (visTimer) clearTimeout(visTimer);
  visTimer = setTimeout(updateCurrentPageFromScroll, 90);
}, { passive: true });


    function getBaseScale() {
      const base = defaultWidthScale || 1;
      return base > 0 ? base : 1;
    }

    function getRelativeScale(scale = currentScale) {
      const base = getBaseScale();
      return clamp(scale / base, ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    }

    function snapIndexFromRelative(ratio) {
      let best = 0, d = 1e9;
      for (let i = 0; i < ZOOM_STEPS.length; i++) {
        const di = Math.abs(ZOOM_STEPS[i] - ratio);
        if (di < d) {
          d = di;
          best = i;
        }
      }
      return best;
    }

    function getMainContentSize() {
      const s = getComputedStyle(mainEl);
      const padX = parseFloat(s.paddingLeft || '0') + parseFloat(s.paddingRight || '0');
      const padY = parseFloat(s.paddingTop || '0') + parseFloat(s.paddingBottom || '0');
      return {
        width: Math.max(0, mainEl.clientWidth - padX),
        height: Math.max(0, mainEl.clientHeight - padY)
      };
    }

    async function computeReaderFitScale() {
      if (!pdfDoc) return currentScale;
      const p = await pdfDoc.getPage(clamp(currentPageIndex + 1, 1, pdfDoc.numPages));
      const vp = p.getViewport({ scale: 1 });
      const { width: w, height: h } = getMainContentSize();
      if (w <= 0 || h <= 0) return currentScale;
      return clamp(Math.min(w / vp.width, h / vp.height), MIN_SCALE, MAX_SCALE);
    }

    function setTool(name) {
      currentTool = name;
      [textTool, commentTool, signatureTool, selectTextTool].forEach(b => b && b.classList.remove('active'));
      if (name === 'textOnce' && textTool) textTool.classList.add('active');
      if (name === 'commentOnce' && commentTool) commentTool.classList.add('active');
      if (name === 'signatureOnce' && signatureTool) signatureTool.classList.add('active');
      if (name === 'selectText' && selectTextTool) selectTextTool.classList.add('active');
      updateInteractionModes();
      const isToolMode = name === 'textOnce' || name === 'commentOnce' || name === 'signatureOnce';
      document.body.classList.toggle('tool-mode-active', isToolMode);
      updateModeIndicator();
      setControlWidth(); // Re-calculate padding and visibility
    }

    function updateModeIndicator() {
      if (!modeIndicator) return;
      const label = TOOL_LABELS[currentTool] || TOOL_LABELS.select;
      modeIndicator.textContent = label;
      modeIndicator.classList.toggle('is-active', currentTool !== 'select');
    }

    updateModeIndicator();
    setControlWidth();

    function updateIdentityDisplay() {
      if (cs.authorName) cs.authorName.textContent = userName || 'Set name';
    }

    function updateToolbarStates() {
      if (saveBtn) saveBtn.disabled = !pdfDoc;
      if (toggleReaderBtn) toggleReaderBtn.classList.toggle('active', readerMode);
      if (identityBtn) identityBtn.title = userName ? `Signed in as ${userName}` : 'Set name & signature';
    }


    function updateInteractionModes() {
      const selecting = currentTool === 'selectText';
      const toolActive  = (currentTool === 'textOnce' ||
                           currentTool === 'commentOnce' ||
                           currentTool === 'signatureOnce');
      pages.forEach(slot => {
        if (!slot) return;
        if (slot.textLayer) {
          slot.textLayer.classList.toggle('hidden', !selecting);
          slot.textLayer.style.pointerEvents = selecting ? 'auto' : 'none';
        }
        if (slot.layer) {
          slot.layer.style.pointerEvents = toolActive ? 'auto' : 'none';
        }
        if (slot.pdfLayer) {
          const shouldBlockPdfLayer = selecting || toolActive;
          slot.pdfLayer.style.pointerEvents = shouldBlockPdfLayer ? 'none' : 'auto';
        }
      });
      if (selecting) renderTextLayersForAll();
    }

    function setSelectedAnnotation(el) {
      if (selectedAnnoEl && selectedAnnoEl !== el) selectedAnnoEl.classList.remove('selected');
      selectedAnnoEl = el || null;
      if (selectedAnnoEl) selectedAnnoEl.classList.add('selected');
    }

    function toRgb(hex) {
      const r = parseInt(hex.substr(1, 2), 16) / 255,
            g = parseInt(hex.substr(3, 2), 16) / 255,
            b = parseInt(hex.substr(5, 2), 16) / 255;
      return { r, g, b };
    }

    function escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function ensurePageSlot(num) {
      let slot = pages[num - 1];
      if (slot) return slot;

      const canvas = document.createElement('canvas');
      const textLayer = document.createElement('div');
      textLayer.className = 'textLayer hidden';
      const pdfLayer = document.createElement('div');
      pdfLayer.className = 'pdf-annotation-layer annotationLayer';
      const layer = document.createElement('div');
      layer.className = 'layer';
      const wrap = document.createElement('div');
      wrap.className = 'page';
      wrap.dataset.page = num;

      wrap.appendChild(canvas);
      wrap.appendChild(textLayer);
      wrap.appendChild(pdfLayer);
      wrap.appendChild(layer);
      pagesEl.appendChild(wrap);

      slot = {
        num,
        canvas,
        ctx: canvas.getContext('2d'),
        pdfLayer,
        layer,
        textLayer,
        baseW: 0,
        baseH: 0,
        renderTask: null,
        pdfRenderTask: null,
        pdfAnnotationLayer: null,
        pdfRenderToken: 0
      };
      pages[num - 1] = slot;

      attachLayerEvents(layer, num);
      return slot;
    }

    function cancelAllPageRenders() {
      pages.forEach(s => {
        if (s && s.renderTask) {
          try {
            s.renderTask.cancel();
          } catch (_) {}
          s.renderTask = null;
        }
        if (s) {
          s.pdfRenderToken++;
          if (s.pdfRenderTask && typeof s.pdfRenderTask.cancel === 'function') {
            try { s.pdfRenderTask.cancel(); } catch (_) {}
          }
          s.pdfRenderTask = null;
          s.pdfAnnotationLayer = null;
          if (s.pdfLayer) s.pdfLayer.innerHTML = '';
        }
      });
    }

function goToPageNumber(n){
  if(!pdfDoc) return;
  currentPageIndex = clamp(n-1, 0, pdfDoc.numPages-1);
  if (readerMode) {
    applyReaderLayout();
    mainEl.scrollTop = 0; mainEl.scrollLeft = 0;
  } else {
    const t = pagesEl.querySelector(`.page[data-page="${currentPageIndex+1}"]`);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  updatePageInfo();
  renderWindowAroundCurrent();
}

    function syncPdfLayerTransform(slot, viewport) {
      if (!slot?.pdfLayer) return;
      const width = viewport?.width ?? ((slot.baseW || 0) * currentScale);
      const height = viewport?.height ?? ((slot.baseH || 0) * currentScale);
      slot.pdfLayer.style.width = `${width}px`;
      slot.pdfLayer.style.height = `${height}px`;
      slot.pdfLayer.style.left = '0';
      slot.pdfLayer.style.top = '0';
      slot.pdfLayer.style.transformOrigin = '0 0';
      slot.pdfLayer.style.transform = '';
    }

    async function renderPage(num) {
      const page = await pdfDoc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: currentScale });
      const slot = ensurePageSlot(num);

      const wrap = slot.canvas.parentElement;
      if (wrap) {
        wrap.style.setProperty(
          'contain-intrinsic-size',
          `${Math.ceil(viewport.width)}px ${Math.ceil(viewport.height)}px`
        );
      }
      slot.baseW = base.width;
      slot.baseH = base.height;

      slot.canvas.style.width = `${viewport.width}px`;
      slot.canvas.style.height = `${viewport.height}px`;

      const rw = Math.floor(viewport.width * dpr);
      const rh = Math.floor(viewport.height * dpr);
      if (slot.canvas.width !== rw || slot.canvas.height !== rh) {
        slot.canvas.width = rw;
        slot.canvas.height = rh;
      }

      slot.layer.style.width = `${base.width}px`;
      slot.layer.style.height = `${base.height}px`;
      slot.layer.style.transform = `scale(${currentScale})`;
      syncPdfLayerTransform(slot, viewport);

      slot.textLayer.style.width = `${viewport.width}px`;
      slot.textLayer.style.height = `${viewport.height}px`;
      slot.textLayer.style.transform = '';

      if (slot.renderTask) {
        try {
          slot.renderTask.cancel();
        } catch (_) {}
      }
      const t = [dpr, 0, 0, dpr, 0, 0];
      const renderParams = { canvasContext: slot.ctx, viewport, transform: t };
      const formsMode = pdfjsLib?.AnnotationMode?.ENABLE_FORMS;
      if (typeof formsMode === 'number') {
        renderParams.annotationMode = formsMode;
      }
      slot.renderTask = page.render(renderParams);

      try {
        await slot.renderTask.promise;
      } catch (e) {
        if (!(e && e.name === 'RenderingCancelledException')) throw e;
      } finally {
        slot.renderTask = null;
      }

      await renderPdfAnnotations(slot, page, viewport);
    }

    async function renderTextLayer(num) {
      const slot = ensurePageSlot(num);
      if (!slot.textLayer) return;

      slot.textLayer.innerHTML = '';
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: currentScale });
      slot.textLayer.style.setProperty('--scale-factor', String(viewport.scale));

      const textContent = await page.getTextContent({ includeMarkedContent: true });

      const task = pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: slot.textLayer,
        viewport,
        enhanceTextSelection: true
      });
      await task.promise;
    }

    async function renderPdfAnnotations(slot, page, viewport) {
      if (!slot.pdfLayer) return;
      slot.pdfRenderToken++;
      const renderToken = slot.pdfRenderToken;
      if (slot.pdfRenderTask && typeof slot.pdfRenderTask.cancel === 'function') {
        try { slot.pdfRenderTask.cancel(); } catch (_) {}
      }
      slot.pdfRenderTask = null;
      slot.pdfAnnotationLayer = null;

      if (slot.pdfLayer) {
        const parent = slot.pdfLayer.parentElement;
        if (parent) {
          const replacement = slot.pdfLayer.cloneNode(false);
          parent.replaceChild(replacement, slot.pdfLayer);
          slot.pdfLayer = replacement;
        } else {
          slot.pdfLayer.innerHTML = '';
        }
        syncPdfLayerTransform(slot, viewport);
      }
      const allAnnots = await page.getAnnotations({ intent: 'display' });
      // Drop sticky-note comments; we render our own pins/threads for those.
      const annotations = allAnnots.filter(a => {
        const t = a.annotationType ?? a.subtype ?? a.subType;
        // pdf.js: AnnotationType.TEXT === 1
         return t !== 1 && t !== 'Text' && t !== 28 && t !== 'Popup';
      });
      if (!annotations || !annotations.length) {
        slot.pdfRenderTask = null;
        return;
      }
      const AnnotationLayerClass = pdfjsLib?.AnnotationLayer;
      if (typeof AnnotationLayerClass !== 'function') {
        console.warn('Annotation layer class missing; skipping interactive annotations.');
        return;
      }
      const viewportForAnnots = viewport.clone({ dontFlip: false });
      const nullL10n = pdfjsLib?.NullL10n || {
        get(str) { return Promise.resolve(str); },
        translate() { return Promise.resolve(); }
      };
      const layer = new AnnotationLayerClass({
        div: slot.pdfLayer,
        accessibilityManager: null,
        annotationCanvasMap: null,
        l10n: nullL10n,
        page,
        viewport: viewportForAnnots
      });
      const renderTask = layer.render({
        annotations,
        intent: 'display',
        viewport: viewportForAnnots,
        renderInteractiveForms: true,
        annotationStorage: pdfDoc?.annotationStorage,
        linkService: annotationLinkService,
        downloadManager: null
      });
      slot.pdfRenderTask = renderTask;
      try {
        if (renderTask && 'promise' in renderTask && renderTask.promise) {
          await renderTask.promise;
        } else {
          await renderTask;
        }
        if (slot.pdfRenderToken === renderToken) {
          slot.pdfAnnotationLayer = layer;
        }
      } catch (err) {
        if (!(err && err.name === 'RenderingCancelledException')) {
          console.warn('Annotation layer render failed', err);
        }
      }
    }

    async function renderTextLayersForAll() {
      if (!pdfDoc) return;
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        await renderTextLayer(i);
      }
    }

    async function renderAll() {
      if (isRendering) {
        rerenderQueued = true;
        return;
      }
      isRendering = true;

      pagesEl.querySelectorAll('.text-anno, .sig-anno, .comment-pin, .markup-anno').forEach(el => el.remove());

      try {
        const keepPos = pagesEl.scrollHeight > 0
          ? (pagesEl.scrollHeight - mainEl.clientHeight > 0
              ? mainEl.scrollTop / (pagesEl.scrollHeight - mainEl.clientHeight)
              : 0)
          : 0;

        clearSearch();
        cancelAllPageRenders();
        pagesEl.innerHTML = '';
        pages.length = 0;

        setSelectedAnnotation(null);
        hideTextToolbar();

        for (let i=1; i<=pdfDoc.numPages; i++) { ensurePageSlot(i); }
        await renderWindowAroundCurrent();
        if (currentTool === 'selectText') await renderTextLayersForAll();

        rehydrateAnnotations();

        if (pagesEl.scrollHeight > 0) {
          const total = pagesEl.scrollHeight - mainEl.clientHeight;
          if (total > 0) mainEl.scrollTop = keepPos * total;
        }

        updatePageInfo();
        renderWindowAroundCurrent();
        applyReaderLayout();
      } finally {
        isRendering = false;
        if (rerenderQueued) {
          rerenderQueued = false;
          renderAll();
        }
      }
    }

    function rehydrateAnnotations() {
      if (!pdfDoc) return;
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const slot = ensurePageSlot(pageNum);
        const list = annotations[String(pageNum)] || [];
        for (const a of list) {
          if (a.type === 'comment' && !a.thread) {
            a.thread = [];
          }
          addAnnotationElement(slot.layer, pageNum, a, { addToState: false });
        }
      }
    }

    function getAuthor(an) {
      return (
        (an.title && an.title.trim()) ||
        (an.t && String(an.t).trim()) ||
        (an.titleObj?.str && an.titleObj.str.trim()) ||
        ''
      );
    }

    async function importPdfComments() {
      if (!pdfDoc) return;

      let maxId = nextAnnoId;
      for (const key in annotations) {
        const list = annotations[key];
        if (Array.isArray(list)) for (const a of list) if (a.id >= maxId) maxId = a.id + 1;
      }

      // Process all pages in parallel
      const pagePromises = [];
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        pagePromises.push(
          (async (pNum) => {
            const page = await pdfDoc.getPage(pNum);
            const vp = page.getViewport({ scale: 1 });
            const ph = vp.height;

            const annots = await page.getAnnotations({ intent: 'display' });
            if (!annots || !annots.length) return null;

            const texts = annots.filter(an =>
              (an.subtype || an.subType || an.annotationType) === 'Text' || an.annotationType === 1
            );
            if (!texts.length) return null;

            const byId = new Map();
            const getId = (an) => an.id || an.annotationId || (an.ref ? String(an.ref) : null);
            for (const an of texts) {
              const id = getId(an);
              if (id) byId.set(id, { ...an });
            }

            const rootOf = (id) => {
              let cur = byId.get(id), safety = 0;
              while (cur && cur.inReplyTo && byId.has(cur.inReplyTo) && safety++ < 32) {
                cur = byId.get(cur.inReplyTo);
              }
              return cur;
            };

            const groups = new Map();
            for (const an of byId.values()) {
              const root = an.inReplyTo ? rootOf(an.inReplyTo) : an;
              const rootId = getId(root);
              if (!rootId) continue;
              let g = groups.get(rootId);
              if (!g) {
                g = { root: root, replies: [] };
                groups.set(rootId, g);
              }
              if (an !== root) g.replies.push(an);
            }

            const pageAnnotations = [];
            for (const g of groups.values()) {
              const r = (g.root.rect || []).map(Number);
              if (r.length < 4) continue;
              const left = Math.min(r[0], r[2]);
              const right = Math.max(r[0], r[2]);
              const top = Math.max(r[1], r[3]);
              const bottom = Math.min(r[1], r[3]);
              const x = left;
              const y = ph - top;
              const pdfRect = { left, right, top, bottom };

              const thread = [];
              const rootAuthor = getAuthor(g.root) || 'Imported Author';
              const rootText = (g.root.contentsObj?.str || g.root.contents || g.root.content || '').trim();
              if (rootText) thread.push({ author: rootAuthor, text: rootText, time: '', imported: true });

              const sortedReplies = g.replies.sort((a, b) => (a.creationDate || '').localeCompare(b.creationDate || ''));

              for (const rep of sortedReplies) {
                const repAuthor = getAuthor(rep) || 'Imported Author';
                const repText = (rep.contentsObj?.str || rep.contents || rep.content || '').trim();
                if (repText) thread.push({ author: repAuthor, text: repText, time: '', imported: true });
              }

              if (thread.length > 0) {
                pageAnnotations.push({
                  page: pNum,
                  x,
                  y,
                  thread,
                  type: 'comment',
                  origin: 'pdf',
                  _importedCount: thread.length,
                  pdfRect
                });
              }
            }
            return { pageNum: pNum, annotations: pageAnnotations };
          })(pageNum)
        );
      }

      // Wait for all pages to complete
      const results = await Promise.all(pagePromises);
      
      // Now assign IDs and add to annotations object
      for (const result of results) {
        if (!result || !result.annotations.length) continue;
        const pageKey = String(result.pageNum);
        if (!annotations[pageKey]) annotations[pageKey] = [];
        for (const anno of result.annotations) {
          if (anno.type === 'comment') normalizeCommentAnnotation(anno);
          anno.id = maxId++;
          annotations[pageKey].push(anno);
        }
      }
      
      nextAnnoId = maxId;
    }

    function clearSearch() {
      searchResults.forEach(res => res.element?.remove());
      searchResults = [];
      currentMatchIndex = -1;
      searchStatus.textContent = '0 / 0';
      searchInput.value = '';
      lastSearchQuery = '';
      searchDirty = false;
      if (searchContainer) {
        searchContainer.classList.remove('has-query');
      }
    }

    function updateActiveHighlight() {
      const hasResults = searchResults.length > 0;
      searchNextBtn.disabled = !hasResults;
      searchPrevBtn.disabled = !hasResults;

      if (!hasResults) {
        searchStatus.textContent = '0 / 0';
        return;
      }

      if (currentMatchIndex === -1 && searchResults.length > 0) currentMatchIndex = 0;
      if (currentMatchIndex < 0) return;

      searchResults.forEach((res, index) => {
        res.element?.classList.toggle('current-match', index === currentMatchIndex);
      });

      const currentResult = searchResults[currentMatchIndex];
      if (currentResult && currentResult.element) {
        currentResult.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        searchStatus.textContent = `${currentMatchIndex + 1} / ${searchResults.length}`;
      }
    }

    async function performSearch() {
      if (!pdfDoc) return;
      const query = (searchInput.value || '').trim().toLowerCase();
      lastSearchQuery = query;

      searchResults.forEach(res => res.element?.remove());
      searchResults = [];
      currentMatchIndex = -1;

      if (!query) {
        updateActiveHighlight();
        searchDirty = false;
        return;
      }

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const slot = ensurePageSlot(i);
        const { height: pageH } = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        for (const item of textContent.items) {
          const itemText = item.str.toLowerCase();
          if (itemText.includes(query)) {
            let startIndex = 0;
            while ((startIndex = itemText.indexOf(query, startIndex)) > -1) {
              const [sX, sY, eX, eY, tX, tY] = item.transform;
              const itemW = item.width;

              const highlight = document.createElement('div');
              highlight.className = 'search-highlight';

              const startPos = tX + (itemW * (startIndex / item.str.length));
              const matchWidth = itemW * (query.length / item.str.length);

              highlight.style.left = `${startPos}px`;
              highlight.style.top = `${pageH - tY - (item.height * 0.8)}px`;
              highlight.style.width = `${matchWidth}px`;
              highlight.style.height = `${item.height}px`;

              slot.layer.appendChild(highlight);
              searchResults.push({ pageNum: i, element: highlight });

              startIndex += query.length;
            }
          }
        }
      }
      updateActiveHighlight();
      searchDirty = false;
    }

    async function loadPdfBytesArray(buf) {
      const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const stable = data.slice ? data.slice() : new Uint8Array(data);
      pdfBytes = stable;
      originalPdfBytes = stable.slice();

      const loading = pdfjsLib.getDocument({ data: pdfBytes });
      pdfDoc = await loading.promise;

      printPrepared = false;
      printInFlight = null;
      if (printContainer) printContainer.innerHTML = '';

      annotations = {};
      nextAnnoId = 1;
      deletedPdfThreads.length = 0;

      await importPdfComments();

      readerMode = false;
      currentPageIndex = 0;

      const baseScale = await computeWidthScale(DEFAULT_WIDTH_FRACTION);
      if (Number.isFinite(baseScale)) {
        defaultWidthScale = baseScale;
        currentScale = baseScale;
        readerPrevScale = baseScale;
      } else {
        currentScale = 1;
        defaultWidthScale = currentScale;
        readerPrevScale = 1;
      }

      // Use windowing - only render visible pages initially
      await renderWindowAroundCurrent();
      rehydrateAnnotations();
      updatePageInfo();
      setTool('select');
      hideTextToolbar();
      clearSearch();
      closeCommentUI();
      updateToolbarStates();

      if (mainEl) {
        requestAnimationFrame(() => {
          if (document.activeElement !== mainEl) {
            mainEl.focus({ preventScroll: true });
          }
        });
      }
    }

    if (fileInput) fileInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const b = await f.arrayBuffer();
      await loadPdfBytesArray(new Uint8Array(b));
      e.target.value = '';
    };

    function fontKeyFor(f, w, s) {
      const fam = /times/i.test(f || '') ? 'Times' : (/courier/i.test(f || '') ? 'Courier' : 'Helvetica');
      const bold = String(w || '').toLowerCase() === 'bold';
      const italic = String(s || '').toLowerCase() === 'italic';
      if (fam === 'Helvetica') {
        if (bold && italic) return 'HelveticaBoldOblique';
        if (bold) return 'HelveticaBold';
        if (italic) return 'HelveticaOblique';
        return 'Helvetica';
      }
      if (fam === 'Times') {
        if (bold && italic) return 'TimesBoldItalic';
        if (bold) return 'TimesBold';
        if (italic) return 'TimesItalic';
        return 'TimesRoman';
      }
      if (bold && italic) return 'CourierBoldOblique';
      if (bold) return 'CourierBold';
      if (italic) return 'CourierOblique';
      return 'Courier';
    }

    function wrapLines(text, pdfFont, size, maxWidth) {
      const paras = (text || '').replace(/\r\n/g, '\n').split('\n');
      const out = [];
      for (const para of paras) {
        const words = para.split(/\s+/);
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          const width = pdfFont.widthOfTextAtSize(test, size);
          if (width <= maxWidth) {
            line = test;
          } else {
            if (line) out.push(line);
            line = w;
          }
        }
        out.push(line);
      }
      return out;
    }

    saveBtn.onclick = async () => {
      if (!pdfBytes || !pdfDoc) {
        alert('Open a PDF first.');
        return;
      }


      // Helper: find nearest existing Text annotation to use as IRT
      function findNearestTextAnnotRef(doc, annotsArray, target, tol = 32) {
          try {
            const N = PDFLib.PDFName;
            const arr = annotsArray.asArray ? annotsArray.asArray() : (annotsArray.array || []);
            let bestRef = null, bestScore = 1e12;
            for (const ref of arr) {
              const dict = doc.context.lookup(ref);
              if (!dict || String(dict.get(N.of('Subtype'))) !== '/Text') continue;
              const rect = dict.get(N.of('Rect'));
              if (!rect || !rect.asArray) continue;
              const nums = rect.asArray().map(n =>
               n?.number !== undefined ? n.number : (n?.asNumber ? n.asNumber() : Number(n))
              );
              const [x1,y1,x2,y2] = nums;
              const rx1 = Math.min(x1, x2);
              const rx2 = Math.max(x1, x2);
              const ry1 = Math.min(y1, y2);
              const ry2 = Math.max(y1, y2);
              if (target?.rect) {
                const rectTarget = target.rect;
                const d = Math.max(
                  Math.abs(rx1 - rectTarget.left),
                  Math.abs(rx2 - rectTarget.right),
                  Math.abs(ry1 - rectTarget.bottom),
                  Math.abs(ry2 - rectTarget.top)
                );
                if (d <= tol && d < bestScore) {
                  bestRef = ref;
                  bestScore = d;
                }
              } else if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
                const dx = rx1 - target.x;
                const dy = ry2 - target.y;
                if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) {
                  const dist = dx * dx + dy * dy;
                  if (dist < bestScore) {
                    bestScore = dist;
                    bestRef = ref;
                  }
                }
              }
            }
            return bestRef;
          } catch { return null; }
      }


      try {
        let sourceBytes = (pdfBytes && pdfBytes.length) ? pdfBytes : null;
        if ((!sourceBytes || sourceBytes.length === 0) && originalPdfBytes?.length) {
          sourceBytes = originalPdfBytes;
        }

        if (!sourceBytes || sourceBytes.length === 0) {
          // Try to reload from original source
          const u = new URL(location.href);
          const src = u.searchParams.get('src');

          if (src && isExtension) {
            const response = await sendRuntimeMessage({ action: 'fetchPdf', url: src });
            if (response?.success && response.data) {
              sourceBytes = new Uint8Array(response.data);
            }
          }
        }

        if (!sourceBytes || sourceBytes.length === 0) {
          throw new Error('No PDF data available to save');
        }
        const doc = await PDFLib.PDFDocument.load(sourceBytes);
        doc.setModificationDate?.(new Date());

        const N = PDFLib.PDFName, S = PDFLib.PDFString, Num = PDFLib.PDFNumber;

        const fontCache = {};
        const ensureFont = async (name) => {
          if (fontCache[name]) return fontCache[name];
          const f = await doc.embedFont(PDFLib.StandardFonts[name]);
          fontCache[name] = f;
          return f;
        };

        const getAnnotsArray = (page) => {
          let arr = page.node.lookup(N.of('Annots'));
          if (!arr) {
            arr = doc.context.obj([]);
            page.node.set(N.of('Annots'), arr);
          }
          return arr;
        };

        const addTextAnnot = (page, x, y, w, h, contents, author) => {
          const rect = doc.context.obj([Num.of(x), Num.of(y), Num.of(x + w), Num.of(y + h)]);
          const annot = doc.context.obj({
            Type: N.of('Annot'),
            Subtype: N.of('Text'),
            Rect: rect,
            Contents: S.of(contents || ''),
            T: S.of(author || ''),
            C: doc.context.obj([Num.of(1), Num.of(0.85), Num.of(0.35)]),
            Name: N.of('Comment'),
            F: Num.of(4)
          });
          const ref = doc.context.register(annot);
          const arr = getAnnotsArray(page);
          arr.push(ref);
          return ref;
        };

        const addReplyAnnot = (page, parentRef, x, y, w, h, contents, author) => {
          const rect = doc.context.obj([Num.of(x), Num.of(y), Num.of(x + w), Num.of(y + h)]);
          const annot = doc.context.obj({
            Type: N.of('Annot'),
            Subtype: N.of('Text'),
            Rect: rect,
            Contents: S.of(contents || ''),
            T: S.of(author || ''),
            IRT: parentRef,
            RT: N.of('R'),
            C: doc.context.obj([Num.of(1), Num.of(0.85), Num.of(0.35)]),
            Name: N.of('Comment'),
            F: Num.of(4)
          });
          const ref = doc.context.register(annot);
          const arr = getAnnotsArray(page);
          arr.push(ref);
          return ref;
        };

        const pagesLib = doc.getPages();

        async function applyFormValues(pdfLibDoc) {
          if (!pdfDoc?.annotationStorage || !pdfLibDoc?.getForm) return;
          let form;
          try {
            form = pdfLibDoc.getForm();
          } catch (err) {
            console.warn('Form access failed:', err);
            return;
          }
          if (!form) return;
          let fieldObjects = null;
          try {
            fieldObjects = await pdfDoc.getFieldObjects?.();
          } catch (err) {
            console.warn('Reading form field metadata failed:', err);
          }
          if (!fieldObjects) return;
          const pdfFields = form.getFields();
          if (!pdfFields?.length) return;
          const fieldMap = new Map(pdfFields.map(f => [f.getName(), f]));
          const domStateCache = new Map();
          const getDomState = (id) => {
            if (!id) return null;
            if (domStateCache.has(id)) return domStateCache.get(id);
            const state = readWidgetDomState(id);
            domStateCache.set(id, state);
            return state;
          };
          let storage = null;
          try {
            storage = pdfDoc.annotationStorage?.getAll?.();
          } catch (err) {
            console.warn('Reading annotation storage failed:', err);
          }
          const storageLookup = storage && typeof storage === 'object' ? storage : {};
          for (const [name, widgets] of Object.entries(fieldObjects)) {
            const field = fieldMap.get(name);
            if (!field) continue;
            const widgetArray = Array.isArray(widgets) ? widgets : [widgets];
            let value = widgetArray.find(w => w && w.value !== undefined)?.value;
            let storageEntry = null;
            let domState = null;
            for (const widget of widgetArray) {
              const entry = storageLookup?.[widget.id];
              if (entry !== undefined) {
                storageEntry = entry;
                break;
              }
              if (!domState) {
                domState = getDomState(widget.id);
              }
            }
            if (!domState) {
              for (const widget of widgetArray) {
                domState = getDomState(widget.id);
                if (domState) break;
              }
            }
            if (storageEntry) {
              if (storageEntry.value !== undefined) value = storageEntry.value;
              else if (storageEntry.valueAsString !== undefined) value = storageEntry.valueAsString;
            }
            try {
              const ctor = field.constructor?.name;
              // Prefer storage entry over static widget default
              const entry = storageEntry || {};
              const exportVal = widgetArray[0]?.exportValue || 'Yes';

              if (ctor === 'PDFTextField') {
                const domValue = domState?.value;
                const v = (typeof domValue === 'string' ? domValue : null)
                  ?? entry.valueAsString ?? entry.value ?? value ?? '';
                field.setText(v != null ? String(v) : '');
              } else if (ctor === 'PDFCheckBox') {
                // pdf.js may store {checked:true}, {value:true}, or {valueAsString:'Yes'|'Off'}
                const vStr = entry.valueAsString ?? (typeof entry.value === 'string' ? entry.value : null);
                let isOn =
                  entry.checked === true ||
                  entry.value === true ||
                  vStr === exportVal || vStr === 'Yes' || vStr === 'On' ||
                  value === true || value === exportVal || value === 'Yes' || value === 'On';
                if (domState?.checked === true) isOn = true;
                if (domState?.checked === false) isOn = false;
                if (typeof domState?.value === 'string') {
                  const domStr = domState.value;
                  if (domStr === exportVal || domStr === 'Yes' || domStr === 'On') {
                    isOn = true;
                  } else if (domStr === 'Off' || domStr === 'No') {
                    isOn = false;
                  }
                }
                if (isOn) field.check(); else field.uncheck();
              } else if (ctor === 'PDFRadioGroup') {
                const domVal = typeof domState?.value === 'string' ? domState.value : null;
                const v = domVal ?? entry.valueAsString ?? entry.value ?? value ?? widgetArray[0]?.value;
                if (typeof v === 'string') field.select(v);
              } else if (ctor === 'PDFDropdown' || ctor === 'PDFOptionList') {
                // May be a string, or an array for multi-select
                const domVal = domState?.value;
                const v = domVal ?? entry.value ?? entry.valueAsString ?? value;
                if (Array.isArray(v)) {
                  field.select(...v.map(x => String(x)));
                } else if (v != null) {
                  field.select(String(v));
                }
              } else if (typeof field.setText === 'function') {
                const domValue = domState?.value;
                const v = (domValue != null ? domValue : (entry.valueAsString ?? entry.value ?? value));
                if (v != null) field.setText(String(v));
              }
            } catch (err) {
               console.warn('Failed to apply form value for field', name, err);
            }
          }

          try {
            const helvetica = await ensureFont('Helvetica');
            form.updateFieldAppearances(helvetica);
          } catch (err) {
            console.warn('Failed to refresh form appearances', err);
          }
        }

        commitPdfJsFormEdits();
        await applyFormValues(doc);

        // Process deleted PDF threads
        const uniqueDeletes = new Map();
        for (const del of deletedPdfThreads) {
          if (!del) continue;
          const rect = clonePdfRect(del.rect);
          const key = rect
            ? `${del.page}-${Math.round(rect.left)}-${Math.round(rect.top)}-${Math.round(rect.right)}-${Math.round(rect.bottom)}`
            : `${del.page}-${Math.round(del.x)}-${Math.round(del.y)}`;
          uniqueDeletes.set(key, {
            page: del.page,
            x: Number(del.x),
            y: Number(del.y),
            rect
          });
        }

        for (const del of uniqueDeletes.values()) {
          try {
            const pIndex = parseInt(del.page, 10) - 1;
            if (pIndex < 0 || pIndex >= pagesLib.length) continue;
            
            const page = pagesLib[pIndex];
            const { height: ph } = page.getSize();
            const annotsArrayRef = page.node.lookup(N.of('Annots'));
            if (!annotsArrayRef) continue;
            const annotsArray = doc.context.lookup(annotsArrayRef);
            if (!annotsArray || !annotsArray.asArray) continue;
            const arr = annotsArray.asArray();
            if (!arr || !arr.length) continue;

            const target = del.rect
              ? { rect: del.rect }
              : { x: Number(del.x), y: ph - Number(del.y) };

            const rootRefToDel = findNearestTextAnnotRef(doc, annotsArray, target, 6);

            if (rootRefToDel) {
              const refsToKeep = [];
              const refsToDel = new Set([rootRefToDel]);

              // Now find all replies to that root
              for (const ref of arr) {
                if (ref === rootRefToDel) continue; // Already in del set
                
                const dict = doc.context.lookup(ref);
                const irt = dict?.get(N.of('IRT'));
                
                if (irt === rootRefToDel) {
                  refsToDel.add(ref); // Delete replies too
                } else {
                  refsToKeep.push(ref);
                }
              }
              
              // If any refs were marked for deletion, rebuild the Annots array
              if (refsToDel.size > 0) {
                annotsArray.clear();
                refsToKeep.forEach(r => annotsArray.push(r));
              }
            }

          } catch (err) {
            console.warn('Failed to delete PDF annotation:', err);
          }
        }

        for (const key in annotations) {
          const list = annotations[key];
          if (!list || !list.length) continue;

          const pIndex = parseInt(key, 10) - 1;
          const page = pagesLib[pIndex];
          const { height: ph } = page.getSize();

          for (const a of list) {
            if (a.type === 'text' && (a.content || '').trim()) {
              const fKey = fontKeyFor(a.styles?.fontFamily, a.styles?.fontWeight, a.styles?.fontStyle);
              const font = await ensureFont(fKey);
              const size = parseInt(a.styles?.fontSize || '12', 10);
              const col = toRgb(a.styles?.color || '#000000');

              const maxW = Math.max(24, Math.floor((a.boxWpt || a.boxW || 240)));
              const lines = wrapLines(a.content, font, size, maxW);
              const lh = size * 1.2;

              let y = ph - a.y - size;
              for (const line of lines) {
                page.drawText(line, { x: a.x, y, size, font, color: PDFLib.rgb(col.r, col.g, col.b) });
                y -= lh;
              }
            } else if (a.type === 'signature' && a.dataUrl) {
              const img = await doc.embedPng(a.dataUrl);
              const w = a.w || 200, h = a.h || 80;
              page.drawImage(img, { x: a.x, y: ph - a.y - h, width: w, height: h });
            } else if (a.type === 'highlight' && Array.isArray(a.rects)) {
              for (const rect of a.rects) {
                const w = rect.w || 0;
                const h = rect.h || 0;
                if (w <= 0 || h <= 0) continue;
                const y = ph - rect.y - h;
                page.drawRectangle({
                  x: rect.x,
                  y,
                  width: w,
                  height: h,
                  color: PDFLib.rgb(1, 0.94, 0.46),
                  opacity: 0.35,
                  borderOpacity: 0
                });
              }
            } else if (a.type === 'strike' && Array.isArray(a.rects)) {
              for (const rect of a.rects) {
                const w = rect.w || 0;
                const h = rect.h || 0;
                if (w <= 0) continue;
                const y = ph - rect.y - (h / 2);
                page.drawLine({
                  start: { x: rect.x, y },
                  end: { x: rect.x + w, y },
                  thickness: 2,
                  color: PDFLib.rgb(0.86, 0.15, 0.15)
                });
              }
            } else if (a.type === 'comment' && (a.thread?.length || 0) > 0) {
              const rectInfo = clonePdfRect(a.pdfRect);
              const estimatedHeight = rectInfo ? Math.max(8, rectInfo.top - rectInfo.bottom) : 24;
              const rootY = rectInfo ? rectInfo.bottom : ph - a.y - 24;
              const rootTarget = rectInfo ? { rect: rectInfo } : { x: a.x, y: ph - a.y };
              const rootX = rectInfo ? rectInfo.left : a.x;
              let rootRef = null;

              const annotsArray = getAnnotsArray(page); // ensure we have an Annots array

              if (a.origin === 'pdf') {
                rootRef = findNearestTextAnnotRef(doc, annotsArray, rootTarget, 6) || null;
                if (!rootRef) {
                  console.warn('Skipping reply export for comment without original thread', {
                    page: a.page,
                    x: rootX,
                    y: rootY
                  });
                  continue;
                }
                const start = Math.max((a._importedCount | 0), 1); // replies user added
                for (let i = start; i < a.thread.length; i++) {
                  const r = a.thread[i];
                  addReplyAnnot(page, rootRef,
                    rootX + 6 * i, rootY - 6 * i, 24, 24,
                    String(r.text || ''), String(r.author || userName || 'User'));
                }
              } else {
                // Normal user-created thread: create root + all replies
                const root = a.thread[0];
                rootRef = addTextAnnot(page, rootX, rootY, 24, Math.max(24, estimatedHeight),
                                       String(root.text||''), String(root.author || userName || 'User'));
                for (let i = 1; i < a.thread.length; i++) {
                  const r = a.thread[i];
                   addReplyAnnot(page, rootRef,
                    rootX + 6*i, rootY - 6*i, 24, 24,
                    String(r.text||''), String(r.author || userName || 'User'));
                }
              }
            }
          }
        }

        const out = await doc.save();
        const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
        const stable = bytes.slice();

        pdfBytes = stable;
        originalPdfBytes = stable.slice();

        const blob = new Blob([stable], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotated.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch (err) {
        alert('Save failed: ' + err.message);
        console.error(err);
      }
    };

    if (identityBtn) {
      identityBtn.onclick = () => {
        queuedTool = null;
        openIdentityModal();
      };
    }
    if (textTool) {
      textTool.onclick = () => setTool('textOnce');
    }
    if (commentTool) {
      commentTool.onclick = () => {
        if (!userName) {
          queueToolAfterIdentity('commentOnce');
        } else {
          setTool('commentOnce');
        }
      };
    }
    if (signatureTool) {
      signatureTool.onclick = () => {
        if (!signatureDataUrl) {
          queueToolAfterIdentity('signatureOnce');
        } else {
          setTool('signatureOnce');
        }
      };
    }
    if (selectTextTool) {
      selectTextTool.onclick = () => {
        setTool(currentTool === 'selectText' ? 'select' : 'selectText');
      };
    }

    function queueToolAfterIdentity(toolName) {
      queuedTool = toolName;
      openIdentityModal();
    }

    function openIdentityModal() {
      identityModal.classList.remove('hidden');
      setTool('select');
      identityHasInk = !!signatureDataUrl;
      identityCtx.clearRect(0, 0, identitySignatureCanvas.width, identitySignatureCanvas.height);
      identityName.value = userName;

      if (signatureDataUrl) {
        const img = new Image();
        img.onload = () => {
          identityCtx.clearRect(0, 0, identitySignatureCanvas.width, identitySignatureCanvas.height);
          identityCtx.drawImage(img, 0, 0, identitySignatureCanvas.width, identitySignatureCanvas.height);
          identityHasInk = true;
        };
        img.src = signatureDataUrl;
      }
      requestAnimationFrame(() => identityName.focus());
    }

    function closeIdentityModal(applyQueuedTool = false) {
      identityModal.classList.add('hidden');
      const pending = queuedTool;
      queuedTool = null;
      if (applyQueuedTool) {
        if (pending === 'signatureOnce' && signatureDataUrl) {
          setTool('signatureOnce');
          return;
        }
        if (pending === 'commentOnce' && userName) {
          setTool('commentOnce');
          return;
        }
      }
      setTool('select');
    }

    if (helpBtn) helpBtn.onclick = () =>  { helpModal.classList.remove('hidden'); }
    if (helpClose) helpClose.onclick = () => helpModal.classList.add('hidden');
    if (helpModal) {
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.add('hidden');
      });
    }

    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = (searchInput.value || '').trim().toLowerCase();
        if (!searchDirty && query && query === lastSearchQuery && searchResults.length) {
          currentMatchIndex = (currentMatchIndex + 1) % searchResults.length;
          updateActiveHighlight();
        } else {
          await performSearch();
        }
      } else if (e.key === 'Escape') {
        clearSearch();
      }
    });

    searchNextBtn.onclick = () => {
      if (!searchResults.length) return;
      currentMatchIndex = (currentMatchIndex + 1) % searchResults.length;
      updateActiveHighlight();
    };

    searchPrevBtn.onclick = () => {
      if (!searchResults.length) return;
      currentMatchIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
      updateActiveHighlight();
    };

    function attachLayerEvents(layer, pageNum) {
      layer.addEventListener('click', (e) => {
        if (e.target !== layer) return;

        const rect = layer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / currentScale;
        const y = (e.clientY - rect.top) / currentScale;

        if (currentTool === 'textOnce') {
          const anno = {
            id: nextAnnoId++,
            type: 'text',
            page: pageNum,
            x,
            y,
            content: '',
            styles: {
              fontFamily: 'Helvetica',
              fontSize: '12',
              fontWeight: 'normal',
              fontStyle: 'normal',
              color: '#000000'
            },
            boxWpt: 200
          };
          addAnnotationElement(layer, pageNum, anno, { addToState: true, focus: true });
          setTool('select');
        } else if (currentTool === 'commentOnce') {
          const anno = {
            id: nextAnnoId++,
            type: 'comment',
            page: pageNum,
            x,
            y,
            thread: [],
            origin: 'user'
          };
          addAnnotationElement(layer, pageNum, anno, { addToState: true });
          openCommentUI(pageNum, anno);
          setTool('select');
        } else if (currentTool === 'signatureOnce' && signatureDataUrl) {
          const anno = {
            id: nextAnnoId++,
            type: 'signature',
            page: pageNum,
            x,
            y,
            w: 200,
            h: 80,
            dataUrl: signatureDataUrl
          };
          addAnnotationElement(layer, pageNum, anno, { addToState: true });
          setTool('select');
        }
      });
    }

    function resolvePageElement(range, rect) {
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      let elAtPoint = document.elementFromPoint(midX, midY);
      if (elAtPoint?.closest) {
        const page = elAtPoint.closest('.page');
        if (page) return page;
      }
      const container = range.commonAncestorContainer;
      if (container instanceof Element && container.closest) {
        const page = container.closest('.page');
        if (page) return page;
      }
      if (container?.parentElement?.closest) {
        return container.parentElement.closest('.page');
      }
      return null;
    }

    function collectSelectionRects() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return null;
      const map = new Map();
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const clientRects = range.getClientRects();
        for (const rect of clientRects) {
          if (!rect || rect.width <= 0 || rect.height <= 0) continue;
          const pageEl = resolvePageElement(range, rect);
          if (!pageEl) continue;
          const pageNum = parseInt(pageEl.dataset.page, 10);
          if (!Number.isFinite(pageNum)) continue;
          const pageRect = pageEl.getBoundingClientRect();
          const x = (rect.left - pageRect.left) / currentScale;
          const y = (rect.top - pageRect.top) / currentScale;
          const w = rect.width / currentScale;
          const h = rect.height / currentScale;
          if (w <= 0 || h <= 0) continue;
          const list = map.get(pageNum) || [];
          list.push({ x, y, w, h });
          map.set(pageNum, list);
        }
      }
      return map.size ? map : null;
    }

    function applyMarkupFromSelection(type) {
      if (!pdfDoc) return false;
      const rectMap = collectSelectionRects();
      if (!rectMap) return false;
      let createdEl = null;
      for (const [pageNum, rects] of rectMap.entries()) {
        if (!rects.length) continue;
        const key = String(pageNum);
        const slot = ensurePageSlot(pageNum);
        const canvasW = slot?.canvas?.width ? slot.canvas.width / (dpr || 1) : 0;
        const canvasH = slot?.canvas?.height ? slot.canvas.height / (dpr || 1) : 0;
        const maxW = slot?.baseW || canvasW || mainEl.clientWidth || 0;
        const maxH = slot?.baseH || canvasH || mainEl.clientHeight || 0;
        const normalized = [];
        for (const r of rects) {
          const x = clamp(r.x, 0, maxW);
          const y = clamp(r.y, 0, maxH);
          const maxWidth = Math.max(0, maxW - x);
          const maxHeight = Math.max(0, maxH - y);
          if (maxWidth <= 0 || maxHeight <= 0) continue;
          const w = clamp(r.w, 0.1, maxWidth);
          const h = clamp(r.h, 0.1, maxHeight);
          normalized.push({ x, y, w, h });
        }
        if (!normalized.length) continue;
        const anno = {
          id: nextAnnoId++,
          type,
          page: pageNum,
          rects: normalized
        };
        if (!annotations[key]) annotations[key] = [];
        annotations[key].push(anno);
        const el = addAnnotationElement(slot.layer, pageNum, anno, { addToState: false });
        if (el) createdEl = el;
      }
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      if (createdEl) {
        setSelectedAnnotation(createdEl);
        return true;
      }
      return false;
    }

    function addAnnotationElement(layer, pageNum, anno, opts) {
      const { addToState = false, focus = false } = opts || {};
      const key = String(pageNum);
      anno.page = pageNum;

      if (addToState) {
        if (!annotations[key]) annotations[key] = [];
        annotations[key].push(anno);
      }

      if (anno.type === 'text') {
        const div = document.createElement('div');
        div.className = 'text-anno';
        div.contentEditable = true;
        div.dataset.id = anno.id;
        div.dataset.page = key;
        div._anno = anno;

        div.style.left = anno.x + 'px';
        div.style.top = anno.y + 'px';
        div.style.minWidth = '120px';
        div.style.minHeight = '24px';
        div.style.width = (anno.boxWpt || 200) + 'px';

        div.style.fontFamily = anno.styles.fontFamily;
        div.style.fontSize = (parseInt(anno.styles.fontSize, 10) || 12) + 'px';
        div.style.fontWeight = anno.styles.fontWeight;
        div.style.fontStyle = anno.styles.fontStyle;
        div.style.color = anno.styles.color || '#000';

        div.textContent = anno.content || '';

        div.addEventListener('input', () => {
          anno.content = div.textContent;
          const w = div.getBoundingClientRect().width / currentScale;
          anno.boxWpt = Math.max(120, Math.min(800, w));
          if (document.activeElement === div) {
            showTextToolbar(div, anno);
            positionTextToolbar(div);
          }
        });
        div.addEventListener('focus', () => {
          setSelectedAnnotation(div);
          showTextToolbar(div, anno);
        });
        div.addEventListener('click', () => {
          if (document.activeElement !== div) div.focus();
          setSelectedAnnotation(div);
          showTextToolbar(div, anno);
        });
        div.addEventListener('blur', () => {
          if (selectedAnnoEl === div) setSelectedAnnotation(null);
          if (!div.textContent.trim()) {
            removeAnnotationElement(div, anno);
          }
        });

        makeDraggable(div, anno, layer, false);
        layer.appendChild(div);
        if (focus) {
          div.focus();
          showTextToolbar(div, anno);
        }
        return div;
      } else if (anno.type === 'comment') {
        normalizeCommentAnnotation(anno);
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'comment-pin';
        pin.innerHTML = '<img src="icons/comment-dots.svg" class="icon-svg" alt="">';
        pin.dataset.id = anno.id;
        pin.dataset.page = key;
        pin._anno = anno;

        pin.onclick = (ev) => {
          ev.stopPropagation();
          openCommentUI(pageNum, anno);
        };
        layer.appendChild(pin);
        const pinHalf = (pin.offsetWidth || 28) / 2;
        pin.style.left = (anno.x - pinHalf) + 'px';
        pin.style.top = (anno.y - pinHalf) + 'px';
        makeDraggable(pin, anno, layer, true);
        return pin;
      } else if (anno.type === 'signature') {
        const box = document.createElement('div');
        box.className = 'sig-anno';
        box.dataset.id = anno.id;
        box.dataset.page = key;
        box._anno = anno;

        box.style.left = anno.x + 'px';
        box.style.top = anno.y + 'px';

        const w = parseFloat(anno.w) || 200, h = parseFloat(anno.h) || 80;
        anno.w = w;
        anno.h = h;
        box.style.width = w + 'px';
        box.style.height = h + 'px';

        const img = document.createElement('img');
        img.src = anno.dataUrl;
        img.draggable = false;
        box.appendChild(img);

        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        box.appendChild(handle);

        box.addEventListener('mousedown', () => {
          setSelectedAnnotation(box);
        });

        makeDraggable(box, anno, layer, false);
        makeResizable(box, handle, anno);

        layer.appendChild(box);
        return box;
      } else if (anno.type === 'highlight' || anno.type === 'strike') {
        const rects = Array.isArray(anno.rects) ? anno.rects : [];
        if (!rects.length) return null;
        const slot = pages[pageNum - 1] || ensurePageSlot(pageNum);
        const group = document.createElement('div');
        group.className = `markup-anno ${anno.type}-group`;
        group.dataset.id = anno.id;
        group.dataset.page = key;
        group._anno = anno;
        const canvasW = slot?.canvas?.width ? slot.canvas.width / (dpr || 1) : 0;
        const canvasH = slot?.canvas?.height ? slot.canvas.height / (dpr || 1) : 0;
        const baseW = slot?.baseW || canvasW || layer.offsetWidth || 0;
        const baseH = slot?.baseH || canvasH || layer.offsetHeight || 0;
        group.style.left = '0';
        group.style.top = '0';
        group.style.width = `${baseW}px`;
        group.style.height = `${baseH}px`;
        rects.forEach((rect, idx) => {
          const seg = document.createElement('div');
          seg.className = anno.type === 'highlight' ? 'highlight-anno' : 'strike-anno';
          seg.style.position = 'absolute';
          seg.style.left = `${rect.x}px`;
          seg.style.top = `${rect.y}px`;
          seg.style.width = `${rect.w}px`;
          seg.style.height = `${rect.h}px`;
          seg.dataset.segment = String(idx);
          seg.addEventListener('click', (ev) => {
            ev.stopPropagation();
            setSelectedAnnotation(group);
          });
          group.appendChild(seg);
        });
        group.addEventListener('click', (ev) => {
          ev.stopPropagation();
          setSelectedAnnotation(group);
        });
        layer.appendChild(group);
        return group;
      }
      return null;
    }

    function removeAnnotationFromState(anno) {
      const key = String(anno.page);
      const list = annotations[key];
      if (!Array.isArray(list)) return;
      const i = list.indexOf(anno);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) delete annotations[key];
    }

    function removeAnnotationElement(el, anno) {
      if (!el) return;
      // If this was an imported PDF comment, remember to delete the original thread on save
      if (anno?.type === 'comment' && anno.origin === 'pdf') {
        markPdfThreadForDeletion(anno);
      }
      if (anno) removeAnnotationFromState(anno);
      if (el.parentElement) el.parentElement.removeChild(el);
      if (selectedAnnoEl === el) setSelectedAnnotation(null);
      if (anno?.type === 'text') hideTextToolbar();
      if (anno?.type === 'comment' && openCommentTarget && openCommentTarget.anno === anno) closeCommentUI();
    }

    function makeDraggable(el, anno, layer, isPin) {
      const isText = el.classList.contains('text-anno');
      const isSignature = el.classList.contains('sig-anno');

      let dragging = false, dragCandidate = false, sx = 0, sy = 0, origL = 0, origT = 0;

      const pinHalf = isPin ? (el.offsetWidth / 2 || 11) : 0;
      const apply = (L, T) => {
        el.style.left = `${L}px`;
        el.style.top = `${T}px`;
        if (isPin) {
          anno.x = L + pinHalf;
          anno.y = T + pinHalf;
        } else {
          anno.x = L;
          anno.y = T;
        }
        if (isText && textToolbarTarget === el) positionTextToolbar(el);
      };

      el.addEventListener('mousedown', (e) => {
        if (e.button && e.button !== 0) return;

        if (isText) {
          dragCandidate = true;
          sx = e.clientX;
          sy = e.clientY;
          origL = parseFloat(el.style.left) || 0;
          origT = parseFloat(el.style.top) || 0;
          return;
        }

        if (!isSignature && !isPin && e.target !== el) return;

        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        origL = parseFloat(el.style.left) || 0;
        origT = parseFloat(el.style.top) || 0;
        e.preventDefault();
        if (isText) hideTextToolbar();
      });

      window.addEventListener('mousemove', (e) => {
        if (isText) {
          if (!dragCandidate) return;
          const dx = (e.clientX - sx) / currentScale, dy = (e.clientY - sy) / currentScale;
          if (!dragging) {
            if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return;
            dragging = true;
            hideTextToolbar();
          }
          e.preventDefault();
          apply(origL + dx, origT + dy);
          return;
        }
        if (!dragging) return;
        const dx = (e.clientX - sx) / currentScale, dy = (e.clientY - sy) / currentScale;
        e.preventDefault();
        apply(origL + dx, origT + dy);
      });

      window.addEventListener('mouseup', () => {
        if (dragging || dragCandidate) {
          dragging = false;
          dragCandidate = false;
        }
      });
    }

    function makeResizable(el, handle, anno) {
      if (!handle) return;
      const MIN_W = 60, MIN_H = 24;
      let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = parseFloat(el.style.width) || anno.w || 200;
        startH = parseFloat(el.style.height) || anno.h || 80;
        setSelectedAnnotation(el);
      });
      window.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        const dw = (e.clientX - startX) / currentScale, dh = (e.clientY - startY) / currentScale;
        const nw = Math.max(MIN_W, startW + dw), nh = Math.max(MIN_H, startH + dh);
        el.style.width = `${nw}px`;
        el.style.height = `${nh}px`;
        anno.w = nw;
        anno.h = nh;
      });
      window.addEventListener('mouseup', () => {
        if (resizing) resizing = false;
      });
    }

    document.addEventListener('mousedown', (e) => {
      if (e.target.closest && (e.target.closest('.sig-anno') || e.target.closest('.text-anno') || e.target.closest('.comment-pin'))) return;
      if (selectedAnnoEl) setSelectedAnnotation(null);
    });

    function normalizeCommentAnnotation(anno) {
      if (!anno) return anno;
      if (!Array.isArray(anno.thread)) anno.thread = [];
      const normalized = [];
      let importedCount = 0;
      for (let idx = 0; idx < anno.thread.length; idx++) {
        const entry = anno.thread[idx];
        if (!entry) continue;
        const text = String(entry.text || '').trim();
        if (!text) continue;
        const author = entry.author || (idx === 0 ? (anno.author || userName || 'User') : userName || 'User');
        const time = entry.time || entry.date || entry.createdAt || entry.modified || '';
        const imported = !!entry.imported || (anno.origin === 'pdf' && idx < (anno._importedCount || anno.thread.length));
        if (imported) importedCount++;
        normalized.push({ author, text, time, imported });
      }
      anno.thread = normalized;
      anno._importedCount = importedCount;
      if (!anno.origin) {
        anno.origin = importedCount ? 'pdf' : 'user';
      } else if (anno.origin === 'pdf' && importedCount === 0) {
        anno.origin = 'user';
        delete anno.pdfRect;
      }
      return anno;
    }

    function renderCommentThread(anno) {
      if (!cs.thread) return;
      cs.thread.innerHTML = '';
      const thread = Array.isArray(anno.thread) ? anno.thread : [];
      thread.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = 'cs-item' + (idx > 0 ? ' reply' : '');
        item.innerHTML =
          `<div class="cs-author">${escapeHtml(c.author || 'User')}</div>
           <div class="cs-text">${escapeHtml(c.text || '')}</div>
           <div class="cs-time">${escapeHtml(c.time || '')}</div>`;
        const del = document.createElement('button');
        del.className = 'mini-btn cs-del';
        del.title = 'Delete';
        del.dataset.index = String(idx);
        del.textContent = '×';
        if (c.imported && idx === 0 && anno.origin === 'pdf') {
          del.setAttribute('aria-label', 'Delete imported comment');
        }
        item.prepend(del);
        cs.thread.appendChild(item);
      });
      if (cs.thread.scrollHeight) {
        cs.thread.scrollTop = cs.thread.scrollHeight;
      }
    }

    function openCommentUI(pageNum, anno) {
      const normalized = normalizeCommentAnnotation(anno);
      openCommentTarget = { pageNum, anno: normalized };

      cs.panel.classList.add('open');
      updateIdentityDisplay();
      renderCommentThread(normalized);

      if (normalized.thread && normalized.thread.length) {
        cs.text.placeholder = 'Write a reply...';
        cs.post.textContent = 'Reply';
      } else {
        cs.text.placeholder = 'Write a comment...';
        cs.post.textContent = 'Post';
      }

      cs.text.focus();
    }

    function closeCommentUI(){
      cs.panel.classList.remove('open');
      if (openCommentTarget) {
        const { anno } = openCommentTarget;
        const emptyThread = !anno.thread || anno.thread.every(m => !m.text || !m.text.trim());
        if (emptyThread) {
          const pinEl = pagesEl.querySelector(`.comment-pin[data-id="${anno.id}"]`);
          if (pinEl) removeAnnotationElement(pinEl, anno);
        }
      }
      openCommentTarget = null;
    }

    // Delete a single comment/reply. If the thread becomes empty, remove the pin.
    cs.thread.addEventListener('click', (e)=>{
      const btn = e.target.closest('.cs-del');
      if (!btn || !openCommentTarget) return;
    
      const i = parseInt(btn.dataset.index, 10);
      const { anno, pageNum } = openCommentTarget;
    
      if (Number.isInteger(i) && anno.thread && anno.thread[i]) {
        
        // Check if we are deleting an *imported* reply
        if (anno.origin === 'pdf' && i < (anno._importedCount || 0)) {
          // Mark the root thread for deletion from the original PDF
          markPdfThreadForDeletion(anno);
        }
    
        anno.thread.splice(i, 1);

        // If it was an imported thread and we modified it, convert to a 'user' thread
        // This ensures it gets fully re-written on save, not just appended to
        if (anno.origin === 'pdf') {
          anno.origin = 'user'; // Convert to a user thread
          anno._importedCount = 0; // It will now be saved from scratch
          delete anno.pdfRect;
        }

        normalizeCommentAnnotation(anno);

        if (!anno.thread.length) {
          const pinEl = pagesEl.querySelector(`.comment-pin[data-id="${anno.id}"]`);
          if (pinEl) removeAnnotationElement(pinEl, anno); // This also adds to deletedPdfThreads
          closeCommentUI();
        } else {
          openCommentUI(pageNum, anno); // rebuild
        }
      }
    });

    cs.post.onclick = () => {
      if (!openCommentTarget) return;
      if (!userName) {
        openIdentityModal();
        return;
      }

      const text = (cs.text.value || '').trim();
      if (!text) return;

      const c = { author: userName, text, time: new Date().toLocaleString() };
      const { pageNum, anno } = openCommentTarget;

      if (!anno.thread) anno.thread = [];
      anno.thread.push(c);

      cs.text.value = '';
      openCommentUI(pageNum, anno);
    };
    cs.close && (cs.close.onclick = closeCommentUI);
    cs.hide.onclick = closeCommentUI;
    cs.identityBtn && (cs.identityBtn.onclick = () => {
      queuedTool = null;
      openIdentityModal();
    });

    document.addEventListener('click', (e) => {
      if (!cs.panel.classList.contains('open')) return;
      if (cs.panel.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.comment-pin')) return;
      closeCommentUI();
    }, true);

    async function computeWidthScale(fraction = 1) {
      if (!pdfDoc) return currentScale;
      const page = await pdfDoc.getPage(1);
      const vp = page.getViewport({ scale: 1 });
      const { width: containerWidth } = getMainContentSize();
      const target = containerWidth * fraction;
      if (target <= 0 || vp.width <= 0) return null;
      return clamp(target / vp.width, MIN_SCALE, MAX_SCALE);
    }

    function setScale(s) {
      currentScale = clamp(s, MIN_SCALE, MAX_SCALE);
      renderAll();
    }

    function performZoomIn() {
      const base = getBaseScale();
      const ratio = getRelativeScale();
      const i = snapIndexFromRelative(ratio);
      const next = ZOOM_STEPS[clamp(i + 1, 0, ZOOM_STEPS.length - 1)];
      setScale(base * next);
    }
    function performZoomOut() {
      const base = getBaseScale();
      const ratio = getRelativeScale();
      const i = snapIndexFromRelative(ratio);
      const next = ZOOM_STEPS[clamp(i - 1, 0, ZOOM_STEPS.length - 1)];
      setScale(base * next);
    }
    if (zoomInBtn) zoomInBtn.onclick = () => performZoomIn();
    if (zoomOutBtn) zoomOutBtn.onclick = () => performZoomOut();

async function fitToAvailableWidth(fraction = 1) {
  if (!pdfDoc) return;
  const scale = await computeWidthScale(fraction);
  if (!Number.isFinite(scale)) return;
  setScale(scale);
}
if (fitWidthBtn) fitWidthBtn.onclick = () => fitToAvailableWidth();

    function applyReaderLayout() {
      document.body.classList.toggle('reader', readerMode);
      const pc = pdfDoc ? pdfDoc.numPages : 0;

      pagesEl.querySelectorAll('.page').forEach(w => {
        w.style.display = 'none';
      });
      if (!pdfDoc) return;

      if (!readerMode) {
        pagesEl.querySelectorAll('.page').forEach(w => {
          w.style.display = 'block';
        });
        return;
      }
      const p = clamp(currentPageIndex + 1, 1, pc);
      const wrap = pagesEl.querySelector(`.page[data-page="${p}"]`);
      if (wrap) wrap.style.display = 'block';
    }

    async function requestReaderFullscreen() {
      let lastError = null;
      const tryRequest = async (target) => {
        if (!target) return false;
        const methods = [
          target.requestFullscreen,
          target.webkitRequestFullscreen,
          target.webkitRequestFullScreen,
          target.mozRequestFullScreen,
          target.msRequestFullscreen
        ];
        for (const fn of methods) {
          if (typeof fn !== 'function') continue;
          try {
            const result = fn.call(target, { navigationUI: 'hide' });
            if (result && typeof result.then === 'function') {
              await result;
            }
            return true;
          } catch (err) {
            lastError = err;
          }
        }
        return false;
      };

      const targets = [document.documentElement, document.body];
      for (const target of targets) {
        if (await tryRequest(target)) {
          return true;
        }
      }

      if (window.self !== window.top) {
        try {
          const parentDoc = window.parent?.document;
          if (parentDoc) {
            const parentTargets = [parentDoc.documentElement, parentDoc.body];
            for (const target of parentTargets) {
              if (await tryRequest(target)) {
                return true;
              }
            }
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (lastError) {
        console.warn('Fullscreen request failed:', lastError);
      }
      return false;
    }

    async function exitReaderFullscreen() {
      const tryExit = async (doc) => {
        if (!doc) return false;
        if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
          const methods = [
            doc.exitFullscreen,
            doc.webkitExitFullscreen,
            doc.webkitCancelFullScreen,
            doc.mozCancelFullScreen,
            doc.msExitFullscreen
          ];
          for (const fn of methods) {
            if (typeof fn !== 'function') continue;
            try {
              const result = fn.call(doc);
              if (result && typeof result.then === 'function') {
                await result;
              }
              return true;
            } catch (err) {
              console.warn('Exit fullscreen failed:', err);
            }
          }
        }
        return false;
      };

      if (await tryExit(document)) {
        return true;
      }

      if (await tryExit(window.parent?.document)) {
        return true;
      }

      return false;
    }

    async function toggleReader() {
      if (!pdfDoc) return;

      const entering = !readerMode;

      if (entering) {
        readerPrevScale = currentScale;
        readerMode = true;
        const fullscreenPromise = requestReaderFullscreen();
        const nextScale = await computeReaderFitScale();
        currentScale = nextScale;
        await renderAll();
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
        try {
          await fullscreenPromise;
        } catch (err) {
          console.warn('Fullscreen request failed:', err);
        }
      } else {
        readerMode = false;
        const exitPromise = exitReaderFullscreen();
        currentScale = readerPrevScale || currentScale;
        await renderAll();
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
        try {
          await exitPromise;
        } catch (err) {
          console.warn('Exit fullscreen failed:', err);
        }
      }
      updateToolbarStates();
      updatePageInfo();
    }

    toggleReaderBtn && toggleReaderBtn.addEventListener('click', () => toggleReader());
    
    // Listen for fullscreen changes to sync reader mode
    document.addEventListener('fullscreenchange', async () => {
      if (!document.fullscreenElement && readerMode) {
        readerMode = false;
        currentScale = readerPrevScale || currentScale;
        await renderAll();
        updateToolbarStates();
        updatePageInfo();
      }
    });

    function goToPage(delta) {
      if (!pdfDoc) return;
      const pc = pdfDoc.numPages;
      currentPageIndex = clamp(currentPageIndex + delta, 0, pc - 1);

      if (readerMode) {
        applyReaderLayout();
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
      } else {
        const t = pagesEl.querySelector(`.page[data-page="${currentPageIndex + 1}"]`);
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      updatePageInfo();
    }

    if (prevPageBtn) prevPageBtn.onclick = () => goToPage(-1);
    if (nextPageBtn) nextPageBtn.onclick = () => goToPage(1);

    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      const editing = e.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (e.key === 'Delete' && !editing && selectedAnnoEl) {
        const anno = selectedAnnoEl._anno;
        if (anno) {
          removeAnnotationElement(selectedAnnoEl, anno);
          e.preventDefault();
          return;
        }
      }

      if (!editing && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        toggleReader();
        return;
      }
      if (!editing && e.key === '+') performZoomIn();
      if (!editing && e.key === '-') performZoomOut();

  if (!editing && (e.key === 't' || e.key === 'T')) {
    e.preventDefault();
    if (selectTextTool) {
      selectTextTool.click();
    } else {
      setTool(currentTool === 'selectText' ? 'select' : 'selectText');
    }
  }
  if (!editing && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    if (textTool) {
      textTool.click();
    } else {
      setTool('textOnce');
    }
  }
  if (!editing && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (signatureTool) {
      signatureTool.click();
    } else if (!signatureDataUrl) {
      queueToolAfterIdentity('signatureOnce');
    } else {
      setTool('signatureOnce');
    }
  }
  if (!editing && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault();
    if (commentTool) {
      commentTool.click();
    } else if (!userName) {
      queueToolAfterIdentity('commentOnce');
    } else {
      setTool('commentOnce');
    }
  }
  if (!editing && (e.key === 'h' || e.key === 'H')) {
    if (applyMarkupFromSelection('highlight')) {
      e.preventDefault();
      return;
    }
  }
  if (!editing && (e.key === 'x' || e.key === 'X')) {
    if (applyMarkupFromSelection('strike')) {
      e.preventDefault();
      return;
    }
  }
  if (!editing && (e.key === 'w' || e.key === 'W')) {
    e.preventDefault();
    if (fitWidthBtn) {
      fitWidthBtn.click();
    } else {
      fitToAvailableWidth();
    }
  }
  if (!editing && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    if (pdfDoc) {
      prepareForPrint().then(() => {
        document.body.classList.add('print-ready');
        window.print();
      });
    }
  }

      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !editing) {
        e.preventDefault();
        const d = e.key === 'ArrowUp' ? -120 : 120;
        const behavior = e.repeat ? 'auto' : 'smooth';
        mainEl.scrollBy({ top: d, behavior });
        return;
      }

      if (e.key === 'Escape') {
        setTool('select');
        hideTextToolbar();
        if (identityModal && !identityModal.classList.contains('hidden')) closeIdentityModal();
        if (helpModal && !helpModal.classList.contains('hidden')) helpModal.classList.add('hidden');
      }

      if (readerMode) {
        if (!editing && e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPage(-1);
        }
        if (!editing && e.key === 'ArrowRight') {
          e.preventDefault();
          goToPage(1);
        }
      } else {
        if (!editing && e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPage(-1);
        }
        if (!editing && e.key === 'ArrowRight') {
          e.preventDefault();
          goToPage(1);
        }
      }
    });

    let textToolbarTarget = null, textToolbarAnno = null;

    function positionTextToolbar(el) {
      if (!textToolbarTarget) return;
      const r = el.getBoundingClientRect();
      const pr = textStylePanel.getBoundingClientRect();
      const ph = pr.height || textStylePanel.offsetHeight || 0;
      const pw = pr.width || textStylePanel.offsetWidth || 0;

      let top = window.scrollY + r.top - ph - 8;
      let left = window.scrollX + r.left;

      if (top < 8) top = window.scrollY + r.bottom + 8;
      const maxL = window.scrollX + document.documentElement.clientWidth - pw - 8;
      if (left > maxL) left = maxL;

      textStylePanel.style.top = Math.max(8, top) + 'px';
      textStylePanel.style.left = Math.max(8, left) + 'px';
    }

    function showTextToolbar(el, anno) {
      textToolbarTarget = el;
      textToolbarAnno = anno;
      textFontFamily.value = anno.styles.fontFamily || 'Helvetica';
      textFontSize.value = parseInt(anno.styles.fontSize, 10) || 12;
      textBoldBtn.classList.toggle('active', anno.styles.fontWeight === 'bold');
      textItalicBtn.classList.toggle('active', anno.styles.fontStyle === 'italic');
      textColor.value = anno.styles.color || '#000000';
      textStylePanel.classList.remove('hidden');
      positionTextToolbar(el);
    }

    function hideTextToolbar() {
      textToolbarTarget = null;
      textToolbarAnno = null;
      textStylePanel.classList.add('hidden');
    }

/* ===== Find UI: show up/down + count only when there is input ===== */
const searchContainer = document.querySelector('.search-container');
function updateSearchUIState(markDirty = false) {
  const has = (searchInput.value || '').trim().length > 0;
  searchContainer.classList.toggle('has-query', has);
  if (markDirty) {
    searchDirty = true;
  }
}
searchInput.addEventListener('input', () => updateSearchUIState(true));
updateSearchUIState(false);

/* ===== Page / Zoom compact boxes ===== */
const pageBox = document.getElementById('pageBox');
const zoomBox = document.getElementById('zoomBox');
const zoomMenu = document.getElementById('zoomMenu');
    function syncInfoBoxes() {
      const pc = pdfDoc ? pdfDoc.numPages : 1;
      const pn = pdfDoc ? clamp(currentPageIndex + 1, 1, pc) : 1;
      
      // Only update text content if the input isn't active
      const pageInput = document.getElementById('pageInput');
      if (pageBox && (!pageInput || document.activeElement !== pageInput)) {
        pageBox.innerHTML = `${pn} / ${pc}`; // Restore original text
        pageBox.style.padding = '6px 8px'; // Restore padding
      } else if (pageInput) {
        // If input exists but isn't focused (e.g., page changed via arrow key)
        pageInput.value = pn;
        pageInput.max = pc;
        const pageTotal = document.getElementById('pageTotal');
        if (pageTotal) pageTotal.textContent = `/ ${pc}`;
      }
      
      if (zoomBox) {
        const baseline = defaultWidthScale || 1;
        const percent = Math.round((currentScale / baseline) * 100);
        zoomBox.textContent = `${percent}%`;
      }
    }
    function updatePageInfo() { syncInfoBoxes(); }
    syncInfoBoxes();
   
    /* Make pageBox editable via prompt */
    pageBox?.addEventListener('click', (e) => {
      if (!pdfDoc || e.target.tagName === 'INPUT') return;
      if (document.getElementById('pageInput')) return; // Already open
    
      const pc = pdfDoc.numPages;
      const pn = clamp(currentPageIndex + 1, 1, pc);
    
      pageBox.innerHTML = ''; // Clear "1 / 1"
      pageBox.style.padding = '4px 6px'; // Adjust padding
    
      const pageInput = document.createElement('input');
      pageInput.id = 'pageInput';
      pageInput.type = 'number';
      pageInput.min = '1';
      pageInput.max = pc;
      pageInput.value = pn;
      pageInput.style.width = '40px';
      pageInput.style.textAlign = 'right';
      pageInput.style.border = '1px solid #ccc';
      pageInput.style.borderRadius = '3px';
      pageInput.style.fontSize = '0.85rem';
      pageInput.style.fontFamily = 'var(--font-sans)';
    
      const pageTotal = document.createElement('span');
      pageTotal.id = 'pageTotal';
      pageTotal.style.whiteSpace = 'pre';
      pageTotal.style.paddingLeft = '4px';
      pageTotal.textContent = `/ ${pc}`;
    
      pageBox.appendChild(pageInput);
      pageBox.appendChild(pageTotal);
    
      pageInput.focus();
      pageInput.select();
    
      const handler = () => {
        const n = parseInt(pageInput.value || '', 10);
        if (!Number.isNaN(n)) {
          goToPageNumber(n); // This will call syncInfoBoxes
        } else {
          syncInfoBoxes(); // Restore if invalid
        }
        // Remove listener to prevent memory leaks
        pageInput.removeEventListener('blur', handler);
        pageInput.removeEventListener('keydown', keyHandler);
      };
      
      const keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          pageInput.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          pageInput.value = pn; // Reset value
          pageInput.blur();
        }
      };
    
      pageInput.addEventListener('blur', handler, { once: true });
      pageInput.addEventListener('keydown', keyHandler);
    });

/* ===== Zoom menu behavior ===== */
function showZoomMenu(anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  zoomMenu.style.left = `${window.scrollX + r.left}px`;
  zoomMenu.style.top = `${window.scrollY + r.bottom + 6}px`;
  zoomMenu.style.display = 'block';
  zoomMenu.setAttribute('aria-hidden', 'false');
}
function hideZoomMenu() {
  zoomMenu.style.display = 'none';
  zoomMenu.setAttribute('aria-hidden', 'true');
}
zoomBox?.addEventListener('click', (e) => {
  const visible = zoomMenu.style.display === 'block';
  if (visible) hideZoomMenu(); else showZoomMenu(e.currentTarget);
});
document.addEventListener('click', (e) => {
  if (!zoomMenu.contains(e.target) && e.target !== zoomBox) hideZoomMenu();
}, true);

/* Zoom menu actions (reuse existing controls) */
document.getElementById('zmIn')?.addEventListener('click', () => { performZoomIn(); hideZoomMenu(); });
document.getElementById('zmOut')?.addEventListener('click', () => { performZoomOut(); hideZoomMenu(); });
document.getElementById('zmFit')?.addEventListener('click', () => { fitToAvailableWidth(); hideZoomMenu(); });
document.getElementById('zmReader')?.addEventListener('click', () => {
  toggleReader();
  hideZoomMenu();
});

/* Keep boxes in sync whenever scale or page changes */
const _origSetScale = setScale;
setScale = function (s) { _origSetScale(s); syncInfoBoxes(); };
const _origGoToPageNumber = goToPageNumber;
goToPageNumber = function (n) { _origGoToPageNumber(n); syncInfoBoxes(); };
const _origGoToPage = goToPage;
goToPage = function (d) { _origGoToPage(d); syncInfoBoxes(); };

    textFontFamily.addEventListener('change', () => {
      if (!textToolbarTarget || !textToolbarAnno) return;
      textToolbarAnno.styles.fontFamily = textFontFamily.value;
      textToolbarTarget.style.fontFamily = textFontFamily.value;
    });
    textFontSize.addEventListener('change', () => {
      if (!textToolbarTarget || !textToolbarAnno) return;
      const s = clamp(parseInt(textFontSize.value, 10) || 12, 8, 96);
      textToolbarAnno.styles.fontSize = String(s);
      textToolbarTarget.style.fontSize = s + 'px';
    });
    textBoldBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!textToolbarTarget || !textToolbarAnno) return;
      const b = textToolbarAnno.styles.fontWeight === 'bold';
      textToolbarAnno.styles.fontWeight = b ? 'normal' : 'bold';
      textToolbarTarget.style.fontWeight = textToolbarAnno.styles.fontWeight;
      textBoldBtn.classList.toggle('active', !b);
    });
    textItalicBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!textToolbarTarget || !textToolbarAnno) return;
      const it = textToolbarAnno.styles.fontStyle === 'italic';
      textToolbarAnno.styles.fontStyle = it ? 'normal' : 'italic';
      textToolbarTarget.style.fontStyle = textToolbarAnno.styles.fontStyle;
      textItalicBtn.classList.toggle('active', !it);
    });
    textColor.addEventListener('input', () => {
      if (!textToolbarTarget || !textToolbarAnno) return;
      textToolbarAnno.styles.color = textColor.value;
      textToolbarTarget.style.color = textColor.value;
    });

    document.addEventListener('click', (e) => {
      if (textStylePanel.contains(e.target) || (textToolbarTarget && textToolbarTarget.contains(e.target))) return;
      hideTextToolbar();
    });
    window.addEventListener('scroll', () => {
      if (textToolbarTarget) positionTextToolbar(textToolbarTarget);
    });
    if (mainEl) {
      mainEl.addEventListener('scroll', () => {
        if (textToolbarTarget) positionTextToolbar(textToolbarTarget);
      });
    }
    mainEl.addEventListener('scroll', () => {
      mainEl.classList.add('is-scrolling');
      if (scrollTimer) clearTimeout(scrollTimer);

      scrollTimer = setTimeout(() => {
        mainEl.classList.remove('is-scrolling');
      }, 150);
    }, { passive: true });

    identityCtx.lineCap = 'round';
    identityCtx.lineJoin = 'round';
    identityCtx.lineWidth = 2;
    identityCtx.strokeStyle = '#111';
    let identityDrawing = false;

    identitySignatureCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      identityDrawing = true;
      identitySignatureCanvas.setPointerCapture(e.pointerId);
      identityCtx.beginPath();
      identityCtx.moveTo(e.offsetX, e.offsetY);
      identityHasInk = true;
    });
    identitySignatureCanvas.addEventListener('pointermove', (e) => {
      if (identityDrawing) e.preventDefault();
      if (!identityDrawing) return;
      identityCtx.lineTo(e.offsetX, e.offsetY);
      identityCtx.stroke();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => {
      identitySignatureCanvas.addEventListener(ev, (e) => {
        if (ev === 'pointerup' && identitySignatureCanvas.hasPointerCapture(e.pointerId)) {
          identitySignatureCanvas.releasePointerCapture(e.pointerId);
        }
        identityDrawing = false;
      });
    });
    identityClear.onclick = () => {
      identityCtx.clearRect(0, 0, identitySignatureCanvas.width, identitySignatureCanvas.height);
      identityHasInk = false;
    };
    identityClose.onclick = () => closeIdentityModal();
    identitySave.onclick = () => {
      const name = (identityName.value || '').trim();
      if (!name) {
        identityName.focus();
        return;
      }
      userName = name;
      localStorage.setItem('userName', userName);
      signatureDataUrl = identityHasInk ? identitySignatureCanvas.toDataURL('image/png') : null;
      if (signatureDataUrl) {
        localStorage.setItem('userSignature', signatureDataUrl);
      } else {
        localStorage.removeItem('userSignature');
      }
      updateIdentityDisplay();
      updateToolbarStates();
      closeIdentityModal(true);
    };

    setTool('select');
    updateIdentityDisplay();
    updateToolbarStates();

    (async function initialiseViewerSource() {
      let sourceUrl = null;
      try {
        const u = new URL(location.href);
        sourceUrl = u.searchParams.get('src');
      } catch (err) {
        console.warn('Unable to parse viewer location', err);
      }

      if ((!sourceUrl || !sourceUrl.trim()) && isExtension && chrome.runtime?.sendMessage) {
        try {
          const response = await sendRuntimeMessage({ action: 'getPdfUrl' });
          if (response?.pdfUrl) {
            sourceUrl = response.pdfUrl;
          }
        } catch (err) {
          console.warn('Failed to resolve PDF URL from background', err);
        }
      }

      if (!sourceUrl || !sourceUrl.trim()) {
        showLoadError('No PDF source was provided for this viewer tab.', null);
        return;
      }

      sourceUrl = normalizePdfSourceUrl(sourceUrl.trim());
      hideLoadError();

      try {
        let bytes = null;
        if (isExtension && chrome.runtime?.sendMessage) {
          const response = await sendRuntimeMessage({ action: 'fetchPdf', url: sourceUrl });
          if (!response?.success || !Array.isArray(response.data)) {
            throw new Error(response?.error || 'Failed to retrieve PDF from extension background.');
          }
          bytes = new Uint8Array(response.data);
        } else {
          const res = await fetch(sourceUrl);
          if (!res.ok) {
            throw new Error(`Failed to load PDF (status ${res.status})`);
          }
          const buf = await res.arrayBuffer();
          bytes = new Uint8Array(buf);
        }

        await loadPdfBytesArray(bytes);
        hideLoadError();
      } catch (err) {
        console.error('Failed to load PDF', err);
        showLoadError(err?.message || 'Failed to load PDF.', sourceUrl);
      }
    })();

// Prepare a print-only rendering of the document
    let printPrepared = false;
    let printInFlight = null;

    function renderAnnotationsForPrint(layer, pageNum) {
      const list = annotations[String(pageNum)] || [];
      if (!list.length) return;
      for (const anno of list) {
        if (anno.type === 'comment') continue;
        if (anno.type === 'text') {
          const styles = anno.styles || {};
          const div = document.createElement('div');
          div.className = 'print-text';
          div.style.left = `${anno.x}px`;
          div.style.top = `${anno.y}px`;
          const w = Math.max(60, anno.boxWpt || 200);
          div.style.width = `${w}px`;
          div.style.whiteSpace = 'pre-wrap';
          div.style.fontFamily = styles.fontFamily || 'Helvetica';
          div.style.fontWeight = styles.fontWeight || 'normal';
          div.style.fontStyle = styles.fontStyle || 'normal';
          const fs = parseInt(styles.fontSize, 10) || 12;
          div.style.fontSize = `${fs}px`;
          div.style.color = styles.color || '#000';
          div.textContent = anno.content || '';
          layer.appendChild(div);
        } else if (anno.type === 'signature') {
          const box = document.createElement('div');
          box.className = 'print-signature';
          box.style.left = `${anno.x}px`;
          box.style.top = `${anno.y}px`;
          const w = parseFloat(anno.w) || 200;
          const h = parseFloat(anno.h) || 80;
          box.style.width = `${w}px`;
          box.style.height = `${h}px`;
          const img = document.createElement('img');
          img.src = anno.dataUrl;
          img.alt = 'Signature';
          img.draggable = false;
          box.appendChild(img);
          layer.appendChild(box);
        } else if (anno.type === 'highlight') {
          const rects = Array.isArray(anno.rects) ? anno.rects : [];
          rects.forEach(rect => {
            const hl = document.createElement('div');
            hl.style.position = 'absolute';
            hl.style.left = `${rect.x}px`;
            hl.style.top = `${rect.y}px`;
            hl.style.width = `${rect.w}px`;
            hl.style.height = `${rect.h}px`;
            hl.style.background = 'rgba(255, 241, 118, 0.5)';
            layer.appendChild(hl);
          });
        } else if (anno.type === 'strike') {
          const rects = Array.isArray(anno.rects) ? anno.rects : [];
          rects.forEach(rect => {
            const box = document.createElement('div');
            box.style.position = 'absolute';
            box.style.left = `${rect.x}px`;
            box.style.top = `${rect.y}px`;
            box.style.width = `${rect.w}px`;
            box.style.height = `${rect.h}px`;
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.left = '0';
            line.style.right = '0';
            line.style.top = '50%';
            line.style.borderTop = '3px solid rgba(220, 38, 38, 0.85)';
            line.style.transform = 'translateY(-50%)';
            box.appendChild(line);
            layer.appendChild(box);
          });
        }
      }
    }

    async function renderPrintPage(pageNum) {
      const page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const printViewport = page.getViewport({ scale: PRINT_UNITS });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.floor(printViewport.width);
      canvas.height = Math.floor(printViewport.height);
      canvas.style.width = `${baseViewport.width}px`;
      canvas.style.height = `${baseViewport.height}px`;
      const printParams = { canvasContext: ctx, viewport: printViewport };
      const formsMode = pdfjsLib?.AnnotationMode?.ENABLE_FORMS;
      if (typeof formsMode === 'number') {
        printParams.annotationMode = formsMode;
      }
      const renderTask = page.render(printParams);
      await renderTask.promise;
      const wrapper = document.createElement('div');
      wrapper.className = 'print-page';
      wrapper.dataset.page = String(pageNum);
      wrapper.style.width = `${baseViewport.width}px`;
      wrapper.style.height = `${baseViewport.height}px`;
      wrapper.appendChild(canvas);
      const layer = document.createElement('div');
      layer.className = 'print-layer';
      layer.style.width = `${baseViewport.width}px`;
      layer.style.height = `${baseViewport.height}px`;
      renderAnnotationsForPrint(layer, pageNum);
      wrapper.appendChild(layer);
      printContainer?.appendChild(wrapper);
    }

    async function prepareForPrint() {
      if (!pdfDoc || !printContainer) return;
      if (printPrepared) return;
      if (printInFlight) {
        await printInFlight;
        return;
      }
      printInFlight = (async () => {
        printContainer.innerHTML = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          await renderPrintPage(i);
        }
        printPrepared = true;
      })();
      try {
        await printInFlight;
      } finally {
        printInFlight = null;
      }
    }

    window.addEventListener('beforeprint', () => {
      if (!pdfDoc) return;
      document.body.classList.add('print-ready');
      prepareForPrint().catch(err => console.error('Print preparation failed:', err));
    });

    window.addEventListener('afterprint', () => {
      printPrepared = false;
      if (printContainer) printContainer.innerHTML = '';
      document.body.classList.remove('print-ready');
    });

    window.addEventListener('resize', () => {
      dpr = window.devicePixelRatio || 1;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        if (!pdfDoc) return;

        const prevBase = defaultWidthScale;
        const newBase = await computeWidthScale(DEFAULT_WIDTH_FRACTION);
        if (Number.isFinite(newBase)) {
          const atDefault = !readerMode && Math.abs(currentScale - prevBase) < 0.01;
          defaultWidthScale = newBase;
          if (atDefault) {
            currentScale = newBase;
          }
        }

        if (readerMode) {
          currentScale = await computeReaderFitScale();
          await renderAll();
          updatePageInfo();
          updateToolbarStates();
        } else {
          await renderAll();
          updatePageInfo();
        }
      }, 120);
    });