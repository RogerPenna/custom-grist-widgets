/**
 * RelationshipLines.js: A library for drawing connection lines between elements using LeaderLine.
 */

export const RelationshipLines = (() => {
  let _activeLines = [];
  let _currentDrawId = 0;
  let _scrollContainer = null;
  let _onScrollHandler = null;
  let _resizeObserver = null;
  let _lastBscData = null;
  let _lastOptions = {};

  /**
   * Surgical removal of masking/clipping on paths only.
   * This preserves <defs> (arrowheads) but stops the "cutting" effect.
   */
  function _removeMasks() {
    const leaderLineEls = document.querySelectorAll('.leader-line');
    leaderLineEls.forEach(el => {
      el.style.zIndex = "999999";
      
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

  function init(scrollContainer) {
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
    if (_scrollContainer && _onScrollHandler) {
      _scrollContainer.removeEventListener('scroll', _onScrollHandler);
    }
    
    _scrollContainer = scrollContainer;
    if (!_scrollContainer) {
      console.warn('[RelationshipLines] init() called with a null container.');
      return;
    }

    _onScrollHandler = () => {
      if (_activeLines.length > 0) {
        _activeLines.forEach(line => {
          try { line.position(); } catch (e) {}
        });
        _removeMasks();
      }
    };
    _scrollContainer.addEventListener('scroll', _onScrollHandler, { passive: true });

    let rafPending = false;
    _resizeObserver = new ResizeObserver(() => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          reposition();
        });
      }
    });
    _resizeObserver.observe(_scrollContainer);

    console.log('[RelationshipLines] Initialized (LeaderLine mode).');
  }

  function _clearLinesOnly() {
    _activeLines.forEach(line => {
      try { line.remove(); } catch (e) {}
    });
    _activeLines = [];
    document.querySelectorAll('.leader-line').forEach(el => el.remove());
  }

  function clear() {
    _currentDrawId++;
    _clearLinesOnly();
    console.log('[RelationshipLines] Cleared.');
  }

  async function drawFromBscData(bscData, options = {}) {
    const drawId = ++_currentDrawId;

    _lastBscData = bscData;
    _lastOptions = options;

    if (!bscData || !bscData.perspectives) {
      clear();
      return;
    }

    return new Promise((resolve) => {
      // Wait for a short settle delay so elements are fully rendered in the DOM
      setTimeout(() => {
        if (drawId !== _currentDrawId) return resolve();

        _clearLinesOnly();

        const isOutlineEnabled = options.outline !== undefined ? options.outline : true;
        const connDistType = options.connDistanceType || 'relative';
        const connD = options.connDistanceFixed !== undefined ? Number(options.connDistanceFixed) : 20;
        const weightMultiplier = options.arrowWeightMultiplier !== undefined ? Number(options.arrowWeightMultiplier) : 1;

        const defaultLineOptions = {
          color: 'rgba(0, 86, 168, 0.8)',
          size: 4,
          path: 'fluid',
          startPlug: 'disc',
          startPlugSize: 1.5,
          endPlug: 'arrow1',
          outline: true,
          outlineColor: 'rgba(255, 255, 255, 0.7)',
          outlineSize: 0.2,
          startPlugOutline: isOutlineEnabled,
          endPlugOutline: isOutlineEnabled,
          ...options
        };

        const objTable = bscData.mapping?.objectivesTable || 'Objetivos';
        let count = 0;

        // Pre-pass: collect incoming and outgoing connections for each objective to distribute points
        const incomingConnections = {};
        const outgoingConnections = {};
        const relationships = bscData.relationships || [];

        relationships.forEach(rel => {
          const causeId = rel.causeId;
          const effectId = rel.effectId;
          if (causeId && effectId) {
            const causaElement = document.getElementById(`record-${objTable}-${causeId}`);
            const efeitoElement = document.getElementById(`record-${objTable}-${effectId}`);
            if (causaElement && efeitoElement) {
              if (!incomingConnections[effectId]) {
                incomingConnections[effectId] = [];
              }
              incomingConnections[effectId].push(causeId);

              if (!outgoingConnections[causeId]) {
                outgoingConnections[causeId] = [];
              }
              outgoingConnections[causeId].push(effectId);
            }
          }
        });

        // Main pass: instantiate connection lines
        relationships.forEach(rel => {
          const causeId = rel.causeId;
          const effectId = rel.effectId;
          const weight = rel.weight !== undefined ? rel.weight : 1;

          if (causeId && effectId) {
            const causaElement = document.getElementById(`record-${objTable}-${causeId}`);
            const efeitoElement = document.getElementById(`record-${objTable}-${effectId}`);

            // DOM Security Validation: only proceed if both elements exist
            if (causaElement && efeitoElement) {
              try {
                const causaRect = causaElement.getBoundingClientRect();
                const efeitoRect = efeitoElement.getBoundingClientRect();
                const vDiff = Math.abs(efeitoRect.top - causaRect.top);

                let startParam = causaElement;
                let endParam   = efeitoElement;
                
                // Calculate thickness scaling by weight
                const baseThickness = options.size !== undefined ? options.size : (defaultLineOptions.size || 4);

                const lineOpts = { 
                  ...defaultLineOptions,
                  size: (weightMultiplier * weight) + baseThickness
                };

                lineOpts.middleLabel = window.LeaderLine.captionLabel('w: ' + weight, {
                  color: lineOpts.color,
                  outlineColor: lineOpts.outlineColor || 'rgba(255, 255, 255, 0.7)',
                  outlineWidth: 0.22,
                  fontSize: '11px',
                  fontWeight: 'normal'
                });

                // 1. Direction Logic based on relative vertical position
                if (vDiff >= 100) {
                  // REGRA VERTICAL: Cause to Effect flow (top of Cause to bottom of Effect)
                  lineOpts.startSocket = 'top';
                  lineOpts.endSocket   = 'bottom';

                  // 2. Point distribution (pointAnchor) at Cause Top (y: '0%')
                  const outs = outgoingConnections[causeId] || [];
                  if (outs.length > 1) {
                    let idx = outs.indexOf(effectId);
                    if (idx === -1) idx = 0;
                    if (connDistType === 'fixed') {
                      const causaWidth = causaRect.width || 200;
                      const xPx = (causaWidth / 2) - ((outs.length - 1) * connD) / 2 + (idx * connD);
                      startParam = window.LeaderLine.pointAnchor(causaElement, { x: xPx, y: '0%' });
                    } else {
                      const pctX = ((idx + 1) * 100 / (outs.length + 1)).toFixed(1);
                      startParam = window.LeaderLine.pointAnchor(causaElement, { x: `${pctX}%`, y: '0%' });
                    }
                  } else {
                    startParam = window.LeaderLine.pointAnchor(causaElement, { x: '50%', y: '0%' });
                  }

                  // Point distribution (pointAnchor) at Effect Bottom (y: '100%')
                  const ins = incomingConnections[effectId] || [];
                  if (ins.length > 1) {
                    let idx = ins.indexOf(causeId);
                    if (idx === -1) idx = 0;
                    if (connDistType === 'fixed') {
                      const efeitoWidth = efeitoRect.width || 200;
                      const xPx = (efeitoWidth / 2) - ((ins.length - 1) * connD) / 2 + (idx * connD);
                      endParam = window.LeaderLine.pointAnchor(efeitoElement, { x: xPx, y: '100%' });
                    } else {
                      const pctX = ((idx + 1) * 100 / (ins.length + 1)).toFixed(1);
                      endParam = window.LeaderLine.pointAnchor(efeitoElement, { x: `${pctX}%`, y: '100%' });
                    }
                  } else {
                    endParam = window.LeaderLine.pointAnchor(efeitoElement, { x: '50%', y: '100%' });
                  }
                } else {
                  // REGRA HORIZONTAL: lateral connection flow (same perspective raia)
                  if (causaRect.left < efeitoRect.left) {
                    lineOpts.startSocket = 'right';
                    lineOpts.endSocket   = 'left';
                  } else {
                    lineOpts.startSocket = 'left';
                    lineOpts.endSocket   = 'right';
                  }
                }

                // Instantiate LeaderLine
                const newLine = new window.LeaderLine(startParam, endParam, lineOpts);
                _activeLines.push(newLine);
                count++;
              } catch (e) {
                console.error("[RelationshipLines] Error creating line:", e);
              }
            }
          }
        });

        console.log(`[RelationshipLines] Created ${count} lines.`);
        _removeMasks();

        // Short cleanup burst to ensure masking layers are removed as they render
        let c = 0;
        const timer = setInterval(() => {
          _removeMasks();
          if (++c > 10) clearInterval(timer);
        }, 150);

        resolve();
      }, 150);
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
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
    if (_scrollContainer && _onScrollHandler) {
      _scrollContainer.removeEventListener('scroll', _onScrollHandler);
    }
    _scrollContainer = null;
    _lastBscData = null;
    _lastOptions = {};
  }

  return { init, clear, drawFromBscData, reposition, destroy };
})();
