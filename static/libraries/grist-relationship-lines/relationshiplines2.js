/**
 * RelationshipLines.js — Custom SVG overlay renderer.
 *
 * ARCHITECTURE:
 *   Instead of relying on LeaderLine.js (which internally generates SVG <mask> and
 *   <clipPath> elements linked to the bounding boxes of the connected elements, causing
 *   the "invisible rectangle cutting" effect), this module draws its own <svg> overlay
 *   positioned absolutely INSIDE the scroll container.
 *
 *   Because the SVG lives inside the same scrollable parent as the cards, its coordinate
 *   system already accounts for scrolling — no offset corrections needed, no "double
 *   scrolling", and no masks whatsoever.
 *
 * RENDERING APPROACH:
 *   - One <svg> element is created and appended to the scroll container.
 *   - It is sized to match the container's full scrollable area (scrollWidth × scrollHeight).
 *   - An <defs> block holds a single arrowhead <marker> definition.
 *   - Each relationship is drawn as a cubic Bézier <path> from the bottom-center of the
 *     source card to the top-center of the target card, with vertical control points
 *     that produce a smooth "fluid" curve matching LeaderLine's default appearance.
 *   - The SVG is pointer-events: none so it never blocks card interactions.
 *   - On scroll the SVG doesn't need to move — it scrolls with the container naturally.
 *   - A ResizeObserver on the container triggers a full redraw when the layout changes.
 *
 * PUBLIC API (drop-in replacement for the original module):
 *   RelationshipLines.init(scrollContainer)
 *   RelationshipLines.clear()
 *   RelationshipLines.drawFromBscData(bscData, options)
 *   RelationshipLines.reposition()   ← triggers a redraw
 *   RelationshipLines.destroy()
 */

