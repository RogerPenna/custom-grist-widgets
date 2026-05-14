/**
 * RelationshipLines.js: A library for drawing connection lines between elements.
 */

export const RelationshipLines = (() => {
  let _activeLines = [];
  let _currentDrawId = 0;
  let _scrollContainer = null;
  let _onScrollHandler = null;

  function init(scrollContainer) {
    if (_scrollContainer && _onScrollHandler) {
      _scrollContainer.removeEventListener('scroll', _onScrollHandler);
    }
    _scrollContainer = scrollContainer;
    if (_scrollContainer) {
      _onScrollHandler = () => {
        if (_activeLines.length > 0) {
          _activeLines.forEach(line => {
            try { line.position(); } catch (e) {}
          });
          _removeMasks();
        }
      };
      _scrollContainer.addEventListener('scroll', _onScrollHandler, { passive: true });
    }
    console.log("[RelationshipLines] Initialized.");
  }

  /**
   * Surgical removal of masking/clipping on paths only.
   * This preserves <defs> (arrowheads) but stops the "cutting" effect.
   */
  function _removeMasks() {
    const leaderLineEls = document.querySelectorAll('.leader-line');
    leaderLineEls.forEach(el => {
        el.style.zIndex = "20000";
        
        // Target ONLY the paths to remove the "gaps"
        const paths = el.querySelectorAll('path');
        paths.forEach(path => {
            if (path.getAttribute('mask')) path.removeAttribute('mask');
            if (path.getAttribute('clip-path')) path.removeAttribute('clip-path');
            path.style.mask = 'none';
            path.style.clipPath = 'none';
            path.style.webkitMask = 'none';
            path.style.webkitClipPath = 'none';
        });
    });
  }

  function clear() {
    console.log("[RelationshipLines] Clearing lines...");
    _currentDrawId++;
    _activeLines.forEach(line => {
      try { line.remove(); } catch (e) {}
    });
    _activeLines = [];
    document.querySelectorAll('.leader-line').forEach(el => el.remove());
  }

  async function drawFromBscData(bscData, options = {}) {
    const drawId = ++_currentDrawId;
    clear(); 
    _currentDrawId = drawId;

    if (!bscData || !bscData.perspectives) return;

    return new Promise((resolve) => {
      setTimeout(() => {
        if (drawId !== _currentDrawId) return resolve();

        const defaultLineOptions = {
          color: 'rgba(0, 86, 168, 0.8)',
          size: 4,
          path: 'fluid',
          endPlug: 'arrow1',
          startSocket: 'bottom',
          endSocket: 'top',
          outline: true,
          outlineColor: 'rgba(255, 255, 255, 0.5)',
          outlineSize: 0.2,
          ...options
        };

        console.log(`[RelationshipLines] Drawing cycle ${drawId}...`);

        let count = 0;
        bscData.perspectives.forEach(p => {
          p.objectives.forEach(o => {
            if (o.ref_obj && o.ref_obj > 0) {
              const startElem = document.getElementById(`record-${o.ref_obj}`);
              const endElem = document.getElementById(`record-${o.id}`);

              if (startElem && endElem) {
                try {
                  const newLine = new window.LeaderLine(startElem, endElem, defaultLineOptions);
                  _activeLines.push(newLine);
                  count++;
                } catch (e) {
                  console.error("[RelationshipLines] Error creating line:", e);
                }
              }
            }
          });
        });

        console.log(`[RelationshipLines] Created ${count} lines.`);
        _removeMasks();
        
        // Short cleanup burst
        let c = 0;
        const timer = setInterval(() => {
            _removeMasks();
            if (++c > 10) clearInterval(timer);
        }, 150);

        resolve();
      }, 800);
    });
  }

  function reposition() {
    if (_activeLines.length > 0) {
      _activeLines.forEach(line => {
        try { line.position(); } catch (e) {}
      });
      _removeMasks();
    }
  }

  function destroy() {
    clear();
    if (_scrollContainer && _onScrollHandler) {
      _scrollContainer.removeEventListener('scroll', _onScrollHandler);
    }
  }

  return { init, clear, drawFromBscData, reposition, destroy };
})();
