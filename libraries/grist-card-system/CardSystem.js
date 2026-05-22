import { getFieldStyle, renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

/*******************************************************************
 * CardSystem: A pure visualization component for the Grist Framework.
 *
 * - Renders "cards" using a 10-column grid layout based on provided options.
 * - Receives all its configuration (styling, layout, etc.) via an 'options' object.
 * - Does NOT contain any self-configuration UI.
 * - Emits a 'grf-card-clicked' event on click/burger icon click.
 *******************************************************************/
export const CardSystem = (() => {
  //--------------------------------------------------------------------
  // 1) Defaults
  //--------------------------------------------------------------------
  const DEFAULT_FIELD_STYLE = {
    labelVisible: true, labelPosition: 'above', labelFont: 'inherit', labelFontSize: 'inherit', labelColor: 'inherit', labelAllCaps: false, labelOutline: false, labelOutlineColor: '#ffffff', dataJustify: 'left', dataAllCaps: false, heightLimited: false, maxHeightRows: 1, isTitleField: false
  };

  const DEFAULT_STYLING = {
    iconGroups: [],
    iconSize: 1.0,
    internalCardPadding: '10px',
    fieldBox: { borderEnabled: false, borderColor: '#cccccc', borderWidth: 1, borderRadius: 4, backgroundColor: '#ffffff', effect: 'none' },
    labelStyle: { bold: false, allCaps: false, color: '#333333', font: 'Calibri', size: '12px' },
    dataStyle: { font: 'Calibri', size: '14px', color: '#000000' },
    widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9",
    cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0",
    cardsColorApplyText: false, cardsColorTextField: null, cardsColorFontField: null, cardsColorOverlayEffect: 'darken', cardsColorOverlayOpacity: 10,
    cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc",
    cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px", cardTitleAllCaps: false,
    cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarLabelAllCaps: false, cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px", cardTitleTopBarDataAllCaps: false,
    handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0",
    handleAreaOverlayEffect: "darken", handleAreaOverlayOpacity: 10,
    handleAreaField: null,
    handleAreaTitleField: null, handleAreaTitleColor: "#ffffff", handleAreaTitleFontSize: "10px", handleAreaTitleAllCaps: false,
    widgetPadding: "10px", cardsSpacing: "15px",
    fieldRowGap: "4px", fieldColGap: "4px", fieldPadding: "4px",
    cardTitleTopBarApplyText: false,
    selectedCard: { enabled: false, scale: 1.05, colorEffect: "none" }
  };

  const DEFAULT_NUM_ROWS = 1;
  const NUM_COLS = 10;

  // Helper to load icons.svg
  let iconsLoaded = false;
  async function loadIcons() {
    if (iconsLoaded) return;
    try {
      const response = await fetch('../libraries/icons/icons.svg');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const svgText = await response.text();
      const div = document.createElement('div');
      div.style.display = 'none';
      div.innerHTML = svgText;
      document.body.insertBefore(div, document.body.firstChild);
      iconsLoaded = true;
    } catch (error) {
      console.error('Falha ao carregar o arquivo de \u00edcones:', error);
    }
  }
  const getIcon = (id) => `<svg class="icon"><use href="#${id}"></use></svg>`;

  function _injectTooltipStyles() {
    if (document.getElementById('grf-tooltip-styles')) return;
    const style = document.createElement('style');
    style.id = 'grf-tooltip-styles';
    style.textContent = `
        .grf-tooltip-trigger { position: relative; display: inline-block; margin-left: 8px; width: 16px; height: 16px; border-radius: 50%; background-color: #adb5bd; color: white; font-size: 11px; font-weight: bold; text-align: center; line-height: 16px; cursor: help; }
        .grf-tooltip-trigger:before, .grf-tooltip-trigger:after { position: absolute; left: 50%; transform: translateX(-50%); opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease; z-index: 10; }
        .grf-tooltip-trigger:after { content: attr(data-tooltip); bottom: 150%; background-color: rgba(0, 0, 0, 0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: normal; line-height: 1.4; white-space: pre-wrap; width: 250px; }
        .grf-tooltip-trigger:before { content: ''; bottom: 150%; margin-bottom: -5px; border-style: solid; border-width: 5px 5px 0 5px; border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent; }
        .grf-tooltip-trigger:hover:before, .grf-tooltip-trigger:hover:after { opacity: 1; visibility: visible; }
    `;
    document.head.appendChild(style);
  }

  //--------------------------------------------------------------------
  // 2) Public renderCards(container, records, options, schema)
  //--------------------------------------------------------------------
  async function renderCards(container, records, options, schema) {
    _injectTooltipStyles();
    _injectGroupingStyles();

    container._csRenderId = (container._csRenderId || 0) + 1;
    const currentRenderId = container._csRenderId;

    const currentOptions = options || {};
    const tableLens = currentOptions.tableLens;
    const styling = { ...DEFAULT_STYLING, ...currentOptions.styling, selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(currentOptions.styling?.selectedCard || {}) } };
    const layout = currentOptions.layout || [];
    
    const viewMode = currentOptions.viewMode || 'click';
    const numRows = currentOptions.numRows || DEFAULT_NUM_ROWS;

    const isRefList = !!currentOptions.isRefList;

    // ARMAZENA ESTADO NO CONTAINER (Evita estado global compartilhado entre instâncias)
    if (!container._csIsFiltering) {
        container._csDatabaseRecords = records;
    }
    container._csOriginalRecords = records;
    container._csOptions = currentOptions;
    container._csSchema = schema;
    container.classList.add('cards-wrapper');

    // Track top-level render session on document.body to prevent race conditions on the global filter bar
    let mainRenderId = 0;
    if (!isRefList) {
        document.body._csMainRenderId = (document.body._csMainRenderId || 0) + 1;
        mainRenderId = document.body._csMainRenderId;
    }

    // Clean up any existing grouping bar in both the filter bar and the container
    const filterBar = document.querySelector('.filter-bar');
    if (filterBar && !isRefList) {
        filterBar.querySelectorAll('.cs-grouping-bar').forEach(el => el.remove());
    }
    container.querySelectorAll('.cs-grouping-bar').forEach(el => el.remove());

    await loadIcons();
    if (!document.body.contains(container) || container._csRenderId !== currentRenderId) return;
    if (!isRefList && document.body._csMainRenderId !== mainRenderId) return;

    // Initialize container states
    let groupingConfig = currentOptions.grouping || currentOptions.mapping?.grouping;
    if (isRefList) {
        groupingConfig = null;
    }
    if (container._csActiveGrouper === undefined) {
        container._csActiveGrouper = groupingConfig?.defaultGrouper || "";
    }
    if (container._csActiveSorter === undefined) {
        container._csActiveSorter = groupingConfig?.defaultSorter || "";
    }
    if (container._csActiveSortDir === undefined) {
        container._csActiveSortDir = groupingConfig?.defaultSortDir || "asc";
    }
    if (container._csDropdownFilters === undefined) {
        container._csDropdownFilters = {};
    }

    const activeGrouper = container._csActiveGrouper;
    const activeSorter = container._csActiveSorter;
    const activeSortDir = container._csActiveSortDir;

    // Determine filter fields
    const configuredFilterFields = groupingConfig?.filterFields || [];
    let searchCols = configuredFilterFields.map(f => f.colId);
    if (!searchCols.length) {
        searchCols = Object.keys(schema).filter(colId => {
            return colId !== 'id' && colId !== 'manualSort' && !colId.startsWith('gristHelper_');
        });
    }

    // Pre-resolve referenced columns asynchronously
    const columnsToResolve = new Set();
    if (groupingConfig) {
        if (groupingConfig.statusColumn) columnsToResolve.add(groupingConfig.statusColumn);
        if (groupingConfig.progressColumn) columnsToResolve.add(groupingConfig.progressColumn);
        if (activeGrouper) columnsToResolve.add(activeGrouper);
    }
    if (activeSorter) columnsToResolve.add(activeSorter);
    searchCols.forEach(colId => columnsToResolve.add(colId));

    const resolvePromises = [];
    for (const record of records) {
        for (const colId of columnsToResolve) {
            resolvePromises.push(_getOrResolveDisplayValue(record, colId, schema, tableLens));
        }
    }
    if (resolvePromises.length > 0) {
        await Promise.all(resolvePromises);
        if (!document.body.contains(container) || container._csRenderId !== currentRenderId) return;
        if (!isRefList && document.body._csMainRenderId !== mainRenderId) return;
    }

    // Unified filtering
    let filteredRecords = [...records];
    const lowerCaseSearchTerm = (container._csSearchTerm || "").trim().toLowerCase();
    if (lowerCaseSearchTerm) {
        filteredRecords = filteredRecords.filter(record => {
            let matches = false;
            for (const colId of searchCols) {
                const colSchema = schema[colId];
                let stringValue = '';
                if (colSchema && colSchema.type === 'Bool') {
                    stringValue = (record[colId] === true) ? 'sim' : (record[colId] === false) ? 'não' : '';
                } else if (colSchema && (colSchema.type.startsWith('Ref:') || colSchema.type.startsWith('RefList:'))) {
                    stringValue = record[`_csResolved_${colId}`] || '';
                } else {
                    const valueToSearch = record[colId];
                    if (valueToSearch !== null && valueToSearch !== undefined) {
                        stringValue = String(valueToSearch);
                    }
                }
                if (stringValue.toLowerCase().includes(lowerCaseSearchTerm)) {
                    matches = true;
                    break;
                }
            }
            return matches;
        });
    }

    const dropdownFilters = container._csDropdownFilters || {};
    Object.keys(dropdownFilters).forEach(colId => {
        const selectedValue = dropdownFilters[colId];
        if (selectedValue) {
            filteredRecords = filteredRecords.filter(record => {
                const colSchema = schema[colId];
                let stringValue = '';
                if (colSchema && colSchema.type === 'Bool') {
                    stringValue = (record[colId] === true) ? 'Sim' : (record[colId] === false) ? 'Não' : '';
                } else if (colSchema && (colSchema.type.startsWith('Ref:') || colSchema.type.startsWith('RefList:'))) {
                    stringValue = record[`_csResolved_${colId}`] || '';
                } else {
                    const val = record[colId];
                    if (val !== null && val !== undefined) stringValue = String(val);
                }
                return stringValue === selectedValue;
            });
        }
    });

    // Populate unique values for configured filter dropdowns based on database records
    const filterFieldUniqueValues = {};
    configuredFilterFields.forEach(f => {
        const colId = f.colId;
        if (!colId) return;
        const colSchema = schema[colId];
        const valSet = new Set();
        (container._csDatabaseRecords || records).forEach(record => {
            let stringValue = '';
            if (colSchema && colSchema.type === 'Bool') {
                stringValue = (record[colId] === true) ? 'Sim' : (record[colId] === false) ? 'Não' : '';
            } else if (colSchema && (colSchema.type.startsWith('Ref:') || colSchema.type.startsWith('RefList:'))) {
                stringValue = record[`_csResolved_${colId}`] || '';
            } else {
                const val = record[colId];
                if (val !== null && val !== undefined) stringValue = String(val);
            }
            if (stringValue) {
                valSet.add(stringValue);
            }
        });
        filterFieldUniqueValues[colId] = Array.from(valSet).sort((a, b) => a.localeCompare(b));
    });

    // Unified sorting
    let processedRecords = [...filteredRecords];
    const orderColumn = currentOptions.orderColumn || currentOptions.mapping?.orderColumn;
    const enableOrder = currentOptions.enableOrder || currentOptions.mapping?.enableOrder;

    if (activeSorter) {
        const dirMultiplier = activeSortDir === 'desc' ? -1 : 1;
        processedRecords.sort((a, b) => {
            const colSchema = schema[activeSorter];
            let valA = a[activeSorter];
            let valB = b[activeSorter];
            if (colSchema && (colSchema.type.startsWith('Ref:') || colSchema.type.startsWith('RefList:'))) {
                valA = a[`_csResolved_${activeSorter}`] || '';
                valB = b[`_csResolved_${activeSorter}`] || '';
            }
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB) * dirMultiplier;
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * dirMultiplier;
            }
            return String(valA).localeCompare(String(valB)) * dirMultiplier;
        });
    } else if (enableOrder && orderColumn) {
        processedRecords.sort((a, b) => {
            const valA = a[orderColumn] ?? 0;
            const valB = b[orderColumn] ?? 0;
            return valA - valB;
        });
    }

    // Helper to render Visualização button & popup
    function _renderOptionsButtonAndPopup() {
        _injectOptionsStyles();
        const filterBar = document.querySelector('.filter-bar');
        if (filterBar && !isRefList) {
            let optionsContainer = filterBar.querySelector('.cs-options-container');
            if (!optionsContainer) {
                optionsContainer = document.createElement('div');
                optionsContainer.className = 'cs-options-container';
                const filterInput = filterBar.querySelector('#filter-input');
                if (filterInput) {
                    filterInput.insertAdjacentElement('afterend', optionsContainer);
                } else {
                    filterBar.appendChild(optionsContainer);
                }
            }
            
            // Hide the legacy top-level filter input dynamically
            const filterInput = filterBar.querySelector('#filter-input');
            if (filterInput) {
                filterInput.style.display = 'none';
            }
            
            const isFilterActive = !!(container._csSearchTerm || Object.values(container._csDropdownFilters || {}).some(v => v));
            const isSortActive = !!activeSorter;
            const isGroupActive = !!activeGrouper;
            
            optionsContainer.innerHTML = `
              <button class="cs-options-btn" id="cs-options-btn" title="Visualização e Filtros">
                <span>Visualização</span>
                <span class="cs-options-btn-icons">
                  <svg class="cs-btn-icon cs-icon-filter ${isFilterActive ? 'active' : ''}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><use xlink:href="#icon-filter"></use></svg>
                  <svg class="cs-btn-icon cs-icon-sort ${isSortActive ? 'active' : ''}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><use xlink:href="#icon-adjustments-vert"></use></svg>
                  <svg class="cs-btn-icon cs-icon-group ${isGroupActive ? 'active' : ''}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><use xlink:href="#icon-folder"></use></svg>
                </span>
              </button>
            `;
            
            const btn = optionsContainer.querySelector('#cs-options-btn');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                container._csOptionsPopupOpen = !container._csOptionsPopupOpen;
                renderCards(container, container._csOriginalRecords, currentOptions, schema);
            });
            
            // Close popup on click outside
            if (!window._csOptionsOutsideClickRegistered) {
                window._csOptionsOutsideClickRegistered = true;
                document.addEventListener('click', () => {
                    document.querySelectorAll('.cards-wrapper').forEach(wrapper => {
                        if (wrapper._csOptionsPopupOpen) {
                            wrapper._csOptionsPopupOpen = false;
                            if (wrapper._csOriginalRecords && wrapper._csOptions && wrapper._csSchema) {
                                renderCards(wrapper, wrapper._csOriginalRecords, wrapper._csOptions, wrapper._csSchema);
                            }
                        }
                    });
                });
            }
            
            if (container._csOptionsPopupOpen) {
                const popup = document.createElement('div');
                popup.className = 'cs-options-popup';
                popup.addEventListener('click', (e) => e.stopPropagation());
                
                let searchHtml = `
                  <div class="cs-popup-section">
                    <div class="cs-popup-label">Buscar</div>
                    <input type="text" id="popup-filter-input" placeholder="Buscar..." class="cs-popup-input" value="${container._csSearchTerm || ''}">
                  </div>
                  <div class="cs-popup-divider"></div>
                `;
                
                let groupingHtml = '';
                const allowedGroupers = groupingConfig?.allowedGroupers || [];
                if (groupingConfig && groupingConfig.enabled) {
                    groupingHtml = `
                      <div class="cs-popup-section">
                        <div class="cs-popup-label">Agrupar por</div>
                        <select class="cs-popup-select cs-select-grouper">
                          <option value="">Sem Agrupamento</option>
                          ${allowedGroupers.map(g => `
                            <option value="${g.colId}" ${g.colId === activeGrouper ? 'selected' : ''}>${g.label || g.colId}</option>
                          `).join('')}
                        </select>
                      </div>
                    `;
                }
                
                let sortingHtml = '';
                const allowedSorts = groupingConfig?.allowedSorts || [];
                if (allowedSorts.length > 0) {
                    sortingHtml = `
                      <div class="cs-popup-section">
                        <div class="cs-popup-label">Ordenar por</div>
                        <div class="cs-sort-group">
                          <select class="cs-popup-select cs-select-sorter">
                            <option value="">Padrão</option>
                            ${allowedSorts.map(s => `
                              <option value="${s.colId}" ${s.colId === activeSorter ? 'selected' : ''}>${s.label || s.colId}</option>
                            `).join('')}
                          </select>
                          <div class="cs-sort-dir-toggle">
                            <button class="cs-sort-dir-btn cs-btn-asc ${activeSortDir === 'asc' ? 'active' : ''}" title="A-Z">A-Z</button>
                            <button class="cs-sort-dir-btn cs-btn-desc ${activeSortDir === 'desc' ? 'active' : ''}" title="Z-A">Z-A</button>
                          </div>
                        </div>
                      </div>
                    `;
                }
                
                let filtersHtml = '';
                if (configuredFilterFields.length > 0) {
                    filtersHtml = `
                      <div class="cs-popup-divider"></div>
                      <div class="cs-popup-label">Filtros Avançados</div>
                      ${configuredFilterFields.map(f => {
                          const colId = f.colId;
                          const uniqueVals = filterFieldUniqueValues[colId] || [];
                          const selectedVal = dropdownFilters[colId] || '';
                          return `
                            <div class="cs-popup-section">
                              <div class="cs-popup-label" style="font-size: 10px; color: #94a3b8;">${f.label || colId}</div>
                              <select class="cs-popup-select cs-select-filter" data-colid="${colId}">
                                <option value="">Todos</option>
                                ${uniqueVals.map(val => `
                                  <option value="${val}" ${val === selectedVal ? 'selected' : ''}>${val}</option>
                                `).join('')}
                              </select>
                            </div>
                          `;
                      }).join('')}
                    `;
                }
                
                popup.innerHTML = `
                  ${searchHtml}
                  ${groupingHtml}
                  ${sortingHtml}
                  ${filtersHtml}
                `;
                
                const popupFilterInput = popup.querySelector('#popup-filter-input');
                if (popupFilterInput) {
                    popupFilterInput.addEventListener('input', async (e) => {
                        const val = e.target.value;
                        container._csSearchTerm = val;
                        
                        const legacyInput = document.getElementById('filter-input');
                        if (legacyInput) {
                            legacyInput.value = val;
                        }
                        
                        const selectionStart = e.target.selectionStart;
                        const selectionEnd = e.target.selectionEnd;
                        
                        await renderCards(container, container._csOriginalRecords, currentOptions, schema);
                        
                        const newInput = document.getElementById('popup-filter-input');
                        if (newInput) {
                            newInput.focus();
                            try {
                                newInput.setSelectionRange(selectionStart, selectionEnd);
                            } catch (err) {}
                        }
                    });
                    
                    popupFilterInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                            container._csOptionsPopupOpen = false;
                            renderCards(container, container._csOriginalRecords, currentOptions, schema);
                        }
                    });
                }
                
                const selectGrouper = popup.querySelector('.cs-select-grouper');
                if (selectGrouper) {
                    selectGrouper.addEventListener('change', (e) => {
                        container._csActiveGrouper = e.target.value;
                        renderCards(container, container._csOriginalRecords, currentOptions, schema);
                    });
                }
                
                const selectSorter = popup.querySelector('.cs-select-sorter');
                if (selectSorter) {
                    selectSorter.addEventListener('change', (e) => {
                        container._csActiveSorter = e.target.value;
                        renderCards(container, container._csOriginalRecords, currentOptions, schema);
                    });
                }
                
                const btnAsc = popup.querySelector('.cs-btn-asc');
                if (btnAsc) {
                    btnAsc.addEventListener('click', () => {
                        container._csActiveSortDir = 'asc';
                        renderCards(container, container._csOriginalRecords, currentOptions, schema);
                    });
                }
                
                const btnDesc = popup.querySelector('.cs-btn-desc');
                if (btnDesc) {
                    btnDesc.addEventListener('click', () => {
                        container._csActiveSortDir = 'desc';
                        renderCards(container, container._csOriginalRecords, currentOptions, schema);
                    });
                }
                
                popup.querySelectorAll('.cs-select-filter').forEach(sel => {
                    sel.addEventListener('change', (e) => {
                        const colId = e.target.dataset.colid;
                        if (!container._csDropdownFilters) container._csDropdownFilters = {};
                        container._csDropdownFilters[colId] = e.target.value;
                        renderCards(container, container._csOriginalRecords, currentOptions, schema);
                    });
                });
                
                optionsContainer.appendChild(popup);
            }
        }
    }

    container.innerHTML = "";
    if (!processedRecords || !processedRecords.length) {
      container.textContent = "No records found.";
      _applyWidgetBackground(container, styling, currentOptions);
      _renderOptionsButtonAndPopup();
      return;
    }

    _applyWidgetBackground(container, styling, currentOptions);
    container.style.padding = currentOptions.isRefList ? '0px' : styling.widgetPadding;

    const colLimit = styling.cardsColumnLimit || 1;
    const colMode = styling.cardsColumnMode || 'fixed';
    let numCols = colLimit;

    if (colMode === 'responsive') {
        const totalRecords = processedRecords.length;
        numCols = Math.min(totalRecords, colLimit);
        if (numCols < 1) numCols = 1;
    } else if (colMode === 'balanced') {
        const totalRecords = processedRecords.length;
        numCols = Math.min(Math.max(totalRecords, 2), colLimit);
        if (numCols < 1) numCols = 1;
    }

    const isGrouped = !!(groupingConfig && groupingConfig.enabled && activeGrouper);

    // Build cache of resolved group keys (reads from display value cache directly)
    const resolvedGroupValues = new Map();
    if (isGrouped || (groupingConfig && groupingConfig.statusColumn)) {
        for (const record of processedRecords) {
            if (isGrouped && activeGrouper) {
                const key = `${record.id}_${activeGrouper}`;
                resolvedGroupValues.set(key, record[`_csResolved_${activeGrouper}`] || 'Sem Grupo');
            }
            if (groupingConfig && groupingConfig.statusColumn) {
                const key = `${record.id}_${groupingConfig.statusColumn}`;
                resolvedGroupValues.set(key, record[`_csResolved_${groupingConfig.statusColumn}`] || 'Sem Grupo');
            }
        }
    }

    if (isGrouped) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '15px';
        container.style.width = '100%';
    } else {
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
        container.style.gridAutoRows = 'min-content';
        container.style.gap = styling.cardsSpacing;
    }

    _renderOptionsButtonAndPopup();


    // Build group map and render accordions if grouped
    const groupMap = new Map();
    if (isGrouped) {
        // Group records
        for (const record of processedRecords) {
            const gKey = _getRecordGroupKey(record, activeGrouper, resolvedGroupValues);
            if (!groupMap.has(gKey)) {
                groupMap.set(gKey, []);
            }
            groupMap.get(gKey).push(record);
        }

        // Sort group keys with "Sem Grupo" at the end
        const groupKeys = Array.from(groupMap.keys()).sort((a, b) => {
            const aIsSem = (a === "Sem Grupo");
            const bIsSem = (b === "Sem Grupo");
            if (aIsSem && !bIsSem) return 1;
            if (!aIsSem && bIsSem) return -1;
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });

        // Determine progress scale
        let shouldScale = true;
        if (groupingConfig.progressColumn) {
            for (const rec of processedRecords) {
                const rawVal = rec[groupingConfig.progressColumn];
                if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                    const num = parseFloat(rawVal);
                    if (!isNaN(num) && num > 1.0) {
                        shouldScale = false;
                        break;
                    }
                }
            }
        }

        // Create accordions
        for (const gKey of groupKeys) {
            const groupRecords = groupMap.get(gKey);
            const totalCount = groupRecords.length;
            
            const accordion = document.createElement("div");
            accordion.className = "cs-accordion";
            
            const header = document.createElement("div");
            header.className = "cs-accordion-header";
            
            const headerLeft = document.createElement("div");
            headerLeft.className = "cs-accordion-header-left";
            
            const chevronSpan = document.createElement("span");
            chevronSpan.className = "cs-accordion-chevron";
            chevronSpan.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            headerLeft.appendChild(chevronSpan);
            
            const titleSpan = document.createElement("span");
            titleSpan.className = "cs-accordion-title";
            titleSpan.textContent = gKey;
            headerLeft.appendChild(titleSpan);
            
            const countBadge = document.createElement("span");
            countBadge.className = "cs-accordion-count";
            countBadge.textContent = `${totalCount} ${totalCount === 1 ? 'card' : 'cards'}`;
            headerLeft.appendChild(countBadge);
            
            if (groupingConfig.statusColumn) {
                const statusListDiv = document.createElement("div");
                statusListDiv.className = "cs-accordion-status-list";
                
                const statusValCounts = {};
                for (const rec of groupRecords) {
                    const statusVal = _getRecordGroupKey(rec, groupingConfig.statusColumn, resolvedGroupValues);
                    statusValCounts[statusVal] = (statusValCounts[statusVal] || 0) + 1;
                }
                
                Object.entries(statusValCounts).forEach(([statusName, count]) => {
                    const pill = document.createElement("span");
                    const semanticClass = _getStatusSemanticClass(statusName);
                    pill.className = `cs-status-pill ${semanticClass}`;
                    pill.textContent = `${statusName}: ${count}`;
                    statusListDiv.appendChild(pill);
                });
                headerLeft.appendChild(statusListDiv);
            }
            
            header.appendChild(headerLeft);
            
            const headerRight = document.createElement("div");
            headerRight.className = "cs-accordion-header-right";
            
            let avgProgress = null;
            if (groupingConfig.progressColumn) {
                let sum = 0;
                let count = 0;
                for (const rec of groupRecords) {
                    const rawVal = rec[groupingConfig.progressColumn];
                    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                        const num = parseFloat(rawVal);
                        if (!isNaN(num)) {
                            let val = num;
                            if (shouldScale) val *= 100;
                            val = Math.max(0, Math.min(100, val));
                            sum += val;
                            count++;
                        }
                    }
                }
                if (count > 0) {
                    avgProgress = Math.round(sum / count);
                }
            }
            
            if (avgProgress !== null) {
                const progressLabel = document.createElement("span");
                progressLabel.className = "cs-progress-label";
                progressLabel.textContent = `${avgProgress}%`;
                headerRight.appendChild(progressLabel);
                
                const progressTrack = document.createElement("div");
                progressTrack.className = "cs-progress-track";
                
                const progressFill = document.createElement("div");
                progressFill.className = "cs-progress-fill";
                progressFill.style.width = `${avgProgress}%`;
                progressFill.style.backgroundColor = `hsl(${avgProgress * 1.2}, 75%, 45%)`;
                
                progressTrack.appendChild(progressFill);
                headerRight.appendChild(progressTrack);
            }
            
            header.appendChild(headerRight);
            accordion.appendChild(header);
            
            const body = document.createElement("div");
            body.className = "cs-accordion-body";
            
            const cardsGrid = document.createElement("div");
            cardsGrid.style.display = "grid";
            cardsGrid.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
            cardsGrid.style.gridAutoRows = "min-content";
            cardsGrid.style.gap = styling.cardsSpacing;
            
            body.appendChild(cardsGrid);
            accordion.appendChild(body);
            
            header.addEventListener("click", () => {
                const isCollapsed = body.style.display === "none";
                if (isCollapsed) {
                    body.style.display = "block";
                    chevronSpan.classList.remove("collapsed");
                } else {
                    body.style.display = "none";
                    chevronSpan.classList.add("collapsed");
                }
            });
            
            container.appendChild(accordion);
            accordion._csCardsGrid = cardsGrid;
            groupMap.set(gKey, accordion);
        }
    }

    for (const record of processedRecords) {
      const cardEl = document.createElement("div");
      cardEl.className = "cs-card";
      
      const idPrefix = currentOptions.tableId ? `${currentOptions.tableId}-` : '';
      cardEl.id = `record-${idPrefix}${record.id}`;
      
      cardEl.dataset.recordId = record.id;
      cardEl.dataset.tableId = currentOptions.tableId || '';
      cardEl.style.display = "grid";
      cardEl.style.gridTemplateRows = `repeat(${numRows}, auto)`;
      
      cardEl.style.gridTemplateColumns = `repeat(${NUM_COLS}, 1fr)`;
      cardEl.style.rowGap = styling.fieldRowGap !== undefined ? styling.fieldRowGap : "4px";
      cardEl.style.columnGap = styling.fieldColGap !== undefined ? styling.fieldColGap : "4px";
      cardEl.style.alignSelf = "start";
      cardEl.style.borderRadius = "8px";
      cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      cardEl.style.position = "relative";
      cardEl.style.minHeight = "60px";
      cardEl.style.transition = "all 0.2s ease-in-out";

      const internalPadding = parseInt(styling.internalCardPadding, 10) || 10;
      const handleWidth = parseInt(styling.handleAreaWidth, 10);

      cardEl.style.padding = `${internalPadding}px`;
      cardEl.style.paddingLeft = `${internalPadding + handleWidth}px`;

      let finalCardColor = styling.cardsColorSolidColor;

      if (styling.cardsColorMode === 'conditional' && styling.cardsColorField) {
        const colSchema = schema[styling.cardsColorField];
        if (colSchema) {
          const cellValue = record[styling.cardsColorField];
          let resolved = false;
          if (typeof cellValue === 'string') {
            const trimmed = cellValue.trim();
            if (
              /^#([0-9a-fA-F]{3,8})$/.test(trimmed) || 
              trimmed.startsWith('rgb(') || 
              trimmed.startsWith('rgba(') || 
              trimmed.startsWith('hsl(') || 
              trimmed.startsWith('hsla(')
            ) {
              finalCardColor = trimmed;
              cardEl.style.background = finalCardColor;
              resolved = true;
            }
          }
          if (!resolved) {
            const fieldStyle = getFieldStyle(record, colSchema, schema);
            finalCardColor = fieldStyle.fillColor || styling.cardsColorSolidColor;
            cardEl.style.background = finalCardColor;
            if (styling.cardsColorApplyText && fieldStyle.textColor) {
              cardEl.style.color = fieldStyle.textColor;
            }
          }
        } else {
          cardEl.style.background = styling.cardsColorSolidColor;
        }
      } else if (styling.cardsColorMode === 'text-value') {
        if (styling.cardsColorTextField) {
             const bgVal = record[styling.cardsColorTextField];
             if (bgVal) {
                 finalCardColor = bgVal;
                 cardEl.style.background = bgVal;
             }
        }
        if (styling.cardsColorFontField) {
             const fontVal = record[styling.cardsColorFontField];
             if (fontVal) cardEl.style.color = fontVal;
        }
      } else if (styling.cardsColorMode === 'solid' && styling.cardsColorField) {
          const bgVal = record[styling.cardsColorField];
          if (bgVal) {
              finalCardColor = bgVal;
              cardEl.style.background = bgVal;
          } else {
              cardEl.style.background = styling.cardsColorSolidColor;
          }
          if (styling.cardsColorApplyText && styling.cardsColorFontField) {
               const fontVal = record[styling.cardsColorFontField];
               if (fontVal) cardEl.style.color = fontVal;
          }
      }
      else if (styling.cardsColorMode === 'overlay') {
          const opacity = (parseInt(styling.cardsColorOverlayOpacity, 10) || 0) / 100;
          const isDarken = styling.cardsColorOverlayEffect === 'darken';
          const rgb = isDarken ? '0, 0, 0' : '255, 255, 255';
          finalCardColor = `rgba(${rgb}, ${opacity})`;
          cardEl.style.background = finalCardColor;
      } else {
        finalCardColor = resolveStyle(record, schema, styling.cardsColorMode, styling.cardsColorSolidColor, { type: styling.cardsColorGradientType, c1: styling.cardsColorGradientColor1, c2: styling.cardsColorGradientColor2 }, styling.cardsColorField);
        cardEl.style.background = finalCardColor;
      }

      if (styling.cardBorderThickness > 0) {
        const borderColor = resolveStyle(record, schema, styling.cardBorderMode, styling.cardBorderSolidColor, null, styling.cardBorderField);
        cardEl.style.border = `${styling.cardBorderThickness}px solid ${borderColor}`;
      } else {
        cardEl.style.border = "none";
      }

      const handleEl = document.createElement("div");
      handleEl.style.position = "absolute";
      handleEl.style.left = "0";
      handleEl.style.top = "0";
      handleEl.style.bottom = "0";
      handleEl.style.width = styling.handleAreaWidth;
      
      let handleBg;
      if (styling.handleAreaMode === 'overlay') {
          const opacity = (parseInt(styling.handleAreaOverlayOpacity, 10) || 0) / 100;
          const isDarken = styling.handleAreaOverlayEffect === 'darken';
          const rgb = isDarken ? '0, 0, 0' : '255, 255, 255';
          handleBg = `rgba(${rgb}, ${opacity})`;
      } else {
          handleBg = resolveStyle(record, schema, styling.handleAreaMode, styling.handleAreaSolidColor, null, styling.handleAreaField);
      }
      handleEl.style.background = handleBg;
      handleEl.style.borderTopLeftRadius = "8px";
      handleEl.style.borderBottomLeftRadius = "8px";

      if (styling.handleAreaTitleField && record[styling.handleAreaTitleField] !== undefined && record[styling.handleAreaTitleField] !== null) {
          const titleText = String(record[styling.handleAreaTitleField]);
          if (titleText.trim() !== "") {
              const titleEl = document.createElement("div");
              titleEl.className = "cs-handle-title";
              titleEl.textContent = styling.handleAreaTitleAllCaps ? titleText.toUpperCase() : titleText;
              titleEl.style.position = "absolute";
              titleEl.style.left = "0";
              titleEl.style.top = "0";
              titleEl.style.width = "100%";
              titleEl.style.height = "100%";
              titleEl.style.display = "flex";
              titleEl.style.alignItems = "center";
              titleEl.style.justifyContent = "center";
              titleEl.style.writingMode = "vertical-rl";
              titleEl.style.transform = "rotate(180deg)";
              titleEl.style.whiteSpace = "normal";
              titleEl.style.wordBreak = "break-word";
              titleEl.style.textAlign = "center";
              titleEl.style.padding = "2px";
              titleEl.style.boxSizing = "border-box";
              titleEl.style.color = styling.handleAreaTitleColor || "#ffffff";
              titleEl.style.fontSize = styling.handleAreaTitleFontSize || "10px";
              titleEl.style.fontWeight = "bold";
              titleEl.style.pointerEvents = "none";
              handleEl.appendChild(titleEl);
          }
      }

      cardEl.appendChild(handleEl);
      
      if (handleWidth === 0) {
        handleEl.style.display = "none";
      }

      if (viewMode === "burger") {
        const burger = document.createElement("span");
        burger.innerHTML = "☰";
        burger.style.cssText = "position: absolute; left: 8px; top: 8px; font-size: 18px; color: #555; cursor: pointer; z-index: 2;";
        handleEl.appendChild(burger);
        burger.addEventListener("click", (e) => { e.stopPropagation(); handleCardClick(record, currentOptions); });
        cardEl.style.cursor = "default";
      } else {
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", (e) => { e.stopPropagation(); handleCardClick(record, currentOptions); });
      }

      if (styling.selectedCard?.enabled) {
        cardEl.addEventListener("mouseenter", () => { cardEl.style.transform = `scale(${styling.selectedCard.scale})`; cardEl.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)"; });
        cardEl.addEventListener("mouseleave", () => { cardEl.style.transform = "scale(1)"; cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"; });
      }

      const titleFields = layout.filter(f => f.style?.isTitleField);
      if (styling.cardTitleTopBarEnabled && titleFields.length > 0) {
        const topBarEl = document.createElement("div");
        topBarEl.style.gridRow = "1 / span 1";
        topBarEl.style.gridColumn = `1 / span ${NUM_COLS}`;
        topBarEl.style.padding = "4px 8px";
        topBarEl.style.display = "flex";
        topBarEl.style.alignItems = "center";
        topBarEl.style.gap = "16px";
        if (styling.cardTitleTopBarMode === 'conditional' && styling.cardTitleTopBarField) {
          const colSchema = schema[styling.cardTitleTopBarField];
          if (colSchema) {
            const fieldStyle = getFieldStyle(record, colSchema, schema);
            topBarEl.style.background = fieldStyle.fillColor || styling.cardTitleTopBarSolidColor;
            if (styling.cardTitleTopBarApplyText && fieldStyle.textColor) {
              topBarEl.style.color = fieldStyle.textColor;
            }
          } else {
            topBarEl.style.background = styling.cardTitleTopBarSolidColor;
          }
        } else {
          topBarEl.style.background = resolveStyle(record, schema, styling.cardTitleTopBarMode, styling.cardTitleTopBarSolidColor, { type: styling.cardTitleTopBarGradientType, c1: styling.cardTitleTopBarGradientColor1, c2: styling.cardTitleTopBarGradientColor2 }, styling.cardTitleTopBarField);
        }
        topBarEl.style.borderTopLeftRadius = "8px";
        topBarEl.style.borderTopRightRadius = "8px";
        cardEl.appendChild(topBarEl);

        for (const f of titleFields) {
          const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
          const tContainer = document.createElement("div");
          tContainer.style.display = "flex";
          tContainer.style.flexDirection = (fieldStyle.labelPosition === 'left' ? "row" : "column");
          tContainer.style.gap = "4px";
          if (fieldStyle.labelVisible) {
            const lblEl = document.createElement("div");
            const fieldSchema = schema ? schema[f.colId] : null;
            lblEl.textContent = fieldSchema ? (fieldSchema.label || f.colId) : f.colId;
            lblEl.style.fontFamily = styling.cardTitleTopBarLabelFontStyle;
            lblEl.style.fontSize = styling.cardTitleTopBarLabelFontSize;
            lblEl.style.color = styling.cardTitleTopBarLabelFontColor;
            if (styling.cardTitleTopBarLabelAllCaps) lblEl.style.textTransform = "uppercase";
            tContainer.appendChild(lblEl);
          }
          const dataEl = document.createElement("div");
          dataEl.style.fontFamily = styling.cardTitleTopBarDataFontStyle;
          dataEl.style.fontSize = styling.cardTitleTopBarDataFontSize;
          dataEl.style.color = styling.cardTitleTopBarDataFontColor;
          if (styling.cardTitleTopBarDataAllCaps) dataEl.style.textTransform = "uppercase";
          
          await renderField({
            container: dataEl,
            colSchema: schema ? schema[f.colId] : null,
            record: record,
            isEditing: false,
            tableLens: tableLens,
            fieldStyle: fieldStyle,
            styling: styling
          });
          if (container._csRenderId !== currentRenderId) return;

          tContainer.appendChild(dataEl);
          topBarEl.appendChild(tContainer);
        }
      }

      for (const f of layout) {
        if (f.isIconGroup) {
          const actions = currentOptions.actions || {};
          const groupConfig = (currentOptions.iconGroups || actions.iconGroups || styling.iconGroups || []).find(g => g.id === f.colId);
          if (!groupConfig || !groupConfig.buttons || groupConfig.buttons.length === 0) continue;

          const groupContainer = document.createElement("div");
          groupContainer.style.gridRow = `${f.row + 1} / span ${f.rowSpan || 1}`;
          groupContainer.style.gridColumn = `${f.col + 1} / span ${f.colSpan || 1}`;
          groupContainer.style.padding = "4px";
          groupContainer.style.display = "flex";
          groupContainer.style.gap = "8px";
          groupContainer.style.alignItems = "center";
          
          if (groupConfig.verticalOffset) {
              groupContainer.style.transform = `translateY(${groupConfig.verticalOffset}px)`;
              groupContainer.style.zIndex = "10"; 
          }

          const isHoverOnly = groupConfig.visibilityMode === 'hover';
          if (isHoverOnly) {
              groupContainer.style.opacity = "0";
              groupContainer.style.transition = "opacity 0.2s ease-in-out";
              groupContainer.style.pointerEvents = "none";
              cardEl.addEventListener('mouseenter', () => {
                  groupContainer.style.opacity = "1";
                  groupContainer.style.pointerEvents = "auto";
              });
              cardEl.addEventListener('mouseleave', () => {
                  groupContainer.style.opacity = "0";
                  groupContainer.style.pointerEvents = "none";
              });
          }

          let justifyContent = "center";
          if (groupConfig.alignment === 'left') justifyContent = "flex-start";
          if (groupConfig.alignment === 'right') justifyContent = "flex-end";
          groupContainer.style.justifyContent = justifyContent;

          groupConfig.buttons.forEach(buttonConfig => {
            const actionButton = document.createElement("button");
            actionButton.className = "cs-action-button";
            
            const isText = buttonConfig.buttonStyle === 'text';
            const shape = groupConfig.shape || 'square';
            const fgColor = groupConfig.iconColor || '#000000';
            const borderWidth = groupConfig.borderWidth !== undefined ? groupConfig.borderWidth : 1;
            
            let bgColor = '#f0f0f0';
            if (groupConfig.bgMode === 'transparent') {
                bgColor = 'transparent';
            } else if (groupConfig.bgMode === 'solid') {
                bgColor = groupConfig.backgroundColor || '#f0f0f0';
            } else if (groupConfig.bgMode === 'overlay') {
                const op = (parseInt(groupConfig.overlayOpacity, 10) || 20) / 100;
                const rgb = groupConfig.overlayEffect === 'darken' ? '0,0,0' : '255,255,255';
                bgColor = `rgba(${rgb}, ${op})`;
            } else if (groupConfig.bgMode === 'match-card') {
                const effect = groupConfig.overlayEffect || 'lighten';
                const opacity = groupConfig.overlayOpacity || 20;
                bgColor = adjustColor(finalCardColor, opacity, effect);
            } else {
                bgColor = groupConfig.transparentBackground ? 'transparent' : (groupConfig.backgroundColor || '#f0f0f0');
            }

            if (isText) {
                actionButton.textContent = (buttonConfig.text || 'Tx').substring(0, 3);
                actionButton.style.fontFamily = 'sans-serif';
                actionButton.style.fontWeight = 'bold';
                actionButton.style.fontSize = '20px';
            } else {
                actionButton.innerHTML = getIcon(buttonConfig.icon || 'icon-link');
            }

            if (buttonConfig.actionType === 'showTooltipField' && buttonConfig.tooltipField) {
                const val = record[buttonConfig.tooltipField];
                if (val !== undefined && val !== null) {
                    actionButton.title = `${buttonConfig.tooltip || ''}\n\n${String(val)}`;
                }
            } else {
                actionButton.title = buttonConfig.tooltip || '';
            }

            const shouldShowCount = (buttonConfig.actionType === 'triggerWidget' || buttonConfig.actionType === 'navigate') && 
                                    buttonConfig.targetTable && tableLens;
            
            if (shouldShowCount) {
                const baseTooltip = buttonConfig.tooltip || '';
                (async () => {
                    try {
                        const targetTableId = buttonConfig.targetTable;
                        const sourceTableId = record.gristHelper_tableId;
                        const relationColId = await tableLens.findRelationField(targetTableId, sourceTableId);
                        if (relationColId) {
                            const allTargetRecords = await tableLens.fetchTableRecords(targetTableId);
                            const relatedCount = allTargetRecords.filter(r => {
                                const val = r[relationColId];
                                if (Array.isArray(val)) return val.includes(record.id);
                                return val === record.id;
                            }).length;
                            const countText = ` (${relatedCount})`;
                            actionButton.title = baseTooltip ? `${baseTooltip}${countText}` : `${relatedCount} itens`;
                        }
                    } catch (err) {
                        console.error("[CardSystem] Error fetching related count for tooltip:", err);
                    }
                })();
            }

            const iconSize = styling.iconSize || 1.0;
            actionButton.style.width = `${32 * iconSize}px`;
            actionButton.style.height = `${32 * iconSize}px`;
            actionButton.style.border = groupConfig.borderColor ? `${borderWidth}px solid ${groupConfig.borderColor}` : `${borderWidth}px solid #ccc`;
            actionButton.style.background = bgColor;
            actionButton.style.color = fgColor;
            actionButton.style.borderRadius = shape === 'circle' ? "50%" : "5px";
            
            const svgIcon = actionButton.querySelector('svg.icon');
            if (svgIcon) {
                svgIcon.style.color = fgColor;
                svgIcon.setAttribute('fill', 'currentColor');
                svgIcon.setAttribute('stroke', 'currentColor');
                svgIcon.style.width = '85%';
                svgIcon.style.height = '85%';
            }

            actionButton.style.cursor = "pointer";
            actionButton.style.padding = "4px";
            actionButton.style.display = "flex";
            actionButton.style.justifyContent = "center";
            actionButton.style.alignItems = "center";
            actionButton.style.transition = "opacity 0.2s";

            actionButton.addEventListener('mouseenter', () => actionButton.style.opacity = '0.8');
            actionButton.addEventListener('mouseleave', () => actionButton.style.opacity = '1');
            
            if (buttonConfig.actionType === 'moveRecord') {
                actionButton.classList.add('cs-move-handle');
                actionButton.style.cursor = 'grab';
                if (!isText && (!buttonConfig.icon || buttonConfig.icon === 'icon-link')) {
                    buttonConfig.icon = 'icon-arrow-move';
                    actionButton.innerHTML = getIcon(buttonConfig.icon);
                    const svg = actionButton.querySelector('svg');
                    if (svg) {
                        svg.style.color = fgColor;
                        svg.setAttribute('fill', 'currentColor');
                        svg.setAttribute('stroke', 'currentColor');
                        svg.style.width = '85%';
                        svg.style.height = '85%';
                    }
                }
            }

            if (buttonConfig.actionType === 'editRecord') {
                actionButton.classList.add('cs-edit-handle');
            }

            actionButton.addEventListener("click", (e) => {
              e.stopPropagation();
              if (buttonConfig.actionType === 'moveRecord') return;

              if (buttonConfig.actionType === 'triggerWidget') {
                const configIdToPublish = buttonConfig.targetConfigId || currentOptions.configId;
                if (!configIdToPublish) return;
                let rowIdsToPublish = [];
                let filterValueToPublish = record.id;

                if (buttonConfig.sourceRefListColumn) {
                  const refListValue = record[buttonConfig.sourceRefListColumn];
                  if (Array.isArray(refListValue) && refListValue[0] === 'L') {
                    rowIdsToPublish = refListValue.slice(1);
                    filterValueToPublish = rowIdsToPublish;
                  }
                }

                publish('grf-trigger-widget', {
                  configId: configIdToPublish,
                  sourceRecord: record,
                  rowIds: rowIdsToPublish,
                  filterValue: filterValueToPublish,
                  componentType: buttonConfig.targetComponentType,
                  filterTargetColumn: buttonConfig.filterTargetColumn,
                  disableFiltering: buttonConfig.disableFiltering
                });
              } else {
                publish('grf-navigation-action-triggered', {
                  config: buttonConfig,
                  sourceRecord: record,
                  tableId: currentOptions.tableId
                });
              }
            });
            groupContainer.appendChild(actionButton);
          });

          cardEl.appendChild(groupContainer);
          continue;
        }

        const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
        if (!record.hasOwnProperty(f.colId)) continue;
        if (styling.cardTitleTopBarEnabled && fieldStyle.isTitleField) continue;

        if (f.row >= 0) {
          const fieldBox = document.createElement("div");
          fieldBox.style.gridRow = `${f.row + 1} / span ${f.rowSpan || 1}`;
          fieldBox.style.gridColumn = `${f.col + 1} / span ${f.colSpan || 1}`;
          fieldBox.style.padding = styling.fieldPadding !== undefined ? styling.fieldPadding : "4px";

          if (styling.fieldBackground?.enabled) {
            const cardBaseColor = resolveStyle(record, schema, styling.cardsColorMode, styling.cardsColorSolidColor, null, styling.cardsColorField);
            fieldBox.style.backgroundColor = lightenHexColor(cardBaseColor, styling.fieldBackground.lightenPercentage || 15);
            fieldBox.style.borderRadius = '4px';
          }

          fieldBox.style.display = "flex";
          fieldBox.style.flexDirection = (fieldStyle.labelPosition === 'left' ? "row" : "column");
          fieldBox.style.gap = fieldStyle.labelVisible ? (fieldStyle.labelPosition === 'left' ? "8px" : "2px") : "0px";
          fieldBox.style.alignItems = (fieldStyle.labelPosition === 'left' ? "center" : "stretch");

          if (fieldStyle.labelVisible) {
            const labelEl = document.createElement("div");
            const fieldSchema = schema ? schema[f.colId] : null;
            let labelText = fieldSchema ? (fieldSchema.label || f.colId) : f.colId;
            if (fieldSchema && fieldSchema.type.startsWith('RefList:')) {
              const refListValue = record[f.colId];
              const count = Array.isArray(refListValue) && refListValue[0] === 'L' ? refListValue.length - 1 : 0;
              labelText += ` (${count} itens)`;
            }
            let labelHtml = labelText;
            if (fieldSchema && fieldSchema.description && fieldSchema.description.trim() !== '') {
              const sanitizedDescription = fieldSchema.description.replace(/"/g, '&quot;');
              labelHtml += ` <span class="grf-tooltip-trigger" data-tooltip="${sanitizedDescription}">?</span>`;
            }
            labelEl.innerHTML = labelHtml;
            const ls = styling.labelStyle || {};
            labelEl.style.fontWeight = ls.bold ? 'bold' : 'normal';
            labelEl.style.color = ls.color;
            labelEl.style.fontFamily = ls.font;
            labelEl.style.fontSize = ls.size;
            if (ls.allCaps || fieldStyle.labelAllCaps) labelEl.style.textTransform = 'uppercase';
            if (fieldStyle.isTitleField && !styling.cardTitleTopBarEnabled) {
              labelEl.style.fontWeight = "bold";
              labelEl.style.color = styling.cardTitleFontColor;
              labelEl.style.fontSize = styling.cardTitleFontSize;
              labelEl.style.fontFamily = styling.cardTitleFontStyle;
              if (styling.cardTitleAllCaps) labelEl.style.textTransform = 'uppercase';
            }
            fieldBox.appendChild(labelEl);
          }

          const fieldSchema = schema ? schema[f.colId] : null;
          const isTabulatorRefList = fieldSchema && fieldSchema.type.startsWith('RefList:') && fieldStyle.refListConfig?.displayAs === 'tabulator';
          let containerForField;
          if (isTabulatorRefList) {
              containerForField = document.createElement('div');
              fieldBox.appendChild(containerForField);
          } else {
              containerForField = document.createElement("div");
              const fb = styling.fieldBox || {};
              if (fb.borderEnabled) {
                  containerForField.style.border = `${fb.borderWidth || 1}px solid ${fb.borderColor || '#cccccc'}`;
                  containerForField.style.borderRadius = `${fb.borderRadius || 4}px`;
                  containerForField.style.padding = '4px 6px';
                  containerForField.style.backgroundColor = fb.backgroundColor || '#ffffff';
                  switch (fb.effect) {
                      case 'bevel': containerForField.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)'; break;
                      case 'bevel-outset': containerForField.style.boxShadow = '-1px -1px 3px rgba(255,255,255,0.7), 1px 1px 3px rgba(0,0,0,0.2)'; break;
                      case 'shadow': containerForField.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)'; break;
                  }
              }
              fieldBox.appendChild(containerForField);
          }

          const fieldOptions = {};
          if (fieldStyle.widget === 'Color Picker' || fieldStyle.widget === 'color') fieldOptions.colorPicker = true;
          else if (fieldStyle.widget === 'Progress Bar' || fieldStyle.widget === 'progress') {
            fieldOptions.progressBar = true;
            fieldOptions.widgetOptions = fieldStyle.widgetOptions;
          }
          if (fieldStyle.dataStyle?.allCaps || fieldStyle.dataAllCaps) containerForField.style.textTransform = 'uppercase';
          if (fieldStyle.isTitleField && !styling.cardTitleTopBarEnabled) {
            if (styling.cardTitleAllCaps) containerForField.style.textTransform = 'uppercase';
            if (styling.cardTitleFontColor) containerForField.style.color = styling.cardTitleFontColor;
            if (styling.cardTitleFontSize) containerForField.style.fontSize = styling.cardTitleFontSize;
            if (styling.cardTitleFontStyle) containerForField.style.fontFamily = styling.cardTitleFontStyle;
            containerForField.style.fontWeight = "bold";
          }
          if (fieldStyle.heightLimited && fieldStyle.maxHeightRows > 0) {
            containerForField.style.display = "-webkit-box";
            containerForField.style.webkitLineClamp = fieldStyle.maxHeightRows;
            containerForField.style.webkitBoxOrient = "vertical";
            containerForField.style.overflow = "hidden";
            containerForField.style.wordBreak = "break-word";
            const rawValue = record[f.colId];
            if (rawValue !== null && rawValue !== undefined) {
              _resolveFieldDisplayText(record, fieldSchema, tableLens).then(txt => {
                containerForField.title = txt;
              });
            }
          }

          await renderField({
            container: containerForField, colSchema: fieldSchema, record: record, isEditing: false, tableLens: tableLens, fieldStyle: fieldStyle,
            fieldConfig: currentOptions.fieldConfig?.[f.colId] || fieldStyle, styling: styling, fieldOptions: fieldOptions,
            receivedConfigs: currentOptions.receivedConfigs, tableSchema: schema
          });
          if (!document.body.contains(container) || container._csRenderId !== currentRenderId) return;
          cardEl.appendChild(fieldBox);
        }
      }
      if (isGrouped) {
        const gKey = _getRecordGroupKey(record, activeGrouper, resolvedGroupValues);
        const accordion = groupMap.get(gKey);
        if (accordion && accordion._csCardsGrid) {
            accordion._csCardsGrid.appendChild(cardEl);
        }
      } else {
        container.appendChild(cardEl);
      }
    }

    if (enableOrder && orderColumn && !isGrouped) {
        _handleDragAndDrop(container, orderColumn, currentOptions);
    }

    if (styling.showDebugInfo) {
        const debugDiv = document.createElement('div');
        debugDiv.style.marginTop = '20px';
        debugDiv.style.padding = '10px';
        debugDiv.style.border = '1px solid red';
        debugDiv.style.backgroundColor = '#fff0f0';
        debugDiv.innerHTML = `<h3>Schema Debug Info (TableLens)</h3>
        <textarea rows="10" style="width: 100%; font-family: monospace;">${JSON.stringify(schema, null, 2)}</textarea>`;
        container.appendChild(debugDiv);
    }
  }

  async function filterRecords(container, searchTerm) {
    if (!container) return;
    const targetContainer = container._csOriginalRecords ? container : (container.querySelector('.cards-wrapper') || container);
    
    targetContainer._csSearchTerm = searchTerm;
    const options = targetContainer._csOptions || {};
    const schema = targetContainer._csSchema || {};
    await renderCards(targetContainer, targetContainer._csOriginalRecords || [], options, schema);
  }

  function handleCardClick(record, options) {
    const drawerConfigId = options?.actions?.sidePanel?.drawerConfigId || options?.sidePanel?.drawerConfigId || null;
    const tableId = options?.tableId;
    if (!tableId) return;
    publish('grf-card-clicked', {
      drawerConfigId: drawerConfigId,
      recordId: record.id,
      tableId: tableId,
      cardConfig: options
    });
  }

  function resolveStyle(record, schema, mode, solidColor, gradientOptions, fieldName) {
    if (mode === 'gradient' && gradientOptions?.type) { return gradientOptions.type.replace('{c1}', gradientOptions.c1).replace('{c2}', gradientOptions.c2); }
    if (mode === 'conditional' && fieldName && record && schema?.[fieldName]) {
      const cellValue = record[fieldName];
      if (typeof cellValue === 'string') {
        const trimmed = cellValue.trim();
        if (
          /^#([0-9a-fA-F]{3,8})$/.test(trimmed) || 
          trimmed.startsWith('rgb(') || 
          trimmed.startsWith('rgba(') || 
          trimmed.startsWith('hsl(') || 
          trimmed.startsWith('hsla(')
        ) {
          return trimmed;
        }
      }
      const fieldStyle = getFieldStyle(record, schema[fieldName], schema);
      return fieldStyle.fillColor || solidColor;
    }
    if (mode === 'text-value' && fieldName && record) return record[fieldName] || solidColor;
    return solidColor;
  }

  function adjustColor(hex, percent, effect) {
    if (!hex || hex.startsWith('rgb')) return hex;
    if (!hex.startsWith('#')) return hex;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    const p = percent / 100;
    if (effect === 'darken') {
        r = Math.round(Math.max(0, r - (r * p)));
        g = Math.round(Math.max(0, g - (g * p)));
        b = Math.round(Math.max(0, b - (b * p)));
    } else {
        r = Math.round(Math.min(255, r + (255 - r) * p));
        g = Math.round(Math.min(255, g + (255 - g) * p));
        b = Math.round(Math.min(255, b + (255 - b) * p));
    }
    const toHex = c => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function _handleDragAndDrop(container, orderColumn, options) {
    const mapping = options.mapping || options;
    const behavior = mapping.orderBehavior || 'free';
    let handle = ".cs-card";
    let filter = ".cs-action-button:not(.cs-move-handle)";
    if (behavior === 'strict') handle = ".cs-move-handle";
    
    if (typeof Sortable !== 'undefined') {
        // Limpa instância anterior se existir para evitar conflitos
        if (container._csSortable) {
            container._csSortable.destroy();
        }

        container._csSortable = new Sortable(container, {
            animation: 150, handle: handle, filter: filter, preventOnFilter: false, draggable: ".cs-card",
            onStart: function (evt) {
                publish('grf-cards-drag-start');
            },
            onSort: function (evt) {
                publish('grf-cards-drag-move');
            },
            onEnd: function (evt) {
                const itemEl = evt.item;
                const recordId = parseInt(itemEl.dataset.recordId, 10);
                const records = container._csRecords || [];
                
                const prevEl = itemEl.previousElementSibling;
                const nextEl = itemEl.nextElementSibling;

                const prevRecord = prevEl ? records.find(r => r.id === parseInt(prevEl.dataset.recordId, 10)) : null;
                const nextRecord = nextEl ? records.find(r => r.id === parseInt(nextEl.dataset.recordId, 10)) : null;

                let newPos;
                const posPrev = prevRecord ? (prevRecord[orderColumn] ?? 0) : null;
                const posNext = nextRecord ? (nextRecord[orderColumn] ?? 0) : null;

                // LÓGICA DE ORDENAÇÃO MELHORADA
                if (posPrev !== null && posNext !== null) {
                    if (posPrev === posNext) {
                         // Se ambos forem iguais (ex: tudo 0), forçamos uma diferenciação
                         // Isso resolve o problema de registros que começam com o mesmo valor
                         // Ao mover um pra "baixo" do outro, o de baixo ganha um incremento
                         newPos = posPrev + 1.0;
                         // Nota: Isso pode exigir re-ordenar outros itens se for massivo, 
                         // mas para arrastar e soltar um a um, funciona bem com Grist.
                    } else {
                        newPos = (posPrev + posNext) / 2;
                    }
                } else if (posPrev !== null) {
                    newPos = posPrev + 1.0;
                } else if (posNext !== null) {
                    newPos = posNext - 1.0;
                } else {
                    newPos = 1.0;
                }

                publish('grf-update-record', {
                    tableId: options.tableId,
                    recordId: recordId,
                    data: { [orderColumn]: newPos }
                });

                publish('grf-cards-drag-end');
                publish('grf-reposition-lines');
            }
        });
    }
  }

  function _applyWidgetBackground(container, styling, options) {
    const isTransparent = styling.widgetBackgroundMode === 'transparent' || options.isRefList;
    const backgroundStyle = isTransparent 
        ? 'transparent' 
        : _resolveBackgroundValue(styling.widgetBackgroundMode, styling.widgetBackgroundSolidColor, { 
            type: styling.widgetBackgroundGradientType, 
            c1: styling.widgetBackgroundGradientColor1, 
            c2: styling.widgetBackgroundGradientColor2 
          });

    if (!options.isRefList) {
        document.body.style.background = backgroundStyle;
        document.body.style.minHeight = "100vh";
    }
    if (container) container.style.background = 'transparent';
  }

  function _resolveBackgroundValue(mode, solid, grad) {
    if (mode === 'gradient' && grad) {
      return (grad.type || "linear-gradient(to right, {c1}, {c2})")
        .replace(/{c1}/g, grad.c1 || "#f9f9f9")
        .replace(/{c2}/g, grad.c2 || "#e9e9e9");
    }
    return solid || "#f9f9f9";
  }

  function lightenHexColor(hex, percent) {
      if (!hex || !hex.startsWith('#')) return hex;
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      const p = percent / 100;
      r = Math.round(Math.min(255, r + (255 - r) * p));
      g = Math.round(Math.min(255, g + (255 - g) * p));
      b = Math.round(Math.min(255, b + (255 - b) * p));
      const toHex = c => c.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function _getRecordGroupKey(record, colId, resolvedCache = null) {
    if (record) {
      const cached = record[`_csResolved_${colId}`];
      if (cached !== undefined) {
        return cached === '' ? 'Sem Grupo' : cached;
      }
    }
    if (resolvedCache && record) {
      const cacheKey = `${record.id}_${colId}`;
      if (resolvedCache.has(cacheKey)) {
        return resolvedCache.get(cacheKey);
      }
    }
    const val = record[colId];
    if (val === null || val === undefined || val === '') {
      return "Sem Grupo";
    }
    if (Array.isArray(val)) {
      let items = val;
      if (val[0] === 'L') {
        items = val.slice(1);
      }
      if (items.length === 0) return "Sem Grupo";
      return items.map(item => {
        if (item && typeof item === 'object') {
          return item.label !== undefined ? String(item.label) : (item.id !== undefined ? String(item.id) : JSON.stringify(item));
        }
        return String(item);
      }).join(", ");
    }
    if (val && typeof val === 'object') {
      return val.label !== undefined ? String(val.label) : (val.id !== undefined ? String(val.id) : JSON.stringify(val));
    }
    return String(val);
  }

  async function _getOrResolveDisplayValue(record, colId, schema, tableLens) {
    if (!colId || !schema || !tableLens || !record) return '';
    const cacheKey = `_csResolved_${colId}`;
    if (record[cacheKey] !== undefined) {
      return record[cacheKey];
    }
    const colSchema = schema[colId];
    if (!colSchema) {
      const val = record[colId] ?? '';
      return String(val);
    }
    
    const type = colSchema.type || '';
    const val = record[colId];
    if (val === null || val === undefined || val === '') {
      record[cacheKey] = '';
      return '';
    }
    
    let resolvedStr = '';
    if (type.startsWith('Ref:')) {
      try {
        const resolved = await tableLens.resolveReference(colSchema, record);
        resolvedStr = resolved?.displayValue || String(val);
      } catch (err) {
        console.error("Error resolving reference:", err);
        resolvedStr = String(val);
      }
    } else if (type.startsWith('RefList:')) {
      try {
        const relatedRecords = await tableLens.fetchRelatedRecords(record, colId);
        if (!relatedRecords || relatedRecords.length === 0) {
          resolvedStr = '';
        } else {
          const referencedTableId = type.split(':')[1];
          if (!referencedTableId) {
            resolvedStr = String(val);
          } else {
            let finalDisplayColId = null;
            const displayColIdNum = colSchema.displayCol;
            if (displayColIdNum) {
                const sourceTableId = record.gristHelper_tableId;
                if (sourceTableId) {
                    const sourceSchema = await tableLens.getTableSchema(sourceTableId);
                    const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);
                    if (displayColHelperSchema) {
                        if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                            const formulaParts = displayColHelperSchema.formula.split('.');
                            finalDisplayColId = formulaParts[formulaParts.length - 1];
                        } else {
                            finalDisplayColId = displayColHelperSchema.colId;
                        }
                    }
                }
            }
            if (!finalDisplayColId) {
                const refSchema = await tableLens.getTableSchema(referencedTableId);
                const firstSensibleColumn = Object.values(refSchema).find(c => c && c.type === 'Text' && !c.isFormula);
                finalDisplayColId = firstSensibleColumn ? firstSensibleColumn.colId : 'id';
            }
            resolvedStr = relatedRecords.map(r => r[finalDisplayColId] || `ID: ${r.id}`).join(', ');
          }
        }
      } catch (err) {
        console.error("Error resolving refList:", err);
        resolvedStr = String(val);
      }
    } else if (Array.isArray(val)) {
      let items = val;
      if (val[0] === 'L') {
        items = val.slice(1);
      }
      if (items.length === 0) {
        resolvedStr = '';
      } else {
        resolvedStr = items.map(item => {
          if (item && typeof item === 'object') {
            return item.label !== undefined ? String(item.label) : (item.id !== undefined ? String(item.id) : JSON.stringify(item));
          }
          return String(item);
        }).join(", ");
      }
    } else if (val && typeof val === 'object') {
      resolvedStr = val.label !== undefined ? String(val.label) : (val.id !== undefined ? String(val.id) : JSON.stringify(val));
    } else {
      resolvedStr = String(val);
    }
    
    record[cacheKey] = resolvedStr;
    return resolvedStr;
  }

  async function _resolveRecordDisplayValue(record, colId, schema, tableLens) {
    const val = await _getOrResolveDisplayValue(record, colId, schema, tableLens);
    return val === '' ? 'Sem Grupo' : val;
  }

  async function _resolveFieldDisplayText(record, colSchema, tableLens) {
    if (!colSchema) return '';
    return _getOrResolveDisplayValue(record, colSchema.colId, { [colSchema.colId]: colSchema }, tableLens);
  }

  function _normalizeString(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function _getStatusSemanticClass(statusText) {
    if (!statusText) return "neutral";
    const normalized = _normalizeString(statusText);
    
    if (
      normalized.includes("atrasad") || 
      normalized.includes("bloquead") || 
      normalized.includes("cancelad") || 
      normalized.includes("danger") || 
      normalized.includes("error") ||
      normalized.includes("critico") ||
      normalized.includes("impedid")
    ) {
      return "danger";
    }
    
    if (
      normalized.includes("conclui") || 
      normalized.includes("finaliz") || 
      normalized.includes("sucess") || 
      normalized.includes("success") || 
      normalized.includes("pront") || 
      normalized.includes("ok") ||
      normalized.includes("feito") ||
      normalized.includes("terminad")
    ) {
      return "success";
    }
    
    if (
      normalized.includes("andamento") || 
      normalized.includes("pendent") || 
      normalized.includes("analise") || 
      normalized.includes("warning") || 
      normalized.includes("medio") ||
      normalized.includes("atencao") ||
      normalized.includes("espera") ||
      normalized.includes("pausad")
    ) {
      return "warning";
    }
    
    return "neutral";
  }

  function _injectGroupingStyles() {
    if (document.getElementById('cs-grouping-styles')) return;
    const style = document.createElement('style');
    style.id = 'cs-grouping-styles';
    style.textContent = `
        .cs-grouping-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px 15px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .cs-grouping-label { font-size: 13px; font-weight: bold; color: #475569; display: flex; align-items: center; gap: 6px; }
        .cs-grouping-select { padding: 6px 12px; font-size: 13px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #ffffff; color: #1e293b; outline: none; cursor: pointer; font-family: inherit; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .cs-grouping-select:hover, .cs-grouping-select:focus { border-color: #94a3b8; box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.1); }
        
        .cs-accordion { margin-bottom: 15px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.2s ease; }
        .cs-accordion:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .cs-accordion-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: #f8fafc; border-bottom: 1px solid #e2e8f0; user-select: none; transition: background 0.2s ease; }
        .cs-accordion-header:hover { background: #f1f5f9; }
        
        .cs-accordion-header-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .cs-accordion-chevron { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; color: #64748b; }
        .cs-accordion-chevron svg { transition: transform 0.2s ease; transform: rotate(90deg); }
        .cs-accordion-chevron.collapsed svg { transform: rotate(0deg); }
        
        .cs-accordion-title { font-weight: 700; font-size: 14px; color: #1e293b; }
        .cs-accordion-count { background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        .cs-accordion-status-list { display: flex; align-items: center; gap: 6px; margin-left: 8px; }
        
        .cs-status-pill { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .cs-status-pill.success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .cs-status-pill.warning { background: #fef9c3; color: #a16207; border: 1px solid #fef08a; }
        .cs-status-pill.danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .cs-status-pill.neutral { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
        
        .cs-accordion-header-right { display: flex; align-items: center; gap: 8px; min-width: 150px; justify-content: flex-end; }
        .cs-progress-label { font-size: 12px; font-weight: bold; color: #475569; min-width: 35px; text-align: right; }
        .cs-progress-track { width: 100px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; position: relative; }
        .cs-progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        
        .cs-accordion-body { padding: 15px; border-top: 1px solid #e2e8f0; }
    `;
    document.head.appendChild(style);
  }

  function _injectOptionsStyles() {
    if (document.getElementById('cs-options-styles')) return;
    const style = document.createElement('style');
    style.id = 'cs-options-styles';
    style.textContent = `
        .cs-options-container {
            position: relative;
            display: inline-block;
        }
        .cs-options-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #475569;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            user-select: none;
        }
        .cs-options-btn:hover {
            border-color: #94a3b8;
            background: #f8fafc;
            color: #1e293b;
        }
        .cs-options-btn:focus {
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        .cs-options-btn-icons {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .cs-btn-icon {
            color: #cbd5e1;
            transition: color 0.2s ease;
        }
        .cs-btn-icon.active {
            color: #3b82f6;
        }
        
        .cs-options-popup {
            position: absolute;
            top: calc(100% + 8px);
            left: 0;
            right: auto;
            z-index: 1000;
            width: 260px;
            padding: 16px;
            border-radius: 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-sizing: border-box;
        }
        .cs-popup-input {
            width: 100%;
            padding: 6px 10px;
            font-size: 13px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            background-color: #ffffff;
            color: #1e293b;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s ease;
        }
        .cs-popup-input:focus {
            border-color: #3b82f6;
        }
        .cs-popup-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cs-popup-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
        }
        .cs-popup-select {
            width: 100%;
            padding: 6px 10px;
            font-size: 13px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            background-color: #ffffff;
            color: #1e293b;
            outline: none;
            cursor: pointer;
            box-sizing: border-box;
            transition: border-color 0.2s ease;
        }
        .cs-popup-select:focus {
            border-color: #3b82f6;
        }
        .cs-sort-group {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .cs-select-sorter {
            flex: 1;
            min-width: 0;
        }
        .cs-sort-dir-toggle {
            display: flex;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
            background: #f8fafc;
            height: 30px;
        }
        .cs-sort-dir-btn {
            border: none;
            background: transparent;
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            cursor: pointer;
            padding: 0 8px;
            transition: all 0.2s ease;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cs-sort-dir-btn:hover {
            background: #e2e8f0;
            color: #1e293b;
        }
        .cs-sort-dir-btn.active {
            background: #3b82f6;
            color: #ffffff;
        }
        .cs-popup-divider {
            height: 1px;
            background-color: #e2e8f0;
            margin: 4px 0;
        }
    `;
    document.head.appendChild(style);
  }

  return { renderCards, filterRecords };
})();