export const RelationshipLines = (() => {

  // ── Internal state ──────────────────────────────────────────────────────────
  let _container      = null;   // The scrollable #main-container
  let _svg            = null;   // The <svg> overlay element
  let _lastBscData    = null;   // Cached data so reposition() can redraw
  let _lastOptions    = {};     // Cached options
  let _drawId         = 0;      // Incremented on every drawFromBscData call to cancel stale draws
  let _resizeObserver = null;
  let _scrollHandler  = null;

  // ── SVG / marker IDs ───────────────────────────────────────────────────────
  const MARKER_ID   = 'rl-arrowhead';
  const SVG_CLASS   = 'rl-svg-overlay';

  // ── Default visual options (mirrors the original LeaderLine defaults) ───────
  const DEFAULT_OPTIONS = {
    color        : 'rgba(0, 86, 168, 0.85)',
    width        : 4,            // stroke-width in px
    arrowSize    : 10,           // arrowhead size in px
    curvature    : 0.45,         // control-point ratio (0 = straight, 1 = very curved)
    outlineColor : 'rgba(255,255,255,0.55)',
    outlineWidth : 1.5,          // extra stroke for the "outline" look
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Create (or re-use) the <svg> overlay inside _container.
   * The SVG is sized to the container's SCROLL dimensions so that elements
   * in any scroll position are reachable without coordinate offsets.
   */
  function _ensureSvg() {
    // Remove any stale overlays left from previous renders
    _container.querySelectorAll(`.${SVG_CLASS}`).forEach(el => el.remove());

    _svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    _svg.classList.add(SVG_CLASS);

    // Size to full scroll area of the container
    const w = _container.scrollWidth;
    const h = _container.scrollHeight;

    Object.assign(_svg.style, {
      position       : 'absolute',
      top            : '0',
      left           : '0',
      width          : w + 'px',
      height         : h + 'px',
      pointerEvents  : 'none',       // Never block card interactions
      overflow       : 'visible',    // Paths that go slightly outside are still shown
      zIndex         : '20000',
    });

    _svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    _svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Insert behind all child elements (cards) so hover effects still work visually,
    // but pointer-events:none means clicks pass through regardless of z-order.
    _container.insertBefore(_svg, _container.firstChild);

    return _svg;
  }

  /**
   * Build the <defs> block with the arrowhead marker.
   * The marker uses the same colour as the line it belongs to, via `context-stroke`.
   */
  function _buildDefs(svg, opts) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Outline (white halo) arrowhead — rendered first (below)
    const markerOutline = _makeMarker(
      MARKER_ID + '-outline',
      opts.arrowSize + opts.outlineWidth * 2,
      opts.outlineColor,
      true
    );
    defs.appendChild(markerOutline);

    // Solid arrowhead — rendered on top
    const markerSolid = _makeMarker(MARKER_ID, opts.arrowSize, opts.color, false);
    defs.appendChild(markerSolid);

    svg.appendChild(defs);
  }

  function _makeMarker(id, size, color, isOutline) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth',  size);
    marker.setAttribute('markerHeight', size);
    marker.setAttribute('refX', size - 1);
    marker.setAttribute('refY', size / 2);
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const tip = size;
    const base = 0;
    const half = size / 2;
    poly.setAttribute('points', `${base},${0} ${tip},${half} ${base},${size}`);
    poly.setAttribute('fill', color);
    marker.appendChild(poly);
    return marker;
  }

  /**
   * Get the position of an element's edge relative to the scroll container's
   * top-left corner (i.e., in the container's scroll coordinate space).
   *
   * We use getBoundingClientRect() for both the element and the container,
   * then add scrollTop/scrollLeft to convert from viewport-relative to
   * scroll-relative coordinates.
   */
  function _getRelativeRect(element) {
    const containerRect = _container.getBoundingClientRect();
    const elemRect      = element.getBoundingClientRect();

    const scrollLeft = _container.scrollLeft;
    const scrollTop  = _container.scrollTop;

    return {
      top   : elemRect.top    - containerRect.top  + scrollTop,
      left  : elemRect.left   - containerRect.left + scrollLeft,
      bottom: elemRect.bottom - containerRect.top  + scrollTop,
      right : elemRect.right  - containerRect.left + scrollLeft,
      width : elemRect.width,
      height: elemRect.height,
    };
  }

  /**
   * Draw a single curved arrow from `startEl` to `endEl`.
   * Returns the created <g> element, or null if either element is missing.
   */
  function _drawArrow(svg, startEl, endEl, opts) {
    if (!startEl || !endEl) return null;

    const from = _getRelativeRect(startEl);
    const to   = _getRelativeRect(endEl);

    // Connect bottom-center → top-center
    const x1 = from.left + from.width  / 2;
    const y1 = from.bottom;
    const x2 = to.left   + to.width    / 2;
    const y2 = to.top;

    // Cubic Bézier control points — vertical bias creates a smooth "S" or "C" curve
    const dy = Math.abs(y2 - y1);
    const cp = dy * opts.curvature;
    const cx1 = x1;
    const cy1 = y1 + cp;
    const cx2 = x2;
    const cy2 = y2 - cp;

    const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // ── Outline path (white halo underneath) ──────────────────────────────────
    if (opts.outlineWidth > 0) {
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      outline.setAttribute('d', d);
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke', opts.outlineColor);
      outline.setAttribute('stroke-width', opts.width + opts.outlineWidth * 2);
      outline.setAttribute('stroke-linecap', 'round');
      outline.setAttribute('marker-end', `url(#${MARKER_ID}-outline)`);
      g.appendChild(outline);
    }

    // ── Main (coloured) path ──────────────────────────────────────────────────
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', opts.color);
    path.setAttribute('stroke-width', opts.width);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('marker-end', `url(#${MARKER_ID})`);
    g.appendChild(path);

    svg.appendChild(g);
    return g;
  }

  /**
   * Core draw routine: clears the SVG and redraws all arrows.
   * Called both by the initial render (after a short delay) and by reposition().
   */
  function _redraw(bscData, opts) {
    if (!_container || !bscData || !bscData.perspectives) return;

    const mergedOpts = { ...DEFAULT_OPTIONS, ...opts };
    const svg = _ensureSvg();
    _buildDefs(svg, mergedOpts);

    let count = 0;
    bscData.perspectives.forEach(p => {
      p.objectives.forEach(o => {
        if (o.ref_obj && o.ref_obj > 0) {
          const startEl = document.getElementById(`record-${o.ref_obj}`);
          const endEl   = document.getElementById(`record-${o.id}`);
          if (_drawArrow(svg, startEl, endEl, mergedOpts)) {
            count++;
          }
        }
      });
    });

    console.log(`[RelationshipLines] Drew ${count} lines (custom SVG, no masking).`);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * init(scrollContainer)
   * Must be called once before drawFromBscData.
   * Attaches a ResizeObserver so that layout changes (e.g. accordion expand) trigger
   * a redraw automatically.
   */
  function init(scrollContainer) {
    if (_resizeObserver) {
      _resizeObserver.disconnect();
    }
    // Remove any old scroll listener
    if (_container && _scrollHandler) {
      _container.removeEventListener('scroll', _scrollHandler);
    }

    _container = scrollContainer;

    if (!_container) {
      console.warn('[RelationshipLines] init() called with a null container.');
      return;
    }

    // Ensure the container is a positioned element so our absolute SVG is contained
    const pos = getComputedStyle(_container).position;
    if (pos === 'static') {
      _container.style.position = 'relative';
    }

    // ResizeObserver: redraws when the container size changes (e.g. window resize,
    // card expand/collapse). Debounced with rAF to avoid excessive redraws.
    let rafPending = false;
    _resizeObserver = new ResizeObserver(() => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (_lastBscData) _redraw(_lastBscData, _lastOptions);
        });
      }
    });
    _resizeObserver.observe(_container);

    // Scroll: because the SVG is inside the scroll container it moves with the
    // content — NO handler needed for basic scrolling. However, if the scroll
    // changes the layout (e.g. sticky headers change bounding rects) we reposition.
    _scrollHandler = () => {
      if (_lastBscData && _svg) {
        // Only update the SVG's viewBox/size if the scrollable area changed
        const w = _container.scrollWidth;
        const h = _container.scrollHeight;
        if (
          _svg.getAttribute('viewBox') !== `0 0 ${w} ${h}`
        ) {
          _svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          _svg.style.width  = w + 'px';
          _svg.style.height = h + 'px';
        }
      }
    };
    _container.addEventListener('scroll', _scrollHandler, { passive: true });

    console.log('[RelationshipLines] Initialized (custom SVG mode).');
  }

  /**
   * clear()
   * Removes the SVG overlay and resets state.
   */
  function clear() {
    _drawId++;
    if (_svg) {
      _svg.remove();
      _svg = null;
    }
    if (_container) {
      _container.querySelectorAll(`.${SVG_CLASS}`).forEach(el => el.remove());
    }
    console.log('[RelationshipLines] Cleared.');
  }

  /**
   * drawFromBscData(bscData, options)
   * Drop-in replacement for the original.
   * Waits for a short settle delay before drawing (same 800 ms pattern as original,
   * but also does a quick 100 ms pre-draw so lines appear faster on fast machines).
   */
  async function drawFromBscData(bscData, options = {}) {
    const thisDrawId = ++_drawId;
    clear();

    _lastBscData  = bscData;
    _lastOptions  = options;

    if (!bscData || !bscData.perspectives) return;

    return new Promise(resolve => {
      // Quick first draw after 150 ms (DOM is usually ready by then)
      setTimeout(() => {
        if (thisDrawId !== _drawId) return resolve(); // Superseded
        _redraw(bscData, options);
      }, 150);

      // Second draw after 800 ms to handle any late-rendering cards / images
      setTimeout(() => {
        if (thisDrawId !== _drawId) return resolve();
        _redraw(bscData, options);
        resolve();
      }, 800);
    });
  }

  /**
   * reposition()
   * Forces an immediate redraw — call this after programmatic layout changes.
   */
  function reposition() {
    if (_lastBscData) {
      _redraw(_lastBscData, _lastOptions);
    }
  }

  /**
   * destroy()
   * Full teardown — call when the widget is unmounted.
   */
  function destroy() {
    clear();
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
    if (_container && _scrollHandler) {
      _container.removeEventListener('scroll', _scrollHandler);
    }
    _container     = null;
    _lastBscData   = null;
    _lastOptions   = {};
  }

  return { init, clear, drawFromBscData, reposition, destroy };
})();