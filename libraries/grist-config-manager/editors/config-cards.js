export const CardConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _fieldStylePopup = null;
    let _iconPickerPopup = null;
    let allConfigs = []; // Variavel no escopo do módulo para persistir a lista de configs

    // Lista de ícones extraída de icons.svg para uso no seletor 
    const AVAILABLE_ICONS = [
        "icon-link", "icon-link-broken", "icon-settings", "icon-edit", "icon-save", "icon-save-alt",
        "icon-adjustments", "icon-adjustments-vert", "icon-annotation", "icon-badge-check", "icon-barcode",
        "icon-bars", "icon-bell", "icon-bell-active", "icon-bookmark", "icon-calendar-edit", "icon-chart",
        "icon-chart-mixed", "icon-chart-pie", "icon-check", "icon-check-circle", "icon-check-circle-alt",
        "icon-minus-circle", "icon-minus-circle-alt", "icon-plus-circle", "icon-plus-circle-alt", "icon-clipboard",
        "icon-clipboard-check", "icon-clipboard-list", "icon-clock-arrow", "icon-close-circle", "icon-close-sidebar",
        "icon-column", "icon-download", "icon-exclamation", "icon-expand", "icon-eye", "icon-file",
        "icon-file-chart", "icon-file-check", "icon-file-clone", "icon-file-search", "icon-filter", "icon-flag",
        "icon-folder", "icon-forward", "icon-globe", "icon-grid", "icon-hourglass", "icon-info-circle",
        "icon-lightbulb", "icon-lifesaver", "icon-lock", "icon-unlock", "icon-microscope", "icon-pen",
        "icon-printer", "icon-profile-card", "icon-rectangle-list", "icon-tools", "icon-trashbin", "icon-truck",
        "icon-zoom-in", "icon-zoom-out", "icon-chart-up", "icon-arrow-move", "icon-bar-chart", "icon-bar-chart-line",
        "icon-bullseye", "icon-card-checklist", "icon-compass", "icon-cone", "icon-cone-striped", "icon-diagram-2",
        "icon-diagram-3", "icon-exclamation-triangle", "icon-exclamation-diamond", "icon-globe-americas", "icon-lightning",
        "icon-pen-alt", "icon-speedometer", "icon-traffic-light", "icon-wrench", "icon-search", "icon-process-cogs",
        "icon-process"
    ];

    function updateDebugJson() {
        if (!_mainContainer) return;
        const outputEl = _mainContainer.querySelector('#config-json-output');
        if (!outputEl) return;
        try {
            const config = read(_mainContainer);
            outputEl.innerHTML = `
                <div class="debug-tri-section">
                    <div class="debug-label mapping">mappingJson (O "Onde")</div>
                    <pre><code>${JSON.stringify(config.mapping, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label styling">stylingJson (O "Como")</div>
                    <pre><code>${JSON.stringify(config.styling, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label actions">actionsJson (O "O que faz")</div>
                    <pre><code>${JSON.stringify(config.actions, null, 2)}</code></pre>
                </div>
            `;
        } catch (e) {
            outputEl.textContent = "Erro ao ler a configuração: " + e.message;
        }
    }

    async function render(container, config, lens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        allConfigs = receivedConfigs;
        if (!tableId) { container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>'; return; }
        const schema = await lens.getTableSchema(tableId);
        if (!schema) { container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>'; return; }

        const options = config || {};
        const actions = options.actions || options;
        const mapping = options.mapping || options;
        const styling = options.styling || options;

        state = {
            layout: JSON.parse(JSON.stringify(mapping.layout || options.layout || [])),
            styling: { ...DEFAULT_STYLING, ...styling, selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(styling.selectedCard || {}) } },
            sidePanel: { size: "25%", ...(actions.sidePanel || options.sidePanel || {}) },
            viewMode: mapping.viewMode || options.viewMode || "click",
            numRows: mapping.numRows || options.numRows || DEFAULT_NUM_ROWS,
            fields: Object.values(schema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos'),
            lens: lens,
            tableId: tableId,
            enableOrder: mapping.enableOrder || false,
            orderColumn: mapping.orderColumn || null,
            orderBehavior: mapping.orderBehavior || 'free',
            showAddButtonTop: actions.showAddButtonTop || false,
            showAddButtonBottom: actions.showAddButtonBottom || false,
            addRecordConfigId: actions.addRecordConfigId || null,
            iconGroups: actions.iconGroups || options.iconGroups || []
        };
        state.layout.forEach(field => { if (!field.style) field.style = { ...DEFAULT_FIELD_STYLE }; });

        if (state.styling.actionButtons) delete state.styling.actionButtons;

        container.innerHTML = `
            <style>
                .debug-tri-section { margin-bottom: 15px; border-left: 4px solid #ddd; padding-left: 10px; }
                .debug-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
                .debug-label.mapping { color: #0d6efd; }
                .debug-label.styling { color: #198754; }
                .debug-label.actions { color: #fd7e14; }
                .config-debugger pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; max-height: 200px; overflow: auto; }
            </style>
        `;

        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [createTabButton("Styling", "sty", container), createTabButton("Fields Layout", "fld", container), createTabButton("Actions & Nav", "actions", container)].forEach(t => tabsRow.appendChild(t));
        container.appendChild(tabsRow);

        const debugSection = document.createElement("div");
        debugSection.innerHTML = `
            <details class="config-debugger">
                <summary>Ver Tripartição JSON (Debug)</summary>
                <div id="config-json-output"></div>
            </details>`;
        container.appendChild(debugSection);

        const contentArea = document.createElement("div");
        contentArea.className = 'config-content';
        contentArea.id = "card-config-contents";
        container.appendChild(contentArea);
        
        buildStylingTab(contentArea);
        buildFieldsLayoutTab(contentArea);
        buildActionsTab(contentArea);
        
        updateDebugJson();
        switchTab("sty", container);
        container.addEventListener('change', updateDebugJson);
        container.addEventListener('input', updateDebugJson);
    }

    function readMappingTab(container) {
        const layoutTab = container.querySelector("[data-tab-section='fld']");
        if (!layoutTab) return {};

        const viewMode = layoutTab.querySelector("#cs-vm-click").checked ? "click" : "burger";
        const numRows = parseInt(layoutTab.querySelector("#cs-num-rows").value, 10) || DEFAULT_NUM_ROWS;

        return {
            tableId: state.tableId,
            layout: state.layout,
            viewMode,
            numRows,
            enableOrder: layoutTab.querySelector("#cs-enable-order").checked,
            orderColumn: layoutTab.querySelector("#cs-order-column").value || null,
            orderBehavior: layoutTab.querySelector("#cs-order-behavior").value || 'free'
        };
    }

    function readStylingTab(container) {
        const tabEl = container.querySelector("[data-tab-section='sty']") || container;
        const getCheckedValue = (name) => tabEl.querySelector(`input[name='${name}']:checked`)?.value;
        const s = {};
        Object.assign(s, DEFAULT_STYLING);

        const bgMode = getCheckedValue('bgmode');
        if (bgMode) {
            s.widgetBackgroundMode = bgMode;
            if (bgMode === 'solid') {
                s.widgetBackgroundSolidColor = tabEl.querySelector("#cs-st-bgcolor").value;
            } else if (bgMode === 'gradient') {
                s.widgetBackgroundGradientType = tabEl.querySelector("#cs-st-bggradient-type").value;
                s.widgetBackgroundGradientColor1 = tabEl.querySelector("#cs-st-bggradient-c1").value;
                s.widgetBackgroundGradientColor2 = tabEl.querySelector("#cs-st-bggradient-c2").value;
            }
        }

        const cardsMode = getCheckedValue('cardscolormode');
        if (cardsMode) {
            s.cardsColorMode = cardsMode;
            if (cardsMode === 'solid') {
                s.cardsColorSolidColor = tabEl.querySelector("#cs-st-cardcolor").value;
            } else if (cardsMode === 'gradient') {
                s.cardsColorGradientType = tabEl.querySelector("#cs-st-cardgradient-type").value;
                s.cardsColorGradientColor1 = tabEl.querySelector("#cs-st-cardgradient-c1").value;
                s.cardsColorGradientColor2 = tabEl.querySelector("#cs-st-cardgradient-c2").value;
            } else if (cardsMode === 'conditional') {
                s.cardsColorField = tabEl.querySelector("#cs-st-cardscolorfield").value || null;
                s.cardsColorApplyText = tabEl.querySelector("#cs-st-cardscolor-apply-text").checked;
            } else if (cardsMode === 'text-value') {
                s.cardsColorTextField = tabEl.querySelector("#cs-st-cardscolor-text-field").value || null;
                s.cardsColorFontField = tabEl.querySelector("#cs-st-cardscolor-font-field").value || null;
            } else if (cardsMode === 'overlay') {
                s.cardsColorOverlayEffect = tabEl.querySelector("#cs-st-card-overlay-effect").value;
                s.cardsColorOverlayOpacity = parseInt(tabEl.querySelector("#cs-st-card-overlay-opacity").value, 10) || 0;
            }
        }

        const borderModeInput = tabEl.querySelector("#cs-st-border-thickness");
        if (borderModeInput) {
            s.cardBorderThickness = parseInt(borderModeInput.value, 10) || 0;
            const borderMode = getCheckedValue('bordermode');
            s.cardBorderMode = borderMode;
            if (borderMode === 'solid') {
                s.cardBorderSolidColor = tabEl.querySelector("#cs-st-border-color").value;
            } else if (borderMode === 'conditional') {
                s.cardBorderField = tabEl.querySelector("#cs-st-border-field").value || null;
            }
        }

        if (tabEl.querySelector("#cs-st-titlecolor")) {
            s.cardTitleFontColor = tabEl.querySelector("#cs-st-titlecolor").value;
            s.cardTitleFontStyle = tabEl.querySelector("#cs-st-titlefont").value;
            s.cardTitleFontSize = `${parseInt(tabEl.querySelector("#cs-st-titlesize").value, 10) || 20}px`;
            s.cardTitleAllCaps = tabEl.querySelector("#cs-st-title-allcaps").checked;
        }

        if (tabEl.querySelector("#cs-st-topbar-enabled")) {
            s.cardTitleTopBarEnabled = tabEl.querySelector("#cs-st-topbar-enabled").checked;
            const topBarMode = getCheckedValue('topbarmode');
            if (topBarMode) {
                s.cardTitleTopBarMode = topBarMode;
                if (topBarMode === 'solid') {
                    s.cardTitleTopBarSolidColor = tabEl.querySelector("#cs-st-topbar-color").value;
                } else if (topBarMode === 'gradient') {
                    s.cardTitleTopBarGradientType = tabEl.querySelector("#cs-st-topbargradient-type").value;
                    s.cardTitleTopBarGradientColor1 = tabEl.querySelector("#cs-st-topbargradient-c1").value;
                    s.cardTitleTopBarGradientColor2 = tabEl.querySelector("#cs-st-topbargradient-c2").value;
                } else if (topBarMode === 'conditional') {
                    s.cardTitleTopBarField = tabEl.querySelector("#cs-st-topbar-field").value || null;
                    s.cardTitleTopBarApplyText = tabEl.querySelector("#cs-st-topbar-apply-text").checked;
                }
            }

            s.cardTitleTopBarLabelFontColor = tabEl.querySelector("#cs-st-topbar-lblcolor").value;
            s.cardTitleTopBarLabelFontStyle = tabEl.querySelector("#cs-st-topbar-lblfont").value;
            s.cardTitleTopBarLabelFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-lblsize").value, 10) || 16}px`;
            s.cardTitleTopBarLabelAllCaps = tabEl.querySelector("#cs-st-topbar-lbl-allcaps").checked;
            s.cardTitleTopBarDataFontColor = tabEl.querySelector("#cs-st-topbar-datacolor").value;
            s.cardTitleTopBarDataFontStyle = tabEl.querySelector("#cs-st-topbar-datafont").value;
            s.cardTitleTopBarDataFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-datasize").value, 10) || 16}px`;
            s.cardTitleTopBarDataAllCaps = tabEl.querySelector("#cs-st-topbar-data-allcaps").checked;
        }

        const handleMode = getCheckedValue('handlemode');
        if (handleMode) {
            s.handleAreaMode = handleMode;
            if (handleMode === 'solid') {
                s.handleAreaSolidColor = tabEl.querySelector("#cs-st-handle-color").value;
            } else if (handleMode === 'conditional') {
                s.handleAreaField = tabEl.querySelector("#cs-st-handle-field").value || null;
            } else if (handleMode === 'text-value') {
                s.handleAreaField = tabEl.querySelector("#cs-st-handle-field-value").value || null;
            } else if (handleMode === 'overlay') {
                s.handleAreaOverlayEffect = tabEl.querySelector("#cs-st-handle-overlay-effect").value;
                s.handleAreaOverlayOpacity = parseInt(tabEl.querySelector("#cs-st-handle-overlay-opacity").value, 10) || 0;
            }
            const handleVal = parseInt(tabEl.querySelector("#cs-st-handle-width").value, 10);
            s.handleAreaWidth = `${isNaN(handleVal) ? 8 : handleVal}px`;
        }

        if (tabEl.querySelector("#cs-st-handle-title-field")) {
            s.handleAreaTitleField = tabEl.querySelector("#cs-st-handle-title-field").value || null;
            s.handleAreaTitleColor = tabEl.querySelector("#cs-st-handle-title-color").value;
            s.handleAreaTitleFontSize = `${parseInt(tabEl.querySelector("#cs-st-handle-title-size").value, 10) || 10}px`;
            s.handleAreaTitleAllCaps = tabEl.querySelector("#cs-st-handle-title-allcaps").checked;
        }

        if (tabEl.querySelector("#cs-st-col-limit")) {
            s.cardsColumnLimit = parseInt(tabEl.querySelector("#cs-st-col-limit").value, 10) || 1;
            s.cardsColumnMode = tabEl.querySelector('input[name="cs-st-col-mode"]:checked')?.value || 'fixed';
        }

        if (tabEl.querySelector("#cs-st-spacing")) s.cardsSpacing = `${parseInt(tabEl.querySelector("#cs-st-spacing").value, 10) || 0}px`;
        if (tabEl.querySelector("#cs-st-internal-padding")) s.internalCardPadding = `${parseInt(tabEl.querySelector("#cs-st-internal-padding").value, 10) || 10}px`;
        if (tabEl.querySelector("#cs-st-sel-enabled")) s.selectedCard = { enabled: tabEl.querySelector("#cs-st-sel-enabled").checked, scale: 1 + ((parseInt(tabEl.querySelector("#cs-st-sel-scale").value, 10) || 0) / 100), colorEffect: "none" };

        if (tabEl.querySelector("#cs-st-fieldbg-enabled")) {
            s.fieldBackground = {
                enabled: tabEl.querySelector("#cs-st-fieldbg-enabled").checked,
                lightenPercentage: parseInt(tabEl.querySelector("#cs-st-fieldbg-lighten").value, 10) || 15
            };
        }

        s.groupBoxes = state.styling.groupBoxes || [];

        if (tabEl.querySelector('#cs-st-simple-textcolor')) {
            s.simpleTextColor = tabEl.querySelector('#cs-st-simple-textcolor').value;
            s.simpleTextFont = tabEl.querySelector('#cs-st-simple-textfont').value;
            s.simpleTextSize = `${parseInt(tabEl.querySelector('#cs-st-simple-textsize').value, 10) || 14}px`;
        }

        if (tabEl.querySelector('#cs-st-fbox-enabled')) {
            s.fieldBox = {
                borderEnabled: tabEl.querySelector('#cs-st-fbox-enabled').checked,
                borderColor: tabEl.querySelector('#cs-st-fbox-bcolor').value,
                borderWidth: parseInt(tabEl.querySelector('#cs-st-fbox-bwidth').value, 10),
                borderRadius: parseInt(tabEl.querySelector('#cs-st-fbox-bradius').value, 10),
                backgroundColor: tabEl.querySelector('#cs-st-fbox-bgcolor').value,
                effect: tabEl.querySelector('#cs-st-fbox-effect').value
            };
        }

        if (tabEl.querySelector('#cs-st-label-bold')) {
            s.labelStyle = {
                bold: tabEl.querySelector('#cs-st-label-bold').checked,
                allCaps: tabEl.querySelector('#cs-st-label-allcaps').checked,
                color: tabEl.querySelector('#cs-st-label-color').value,
                font: tabEl.querySelector('#cs-st-label-font').value,
                size: `${parseInt(tabEl.querySelector('#cs-st-label-size').value, 10)}px`
            };
        }

        if (tabEl.querySelector('#cs-st-show-debug')) s.showDebugInfo = tabEl.querySelector('#cs-st-show-debug').checked;

        return s;
    }

    function readActionsTab(container) {
        const sidePanelTab = container.querySelector("[data-tab-section='actions']");
        if (!sidePanelTab) return {};

        return {
            sidePanel: { 
                size: sidePanelTab.querySelector("#cs-sp-size").value, 
                drawerConfigId: sidePanelTab.querySelector("#cs-sp-drawer-config").value || null 
            },
            iconGroups: state.iconGroups || [],
            showAddButtonTop: sidePanelTab.querySelector("#cs-add-btn-top").checked,
            showAddButtonBottom: sidePanelTab.querySelector("#cs-add-btn-bottom").checked,
            addRecordConfigId: sidePanelTab.querySelector("#cs-add-btn-config").value || null,
            iconSize: parseFloat(sidePanelTab.querySelector("#cs-icon-size").value) || 1.0
        };
    }

    function read(container) {
        // Clean up layout from any buttonConfig properties
        state.layout.forEach(layoutItem => {
            if (layoutItem.buttonConfig) {
                delete layoutItem.buttonConfig;
            }
        });

        const mapping = readMappingTab(container);
        const styling = readStylingTab(container);
        const actions = readActionsTab(container);
        
        styling.iconSize = actions.iconSize;

        return { mapping, styling, actions };
    }

    const DEFAULT_FIELD_STYLE = { useGristStyle: true, labelVisible: true, labelPosition: 'above', labelFont: 'inherit', labelFontSize: 'inherit', labelColor: 'inherit', labelAllCaps: false, labelOutline: false, labelOutlineColor: '#ffffff', dataJustify: 'left', dataAllCaps: false, heightLimited: false, maxHeightRows: 1, isTitleField: false };
    const DEFAULT_STYLING = { iconSize: 1.0, internalCardPadding: '10px', fieldBox: { borderEnabled: false, borderColor: '#cccccc', borderWidth: 1, borderRadius: 4, backgroundColor: '#ffffff', effect: 'none' }, labelStyle: { bold: false, allCaps: false, color: '#333333', font: 'Calibri', size: '12px' }, simpleTextColor: '#000000', simpleTextFont: 'Calibri', simpleTextSize: '14px', fieldBackground: { enabled: false, lightenPercentage: 15 }, iconGroups: [], groupBoxes: [], widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9", cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0", cardsColorApplyText: false, cardsColorTextField: null, cardsColorFontField: null, cardsColorOverlayEffect: 'darken', cardsColorOverlayOpacity: 10, cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc", cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px", cardTitleAllCaps: false, cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarLabelAllCaps: false, cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px", cardTitleTopBarDataAllCaps: false, handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0", handleAreaOverlayEffect: "darken", handleAreaOverlayOpacity: 10, handleAreaField: null, handleAreaTitleField: null, handleAreaTitleColor: "#ffffff", handleAreaTitleFontSize: "10px", handleAreaTitleAllCaps: false, widgetPadding: "10px", cardsSpacing: "15px", selectedCard: { enabled: false, scale: 1.05, colorEffect: "none" } };
    const DEFAULT_NUM_ROWS = 1; const NUM_COLS = 10; const CONFIG_WIDTH = 700; const COL_WIDTH = CONFIG_WIDTH / NUM_COLS;

    function createTabButton(label, tabId, container) { const btn = document.createElement("button"); btn.type = "button"; btn.textContent = label; btn.className = 'config-tab-button'; btn.addEventListener("click", () => switchTab(tabId, container)); btn.dataset.tabId = tabId; return btn; }
    function switchTab(tabId, container) { const contentDiv = container.querySelector("#card-config-contents"); if (!contentDiv) return; contentDiv.querySelectorAll("[data-tab-section]").forEach(t => (t.style.display = "none")); container.querySelectorAll("[data-tab-id]").forEach(b => b.classList.remove('active')); const newActiveTab = contentDiv.querySelector(`[data-tab-section='${tabId}']`); if (newActiveTab) newActiveTab.style.display = "block"; const activeBtn = container.querySelector(`[data-tab-id='${tabId}']`); if (activeBtn) activeBtn.classList.add('active'); }

    function buildStylingTab(contentArea) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "sty";
        tabEl.style.display = "none";
        tabEl.innerHTML = `
            <h3>Styling Options <button type="button" id="cs-save-style-btn" class="btn btn-sm btn-primary" style="margin-left: 10px;">Salvar como Preset (Estilo + Botões)</button></h3>
            <div style="margin-top: 15px; display: flex; align-items: center; gap: 10px;">
                <select id="cs-load-style-select" class="form-control" style="flex-grow: 1;">
                    <option value="">-- Carregar Preset Salvo --</option>
                </select>
                <button type="button" id="cs-load-style-btn" class="btn btn-sm btn-secondary">Load</button>
            </div>
            <div class="styling-grid">
                <fieldset>
                    <legend><b>Widget Background</b></legend>
                    <label><input type="radio" name="bgmode" value="solid"> Solid</label>
                    <label><input type="radio" name="bgmode" value="gradient"> Gradient</label>
                    <label><input type="radio" name="bgmode" value="transparent"> Transparent</label>
                    <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-bgcolor"></div>
                    <div class="style-control-group" data-mode="gradient" style="display:none;">
                        <select id="cs-st-bggradient-type"><option value="linear-gradient(to right, {c1}, {c2})">Linear H</option><option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option><option value="radial-gradient(circle, {c1}, {c2})">Radial</option></select>
                        <input type="color" id="cs-st-bggradient-c1"> <input type="color" id="cs-st-bggradient-c2">
                    </div>
                </fieldset>
                <fieldset>
                    <legend><b>Cards Color</b></legend>
                    <label><input type="radio" name="cardscolormode" value="solid"> Solid</label>
                    <label><input type="radio" name="cardscolormode" value="gradient"> Gradient</label>
                    <label><input type="radio" name="cardscolormode" value="conditional"> By Choice Options</label>
                    <label><input type="radio" name="cardscolormode" value="text-value"> By Field Value</label>
                    <label><input type="radio" name="cardscolormode" value="overlay"> Transparent Overlay</label>
                    <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-cardcolor"></div>
                    <div class="style-control-group" data-mode="gradient" style="display:none;">
                        <select id="cs-st-cardgradient-type"><option value="linear-gradient(to right, {c1}, {c2})">Linear H</option><option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option><option value="radial-gradient(circle, {c1}, {c2})">Radial</option></select>
                        <input type="color" id="cs-st-cardgradient-c1"> <input type="color" id="cs-st-cardgradient-c2">
                    </div>
                    <div class="style-control-group" data-mode="conditional" style="display:none;">
                        <select id="cs-st-cardscolorfield"><option value="">-- field --</option></select>
                        <div class="sub-option" style="margin-top: 8px;">
                            <label><input type="checkbox" id="cs-st-cardscolor-apply-text"> Também aplicar cor de texto do campo</label>
                        </div>
                    </div>
                    <div class="style-control-group" data-mode="text-value" style="display:none;">
                        <div style="margin-bottom: 5px;">
                             <label style="display:block; font-size: 0.9em;">Background Color Source:</label>
                             <select id="cs-st-cardscolor-text-field"><option value="">-- Select Field (e.g. #RRGGBB) --</option></select>
                        </div>
                        <div>
                             <label style="display:block; font-size: 0.9em;">Font Color Source (Optional):</label>
                             <select id="cs-st-cardscolor-font-field"><option value="">-- Select Field (e.g. #RRGGBB) --</option></select>
                        </div>
                    </div>
                    <div class="style-control-group" data-mode="overlay" style="display:none;">
                        <select id="cs-st-card-overlay-effect" style="width: 100%; margin-bottom: 5px;">
                            <option value="darken">Darken (Black Overlay)</option>
                            <option value="lighten">Lighten (White Overlay)</option>
                        </select>
                        <label>Opacity: <input type="number" id="cs-st-card-overlay-opacity" min="0" max="100" style="width:50px" value="10">%</label>
                    </div>
                </fieldset>
                <fieldset><legend><b>Card Border</b></legend>Thickness (px): <input type="number" id="cs-st-border-thickness" min="0" style="width:60px"> <br><label><input type="radio" name="bordermode" value="solid"> Solid</label> <label><input type="radio" name="bordermode" value="conditional"> By Field</label><div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-border-color"></div><div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-border-field"><option value="">-- field --</option></select></div></fieldset>
                <fieldset class="title-control-group" data-title-mode="no-bar"><legend><b>Card Title (when Top Bar is OFF)</b></legend>Color: <input type="color" id="cs-st-titlecolor"> Font: <select id="cs-st-titlefont"><option>Calibri</option><option>Arial</option><option>Inter</option><option>Roboto</option><option>Open Sans</option><option>Times New Roman</option></select> Size: <input type="number" id="cs-st-titlesize" min="8" style="width:60px">px <label><input type="checkbox" id="cs-st-title-allcaps"> All Caps</label></fieldset>
                <fieldset><legend><b>Handle Area</b></legend><div style="margin-bottom: 8px;">Width (px): <input type="number" id="cs-st-handle-width" min="0" style="width:60px"></div><div style="margin-bottom: 8px;"><label><input type="radio" name="handlemode" value="solid"> Solid</label> <label><input type="radio" name="handlemode" value="conditional"> By Choice Options</label> <label><input type="radio" name="handlemode" value="text-value"> By Field Value</label> <label><input type="radio" name="handlemode" value="overlay"> Transparent Overlay</label></div><div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-handle-color"></div><div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-handle-field"><option value="">-- select field --</option></select></div><div class="style-control-group" data-mode="text-value" style="display:none;"><select id="cs-st-handle-field-value"><option value="">-- select field --</option></select></div><div class="style-control-group" data-mode="overlay" style="display:none;"><select id="cs-st-handle-overlay-effect" style="width: 100%; margin-bottom: 5px;"><option value="darken">Darken (Black Overlay)</option><option value="lighten">Lighten (White Overlay)</option></select><label>Opacity: <input type="number" id="cs-st-handle-overlay-opacity" min="0" max="100" style="width:50px">%</label></div><hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;"><div style="margin-top: 8px;"><b style="font-size: 0.9em; display: block; margin-bottom: 4px;">Handle Title</b><div style="margin-bottom: 4px;">Field: <select id="cs-st-handle-title-field"><option value="">-- none --</option></select></div><div style="display: flex; gap: 10px; align-items: center;"><label>Color: <input type="color" id="cs-st-handle-title-color" value="#ffffff"></label><label>Size: <input type="number" id="cs-st-handle-title-size" min="5" style="width:50px">px</label><label><input type="checkbox" id="cs-st-handle-title-allcaps"> All Caps</label></div></div></fieldset>
                <fieldset>
                    <legend><b>Grid Columns</b></legend>
                    <label>Max Columns: <input type="number" id="cs-st-col-limit" min="1" max="20" style="width:50px;"></label>
                    <div style="margin-top: 5px;">
                        <label title="If fewer cards than Max Cols, cards are smaller (1/Max width)."><input type="radio" name="cs-st-col-mode" value="fixed"> Fixed Width</label><br>
                        <label title="If fewer cards than Max Cols, cards expand to fill row."><input type="radio" name="cs-st-col-mode" value="responsive"> Responsive Fill</label><br>
                        <label title="Cards occupy 50% if 1 or 2, 33% if 3, up to Max Columns. Extra rows match first row size."><input type="radio" name="cs-st-col-mode" value="balanced"> Balanced Grid</label>
                    </div>
                </fieldset>
                <fieldset><legend><b>Layout Spacing</b></legend>Widget Padding (px): <input type="number" id="cs-st-padding" min="0" style="width:60px"> <br>Card Spacing (px): <input type="number" id="cs-st-spacing" min="0" style="width:60px"> <br>Internal Card Padding (px): <input type="number" id="cs-st-internal-padding" min="0" style="width:60px"></fieldset>
                <fieldset>
                    <legend><b>Field Background</b></legend>
                    <label><input type="checkbox" id="cs-st-fieldbg-enabled"> Enable custom background</label>
                    <div id="cs-st-fieldbg-controls" style="display:none; margin-top: 8px;">
                        <label>Lighten card background by:</label>
                        <select id="cs-st-fieldbg-lighten">
                            <option value="15">15%</option>
                            <option value="30">30%</option>
                            <option value="50">50%</option>
                        </select>
                    </div>
                </fieldset>
                <fieldset class="full-width title-control-group" data-title-mode="top-bar">
    <legend><b>Card Title Top Bar</b></legend>
    <label><input type="checkbox" id="cs-st-topbar-enabled"> Enable Top Bar</label>
    <div class="top-bar-config" style="display: none;">
        <div>
            <b>Bar Background:</b> <br>
            <label><input type="radio" name="topbarmode" value="solid"> Solid</label> 
            <label><input type="radio" name="topbarmode" value="gradient"> Gradient</label> 
            <label><input type="radio" name="topbarmode" value="conditional"> By Field</label>
            <div class="style-control-group" data-mode="solid">
                <input type="color" id="cs-st-topbar-color">
            </div>
            <div class="style-control-group" data-mode="gradient" style="display:none;">
                <select id="cs-st-topbargradient-type">
                    <option value="linear-gradient(to right, {c1}, {c2})">Linear H</option>
                    <option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option>
                    <option value="radial-gradient(circle, {c1}, {c2})">Radial</option>
                </select>
                <input type="color" id="cs-st-topbargradient-c1"> 
                <input type="color" id="cs-st-topbargradient-c2">
            </div>
            <div class="style-control-group" data-mode="conditional" style="display:none;">
                <select id="cs-st-topbar-field"><option value="">-- field --</option></select>
                <div class="sub-option" style="margin-top: 8px;">
                    <label>
                        <input type="checkbox" id="cs-st-topbar-apply-text">
                        Também aplicar cor de texto do campo
                    </label>
                </div>
                </div>
        </div>
        <div>
            <b>Label Style:</b> <br>
            Color: <input type="color" id="cs-st-topbar-lblcolor"> <br>
            Font: <select id="cs-st-topbar-lblfont"><option>Calibri</option><option>Arial</option><option>Inter</option><option>Roboto</option><option>Open Sans</option></select> <br>
            Size: <input type="number" id="cs-st-topbar-lblsize" min="8" style="width:60px">px <br>
            <label><input type="checkbox" id="cs-st-topbar-lbl-allcaps"> All Caps</label>
        </div>
        <div>
            <b>Data Style:</b> <br>
            Color: <input type="color" id="cs-st-topbar-datacolor"> <br>
            Font: <select id="cs-st-topbar-datafont"><option>Calibri</option><option>Arial</option><option>Inter</option><option>Roboto</option><option>Open Sans</option></select> <br>
            Size: <input type="number" id="cs-st-topbar-datasize" min="8" style="width:60px">px <br>
            <label><input type="checkbox" id="cs-st-topbar-data-allcaps"> All Caps</label>
        </div>
    </div>
</fieldset>
                <fieldset class="full-width"><legend><b>Selected Card Hover Effect</b></legend><label>Enable: <input type="checkbox" id="cs-st-sel-enabled"></label> <label style="margin-left: 20px;">Scale: <input type="number" id="cs-st-sel-scale" min="0" max="100" style="width:60px">%</label></fieldset>
                <fieldset class="full-width">
                    <legend><b>Field Box & Label Style</b></legend>
                    <div class="styling-grid-internal">
                        <fieldset>
                            <legend>Field Box</legend>
                            <label><input type="checkbox" id="cs-st-fbox-enabled"> Enable Border</label>
                            <div id="cs-st-fbox-controls" style="display:none;">
                                <p>Border:</p>
                                Color: <input type="color" id="cs-st-fbox-bcolor">
                                Width: <input type="number" id="cs-st-fbox-bwidth" min="0" style="width:60px">px
                                Radius: <input type="number" id="cs-st-fbox-bradius" min="0" style="width:60px">px
                                <hr style="margin: 8px 0;">
                                <p>Fill & Effect:</p>
                                Box Background: <input type="color" id="cs-st-fbox-bgcolor">
                                <br>
                                Box Effect: 
                                <select id="cs-st-fbox-effect">
                                    <option value="none">None</option>
                                    <option value="bevel">Bevel (Inset)</option>
                                    <option value="bevel-outset">Bevel (Outset)</option>
                                    <option value="shadow">Drop Shadow</option>
                                </select>
                                <p class="help-text">A background color is required for the Bevel effect to be visible.</p>
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend>Label Style</legend>
                            <label><input type="checkbox" id="cs-st-label-bold"> Bold</label>
                            <label style="margin-left: 10px;"><input type="checkbox" id="cs-st-label-allcaps"> All Caps</label> <br>
                            Color: <input type="color" id="cs-st-label-color">
                            Font: <select id="cs-st-label-font"><option>Calibri</option><option>Arial</option><option>Inter</option><option>Roboto</option><option>Open Sans</option><option>Times New Roman</option></select>
                            Size: <input type="number" id="cs-st-label-size" min="8" style="width:60px">px
                        </fieldset>
                    </div>
                </fieldset>
                <fieldset><legend><b>Simple Text Style</b></legend><p class="help-text">For fields where "Use Grist Field Style" is disabled.</p>Color: <input type="color" id="cs-st-simple-textcolor"> Font: <select id="cs-st-simple-textfont"><option>Calibri</option><option>Arial</option><option>Inter</option><option>Roboto</option><option>Open Sans</option><option>Times New Roman</option></select> Size: <input type="number" id="cs-st-simple-textsize" min="8" style="width:60px">px</fieldset>
                <fieldset>
                    <legend><b>Debug</b></legend>
                    <label><input type="checkbox" id="cs-st-show-debug"> Show Schema Debug Info (TableLens output)</label>
                </fieldset>
            </div>
        `;
        contentArea.appendChild(tabEl);
        const setupModeSwitcher = (fieldset) => { const radios = fieldset.querySelectorAll('input[type="radio"]'); radios.forEach(radio => { radio.addEventListener('change', () => { const selectedMode = radio.value; fieldset.querySelectorAll('.style-control-group').forEach(group => { group.style.display = group.dataset.mode === selectedMode ? '' : 'none'; }); }); }); };
        tabEl.querySelectorAll('fieldset').forEach(setupModeSwitcher);

        const setupCheckboxToggle = (checkboxId, controlsId, displayType = 'block') => {
            const checkbox = tabEl.querySelector(checkboxId);
            const controls = tabEl.querySelector(controlsId);
            if (!checkbox || !controls) return () => { };
            const toggle = () => { controls.style.display = checkbox.checked ? displayType : 'none'; };
            checkbox.addEventListener('change', toggle);
            return toggle;
        };

        const toggleTopBarControls = setupCheckboxToggle('#cs-st-topbar-enabled', '.top-bar-config', 'flex');
        const toggleFieldBgControls = setupCheckboxToggle('#cs-st-fieldbg-enabled', '#cs-st-fieldbg-controls');
        const toggleFieldBoxControls = setupCheckboxToggle('#cs-st-fbox-enabled', '#cs-st-fbox-controls');

        const topBarApplyTextCheckbox = tabEl.querySelector('#cs-st-topbar-apply-text');
        const topBarModeRadios = tabEl.querySelectorAll('input[name="topbarmode"]');
        const lblColorInput = tabEl.querySelector('#cs-st-topbar-lblcolor');
        const dataColorInput = tabEl.querySelector('#cs-st-topbar-datacolor');
        const updateTopBarColorInputsState = () => {
            const isConditional = tabEl.querySelector('input[name="topbarmode"][value="conditional"]').checked;
            const applyTextColor = topBarApplyTextCheckbox.checked;
            const shouldDisable = isConditional && applyTextColor;
            [lblColorInput, dataColorInput].forEach(input => {
                if (input) {
                    const container = input.closest('div');
                    input.disabled = shouldDisable;
                    if (container) {
                        container.style.opacity = shouldDisable ? 0.5 : 1;
                        container.style.pointerEvents = shouldDisable ? 'none' : 'auto';
                    }
                }
            });
        };
        topBarApplyTextCheckbox.addEventListener('change', updateTopBarColorInputsState);
        topBarModeRadios.forEach(radio => radio.addEventListener('change', updateTopBarColorInputsState));

        const allFields = state.fields.map(f => f.colId);
        populateFieldSelect(tabEl.querySelector("#cs-st-cardscolorfield"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-cardscolor-text-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-cardscolor-font-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-border-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-topbar-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-handle-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-handle-field-value"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-handle-title-field"), allFields);

        populateStylingTab(tabEl);

        toggleTopBarControls();
        toggleFieldBgControls();
        toggleFieldBoxControls();
        updateTopBarColorInputsState();
        tabEl.querySelectorAll('input[type="radio"]:checked').forEach(radio => { if (radio) radio.dispatchEvent(new Event('change')) });

        const saveStyleBtn = tabEl.querySelector('#cs-save-style-btn');
        if (saveStyleBtn) {
            saveStyleBtn.addEventListener('click', () => {
                try {
                    const currentStyling = readStylingTab(_mainContainer);
                    const currentActions = readActionsTab(_mainContainer);

                    const event = new CustomEvent('grf-save-card-style', {
                        detail: {
                            widgetTitle: null,
                            configJson: JSON.stringify({ 
                                styling: currentStyling,
                                actions: currentActions
                            }),
                            componentType: 'Card Style',
                            description: '[PRESET] Estilo e Ações'
                        },
                        bubbles: true
                    });
                    _mainContainer.dispatchEvent(event);

                    alert("⚠️ AVISO: O Preset foi criado com as configurações de Estilo e Botões.\n\nLembre-se de revisar os campos de mapeamento (ex: campos de cor baseados em texto ou colunas de vínculo de botões) no novo widget, pois os nomes das colunas podem variar entre documentos.");
                } catch (e) {
                    console.error('Error saving preset:', e);
                    alert('Error saving preset: ' + e.message);
                }
            });
        }

        const loadStyleSelect = tabEl.querySelector('#cs-load-style-select');
        const loadStyleBtn = tabEl.querySelector('#cs-load-style-btn');

        const cardStyles = allConfigs.filter(c => c.componentType === 'Card Style');
        cardStyles.forEach(styleConfig => {
            const option = document.createElement('option');
            option.value = styleConfig.configId;
            option.textContent = styleConfig.widgetTitle;
            loadStyleSelect.appendChild(option);
        });

        if (loadStyleBtn) {
            loadStyleBtn.addEventListener('click', () => {
                const selectedConfigId = loadStyleSelect.value;
                if (!selectedConfigId) { alert('Please select a style to load.'); return; }
                const selectedStyle = cardStyles.find(s => s.configId === selectedConfigId);
                if (selectedStyle) {
                    try {
                        const parsed = JSON.parse(selectedStyle.configJson);
                        const loadedStyling = parsed.styling;
                        const loadedActions = parsed.actions;

                        state.styling = { ...DEFAULT_STYLING, ...loadedStyling };
                        if (loadedActions) {
                            state.iconGroups = loadedActions.iconGroups || [];
                            state.sidePanel = loadedActions.sidePanel || state.sidePanel;
                            state.showAddButtonTop = !!loadedActions.showAddButtonTop;
                            state.showAddButtonBottom = !!loadedActions.showAddButtonBottom;
                            state.addRecordConfigId = loadedActions.addRecordConfigId || null;
                            const actionsTab = _mainContainer.querySelector("[data-tab-section='actions']");
                            if (actionsTab) {
                                actionsTab.querySelector("#cs-add-btn-top").checked = state.showAddButtonTop;
                                actionsTab.querySelector("#cs-add-btn-bottom").checked = state.showAddButtonBottom;
                                actionsTab.querySelector("#cs-add-btn-config").value = state.addRecordConfigId || "";
                                actionsTab.querySelector("#cs-sp-drawer-config").value = state.sidePanel.drawerConfigId || "";
                                actionsTab.querySelector("#cs-sp-size").value = state.sidePanel.size || "25%";
                                renderActionsLayout(actionsTab.querySelector('#actions-master-detail'));
                            }
                        }
                        populateStylingTab(tabEl);
                        tabEl.querySelectorAll('input[type="radio"]:checked').forEach(radio => { if (radio) radio.dispatchEvent(new Event('change')) });
                        buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields"));
                        updateDebugJson();
                        alert(`Preset "${selectedStyle.widgetTitle}" (Estilo + Botões) carregado com sucesso!`);
                    } catch (e) {
                        console.error('Error loading style:', e);
                        alert('Error loading style: ' + e.message);
                    }
                } else { alert('Selected style not found.'); }
            });
        }
    }

    function populateStylingTab(tabEl) {
        const s = state.styling; 
        let bgModeInput = tabEl.querySelector(`input[name='bgmode'][value='${s.widgetBackgroundMode}']`); 
        if (bgModeInput) { bgModeInput.checked = true; } else { tabEl.querySelector("input[name='bgmode'][value='solid']").checked = true; } 
        tabEl.querySelector("#cs-st-bgcolor").value = s.widgetBackgroundSolidColor; 
        tabEl.querySelector("#cs-st-bggradient-type").value = s.widgetBackgroundGradientType || 'linear-gradient(to right, {c1}, {c2})'; 
        tabEl.querySelector("#cs-st-bggradient-c1").value = s.widgetBackgroundGradientColor1 || '#f9f9f9'; 
        tabEl.querySelector("#cs-st-bggradient-c2").value = s.widgetBackgroundGradientColor2 || '#e9e9e9'; 
        tabEl.querySelector(`input[name='cardscolormode'][value='${s.cardsColorMode}']`).checked = true; 
        tabEl.querySelector("#cs-st-cardcolor").value = s.cardsColorSolidColor; 
        tabEl.querySelector("#cs-st-cardgradient-type").value = s.cardsColorGradientType || 'linear-gradient(to right, {c1}, {c2})'; 
        tabEl.querySelector("#cs-st-cardgradient-c1").value = s.cardsColorGradientColor1 || '#ffffff'; 
        tabEl.querySelector("#cs-st-cardgradient-c2").value = s.cardsColorGradientColor2 || '#f0f0f0'; 
        tabEl.querySelector("#cs-st-cardscolorfield").value = s.cardsColorField || ""; 
        tabEl.querySelector("#cs-st-cardscolor-apply-text").checked = s.cardsColorApplyText === true;
        tabEl.querySelector("#cs-st-cardscolor-text-field").value = s.cardsColorTextField || ""; 
        tabEl.querySelector("#cs-st-cardscolor-font-field").value = s.cardsColorFontField || "";
        tabEl.querySelector("#cs-st-card-overlay-effect").value = s.cardsColorOverlayEffect || 'darken';
        tabEl.querySelector("#cs-st-card-overlay-opacity").value = s.cardsColorOverlayOpacity || 10;
        tabEl.querySelector("#cs-st-border-thickness").value = s.cardBorderThickness; 
        tabEl.querySelector(`input[name='bordermode'][value='${s.cardBorderMode}']`).checked = true; 
        tabEl.querySelector("#cs-st-border-color").value = s.cardBorderSolidColor; 
        tabEl.querySelector("#cs-st-border-field").value = s.cardBorderField || ""; 
        tabEl.querySelector("#cs-st-titlecolor").value = s.cardTitleFontColor; 
        tabEl.querySelector("#cs-st-titlefont").value = s.cardTitleFontStyle; 
        tabEl.querySelector("#cs-st-titlesize").value = parseInt(s.cardTitleFontSize, 10); 
        tabEl.querySelector("#cs-st-title-allcaps").checked = s.cardTitleAllCaps === true; 
        tabEl.querySelector("#cs-st-topbar-enabled").checked = s.cardTitleTopBarEnabled; 
        tabEl.querySelector(`input[name='topbarmode'][value='${s.cardTitleTopBarMode}']`).checked = true; 
        tabEl.querySelector("#cs-st-topbar-color").value = s.cardTitleTopBarSolidColor; 
        tabEl.querySelector("#cs-st-topbargradient-type").value = s.cardTitleTopBarGradientType || 'linear-gradient(to right, {c1}, {c2})'; 
        tabEl.querySelector("#cs-st-topbargradient-c1").value = s.cardTitleTopBarGradientColor1 || '#dddddd'; 
        tabEl.querySelector("#cs-st-topbargradient-c2").value = s.cardTitleTopBarGradientColor2 || '#cccccc'; 
        tabEl.querySelector("#cs-st-topbar-field").value = s.cardTitleTopBarField || ""; 
        tabEl.querySelector("#cs-st-topbar-apply-text").checked = s.cardTitleTopBarApplyText === true; 
        tabEl.querySelector("#cs-st-topbar-lblcolor").value = s.cardTitleTopBarLabelFontColor; 
        tabEl.querySelector("#cs-st-topbar-lblfont").value = s.cardTitleTopBarLabelFontStyle; 
        tabEl.querySelector("#cs-st-topbar-lblsize").value = parseInt(s.cardTitleTopBarLabelFontSize, 10); 
        tabEl.querySelector("#cs-st-topbar-lbl-allcaps").checked = s.cardTitleTopBarLabelAllCaps === true; 
        tabEl.querySelector("#cs-st-topbar-datacolor").value = s.cardTitleTopBarDataFontColor; 
        tabEl.querySelector("#cs-st-topbar-datafont").value = s.cardTitleTopBarDataFontStyle;         
        tabEl.querySelector("#cs-st-topbar-datasize").value = parseInt(s.cardTitleTopBarDataFontSize, 10); 
        tabEl.querySelector("#cs-st-topbar-data-allcaps").checked = s.cardTitleTopBarDataAllCaps === true; 
        tabEl.querySelector("#cs-st-handle-width").value = parseInt(s.handleAreaWidth, 10);
        tabEl.querySelector(`input[name='handlemode'][value='${s.handleAreaMode}']`).checked = true; 
        tabEl.querySelector("#cs-st-handle-color").value = s.handleAreaSolidColor; 
        tabEl.querySelector("#cs-st-handle-field").value = s.handleAreaField || ""; 
        tabEl.querySelector("#cs-st-handle-field-value").value = s.handleAreaField || ""; 
        tabEl.querySelector("#cs-st-handle-overlay-effect").value = s.handleAreaOverlayEffect || "darken";
        tabEl.querySelector("#cs-st-handle-overlay-opacity").value = s.handleAreaOverlayOpacity !== undefined ? s.handleAreaOverlayOpacity : 10;
        tabEl.querySelector("#cs-st-handle-title-field").value = s.handleAreaTitleField || "";
        tabEl.querySelector("#cs-st-handle-title-color").value = s.handleAreaTitleColor || "#ffffff";
        tabEl.querySelector("#cs-st-handle-title-size").value = parseInt(s.handleAreaTitleFontSize, 10) || 10;
        tabEl.querySelector("#cs-st-handle-title-allcaps").checked = s.handleAreaTitleAllCaps === true; 
        tabEl.querySelector("#cs-st-padding").value = parseInt(s.widgetPadding, 10); 
        tabEl.querySelector("#cs-st-spacing").value = parseInt(s.cardsSpacing, 10);
        tabEl.querySelector("#cs-st-col-limit").value = s.cardsColumnLimit || 1;
        const colMode = s.cardsColumnMode || 'fixed';
        const colModeRadio = tabEl.querySelector(`input[name="cs-st-col-mode"][value="${colMode}"]`);
        if (colModeRadio) colModeRadio.checked = true;
        tabEl.querySelector("#cs-st-internal-padding").value = parseInt(s.internalCardPadding, 10); 
        tabEl.querySelector("#cs-st-sel-enabled").checked = s.selectedCard.enabled; 
        tabEl.querySelector("#cs-st-sel-scale").value = s.selectedCard ? ((s.selectedCard.scale - 1) * 100).toFixed(0) : 0;
        s.fieldBackground = s.fieldBackground || {};
        tabEl.querySelector("#cs-st-fieldbg-enabled").checked = s.fieldBackground.enabled === true;
        tabEl.querySelector("#cs-st-fieldbg-lighten").value = s.fieldBackground.lightenPercentage || 15;
        tabEl.querySelector('#cs-st-simple-textcolor').value = s.simpleTextColor || '#000000';
        tabEl.querySelector('#cs-st-simple-textfont').value = s.simpleTextFont || 'Calibri';
        tabEl.querySelector('#cs-st-simple-textsize').value = parseInt(s.simpleTextSize, 10) || 14;
        const fb = s.fieldBox || {};
        tabEl.querySelector('#cs-st-fbox-enabled').checked = fb.borderEnabled;
        tabEl.querySelector('#cs-st-fbox-bcolor').value = fb.borderColor;
        tabEl.querySelector('#cs-st-fbox-bwidth').value = fb.borderWidth;
        tabEl.querySelector('#cs-st-fbox-bradius').value = fb.borderRadius;
        tabEl.querySelector('#cs-st-fbox-bgcolor').value = fb.backgroundColor;
        tabEl.querySelector('#cs-st-fbox-effect').value = fb.effect || 'none';
        const ls = s.labelStyle || {};
        tabEl.querySelector('#cs-st-label-bold').checked = ls.bold;
        tabEl.querySelector('#cs-st-label-allcaps').checked = ls.allCaps === true;
        tabEl.querySelector('#cs-st-label-color').value = ls.color;
        tabEl.querySelector('#cs-st-label-font').value = ls.font;
        tabEl.querySelector('#cs-st-label-size').value = parseInt(ls.size, 10);
        tabEl.querySelector('#cs-st-show-debug').checked = s.showDebugInfo === true;
    }

    function buildFieldsLayoutTab(contentArea) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "fld";
        tabEl.style.display = "none";
        tabEl.innerHTML = `
            <h3>Fields & Layout</h3>
            <div class="layout-controls" style="display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div>
                        <label>View Mode:</label>
                        <label><input type="radio" name="cs-viewmode" id="cs-vm-click" value="click" /> Click Card</label>
                        <label><input type="radio" name="cs-viewmode" id="cs-vm-burger" value="burger" /> Burger Icon</label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <label>Number of Rows:</label>
                        <input type="number" id="cs-num-rows" value="${state.numRows}" min="1" max="20" style="width: 50px;" />
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <label style="white-space: nowrap; font-weight: bold;"><input type="checkbox" id="cs-enable-order" ${state.enableOrder ? 'checked' : ''}> Enable Card Order</label>
                    <div id="cs-order-column-container" style="display: ${state.enableOrder ? 'flex' : 'none'}; flex-wrap: wrap; align-items: center; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label for="cs-order-column" style="white-space: nowrap; font-size: 0.9em;">Column:</label>
                            <select id="cs-order-column" style="width: auto; min-width: 100px;">
                                <option value="">-- Select --</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label for="cs-order-behavior" style="white-space: nowrap; font-size: 0.9em;">Handle:</label>
                            <select id="cs-order-behavior" style="width: auto;">
                                <option value="free" ${state.orderBehavior === 'free' ? 'selected' : ''}>Entire Card</option>
                                <option value="hybrid" ${state.orderBehavior === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                                <option value="strict" ${state.orderBehavior === 'strict' ? 'selected' : ''}>Strict (Handle Only)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <p class="help-text">Drag fields onto the grid below. Resize by dragging the right edge.</p>
            <div style="position: relative;">
                <div id="cs-group-box-grid" class="layout-grid" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none; --col-width: ${COL_WIDTH}px; --num-cols: ${NUM_COLS};"></div>
                <div id="cs-layout-grid" class="layout-grid" style="position: relative; z-index: 1; --col-width: ${COL_WIDTH}px; --num-cols: ${NUM_COLS};"></div>
            </div>
            <div class="available-fields-container">
                <b>Available Fields:</b>
                <div id="cs-layout-fields" class="available-fields-list"></div>
            </div>
            <hr>
            <h4>Group Boxes</h4>
            <p class="help-text">Add and configure group boxes. Drag them from the 'Available' list onto the grid above.</p>
            <div class="available-fields-container">
                <b>Available Group Boxes:</b>
                <div id="cs-group-box-list" class="available-fields-list"></div>
                <button type="button" id="cs-add-group-box-btn" class="btn-add-item" style="margin-top: 5px;">+ Add Group Box</button>
            </div>
        `;
        contentArea.appendChild(tabEl);
        if (state.viewMode === "burger") {
            tabEl.querySelector("#cs-vm-burger").checked = true;
        } else {
            tabEl.querySelector("#cs-vm-click").checked = true;
        }
        const rowInput = tabEl.querySelector("#cs-num-rows");
        rowInput.addEventListener("change", () => {
            state.numRows = parseInt(rowInput.value, 10) || 1;
            buildGridUI(tabEl.querySelector("#cs-layout-grid"), tabEl);
        });

        const enableOrderCheckbox = tabEl.querySelector("#cs-enable-order");
        const orderColumnContainer = tabEl.querySelector("#cs-order-column-container");
        const orderColumnSelect = tabEl.querySelector("#cs-order-column");

        const numericFields = state.fields
            .filter(f => ['Int', 'Float', 'Numeric'].some(type => f.type.startsWith(type)))
            .map(f => f.colId);
        
        populateFieldSelect(orderColumnSelect, numericFields);
        orderColumnSelect.value = state.orderColumn || "";

        const orderBehaviorSelect = tabEl.querySelector("#cs-order-behavior");

        enableOrderCheckbox.addEventListener("change", () => {
            orderColumnContainer.style.display = enableOrderCheckbox.checked ? 'flex' : 'none';
        });

        orderBehaviorSelect.addEventListener("change", () => {
            state.orderBehavior = orderBehaviorSelect.value;
            updateDebugJson();
        });

        buildGridUI(tabEl.querySelector("#cs-layout-grid"), tabEl);
        buildAvailableFieldsList(tabEl.querySelector("#cs-layout-fields"));

        const addGroupBoxBtn = tabEl.querySelector('#cs-add-group-box-btn');
        addGroupBoxBtn.addEventListener('click', () => {
            if (!Array.isArray(state.styling.groupBoxes)) { state.styling.groupBoxes = []; }
            const newGroupBox = { id: `gbox-${Date.now()}`, name: `Group ${state.styling.groupBoxes.length + 1}`, backgroundColor: '#e0e0e0', row: -1, col: -1, colSpan: 3, rowSpan: 2, };
            state.styling.groupBoxes.push(newGroupBox);
            buildAvailableGroupBoxesList(tabEl.querySelector('#cs-group-box-list'));
            updateDebugJson();
        });

        buildAvailableGroupBoxesList(tabEl.querySelector('#cs-group-box-list'));
        buildGroupBoxGridUI(tabEl.querySelector('#cs-group-box-grid'));
    }

    function buildAvailableFieldsList(container) {
        if (!container) return;
        container.innerHTML = "";
        const usedColIds = state.layout.map(f => f.colId);
        const availableCols = state.fields.filter(f => !usedColIds.includes(f.colId));
        const iconGroups = state.iconGroups || [];
        const availableIconGroups = iconGroups.filter(g => !usedColIds.includes(g.id));
        if (availableCols.length === 0 && availableIconGroups.length === 0) { container.innerHTML = "<i>No available fields.</i>"; return; }
        availableIconGroups.forEach(group => {
            const el = document.createElement("div");
            el.className = 'available-field available-icon-group';
            el.textContent = `[Group] ${group.name}`;
            el.dataset.colid = group.id;
            el.draggable = true;
            el.addEventListener("dragstart", e => { e.dataTransfer.setData("text/colid", group.id); e.dataTransfer.setData("text/isIconGroup", "true"); });
            container.appendChild(el);
        });
        availableCols.forEach(field => {
            const el = document.createElement("div");
            el.className = 'available-field';
            el.textContent = field.label || field.colId;
            el.dataset.colid = field.colId;
            el.draggable = true;
            el.addEventListener("dragstart", e => { e.dataTransfer.setData("text/colid", field.colId); });
            container.appendChild(el);
        });
    }

    function buildAvailableGroupBoxesList(container) {
        if (!container) return;
        container.innerHTML = "";
        const unplacedGroupBoxes = (state.styling.groupBoxes || []).filter(g => g.row === -1);
        if (!unplacedGroupBoxes.length) { container.innerHTML = "<i>No available group boxes.</i>"; return; }
        unplacedGroupBoxes.forEach(gbox => {
            const el = document.createElement("div");
            el.className = 'available-field';
            el.textContent = gbox.name;
            el.dataset.gboxid = gbox.id;
            el.draggable = true;
            el.addEventListener("dragstart", e => { e.dataTransfer.setData("text/gboxid", gbox.id); });
            container.appendChild(el);
        });
    }

    function buildGroupBoxGridUI(gridEl) {
        if (!gridEl) return;
        gridEl.innerHTML = ""; 
        const placedGroupBoxes = (state.styling.groupBoxes || []).filter(g => g.row > -1);
        placedGroupBoxes.forEach(gbox => {
            const box = document.createElement("div");
            box.className = 'layout-group-box';
            box.style.position = 'absolute';
            box.style.left = (gbox.col * COL_WIDTH) + "px";
            box.style.top = (gbox.row * 40) + "px";
            box.style.width = (gbox.colSpan * COL_WIDTH) + "px";
            box.style.height = (gbox.rowSpan * 40) + "px";
            box.style.backgroundColor = gbox.backgroundColor;
            box.style.opacity = 0.7;
            box.style.zIndex = 0;
            box.draggable = true;
            box.addEventListener("dragstart", e => { e.dataTransfer.setData("text/gboxid", gbox.id); });
            box.innerHTML = `<span class="group-box-name">${gbox.name}</span>`;
            const gearIcon = document.createElement("div");
            gearIcon.innerHTML = "⚙️"; gearIcon.className = 'field-box-icon gear'; gearIcon.style.zIndex = "10";
            gearIcon.addEventListener("click", e => { e.stopPropagation(); openGroupBoxStylePopup(gbox); });
            box.appendChild(gearIcon);
            const removeIcon = document.createElement("div");
            removeIcon.innerHTML = "✕"; removeIcon.className = 'field-box-icon remove'; removeIcon.style.zIndex = "10";
            removeIcon.addEventListener("click", e => { e.stopPropagation(); const idx = state.styling.groupBoxes.findIndex(g => g.id === gbox.id); if (idx > -1) { state.styling.groupBoxes.splice(idx, 1); } buildGroupBoxGridUI(gridEl); updateDebugJson(); });
            box.appendChild(removeIcon);
            const handle = document.createElement("div"); handle.className = 'resize-handle'; box.appendChild(handle);
            handle.addEventListener("mousedown", e => {
                e.stopPropagation(); e.preventDefault();
                const startX = e.clientX; const startY = e.clientY; const origW = parseFloat(box.style.width); const origH = parseFloat(box.style.height);
                const onMouseMove = moveEvt => { let newWidth = origW + (moveEvt.clientX - startX); let newHeight = origH + (moveEvt.clientY - startY); box.style.width = newWidth + "px"; box.style.height = newHeight + "px"; };
                const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp);
                    let newColSpan = Math.round(parseFloat(box.style.width) / COL_WIDTH);
                    let newRowSpan = Math.round(parseFloat(box.style.height) / 40);
                    gbox.colSpan = Math.max(1, Math.min(NUM_COLS - gbox.col, newColSpan));
                    gbox.rowSpan = Math.max(1, newRowSpan);
                    buildGroupBoxGridUI(gridEl); updateDebugJson();
                };
                document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
            });
            gridEl.appendChild(box);
        });
    }

    function openGroupBoxStylePopup(gbox) {
        if (_fieldStylePopup && _fieldStylePopup.parentNode) _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
        const existingBackdrop = document.querySelector('.popup-backdrop'); if (existingBackdrop) existingBackdrop.parentNode.removeChild(existingBackdrop);
        const backdrop = document.createElement('div'); backdrop.className = 'popup-backdrop'; backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 1050;`;
        _mainContainer.appendChild(backdrop);
        _fieldStylePopup = document.createElement("div"); _fieldStylePopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);`; _fieldStylePopup.className = 'field-style-popup';
        _fieldStylePopup.innerHTML = `<h3 style="margin-top:0;">Edit Group Box</h3><div class="form-group"><label>Name:</label><input type="text" id="gbox-name" value="${gbox.name}" class="form-control"></div><div class="form-group"><label>Background Color:</label><input type="color" id="gbox-bgcolor" value="${gbox.backgroundColor}"></div><div class="popup-actions"><button id="gbox-cancel" type="button" class="btn btn-secondary">Cancel</button><button id="gbox-save" type="button" class="btn btn-primary">Save</button></div>`;
        _mainContainer.appendChild(_fieldStylePopup);
        const closePopup = () => { if (_fieldStylePopup && _fieldStylePopup.parentNode) _fieldStylePopup.parentNode.removeChild(_fieldStylePopup); _fieldStylePopup = null; const backdrop = document.querySelector('.popup-backdrop'); if (backdrop) backdrop.parentNode.removeChild(backdrop); };
        _fieldStylePopup.querySelector('#gbox-cancel').addEventListener('click', closePopup);
        _fieldStylePopup.querySelector('#gbox-save').addEventListener('click', () => { gbox.name = _fieldStylePopup.querySelector('#gbox-name').value; gbox.backgroundColor = _fieldStylePopup.querySelector('#gbox-bgcolor').value; closePopup(); buildGroupBoxGridUI(_mainContainer.querySelector("#cs-group-box-grid")); updateDebugJson(); });
    }

    function buildGridUI(gridEl, tabEl) {
        gridEl.innerHTML = ""; for (let r = 0; r < state.numRows; r++) {
            const rowDiv = document.createElement("div"); rowDiv.className = 'layout-grid-row'; rowDiv.dataset.rowIndex = String(r); rowDiv.addEventListener("dragover", e => e.preventDefault()); rowDiv.addEventListener("drop", e => {
                e.preventDefault();
                const colId = e.dataTransfer.getData("text/colid");
                const gboxId = e.dataTransfer.getData("text/gboxid");
                const rect = rowDiv.getBoundingClientRect();
                const col = Math.floor((e.clientX - rect.left) / COL_WIDTH);
                if (colId) {
                    const isIconGroup = e.dataTransfer.getData("text/isIconGroup") === "true";
                    const existingItem = state.layout.find(f => f.colId === colId);
                    if (existingItem) { existingItem.row = r; existingItem.col = col; } 
                    else { const newLayoutItem = { colId, row: r, col, colSpan: 2, rowSpan: 1, style: { ...DEFAULT_FIELD_STYLE } }; if (isIconGroup) newLayoutItem.isIconGroup = true; state.layout.push(newLayoutItem); }
                    buildGridUI(gridEl, tabEl); buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields")); updateDebugJson();
                } else if (gboxId) {
                    const gbox = (state.styling.groupBoxes || []).find(g => g.id === gboxId);
                    if (gbox) { gbox.row = r; gbox.col = col; buildGroupBoxGridUI(_mainContainer.querySelector("#cs-group-box-grid")); buildAvailableGroupBoxesList(_mainContainer.querySelector("#cs-group-box-list")); updateDebugJson(); }
                }
            }); state.layout.filter(f => f.row === r).forEach(f => { rowDiv.appendChild(createFieldBoxInConfigUI(f, gridEl, tabEl)); }); gridEl.appendChild(rowDiv);
        }
    }

    function createFieldBoxInConfigUI(fieldDef, gridEl, tabEl) {
        let fieldLabel; let fieldSchema;
        if (fieldDef.isIconGroup) { const group = (state.iconGroups || []).find(g => g.id === fieldDef.colId); fieldLabel = `[Group] ${group ? group.name : fieldDef.colId}`; } 
        else { fieldSchema = state.fields.find(field => field.colId === fieldDef.colId); fieldLabel = fieldSchema ? (fieldSchema.label || fieldSchema.colId) : fieldDef.colId; }
        const box = document.createElement("div"); box.className = 'layout-field-box'; box.textContent = fieldLabel; box.style.left = (fieldDef.col * COL_WIDTH) + "px"; box.style.width = (fieldDef.colSpan * COL_WIDTH) + "px"; box.style.height = (((fieldDef.rowSpan || 1) * 40) - 8) + "px";
        box.draggable = true; box.addEventListener("dragstart", e => { e.dataTransfer.setData("text/colid", fieldDef.colId); if (fieldDef.isIconGroup) e.dataTransfer.setData("text/isIconGroup", "true"); });
        const gearIcon = document.createElement("div"); gearIcon.innerHTML = "⚙️"; gearIcon.className = 'field-box-icon gear'; gearIcon.addEventListener("click", e => { e.stopPropagation(); openFieldStylePopup(fieldDef, fieldSchema, gridEl, tabEl); }); box.appendChild(gearIcon);
        const removeIcon = document.createElement("div"); removeIcon.innerHTML = "✕"; removeIcon.className = 'field-box-icon remove'; removeIcon.addEventListener("click", e => { e.stopPropagation(); const idx = state.layout.indexOf(fieldDef); if (idx > -1) { state.layout.splice(idx, 1); buildGridUI(gridEl, tabEl); buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields")); updateDebugJson(); } }); box.appendChild(removeIcon);
        const handle = document.createElement("div"); handle.className = 'resize-handle'; box.appendChild(handle);
        handle.addEventListener("mousedown", e => {
            e.stopPropagation(); e.preventDefault(); const startX = e.clientX; const origW = parseFloat(box.style.width);
            const onMouseMove = moveEvt => { let newWidth = origW + (moveEvt.clientX - startX); box.style.width = newWidth + "px"; };
            const onMouseUp = () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); let newColSpan = Math.round(parseFloat(box.style.width) / COL_WIDTH); fieldDef.colSpan = Math.max(1, Math.min(NUM_COLS - fieldDef.col, newColSpan)); buildGridUI(gridEl, tabEl); updateDebugJson(); };
            document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
        });
        return box;
    }

    let activeGroupId = null; let activeButtonIndex = -1;

    function buildActionsTab(contentArea) {
        const tabEl = document.createElement("div"); tabEl.dataset.tabSection = "actions"; tabEl.style.display = "none";
        const styleId = 'actions-tab-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style'); style.id = styleId;
            style.textContent = `.actions-layout { display: flex; height: 500px; border: 1px solid #ddd; border-radius: 4px; background: #fff; } .col-groups { width: 200px; border-right: 1px solid #eee; display: flex; flex-direction: column; background: #f9f9f9; } .col-buttons { width: 150px; border-right: 1px solid #eee; display: flex; flex-direction: column; background: #fff; } .col-details { flex-grow: 1; padding: 15px; overflow-y: auto; background: #fff; } .list-header { padding: 10px; font-weight: bold; border-bottom: 1px solid #eee; background: #f0f0f0; color: #555; font-size: 12px; text-transform: uppercase; } .list-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #f5f5f5; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; } .list-item:hover { background-color: #f0f0f0; } .list-item.active { background-color: #e6f7ff; border-left: 3px solid #1890ff; } .group-actions { display: flex; gap: 5px; opacity: 0.5; } .list-item:hover .group-actions { opacity: 1; } .group-action-btn { border: none; background: none; cursor: pointer; padding: 2px; color: #888; } .group-action-btn:hover { color: #333; } .add-btn-row { padding: 10px; text-align: center; border-top: 1px solid #eee; margin-top: auto; } .add-btn-icon { font-size: 24px; color: #28a745; cursor: pointer; background: none; border: none; transition: transform 0.2s; } .add-btn-icon:hover { transform: scale(1.2); } .button-preview-item { display: flex; align-items: center; gap: 10px; } .btn-icon-preview { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; } .btn-icon-preview.circle { border-radius: 50%; } .empty-state { padding: 20px; text-align: center; color: #999; font-style: italic; }`;
            document.head.appendChild(style);
        }
        tabEl.innerHTML = `<h3>Card Actions & Navigation</h3><div class="form-group" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;"><div><label style="display:block; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">General Card Interaction</label><div style="display:flex; gap:10px; align-items:center;"><label for="cs-sp-drawer-config">Details Drawer:</label><select id="cs-sp-drawer-config" style="flex:1;"><option value="">-- None --</option></select></div><div style="display:flex; gap:10px; align-items:center; margin-top:10px;"><label for="cs-sp-size">Drawer Size:</label><select id="cs-sp-size" style="flex:1;"><option value="">-- Use Drawer Config --</option><option value="25%">25%</option><option value="35%">35%</option><option value="50%">50%</option><option value="75%">75%</option></select></div></div><div><label style="display:block; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">Global "Add New" Buttons</label><div style="display:flex; flex-direction:column; gap:8px;"><label><input type="checkbox" id="cs-add-btn-top"> Show "+" Button at Top</label><label><input type="checkbox" id="cs-add-btn-bottom"> Show "+" Button at Bottom</label><div style="display:flex; gap:10px; align-items:center; margin-top:5px;"><label style="white-space:nowrap;">Creation Config:</label><select id="cs-add-btn-config" style="flex:1;"><option value="">-- Use Default --</option></select></div></div></div></div><hr style="margin: 15px 0; border:none; border-top: 1px solid #ddd;"><div style="display:flex; gap:20px; align-items:center;"><label for="cs-icon-size">Global Icon Size:</label><select id="cs-icon-size" style="width: auto;"><option value="0.8">80%</option><option value="0.9">90%</option><option value="1.0" selected>100% (Default)</option><option value="1.1" selected>110%</option><option value="1.2" selected>120%</option></select></div><div id="actions-master-detail" class="actions-layout"></div>`;
        contentArea.appendChild(tabEl);
        const drawerSelect = tabEl.querySelector("#cs-sp-drawer-config"); const addBtnConfigSelect = tabEl.querySelector("#cs-add-btn-config");
        if (allConfigs && Array.isArray(allConfigs)) { allConfigs.filter(c => c.componentType === 'Drawer').forEach(c => { const option = document.createElement('option'); option.value = c.configId; option.textContent = c.configId; drawerSelect.appendChild(option); const option2 = document.createElement('option'); option2.value = c.configId; option2.textContent = c.configId; addBtnConfigSelect.appendChild(option2); }); }
        if (state.sidePanel && state.sidePanel.drawerConfigId) drawerSelect.value = state.sidePanel.drawerConfigId;
        if (state.sidePanel && state.sidePanel.size) tabEl.querySelector("#cs-sp-size").value = state.sidePanel.size;
        if (state.styling && state.styling.iconSize) tabEl.querySelector("#cs-icon-size").value = state.styling.iconSize;
        tabEl.querySelector("#cs-add-btn-top").checked = !!state.showAddButtonTop; tabEl.querySelector("#cs-add-btn-bottom").checked = !!state.showAddButtonBottom; if (state.addRecordConfigId) addBtnConfigSelect.value = state.addRecordConfigId;
        renderActionsLayout(tabEl.querySelector('#actions-master-detail'));
    }

    function renderActionsLayout(container) {
        container.innerHTML = '';
        const colGroups = document.createElement('div'); colGroups.className = 'col-groups'; colGroups.innerHTML = '<div class="list-header">Icon Groups</div><div class="groups-list-content" style="flex-grow:1; overflow-y:auto;"></div><div class="add-btn-row"><button type="button" class="add-btn-icon" title="Add Icon Group">+</button></div>';
        renderGroupsList(colGroups.querySelector('.groups-list-content'));
        colGroups.querySelector('.add-btn-icon').onclick = (e) => { e.preventDefault(); e.stopPropagation(); state.iconGroups = state.iconGroups || []; const newGroup = { id: `icon-group-${Date.now()}`, name: `Group ${state.iconGroups.length + 1}`, alignment: 'center', buttons: [] }; state.iconGroups.push(newGroup); activeGroupId = newGroup.id; activeButtonIndex = -1; renderActionsLayout(container); buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields")); updateDebugJson(); };
        container.appendChild(colGroups);
        const colButtons = document.createElement('div'); colButtons.className = 'col-buttons'; colButtons.innerHTML = '<div class="list-header">Buttons</div><div class="buttons-list-content" style="flex-grow:1; overflow-y:auto;"></div><div class="add-btn-row"><button type="button" class="add-btn-icon" title="Add Action Button">+</button></div>';
        const activeGroup = (state.iconGroups || []).find(g => g.id === activeGroupId);
        if (activeGroup) { renderButtonsList(colButtons.querySelector('.buttons-list-content'), activeGroup); colButtons.querySelector('.add-btn-icon').onclick = (e) => { e.preventDefault(); e.stopPropagation(); activeGroup.buttons = activeGroup.buttons || []; activeGroup.buttons.push({ id: `btn-${Date.now()}`, icon: 'icon-star', tooltip: 'New Action', actionType: 'navigateToGristPage', buttonStyle: 'icon', shape: 'square', iconColor: '#000000', backgroundColor: '#f0f0f0', transparentBackground: false }); activeButtonIndex = activeGroup.buttons.length - 1; renderActionsLayout(container); updateDebugJson(); }; } 
        else { colButtons.innerHTML = '<div class="empty-state">Select a Group</div>'; }
        container.appendChild(colButtons);
        const colDetails = document.createElement('div'); colDetails.className = 'col-details';
        if (activeGroup && activeButtonIndex >= 0 && activeGroup.buttons[activeButtonIndex]) { renderButtonConfig(colDetails, activeGroup.buttons[activeButtonIndex], activeGroup); } 
        else { colDetails.innerHTML = '<div class="empty-state">Select a Button to Configure</div>'; }
        container.appendChild(colDetails);
    }

    function renderGroupsList(container) {
        (state.iconGroups || []).forEach(group => {
            const el = document.createElement('div'); el.className = `list-item ${group.id === activeGroupId ? 'active' : ''}`;
            el.innerHTML = `<span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group.name}</span><div class="group-actions"><button type="button" class="group-action-btn cfg" title="Configure">⚙️</button><button type="button" class="group-action-btn rm" title="Remove">✕</button></div>`;
            el.onclick = () => { activeGroupId = group.id; activeButtonIndex = -1; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); };
            el.querySelector('.cfg').onclick = (e) => { e.stopPropagation(); openGroupSettingsPopup(group); };
            el.querySelector('.rm').onclick = (e) => { e.stopPropagation(); if(confirm('Delete this group?')) { state.iconGroups = state.iconGroups.filter(g => g.id !== group.id); if(activeGroupId === group.id) activeGroupId = null; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields")); updateDebugJson(); } };
            container.appendChild(el);
        });
    }

    function renderButtonsList(container, group) {
        (group.buttons || []).forEach((btn, idx) => {
            const el = document.createElement('div'); el.className = `list-item ${idx === activeButtonIndex ? 'active' : ''}`;
            let previewHtml = ''; const menuPreviewStyle = `background-color: #fff; color: #333; border: 1px solid #ccc;`; const shapeClass = group.shape === 'circle' ? 'circle' : '';
            if (btn.buttonStyle === 'text') { previewHtml = `<div class="btn-icon-preview ${shapeClass}" style="${menuPreviewStyle}">${(btn.text || 'Tx').substring(0,2)}</div>`; } 
            else { previewHtml = `<div class="btn-icon-preview ${shapeClass}" style="${menuPreviewStyle}"><svg class="icon" style="fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${btn.icon || 'icon-star'}"></use></svg></div>`; }
            el.innerHTML = `<div class="button-preview-item">${previewHtml} <span style="font-size: 11px;">#${idx + 1}</span></div><div class="group-actions" style="display: flex; gap: 4px;"><button type="button" class="group-action-btn move-up" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>↑</button><button type="button" class="group-action-btn move-down" title="Move Down" ${idx === group.buttons.length - 1 ? 'disabled style="opacity:0.3"' : ''}>↓</button><button type="button" class="group-action-btn rm" title="Delete Icon">✕</button></div>`;
            el.onclick = () => { activeButtonIndex = idx; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); };
            el.querySelector('.move-up').onclick = (e) => { e.stopPropagation(); if (idx > 0) { const temp = group.buttons[idx]; group.buttons[idx] = group.buttons[idx - 1]; group.buttons[idx - 1] = temp; if (activeButtonIndex === idx) activeButtonIndex = idx - 1; else if (activeButtonIndex === idx - 1) activeButtonIndex = idx; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); } };
            el.querySelector('.move-down').onclick = (e) => { e.stopPropagation(); if (idx < group.buttons.length - 1) { const temp = group.buttons[idx]; group.buttons[idx] = group.buttons[idx + 1]; group.buttons[idx + 1] = temp; if (activeButtonIndex === idx) activeButtonIndex = idx + 1; else if (activeButtonIndex === idx + 1) activeButtonIndex = idx; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); } };
            el.querySelector('.rm').onclick = (e) => { e.stopPropagation(); group.buttons.splice(idx, 1); if (activeButtonIndex === idx) activeButtonIndex = -1; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); };
            container.appendChild(el);
        });
    }

    function renderButtonConfig(container, btn, group) {
        container.innerHTML = `<h4>Button Config</h4><div class="form-group"><label>Content Type:</label><label><input type="radio" name="btn-style" value="icon" ${btn.buttonStyle !== 'text' ? 'checked' : ''}> Icon</label><label><input type="radio" name="btn-style" value="text" ${btn.buttonStyle === 'text' ? 'checked' : ''}> Text</label></div><div id="btn-content-icon" style="display: ${btn.buttonStyle !== 'text' ? 'block' : 'none'}"><div class="form-group"><label>Select Icon:</label><div class="icon-picker-display" style="cursor:pointer; padding: 5px; border: 1px solid #ccc; display: inline-flex; align-items:center; gap: 8px; border-radius: 4px; background: #fff;"><span class="current-icon" style="display:flex; color: #333;"><svg class="icon" style="width:20px; height:20px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${btn.icon || 'icon-star'}"></use></svg></span> <span style="font-weight:bold; color: #555;">Change</span></div></div></div><div id="btn-content-text" style="display: ${btn.buttonStyle === 'text' ? 'block' : 'none'}"><div class="form-group"><label>Text (1-3 chars):</label><input type="text" id="btn-text-val" value="${btn.text || ''}" maxlength="3" style="width: 60px;"></div></div><hr><div class="form-group"><label>Tooltip:</label><input type="text" id="btn-tooltip" value="${btn.tooltip || ''}" class="form-control"></div><div class="form-group"><label>Action Type:</label><select id="btn-actionType" class="form-control"><option value="navigateToGristPage" ${btn.actionType === 'navigateToGristPage' ? 'selected' : ''}>Navigate to Page</option><option value="openUrlFromColumn" ${btn.actionType === 'openUrlFromColumn' ? 'selected' : ''}>Open URL</option><option value="updateRecord" ${btn.actionType === 'updateRecord' ? 'selected' : ''}>Update Record</option><option value="triggerWidget" ${btn.actionType === 'triggerWidget' ? 'selected' : ''}>Trigger Widget</option><option value="editRecord" ${btn.actionType === 'editRecord' ? 'selected' : ''}>Open Drawer</option><option value="deleteRecord" ${btn.actionType === 'deleteRecord' ? 'selected' : ''}>Delete Record</option><option value="addSubRecord" ${btn.actionType === 'addSubRecord' ? 'selected' : ''}>Add Sub-Record</option><option value="showTooltipField" ${btn.actionType === 'showTooltipField' ? 'selected' : ''}>Tooltip Field</option><option value="moveRecord" ${btn.actionType === 'moveRecord' ? 'selected' : ''}>Move Alça</option><option value="SHOW_INDICATOR_CHART" ${btn.actionType === 'SHOW_INDICATOR_CHART' ? 'selected' : ''}>Show Indicator Chart</option><option value="EDIT_INDICATOR_DATA" ${btn.actionType === 'EDIT_INDICATOR_DATA' ? 'selected' : ''}>Edit Indicator Data</option></select><div id="btn-action-help-container">${renderActionHelp(btn.actionType)}</div></div><div id="btn-action-specific" style="margin-top: 10px;"></div><hr><h4>Individual Overrides</h4><div class="form-group"><label>Icon/Text Color:</label><input type="color" id="btn-fg" value="${btn.iconColor||group.iconColor||'#000000'}"> <label><input type="checkbox" id="btn-fg-default" ${!btn.iconColor?'checked':''}> Default</label></div><div class="form-group"><label>Background Mode:</label><select id="btn-bgmode"><option value="default" ${!btn.bgMode?'selected':''}>Follow Group</option><option value="solid" ${btn.bgMode==='solid'?'selected':''}>Solid Color</option><option value="transparent" ${btn.bgMode==='transparent'?'selected':''}>Transparent</option><option value="overlay" ${btn.bgMode==='overlay'?'selected':''}>Adaptive Overlay</option></select></div><div id="btn-solid-opts" style="display:none;"><div class="form-group"><label>Background Color:</label><input type="color" id="btn-bg" value="${btn.backgroundColor||'#f0f0f0'}"></div></div>`;
        const actionTypeSelect = container.querySelector('#btn-actionType'); const actionSpecContainer = container.querySelector('#btn-action-specific'); const actionHelpContainer = container.querySelector('#btn-action-help-container');
        renderActionSpecificConfig(actionSpecContainer, btn, 0);
        actionTypeSelect.addEventListener('change', (e) => { btn.actionType = e.target.value; actionHelpContainer.innerHTML = renderActionHelp(btn.actionType); renderActionSpecificConfig(actionSpecContainer, btn, 0); update(); });
        actionSpecContainer.addEventListener('change', (e) => {
            const prop = e.target.dataset.prop;
            if (prop) {
                if (e.target.type === 'checkbox') {
                    btn[prop] = e.target.checked;
                } else {
                    btn[prop] = e.target.value;
                }
                update();
            }
        });
        const update = () => { renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); };
        container.querySelectorAll('input[name="btn-style"]').forEach(r => r.addEventListener('change', (e) => { btn.buttonStyle = e.target.value; container.querySelector('#btn-content-icon').style.display = btn.buttonStyle === 'icon' ? 'block' : 'none'; container.querySelector('#btn-content-text').style.display = btn.buttonStyle === 'text' ? 'block' : 'none'; update(); }));
        container.querySelector('.icon-picker-display').onclick = (e) => { const display = e.currentTarget.querySelector('.current-icon'); const dummyInput = { value: btn.icon }; openIconPicker(dummyInput, display, btn); };
        container.querySelector('#btn-text-val').addEventListener('input', (e) => { btn.text = e.target.value; update(); });
        container.querySelector('#btn-tooltip').addEventListener('input', (e) => { btn.tooltip = e.target.value; });
    }

    function openGroupSettingsPopup(group) {
        if (!group.bgMode) group.bgMode = group.transparentBackground ? 'transparent' : 'solid';
        if (!group.borderColor) group.borderColor = '#cccccc'; if (!group.overlayEffect) group.overlayEffect = 'lighten'; if (!group.overlayOpacity) group.overlayOpacity = 20;
        if (_fieldStylePopup && _fieldStylePopup.parentNode) _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
        const backdrop = document.createElement('div'); backdrop.className = 'popup-backdrop'; backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 1050;`;
        _mainContainer.appendChild(backdrop);
        _fieldStylePopup = document.createElement("div"); _fieldStylePopup.className = 'field-style-popup'; _fieldStylePopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 320px; max-height: 90vh; overflow-y: auto;`;
        _fieldStylePopup.innerHTML = `<h3>Edit Group</h3><div class="form-group"><label>Name:</label><input type="text" id="popup-g-name" value="${group.name}"></div><div class="form-group"><label>Align:</label><select id="popup-g-align"><option value="left" ${group.alignment==='left'?'selected':''}>Left</option><option value="center" ${group.alignment==='center'?'selected':''}>Center</option><option value="right" ${group.alignment==='right'?'selected':''}>Right</option></select></div><div class="form-group"><label>Vertical Offset (px):</label><input type="number" id="popup-g-v-offset" value="${group.verticalOffset || 0}" style="width: 60px;"></div><div class="form-group"><label>Visibility:</label><select id="popup-g-visibility"><option value="always" ${group.visibilityMode!=='hover'?'selected':''}>Always Visible</option><option value="hover" ${group.visibilityMode==='hover'?'selected':''}>Show on Hover</option></select></div><hr><h4>Default Button Style</h4><div class="form-group"><label>Shape:</label><select id="popup-g-shape"><option value="square" ${group.shape!=='circle'?'selected':''}>Square</option><option value="circle" ${group.shape==='circle'?'selected':''}>Circle</option></select></div><div class="form-group"><label>Icon/Text Color:</label><input type="color" id="popup-g-fg" value="${group.iconColor||'#000000'}"></div><div class="form-group"><label>Background Mode:</label><select id="popup-g-bgmode"><option value="solid" ${group.bgMode==='solid'?'selected':''}>Solid Color</option><option value="transparent" ${group.bgMode==='transparent'?'selected':''}>Transparent</option><option value="overlay" ${group.bgMode==='overlay'?'selected':''}>Adaptive Overlay</option><option value="match-card" ${group.bgMode==='match-card'?'selected':''}>Match Card Color</option></select></div><div id="popup-g-solid-opts" class="form-group" style="display:none;"><label>Background Color:</label><input type="color" id="popup-g-bg" value="${group.backgroundColor||'#f0f0f0'}"></div><div id="popup-g-overlay-opts" class="form-group" style="display:none;"><label>Effect:</label><select id="popup-g-overlay-effect"><option value="lighten" ${group.overlayEffect==='lighten'?'selected':''}>Lighten</option><option value="darken" ${group.overlayEffect==='darken'?'selected':''}>Darken</option></select><br><label>Opacity (%):</label><input type="number" id="popup-g-overlay-opacity" value="${group.overlayOpacity}" style="width:60px;"></div><div class="form-group"><label>Border Color:</label><input type="color" id="popup-g-border" value="${group.borderColor||'#cccccc'}"></div><div class="form-group"><label>Border Width (px):</label><input type="number" id="popup-g-border-width" value="${group.borderWidth||0}" style="width:60px;"></div><div class="popup-actions"><button id="popup-close" type="button" class="btn btn-primary">Close</button></div>`;
        _mainContainer.appendChild(_fieldStylePopup);
        const toggleOpts = () => { const mode = _fieldStylePopup.querySelector('#popup-g-bgmode').value; _fieldStylePopup.querySelector('#popup-g-solid-opts').style.display = mode === 'solid' ? 'block' : 'none'; _fieldStylePopup.querySelector('#popup-g-overlay-opts').style.display = (mode === 'overlay' || mode === 'match-card') ? 'block' : 'none'; };
        _fieldStylePopup.querySelector('#popup-g-bgmode').addEventListener('change', toggleOpts); toggleOpts();
        _fieldStylePopup.querySelector('#popup-close').onclick = () => { group.name = _fieldStylePopup.querySelector('#popup-g-name').value; group.alignment = _fieldStylePopup.querySelector('#popup-g-align').value; group.shape = _fieldStylePopup.querySelector('#popup-g-shape').value; group.iconColor = _fieldStylePopup.querySelector('#popup-g-fg').value; group.bgMode = _fieldStylePopup.querySelector('#popup-g-bgmode').value; group.backgroundColor = _fieldStylePopup.querySelector('#popup-g-bg').value; group.overlayEffect = _fieldStylePopup.querySelector('#popup-g-overlay-effect').value; group.overlayOpacity = parseInt(_fieldStylePopup.querySelector('#popup-g-overlay-opacity').value, 10) || 0; group.borderColor = _fieldStylePopup.querySelector('#popup-g-border').value; group.borderWidth = parseInt(_fieldStylePopup.querySelector('#popup-g-border-width').value, 10) || 0; group.verticalOffset = parseInt(_fieldStylePopup.querySelector('#popup-g-v-offset').value, 10) || 0; group.visibilityMode = _fieldStylePopup.querySelector('#popup-g-visibility').value; backdrop.remove(); _fieldStylePopup.remove(); renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); };
    }

    function openIconPicker(inputElement, displayElement, buttonConfig) {
        if (_iconPickerPopup && _iconPickerPopup.parentNode) { _iconPickerPopup.parentNode.removeChild(_iconPickerPopup); }
        _iconPickerPopup = document.createElement("div"); _iconPickerPopup.className = 'icon-picker-popup'; _iconPickerPopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1080; padding: 15px; background: white; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 600px; max-height: 500px; overflow-y: auto; border-radius: 5px;`;
        _iconPickerPopup.innerHTML = `<style>.icon-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; } .icon-option { width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #eee; border-radius: 4px; cursor: pointer; transition: all 0.2s; color: #000; padding: 5px; overflow: hidden; } .icon-option:hover { background: #e6f7ff; border-color: #1890ff; transform: scale(1.05); } .icon-option svg { width: 32px; height: 32px; flex-shrink: 0; fill: currentColor; } .icon-id-label { font-size: 9px; margin-top: 5px; text-align: center; word-break: break-all; color: #666; max-height: 24px; overflow: hidden; }</style><h4 style="margin-top: 0;">Select an Icon</h4><div class="icon-grid">${AVAILABLE_ICONS.map(id => `<div class="icon-option" data-id="${id}" title="${id}"><svg><use href="#${id}"></use></svg><div class="icon-id-label">${id.replace('icon-', '')}</div></div>`).join('')}</div><div style="text-align: right; margin-top: 15px;"><button id="icon-picker-cancel" type="button" class="btn btn-secondary">Cancel</button></div>`;
        _mainContainer.appendChild(_iconPickerPopup);
        _iconPickerPopup.querySelectorAll('.icon-option').forEach(iconEl => { iconEl.addEventListener('click', () => { const selectedIcon = iconEl.dataset.id; buttonConfig.icon = selectedIcon; if(inputElement) inputElement.value = selectedIcon; if(displayElement) displayElement.innerHTML = `<svg class="icon"><use href="#${selectedIcon}"></use></svg>`; _iconPickerPopup.parentNode.removeChild(_iconPickerPopup); _iconPickerPopup = null; renderActionsLayout(_mainContainer.querySelector('#actions-master-detail')); updateDebugJson(); }); });
        _iconPickerPopup.querySelector('#icon-picker-cancel').addEventListener('click', () => { _iconPickerPopup.parentNode.removeChild(_iconPickerPopup); _iconPickerPopup = null; });
    }

    function renderActionHelp(actionType) { const helpMap = { 'navigateToGristPage': 'Navega para outra página/seção do Grist.', 'openUrlFromColumn': 'Abre um link contido em uma coluna.', 'updateRecord': 'Atualiza um campo do registro.', 'triggerWidget': 'Dispara outro widget.', 'editRecord': 'Abre a gaveta lateral.', 'deleteRecord': 'Exclui o registro.', 'addSubRecord': 'Cria um novo registro vinculado.', 'showTooltipField': 'Exibe um campo como tooltip.', 'moveRecord': 'Alça de arraste manual.', 'SHOW_INDICATOR_CHART': 'Exibe o gráfico detalhado do indicador.', 'EDIT_INDICATOR_DATA': 'Abre o editor de valores mensais do indicador.' }; return helpMap[actionType] ? `<p class="help-text" style="margin-top: 5px; color: #64748b; font-size: 0.85em;">${helpMap[actionType]}</p>` : ''; }

    async function renderActionSpecificConfig(container, buttonConfig, index) {
        container.innerHTML = ''; const allGristPages = await state.lens.listAllTables(); const allGristColumns = (state.fields || []).map(f => f.colId);
        if (buttonConfig.actionType === 'navigateToGristPage') { container.innerHTML = `<div class="form-group"><label>Target Page:</label><select class="action-target-page" data-prop="targetPageId"><option value="">-- Select --</option>${allGristPages.map(p => `<option value="${p.id}" ${buttonConfig.targetPageId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div><div class="form-group"><label>Filter Column:</label><input type="text" class="action-target-filter-column" data-prop="targetFilterColumn" value="${buttonConfig.targetFilterColumn || ''}"></div><div class="form-group"><label>Filter Value:</label><select class="action-source-value-column" data-prop="sourceValueColumn"><option value="">-- Select --</option>${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.sourceValueColumn === col ? 'selected' : ''}>${col}</option>`).join('')}</select></div>`; } 
        else if (buttonConfig.actionType === 'openUrlFromColumn') { container.innerHTML = `<div class="form-group"><label>URL Column:</label><select class="action-url-column" data-prop="urlColumn"><option value="">-- Select --</option>${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.urlColumn === col ? 'selected' : ''}>${col}</option>`).join('')}</select></div>`; } 
        else if (buttonConfig.actionType === 'updateRecord') { container.innerHTML = `<div class="form-group"><label>Field:</label><select class="action-update-field" data-prop="updateField"><option value="">-- Select --</option>${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.updateField === col ? 'selected' : ''}>${col}</option>`).join('')}</select></div><div class="form-group"><label>Value:</label><input type="text" class="action-update-value" data-prop="updateValue" value="${buttonConfig.updateValue || ''}"></div>`; } 
        else if (buttonConfig.actionType === 'triggerWidget') {
            container.innerHTML = `
                <div class="form-group">
                    <label>Target ID:</label>
                    <select class="action-target-config-id" data-prop="targetConfigId">
                        <option value="">-- Select --</option>
                        ${allConfigs.map(c => `<option value="${c.configId}" ${buttonConfig.targetConfigId === c.configId ? 'selected' : ''} data-type="${c.componentType || ''}">${c.configId}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Filter Target Column:</label>
                    <input type="text" class="action-filter-target-column" data-prop="filterTargetColumn" value="${buttonConfig.filterTargetColumn || ''}" placeholder="e.g. ref_parent">
                </div>
                <div class="form-group" style="margin-top: 8px;">
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: normal;">
                        <input type="checkbox" class="action-disable-filtering" data-prop="disableFiltering" ${buttonConfig.disableFiltering ? 'checked' : ''}>
                        Sem filtrar pelo registro atual (chamar limpo)
                    </label>
                </div>
            `;
            const selectEl = container.querySelector('.action-target-config-id');
            selectEl.addEventListener('change', (e) => {
                const selectedOpt = e.target.options[e.target.selectedIndex];
                const compType = selectedOpt ? (selectedOpt.dataset.type || '') : '';
                buttonConfig.targetComponentType = compType;
            });
        }
        else if (buttonConfig.actionType === 'deleteRecord') { container.innerHTML = `<div class="form-group"><label>Confirmation:</label><input type="text" class="action-confirm-msg" data-prop="confirmationMessage" value="${buttonConfig.confirmationMessage || 'Delete record?'}"></div>`; } 
        else if (buttonConfig.actionType === 'addSubRecord') { 
            const drawerConfigs = allConfigs.filter(c => c.componentType === 'Drawer');
            container.innerHTML = `
                <div class="form-group">
                    <label>Target Table:</label>
                    <select class="action-sub-table-id" data-prop="subRecordTableId">
                        <option value="">-- Auto-detect --</option>
                        ${allGristPages.map(p => `<option value="${p.id}" ${buttonConfig.subRecordTableId === p.id ? 'selected' : ''}>${p.id}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Relationship Field (in sub-table):</label>
                    <input type="text" class="action-sub-record-ref-field" data-prop="subRecordRefField" value="${buttonConfig.subRecordRefField || ''}" placeholder="ex: ref_parent">
                </div>
                <div class="form-group">
                    <label>Drawer Configuration:</label>
                    <select class="action-sub-record-config-id" data-prop="subRecordConfigId">
                        <option value="">-- Default / All Fields --</option>
                        ${drawerConfigs.map(c => `<option value="${c.configId}" ${buttonConfig.subRecordConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`).join('')}
                    </select>
                </div>
            `; 
        } 
        else if (buttonConfig.actionType === 'moveRecord') {
            if (!state.enableOrder || !state.orderColumn) {
                container.innerHTML = `
                    <div class="alert alert-warning" style="font-size: 0.85em; padding: 10px; border-radius: 6px; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e;">
                        <strong>⚠️ Requisito:</strong> Esta ação exige que a ordenação esteja habilitada na aba <b>Fields & Layout</b> e que uma coluna numérica de ordem seja selecionada.
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="alert alert-success" style="font-size: 0.85em; padding: 10px; border-radius: 6px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
                        ✅ Alça de arraste configurada (usando coluna: <b>${state.orderColumn}</b>).
                    </div>
                `;
            }
        }
        else if (buttonConfig.actionType === 'showTooltipField') { container.innerHTML = `<div class="form-group"><label>Field:</label><select class="action-tooltip-field" data-prop="tooltipField"><option value="">-- Select --</option>${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.tooltipField === col ? 'selected' : ''}>${col}</option>`).join('')}</select></div>`; }
    }

    async function openFieldStylePopup(fieldDef, fieldSchema, gridEl, tabEl) {
        if (_fieldStylePopup && _fieldStylePopup.parentNode) _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
        const backdrop = document.createElement('div'); backdrop.className = 'popup-backdrop'; backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 1050;`; _mainContainer.appendChild(backdrop);
        _fieldStylePopup = document.createElement("div"); _fieldStylePopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); max-height: 80vh; overflow-y: auto;`;
        const isRefList = fieldSchema && fieldSchema.type.startsWith('RefList:');
        let refListOptionsHtml = '';
        if (isRefList) {
            const currentRefListConfig = fieldDef.style.refListConfig || {};
            refListOptionsHtml = `<hr><h4>RefList Options</h4><div class="form-group"><label>Display As:</label><select id="fs-reflist-display-as"><option value="table" ${currentRefListConfig.displayAs === 'table' ? 'selected' : ''}>Table</option><option value="cards" ${currentRefListConfig.displayAs === 'cards' ? 'selected' : ''}>Cards</option><option value="tabulator" ${currentRefListConfig.displayAs === 'tabulator' ? 'selected' : ''}>Complex Table</option></select></div><div class="form-group" id="fs-reflist-card-config-group" style="display: ${currentRefListConfig.displayAs === 'cards' ? 'block' : 'none'};"><label>Card Config ID:</label><select id="fs-reflist-card-config-id" class="form-control"><option value="">-- Select --</option>${allConfigs.filter(c => c.componentType === 'Card System').map(c => `<option value="${c.configId}" ${currentRefListConfig.cardConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`).join('')}</select></div><div class="form-group" id="fs-reflist-tabulator-config-group" style="display: ${currentRefListConfig.displayAs === 'tabulator' ? 'block' : 'none'};"><label>Tabulator Config ID:</label><select id="fs-reflist-tabulator-config-id" class="form-control"><option value="">-- Select --</option>${allConfigs.filter(c => c.componentType === 'Table').map(c => `<option value="${c.configId}" ${currentRefListConfig.tabulatorConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`).join('')}</select></div>`;
        }

        // Generate widget options based on field type
        const fieldType = fieldSchema ? fieldSchema.type : 'Text';
        const allGristColumns = (state.fields || []).map(f => f.colId);
        console.log(`[CardConfigEditor] Opening style popup for ${fieldDef.colId}. Type: ${fieldType}`);

        const isNumeric = ['Int', 'Float', 'Numeric', 'Any'].some(t => fieldType.startsWith(t));
        const isBoolean = fieldType === 'Bool';
        const isChoice = fieldType.includes('Choice');
        const isTextLike = !isBoolean; // Quase tudo pode ser texto ou renderizado como tal

        let widgetOptionsHtml = '<option value="">Default (Auto)</option>';
        
        // Toggles: Para campos lógicos ou de escolha
        if (isBoolean || isChoice || fieldType === 'Any') {
            widgetOptionsHtml += '<option value="Toggle Switch">Toggle Switch</option>';
        }
        
        // Progress & Money: Para campos numéricos ou genéricos
        if (isNumeric || fieldType === 'Any') {
            widgetOptionsHtml += '<option value="Progress Bar">Progress Bar</option>';
            widgetOptionsHtml += '<option value="Money">Moeda (BRL R$)</option>';
        }
        
        // Color Picker: Quase qualquer campo pode conter um HEX
        if (!isBoolean) {
             widgetOptionsHtml += '<option value="Color Picker">Color Picker</option>';
        }
        
        // Widgets de Texto / Imagem / Protocolos
        if (isTextLike) {
             widgetOptionsHtml += '<option value="Dynamic UI">Dynamic UI (JSON)</option>';
             widgetOptionsHtml += '<option value="Image">Imagem (URL/Anexo)</option>';
             widgetOptionsHtml += '<option value="Indicator JSON">Indicadores (Performance JSON)</option>';
        }

        _fieldStylePopup.innerHTML = `
            <style>
                .col-manager-card { display: flex; align-items: center; background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; padding: 5px; margin-bottom: 5px; cursor: grab; }
                .col-manager-card.dragging { opacity: 0.5; }
                .col-manager-handle { margin-right: 8px; cursor: grab; }
                .col-manager-label { flex-grow: 1; }
                .col-manager-sort { margin-left: 8px; cursor: pointer; width: 20px; text-align: center; }
                .col-manager-sort.asc::after { content: '▲'; color: green; }
                .col-manager-sort.desc::after { content: '▼'; color: red; }
            </style>
            <div class="field-style-popup-content">
                <h3 style="margin-top:0;">Style: ${fieldDef.colId}</h3>
                <div><label><input type="checkbox" id="fs-use-grist-style"> Use Grist Field Style</label></div>
                <p class="help-text">If unchecked, the field will be rendered as simple text.</p>
                
                <hr>
                <h4>Widget</h4>
                <div class="form-group">
                    <label>Widget Type:</label>
                    <select id="fs-widget-type">
                        ${widgetOptionsHtml}
                    </select>
                </div>
                <div id="fs-widget-options-container" style="display: none; border: 1px solid #eee; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <!-- Widget specific options will be rendered here -->
                </div>

                <hr>
                <h4>Data Font Style</h4>
                <div class="form-group">
                    <label>Font Family:</label>
                    <select id="fs-data-font">
                        <option value="">Inherit (Default)</option>
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Font Size (px):</label>
                    <input type="number" id="fs-data-size" min="8" style="width: 60px;" placeholder="Default">
                </div>
                <div class="form-group">
                    <label>Font Color:</label>
                    <input type="color" id="fs-data-color" value="#000000"> 
                    <label><input type="checkbox" id="fs-data-color-default" checked> Use Default</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="fs-data-bold"> Bold</label>
                    <label><input type="checkbox" id="fs-data-italic" style="margin-left: 15px;"> Italic</label>
                    <label><input type="checkbox" id="fs-data-allcaps" style="margin-left: 15px;"> All Caps</label>
                </div>

                <hr>
                <div><label>Card Rows: <input type="number" id="fs-card-rows" min="1" style="width:50px;"></label></div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label><input type="checkbox" id="fs-lv"> Show Label</label>
                    <label><input type="checkbox" id="fs-label-allcaps"> Label All Caps</label>
                </div>
                <div>Label Position: <label><input type="radio" name="fs-lp" value="above"> Above</label> <label><input type="radio" name="fs-lp" value="left"> Left</label> </div>
                <div>Data Justification: <select id="fs-dj"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select> </div>
                <div><label><input type="checkbox" id="fs-hl"> Limit Height</label></div>
                <div id="fs-hl-rows" style="display:none;"><label>Max Rows: <input type="number" id="fs-hr" min="1" style="width:50px;"></label></div>
                <hr>
                <div><label><input type="checkbox" id="fs-itf"> Is a Title Field</label></div>
                <p class="help-text">Title Fields appear in the Top Bar if it's enabled.</p>
                ${refListOptionsHtml}
                <div class="popup-actions">
                    <button id="fs-cancel" type="button" class="btn btn-secondary">Cancel</button>
                    <button id="fs-save" type="button" class="btn btn-primary">Save</button>
                </div>
            </div>
        `;
        _mainContainer.appendChild(_fieldStylePopup);
        
        const s = { ...DEFAULT_FIELD_STYLE, ...fieldDef.style };
        const widgetSelect = _fieldStylePopup.querySelector('#fs-widget-type');
        const widgetOptionsContainer = _fieldStylePopup.querySelector('#fs-widget-options-container');
        let tempWidgetOptions = s.widgetOptions ? JSON.parse(JSON.stringify(s.widgetOptions)) : {};

        const renderWidgetOptions = () => {
            const widgetType = widgetSelect.value;
            widgetOptionsContainer.innerHTML = '';
            widgetOptionsContainer.style.display = widgetType ? 'block' : 'none';

            if (widgetType === 'Toggle Switch') {
                widgetOptionsContainer.innerHTML = `
                    <div class="form-group"><label>On Color:</label><input type="color" id="fs-toggle-on-color" value="${tempWidgetOptions.onColor || '#198754'}"></div>
                    <div class="form-group"><label>Off Color:</label><input type="color" id="fs-toggle-off-color" value="${tempWidgetOptions.offColor || '#ced4da'}"></div>
                    <div class="form-group"><label><input type="checkbox" id="fs-toggle-labels" ${tempWidgetOptions.showLabels !== false ? 'checked' : ''}> Show Yes/No Labels</label></div>
                `;
                widgetOptionsContainer.querySelector('#fs-toggle-on-color').onchange = e => tempWidgetOptions.onColor = e.target.value;
                widgetOptionsContainer.querySelector('#fs-toggle-off-color').onchange = e => tempWidgetOptions.offColor = e.target.value;
                widgetOptionsContainer.querySelector('#fs-toggle-labels').onchange = e => tempWidgetOptions.showLabels = e.target.checked;
            } else if (widgetType === 'Progress Bar') {
                const isCircular = tempWidgetOptions.progressType === 'circular';
                const showInternal = tempWidgetOptions.showInternalBar;

                const getFilteredPresets = (type) => {
                    return allConfigs.filter(c => {
                        if (c.componentType !== 'Progress Bar') return false;
                        try {
                            const data = JSON.parse(c.stylingJson || c.configJson || '{}');
                            return (data.progressType || 'linear') === type;
                        } catch(e) { return type === 'linear'; }
                    });
                };

                const extPresets = getFilteredPresets(isCircular ? 'circular' : 'linear');
                const intPresets = getFilteredPresets('circular');

                const renderBarStylingBlock = (prefix, isInternal = false) => {
                    const presetId = isInternal ? tempWidgetOptions.internalBarPreset : tempWidgetOptions.progressBarPreset;
                    const colorPresetId = isInternal ? (tempWidgetOptions.internalColorPaletteId || tempWidgetOptions.internalColorPalette) : (tempWidgetOptions.colorPaletteId || tempWidgetOptions.colorPalette);
                    const presets = isInternal ? intPresets : extPresets;
                    const hasPreset = !!(presetId && presets.some(p => p.configId === presetId));
                    const labelPos = isInternal ? tempWidgetOptions.internalLabelPosition : tempWidgetOptions.labelPosition;

                    const curMainColor = isInternal ? tempWidgetOptions.internalMainColor : tempWidgetOptions.mainColor;
                    const curBgColor = isInternal ? tempWidgetOptions.internalBgColor : tempWidgetOptions.bgColor;
                    const curShowBg = (isInternal ? tempWidgetOptions.internalShowBgColor : tempWidgetOptions.showBgColor) !== false;
                    const curRadius = (isInternal ? tempWidgetOptions.internalBorderRadius : tempWidgetOptions.borderRadius) ?? 4;
                    const curThick = (isInternal ? tempWidgetOptions.internalThickness : tempWidgetOptions.thickness) || "100";
                    const curMode = (isInternal ? tempWidgetOptions.internalColorMode : tempWidgetOptions.colorMode) || 'solid';

                    return `
                        <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #cbd5e1;">
                            <div class="form-group">
                                <label style="font-weight: bold; color: #475569;">PRESET:</label>
                                <select id="${prefix}-preset" style="width:100%;">
                                    <option value="">-- Personalizado --</option>
                                    ${presets.map(c => `<option value="${c.configId}" ${presetId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="font-size: 11px;">COLOR PRESET:</label>
                                <select id="${prefix}-color-palette" style="width: 100%; font-size: 11px;">
                                    <option value="">-- Custom --</option>
                                    ${allConfigs.filter(c => c.componentType === 'Color Options').map(c => `<option value="${c.configId}" ${colorPresetId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="font-size: 11px;">POS VALOR:</label>
                                <select id="${prefix}-label-pos" style="width:100%; font-size: 11px;">
                                    <option value="middle" ${labelPos === 'middle' ? 'selected' : ''}>Centro (Centro)</option>
                                    <option value="above-in" ${labelPos === 'above-in' ? 'selected' : ''}>Centro (Acima)</option>
                                    <option value="below-in" ${labelPos === 'below-in' ? 'selected' : ''}>Centro (Abaixo)</option>
                                    <option value="left-in" ${labelPos === 'left-in' ? 'selected' : ''}>Centro (Esquerda)</option>
                                    <option value="right-in" ${labelPos === 'right-in' ? 'selected' : ''}>Centro (Direita)</option>
                                    <option value="above" ${labelPos === 'above' ? 'selected' : ''}>Fora (Acima)</option>
                                    <option value="below" ${labelPos === 'below' ? 'selected' : ''}>Fora (Abaixo)</option>
                                    <option value="left" ${labelPos === 'left' ? 'selected' : ''}>Fora (Esquerda)</option>
                                    <option value="right" ${labelPos === 'right' ? 'selected' : ''}>Fora (Direita)</option>
                                </select>
                            </div>

                            <div id="${prefix}-manual-styling" style="opacity: ${hasPreset ? '0.6' : '1'}; pointer-events: ${hasPreset ? 'none' : 'auto'}; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div class="form-group"><label style="font-size: 10px;">Bar Color:</label><input type="color" id="${prefix}-color" value="${curMainColor || '#4caf50'}"></div>
                                    <div class="form-group">
                                        <label style="font-size: 10px;">Track Bg:</label>
                                        <div style="display: flex; gap: 3px; align-items: center;">
                                            <input type="color" id="${prefix}-bgcolor" value="${curBgColor || '#e0e0e0'}" ${curShowBg ? '' : 'disabled'}>
                                            <input type="checkbox" id="${prefix}-show-bg" ${curShowBg ? 'checked' : ''}>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div class="form-group"><label style="font-size: 10px;">Radius:</label><input type="number" id="${prefix}-radius" value="${curRadius}" min="0" style="width:100%; font-size: 11px;"></div>
                                    <div class="form-group"><label style="font-size: 10px;">Thickness:</label>
                                        <select id="${prefix}-thick" style="width:100%; font-size: 11px;">
                                            <option value="50">50%</option>
                                            <option value="75">75%</option>
                                            <option value="100">100%</option>
                                            <option value="150">150%</option>
                                            <option value="200">200%</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="form-group" style="margin-top: 8px;">
                                    <label style="font-size: 10px;">Color Mode:</label>
                                    <select id="${prefix}-mode" style="width:100%; font-size: 11px;">
                                        <option value="solid-fixed" ${curMode === 'solid-fixed' || curMode === 'solid' ? 'selected' : ''}>Sólida Estática</option>
                                        <option value="solid-dynamic" ${curMode === 'solid-dynamic' || curMode === 'dynamic-gradient' ? 'selected' : ''}>Sólida Dinâmica</option>
                                        <option value="solid-thresholds" ${curMode === 'solid-thresholds' ? 'selected' : ''}>Sólida por Degraus</option>
                                        <option value="gradient-smooth" ${curMode === 'gradient-smooth' || curMode === 'static-gradient' ? 'selected' : ''}>Gradiente Suave</option>
                                        <option value="gradient-steps" ${curMode === 'gradient-steps' || curMode === 'steps' ? 'selected' : ''}>Gradiente em Blocos</option>
                                    </select>
                                </div>

                                <div id="${prefix}-stops-container" style="display: ${curMode === 'solid-fixed' || curMode === 'solid' ? 'none' : 'block'}; margin-top: 8px; border: 1px solid #e2e8f0; padding: 5px; border-radius: 4px; background: #fff;">
                                    <label style="font-size: 10px; font-weight: bold;">Color Stops:</label>
                                    <div id="${prefix}-stops-list"></div>
                                    <button id="${prefix}-add-stop" type="button" class="btn btn-sm btn-secondary" style="width: 100%; font-size: 9px; padding: 2px; margin-top: 5px;">+ Add Stop</button>
                                </div>
                                </div>
                                ${!isCircular && !isInternal ? `
                                <div class="form-group" style="display: flex; gap: 10px; margin-top: 5px;">
                                    <label style="font-size: 10px;"><input type="checkbox" id="${prefix}-striped" ${tempWidgetOptions.striped ? 'checked' : ''}> Striped</label>
                                    <label style="font-size: 10px;"><input type="checkbox" id="${prefix}-animated" ${tempWidgetOptions.animated ? 'checked' : ''}> Animated</label>
                                </div>` : ''}
                            </div>
                        </div>
                    `;
                };

                widgetOptionsContainer.innerHTML = `
                    <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <div class="form-group" style="flex: 2; margin-bottom: 0;">
                            <label style="font-weight: bold;">Tipo:</label>
                            <select id="fs-pb-type" style="width:100%">
                                <option value="linear" ${!isCircular ? 'selected' : ''}>Linear</option>
                                <option value="circular" ${isCircular ? 'selected' : ''}>Circular</option>
                            </select>
                        </div>
                        <div style="flex: 1; padding-bottom: 5px;">
                            <label style="font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="fs-pb-show-internal" ${showInternal ? 'checked' : ''}> Barra Interna
                            </label>
                        </div>
                    </div>

                    <div id="fs-pb-circular-layout" style="display: ${isCircular ? 'block' : 'none'}; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; background: #f8fafc; margin-bottom: 15px;">
                        <h5 style="margin-top:0; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Layout (Circular Only)</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                            <div class="form-group"><label style="font-size: 11px;">Size (px):</label><input type="number" id="fs-pb-size" value="${tempWidgetOptions.size ?? 80}" min="20" max="400" style="width:100%; font-size: 11px;"></div>
                            <div class="form-group">
                                <label style="font-size: 11px;">Field Bg:</label>
                                <div style="display: flex; gap: 3px; align-items: center;">
                                    <input type="color" id="fs-pb-field-bg" value="${tempWidgetOptions.fieldBgColor || '#ffffff'}" ${tempWidgetOptions.useFieldBg ? '' : 'disabled'} style="width: 30px; height: 20px;">
                                    <input type="checkbox" id="fs-pb-use-field-bg" ${tempWidgetOptions.useFieldBg ? 'checked' : ''}>
                                </div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                            <div class="form-group"><label style="font-size: 11px;">Border:</label><div style="display: flex; gap: 3px; align-items: center;"><input type="color" id="fs-pb-field-border-color" value="${tempWidgetOptions.fieldBorderColor || '#cbd5e1'}" style="width: 25px; height: 18px;"><input type="number" id="fs-pb-field-border-width" value="${tempWidgetOptions.fieldBorderWidth ?? 0}" min="0" max="10" style="width: 35px; font-size: 11px;"></div></div>
                            <div class="form-group">
                                <label style="font-size: 11px;">Opacity & Shadow:</label>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <input type="range" id="fs-pb-field-opacity" min="0" max="100" value="${(tempWidgetOptions.fieldOpacity ?? 1) * 100}" style="width: 40px;"><span id="fs-pb-field-opacity-val" style="font-size: 9px;">${Math.round((tempWidgetOptions.fieldOpacity ?? 1) * 100)}%</span>
                                    <input type="checkbox" id="fs-pb-field-shadow" ${tempWidgetOptions.fieldShadow ? 'checked' : ''}>
                                </div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label style="font-size: 11px;">Bg Shape:</label>
                                <select id="fs-pb-circular-bg-mode" style="width:100%; font-size: 11px;">
                                    <option value="circle" ${tempWidgetOptions.circularBgMode !== 'box' ? 'selected' : ''}>Circle</option>
                                    <option value="box" ${tempWidgetOptions.circularBgMode === 'box' ? 'selected' : ''}>Box (Quadrado)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="font-size: 11px;">Contorno (Contrast):</label>
                                <select id="fs-pb-circular-outline" style="width:100%; font-size: 11px;">
                                    <option value="none" ${tempWidgetOptions.circularOutline === 'none' || !tempWidgetOptions.circularOutline ? 'selected' : ''}>Nenhum</option>
                                    <option value="black" ${tempWidgetOptions.circularOutline === 'black' ? 'selected' : ''}>Preto</option>
                                    <option value="white" ${tempWidgetOptions.circularOutline === 'white' ? 'selected' : ''}>Branco</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    ${showInternal ? `
                        <div style="margin-bottom: 15px; padding: 8px; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 6px;">
                            <label style="font-size: 11px; font-weight: bold; color: #c53030;">COLUNA INTERNA:</label>
                            <select id="fs-pb-internal-col" style="width: 100%; font-size: 11px;">
                                <option value="">-- Selecione Coluna --</option>
                                ${allGristColumns.map(f => `<option value="${f}" ${tempWidgetOptions.internalBarColId === f ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>
                        <h4 style="font-size: 11px; font-weight: bold; color: #2563eb; margin: 15px 0 5px 0; text-transform: uppercase;">BARRA EXTERNA</h4>
                        ${renderBarStylingBlock('fs-pb-ext', false)}
                        <h4 style="font-size: 11px; font-weight: bold; color: #059669; margin: 15px 0 5px 0; text-transform: uppercase;">BARRA INTERNA</h4>
                        ${renderBarStylingBlock('fs-pb-int', true)}
                    ` : `
                        ${renderBarStylingBlock('fs-pb-ext', false)}
                    `}
                `;

                const setThick = (prefix, val) => { const el = widgetOptionsContainer.querySelector(`#${prefix}-thick`); if (el) el.value = val || "100"; };
                setThick('fs-pb-ext', tempWidgetOptions.thickness);
                if (showInternal) setThick('fs-pb-int', tempWidgetOptions.internalThickness);

                const renderStopsGeneric = (container, stopsArray, onUpdate) => {
                    container.innerHTML = '';
                    if (!stopsArray) return;
                    
                    [...stopsArray].sort((a,b) => a.value - b.value).forEach((stop, index) => {
                        const row = document.createElement('div');
                        row.style.cssText = 'display: flex; align-items: center; gap: 5px; margin-bottom: 5px;';
                        row.innerHTML = `
                            <input type="number" value="${stop.value}" min="0" max="100" style="width: 45px; font-size: 10px;">
                            <input type="color" value="${stop.color}" style="flex-grow: 1; height: 20px;">
                            <button type="button" class="btn-remove" style="border: none; background: none; cursor: pointer; color: red; font-size: 14px;">&times;</button>
                        `;
                        const [valInput, colorInput, removeBtn] = row.querySelectorAll('input, button');
                        
                        valInput.onchange = (e) => {
                            stop.value = parseInt(e.target.value, 10);
                            onUpdate();
                        };
                        colorInput.onchange = (e) => {
                            stop.color = e.target.value;
                            updateDebugJson();
                        };
                        removeBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const actualIdx = stopsArray.indexOf(stop);
                            if (actualIdx > -1) stopsArray.splice(actualIdx, 1);
                            onUpdate();
                        };
                        container.appendChild(row);
                    });
                };

                const setupStylingListeners = (prefix, isInternal) => {
                    const find = id => widgetOptionsContainer.querySelector(`#${prefix}-${id}`);
                    
                    const renderCurrentStops = () => {
                        const list = find('stops-list');
                        const stops = isInternal ? (tempWidgetOptions.internalColorStops || []) : (tempWidgetOptions.colorStops || []);
                        renderStopsGeneric(list, stops, () => {
                            renderCurrentStops();
                            updateDebugJson();
                        });
                    };

                    find('preset').onchange = e => {
                        const val = e.target.value;
                        if (isInternal) tempWidgetOptions.internalBarPreset = val;
                        else tempWidgetOptions.progressBarPreset = val;
                        
                        if (val) {
                            const preset = allConfigs.find(c => c.configId === val);
                            if (preset) {
                                try {
                                    const data = JSON.parse(preset.stylingJson || preset.configJson || '{}');
                                    if (isInternal) {
                                        tempWidgetOptions.internalMainColor = data.mainColor;
                                        tempWidgetOptions.internalBgColor = data.bgColor;
                                        tempWidgetOptions.internalBorderRadius = data.borderRadius;
                                        tempWidgetOptions.internalThickness = data.thickness;
                                        tempWidgetOptions.internalShowBgColor = data.showBgColor !== false;
                                        tempWidgetOptions.internalColorMode = data.colorMode || 'solid';
                                        tempWidgetOptions.internalColorStops = data.colorStops ? JSON.parse(JSON.stringify(data.colorStops)) : null;
                                    } else {
                                        tempWidgetOptions.mainColor = data.mainColor;
                                        tempWidgetOptions.bgColor = data.bgColor;
                                        tempWidgetOptions.borderRadius = data.borderRadius;
                                        tempWidgetOptions.thickness = data.thickness;
                                        tempWidgetOptions.showBgColor = data.showBgColor !== false;
                                        tempWidgetOptions.striped = data.striped;
                                        tempWidgetOptions.animated = data.animated;
                                        tempWidgetOptions.colorMode = data.colorMode || 'solid';
                                        tempWidgetOptions.colorStops = data.colorStops ? JSON.parse(JSON.stringify(data.colorStops)) : null;
                                    }
                                } catch(err) {}
                            }
                        }
                        renderWidgetOptions();
                        updateDebugJson();
                    };

                    find('color-palette').onchange = e => {
                        const val = e.target.value;
                        if (isInternal) tempWidgetOptions.internalColorPaletteId = val;
                        else tempWidgetOptions.colorPaletteId = val;
                        
                        if (val) {
                            const palette = allConfigs.find(c => c.configId === val);
                            if (palette) {
                                try {
                                    const data = JSON.parse(palette.stylingJson || palette.configJson || '{}');
                                    const paletteColors = data.colors || [];
                                    if (paletteColors.length > 0) {
                                        const newStops = paletteColors.map((c, i) => ({
                                            value: paletteColors.length > 1 ? Math.round((i / (paletteColors.length - 1)) * 100) : 0,
                                            color: c.hex
                                        }));
                                        if (isInternal) tempWidgetOptions.internalColorStops = newStops;
                                        else tempWidgetOptions.colorStops = newStops;
                                        
                                        // Ensure mode is dynamic-gradient to show the stops
                                        if (isInternal) tempWidgetOptions.internalColorMode = 'dynamic-gradient';
                                        else tempWidgetOptions.colorMode = 'dynamic-gradient';
                                        
                                        renderWidgetOptions(); // Full refresh to update dropdowns and stops list
                                    }
                                } catch(err) {}
                            }
                        }
                        updateDebugJson();
                    };

                    find('label-pos').onchange = e => {
                        if (isInternal) tempWidgetOptions.internalLabelPosition = e.target.value;
                        else tempWidgetOptions.labelPosition = e.target.value;
                        updateDebugJson();
                    };

                    find('color').onchange = e => {
                        if (isInternal) tempWidgetOptions.internalMainColor = e.target.value;
                        else tempWidgetOptions.mainColor = e.target.value;
                        updateDebugJson();
                    };

                    find('show-bg').onchange = e => {
                        if (isInternal) tempWidgetOptions.internalShowBgColor = e.target.checked;
                        else tempWidgetOptions.showBgColor = e.target.checked;
                        find('bgcolor').disabled = !e.target.checked;
                        updateDebugJson();
                    };

                    find('bgcolor').onchange = e => {
                        if (isInternal) tempWidgetOptions.internalBgColor = e.target.value;
                        else tempWidgetOptions.bgColor = e.target.value;
                        updateDebugJson();
                    };

                    find('radius').oninput = e => {
                        const v = parseInt(e.target.value, 10);
                        if (isInternal) tempWidgetOptions.internalBorderRadius = v;
                        else tempWidgetOptions.borderRadius = v;
                        updateDebugJson();
                    };

                    find('thick').onchange = e => {
                        if (isInternal) tempWidgetOptions.internalThickness = e.target.value;
                        else tempWidgetOptions.thickness = e.target.value;
                        updateDebugJson();
                    };

                    find('mode').onchange = e => {
                        const mode = e.target.value;
                        if (isInternal) tempWidgetOptions.internalColorMode = mode;
                        else tempWidgetOptions.colorMode = mode;
                        
                        find('stops-container').style.display = mode === 'solid' ? 'none' : 'block';
                        if (mode !== 'solid') {
                            const stops = isInternal ? tempWidgetOptions.internalColorStops : tempWidgetOptions.colorStops;
                            if (!stops || stops.length === 0) {
                                const initialStops = [{value: 0, color: '#ff4d4d'}, {value: 100, color: '#4caf50'}];
                                if (isInternal) tempWidgetOptions.internalColorStops = initialStops;
                                else tempWidgetOptions.colorStops = initialStops;
                            }
                            renderCurrentStops();
                        }
                        updateDebugJson();
                    };

                    find('add-stop').onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        let stops = isInternal ? tempWidgetOptions.internalColorStops : tempWidgetOptions.colorStops;
                        if (!stops) {
                            stops = [];
                            if (isInternal) tempWidgetOptions.internalColorStops = stops;
                            else tempWidgetOptions.colorStops = stops;
                        }
                        stops.push({ value: 50, color: '#ffcc00' });
                        renderCurrentStops();
                        updateDebugJson();
                    };

                    const striped = find('striped');
                    if (striped) striped.onchange = e => { tempWidgetOptions.striped = e.target.checked; updateDebugJson(); };
                    const animated = find('animated');
                    if (animated) animated.onchange = e => { tempWidgetOptions.animated = e.target.checked; updateDebugJson(); };

                    // Initial render of stops
                    const mode = isInternal ? (tempWidgetOptions.internalColorMode || 'solid') : (tempWidgetOptions.colorMode || 'solid');
                    if (mode !== 'solid') renderCurrentStops();
                };

                widgetOptionsContainer.querySelector('#fs-pb-type').onchange = e => { tempWidgetOptions.progressType = e.target.value; renderWidgetOptions(); updateDebugJson(); };
                widgetOptionsContainer.querySelector('#fs-pb-show-internal').onchange = e => { tempWidgetOptions.showInternalBar = e.target.checked; renderWidgetOptions(); updateDebugJson(); };
                
                const intCol = widgetOptionsContainer.querySelector('#fs-pb-internal-col');
                if (intCol) intCol.onchange = e => { tempWidgetOptions.internalBarColId = e.target.value; updateDebugJson(); };

                const sz = widgetOptionsContainer.querySelector('#fs-pb-size');
                if (sz) sz.oninput = e => { tempWidgetOptions.size = parseInt(e.target.value, 10); updateDebugJson(); };
                
                const fbg = widgetOptionsContainer.querySelector('#fs-pb-field-bg');
                const ufbg = widgetOptionsContainer.querySelector('#fs-pb-use-field-bg');
                if (ufbg) {
                    ufbg.onchange = e => {
                        tempWidgetOptions.useFieldBg = e.target.checked;
                        fbg.disabled = !e.target.checked;
                        if (e.target.checked && !tempWidgetOptions.fieldBgColor) tempWidgetOptions.fieldBgColor = '#ffffff';
                        updateDebugJson();
                    };
                    fbg.onchange = e => { tempWidgetOptions.fieldBgColor = e.target.value; updateDebugJson(); };
                }

                const fbcol = widgetOptionsContainer.querySelector('#fs-pb-field-border-color');
                const fbw = widgetOptionsContainer.querySelector('#fs-pb-field-border-width');
                if (fbcol) fbcol.onchange = e => { tempWidgetOptions.fieldBorderColor = e.target.value; updateDebugJson(); };
                if (fbw) fbw.oninput = e => { tempWidgetOptions.fieldBorderWidth = parseInt(e.target.value, 10); updateDebugJson(); };
                
                const fop = widgetOptionsContainer.querySelector('#fs-pb-field-opacity');
                if (fop) fop.oninput = e => {
                    tempWidgetOptions.fieldOpacity = parseInt(e.target.value, 10) / 100;
                    widgetOptionsContainer.querySelector('#fs-pb-field-opacity-val').textContent = `${e.target.value}%`;
                    updateDebugJson();
                };
                const fsh = widgetOptionsContainer.querySelector('#fs-pb-field-shadow');
                if (fsh) fsh.onchange = e => { tempWidgetOptions.fieldShadow = e.target.checked; updateDebugJson(); };

                const bgm = widgetOptionsContainer.querySelector('#fs-pb-circular-bg-mode');
                if (bgm) bgm.onchange = e => { tempWidgetOptions.circularBgMode = e.target.value; updateDebugJson(); };
                
                const outl = widgetOptionsContainer.querySelector('#fs-pb-circular-outline');
                if (outl) outl.onchange = e => { tempWidgetOptions.circularOutline = e.target.value; updateDebugJson(); };

                setupStylingListeners('fs-pb-ext', false);
                if (showInternal) setupStylingListeners('fs-pb-int', true);

            } else if (widgetType === 'Image') {
                const sizes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 500];
                const sizeOptions = sizes.map(s => `<option value="${s}" ${tempWidgetOptions.imageSize === String(s) ? 'selected' : ''}>${s}px</option>`).join('');
                
                widgetOptionsContainer.innerHTML = `
                    <div class="form-group">
                        <label>Limit Dimension By:</label>
                        <select id="fs-img-dim" style="width:100%">
                            <option value="width" ${tempWidgetOptions.imageConstraint === 'width' ? 'selected' : ''}>Width</option>
                            <option value="height" ${tempWidgetOptions.imageConstraint === 'height' ? 'selected' : ''}>Height</option>
                            <option value="both" ${tempWidgetOptions.imageConstraint === 'both' ? 'selected' : ''}>Both (Width & Height)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Max Size (Pixels):</label>
                        <select id="fs-img-size" style="width:100%">
                            <option value="">-- Use Default (100%) --</option>
                            ${sizeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Object Fit:</label>
                        <select id="fs-img-fit" style="width:100%">
                            <option value="cover" ${tempWidgetOptions.objectFit === 'cover' ? 'selected' : ''}>Cover (Fill nicely)</option>
                            <option value="contain" ${tempWidgetOptions.objectFit === 'contain' ? 'selected' : ''}>Contain (Show whole image)</option>
                            <option value="scale-down" ${tempWidgetOptions.objectFit === 'scale-down' ? 'selected' : ''}>Scale Down</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Border Radius:</label><input type="text" id="fs-img-br" value="${tempWidgetOptions.borderRadius || '4px'}" placeholder="ex: 4px, 50%"></div>
                `;
                widgetOptionsContainer.querySelector('#fs-img-dim').onchange = e => tempWidgetOptions.imageConstraint = e.target.value;
                widgetOptionsContainer.querySelector('#fs-img-size').onchange = e => tempWidgetOptions.imageSize = e.target.value;
                widgetOptionsContainer.querySelector('#fs-img-fit').onchange = e => tempWidgetOptions.objectFit = e.target.value;
                widgetOptionsContainer.querySelector('#fs-img-br').oninput = e => tempWidgetOptions.borderRadius = e.target.value;
            }
        };

        widgetSelect.value = s.widget || "";
        widgetSelect.addEventListener('change', renderWidgetOptions);
        renderWidgetOptions();

        _fieldStylePopup.querySelector('#fs-card-rows').value = fieldDef.rowSpan || 1;
        _fieldStylePopup.querySelector('#fs-use-grist-style').checked = s.useGristStyle;
        _fieldStylePopup.querySelector('#fs-data-font').value = s.dataStyle?.font || "";
        _fieldStylePopup.querySelector('#fs-data-size').value = s.dataStyle?.size ? parseInt(s.dataStyle.size, 10) : "";
        _fieldStylePopup.querySelector('#fs-data-bold').checked = s.dataStyle?.bold;
        _fieldStylePopup.querySelector('#fs-data-italic').checked = s.dataStyle?.italic;
        _fieldStylePopup.querySelector('#fs-data-allcaps').checked = s.dataStyle?.allCaps;
        _fieldStylePopup.querySelector('#fs-lv').checked = s.labelVisible;
        _fieldStylePopup.querySelector('#fs-label-allcaps').checked = s.labelAllCaps;
        const lpRadio = _fieldStylePopup.querySelector(`input[name="fs-lp"][value="${s.labelPosition || 'above'}"]`);
        if (lpRadio) lpRadio.checked = true;
        _fieldStylePopup.querySelector('#fs-dj').value = s.dataJustify || 'left';
        _fieldStylePopup.querySelector('#fs-hl').checked = s.heightLimited;
        _fieldStylePopup.querySelector('#fs-hr').value = s.maxHeightRows || 1;
        _fieldStylePopup.querySelector('#fs-itf').checked = s.isTitleField;

        const hlCheckbox = _fieldStylePopup.querySelector('#fs-hl');
        const hlRowsDiv = _fieldStylePopup.querySelector('#fs-hl-rows');
        hlCheckbox.onchange = () => hlRowsDiv.style.display = hlCheckbox.checked ? 'block' : 'none';
        hlCheckbox.onchange();

        const colorInput = _fieldStylePopup.querySelector('#fs-data-color'); const colorDefault = _fieldStylePopup.querySelector('#fs-data-color-default');
        if (s.dataStyle?.color) { colorInput.value = s.dataStyle.color; colorDefault.checked = false; } else { colorDefault.checked = true; colorInput.disabled = true; }
        colorDefault.onchange = () => colorInput.disabled = colorDefault.checked;
        _fieldStylePopup.querySelector('#fs-cancel').onclick = () => { backdrop.remove(); _fieldStylePopup.remove(); };
        _fieldStylePopup.querySelector('#fs-save').onclick = () => {
            fieldDef.rowSpan = parseInt(_fieldStylePopup.querySelector('#fs-card-rows').value, 10) || 1;
            fieldDef.style = { 
                ...s, 
                widget: widgetSelect.value, 
                widgetOptions: tempWidgetOptions, 
                useGristStyle: _fieldStylePopup.querySelector('#fs-use-grist-style').checked, 
                labelVisible: _fieldStylePopup.querySelector('#fs-lv').checked,
                labelAllCaps: _fieldStylePopup.querySelector('#fs-label-allcaps').checked,
                labelPosition: _fieldStylePopup.querySelector('input[name="fs-lp"]:checked').value,
                dataJustify: _fieldStylePopup.querySelector('#fs-dj').value,
                heightLimited: _fieldStylePopup.querySelector('#fs-hl').checked,
                maxHeightRows: parseInt(_fieldStylePopup.querySelector('#fs-hr').value, 10) || 1,
                isTitleField: _fieldStylePopup.querySelector('#fs-itf').checked,
                dataStyle: { 
                    font: _fieldStylePopup.querySelector('#fs-data-font').value || null,
                    size: _fieldStylePopup.querySelector('#fs-data-size').value ? `${_fieldStylePopup.querySelector('#fs-data-size').value}px` : null, 
                    color: colorDefault.checked ? null : colorInput.value,
                    bold: _fieldStylePopup.querySelector('#fs-data-bold').checked,
                    italic: _fieldStylePopup.querySelector('#fs-data-italic').checked,
                    allCaps: _fieldStylePopup.querySelector('#fs-data-allcaps').checked
                } 
            };
            if (isRefList) { fieldDef.style.refListConfig = { displayAs: _fieldStylePopup.querySelector('#fs-reflist-display-as').value, cardConfigId: _fieldStylePopup.querySelector('#fs-reflist-card-config-id')?.value, tabulatorConfigId: _fieldStylePopup.querySelector('#fs-reflist-tabulator-config-id')?.value }; }
            backdrop.remove(); _fieldStylePopup.remove(); buildGridUI(gridEl, tabEl); updateDebugJson();
        };
    }

    function buildColumnsManager(container, relatedSchema, currentConfig) { } // Placeholder

    function populateFieldSelect(selectEl, fieldList) { if (!selectEl) return; while (selectEl.options.length > 1) { selectEl.remove(1); } fieldList.forEach(f => { const opt = document.createElement("option"); opt.value = f; opt.textContent = f; selectEl.appendChild(opt); }); }
    return { render, read };
})();
