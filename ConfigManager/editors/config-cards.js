window.CardConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _fieldStylePopup = null;
    let _iconPickerPopup = null;
    let allConfigs = []; // Moved from state to module scope for persistence
    
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
    ]; // 

    function updateDebugJson() {
        if (!_mainContainer) return;
        const outputEl = _mainContainer.querySelector('#config-json-output');
        if (!outputEl) return;
        try {
            const currentConfig = read(_mainContainer);
            outputEl.textContent = JSON.stringify(currentConfig, null, 2);
        } catch (e) {
            outputEl.textContent = "Erro ao ler a configuração: " + e.message;
        }
    }

    async function render(container, config, lens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        allConfigs = receivedConfigs; // Use module-scoped variable
        if (!tableId) { container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>'; return; }
        const schema = await lens.getTableSchema(tableId);
        if (!schema) { container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>'; return; }

        const options = config || {};
        state = {
            layout: JSON.parse(JSON.stringify(options.layout || [])),
            styling: { ...DEFAULT_STYLING, ...(options.styling || {}), selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(options.styling?.selectedCard || {}) } },
            sidePanel: { size: "25%", ...(options.sidePanel || {}) },
            viewMode: options.viewMode || "click",
            numRows: options.numRows || DEFAULT_NUM_ROWS,
            fields: Object.values(schema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos'),
            lens: lens,
            tableId: tableId
        };
        state.layout.forEach(field => { if (!field.style) field.style = { ...DEFAULT_FIELD_STYLE }; });

        // Re-populate actionButtons from the layout configuration on load
        const buttonsFromLayout = state.layout
            .filter(item => item.isActionButton && item.buttonConfig)
            .map(item => item.buttonConfig);
        state.styling.actionButtons = buttonsFromLayout;

        container.innerHTML = "";
        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [createTabButton("Styling", "sty", container), createTabButton("Fields Layout", "fld", container), createTabButton("Actions & Nav", "actions", container)].forEach(t => tabsRow.appendChild(t));
        container.appendChild(tabsRow);
        const debugSection = document.createElement("div");
        debugSection.innerHTML = `<details class="config-debugger"><summary>Ver Configuração JSON (Debug)</summary><pre><code id="config-json-output">{}</code></pre></details>`;
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

    function read(container) {
        // Before saving, ensure the buttonConfig in the layout is up-to-date.
        state.layout.forEach(layoutItem => {
            if (layoutItem.isActionButton) {
                const latestButtonConfig = (state.styling.actionButtons || []).find(b => b.id === layoutItem.colId);
                if (latestButtonConfig) {
                    layoutItem.buttonConfig = latestButtonConfig;
                }
            }
        });

        const newStyling = readStylingTab(container);
        const layoutTab = container.querySelector("[data-tab-section='fld']");
        const viewMode = layoutTab.querySelector("#cs-vm-click").checked ? "click" : "burger";
        const numRows = parseInt(layoutTab.querySelector("#cs-num-rows").value, 10) || DEFAULT_NUM_ROWS;
        const sidePanelTab = container.querySelector("[data-tab-section='actions']");
        const sidePanel = { size: sidePanelTab.querySelector("#cs-sp-size").value, drawerConfigId: sidePanelTab.querySelector("#cs-sp-drawer-config").value || null };
        return { tableId: state.tableId, styling: newStyling, sidePanel, layout: state.layout, viewMode, numRows };
    }

    const DEFAULT_FIELD_STYLE = { labelVisible: true, labelPosition: 'above', labelFont: 'inherit', labelFontSize: 'inherit', labelColor: 'inherit', labelOutline: false, labelOutlineColor: '#ffffff', dataJustify: 'left', heightLimited: false, maxHeightRows: 1, isTitleField: false };
    const DEFAULT_STYLING = { fieldBackground: { enabled: false, lightenPercentage: 15 }, actionButtons: [], groupBoxes: [], widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9", cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0", cardsColorApplyText: false, cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc", cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px", cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px", handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0", widgetPadding: "10px", cardsSpacing: "15px", selectedCard: { enabled: false, scale: 1.05, cardTitleTopBarApplyText: false, colorEffect: "none" } };
    const DEFAULT_NUM_ROWS = 1; const NUM_COLS = 10; const CONFIG_WIDTH = 700; const COL_WIDTH = CONFIG_WIDTH / NUM_COLS;
    
    function createTabButton(label, tabId, container) { const btn = document.createElement("button"); btn.type = "button"; btn.textContent = label; btn.className = 'config-tab-button'; btn.addEventListener("click", () => switchTab(tabId, container)); btn.dataset.tabId = tabId; return btn; }
    function switchTab(tabId, container) { const contentDiv = container.querySelector("#card-config-contents"); if (!contentDiv) return; contentDiv.querySelectorAll("[data-tab-section]").forEach(t => (t.style.display = "none")); container.querySelectorAll("[data-tab-id]").forEach(b => b.classList.remove('active')); const newActiveTab = contentDiv.querySelector(`[data-tab-section='${tabId}']`); if (newActiveTab) newActiveTab.style.display = "block"; const activeBtn = container.querySelector(`[data-tab-id='${tabId}']`); if (activeBtn) activeBtn.classList.add('active'); }
    
    // Helper function to render the UI for all action buttons
    function renderActionButtonsUI(container, actionButtons) {
        container.innerHTML = ''; // Clear previous content
        if (!actionButtons || actionButtons.length === 0) {
            container.innerHTML = '<p class="help-text">Nenhum bot\u00e3o de a\u00e7\u00e3o configurado. Clique em \"+ Add Action Button\" para adicionar um.</p>';
            return;
        }

        actionButtons.forEach((buttonConfig, index) => {
            const buttonEl = document.createElement('div');
            buttonEl.className = 'action-button-item';
            buttonEl.dataset.index = index;
            buttonEl.innerHTML = `
                <div class="action-button-item-header">
                    <strong>Bot\u00e3o de A\u00e7\u00e3o #${index + 1}</strong>
                    <button type="button" class="btn-remove-item" data-index="${index}">Remover</button>
                </div>
                <div class="form-group">
                    <label>\u00cdcone:</label>
                    <div class="icon-picker-display">
                        <span class="current-icon">${buttonConfig.icon ? `<svg class="icon"><use href="#${buttonConfig.icon}"></use></svg>` : 'Nenhum'}</span>
                        <button type="button" class="btn-open-icon-picker" data-index="${index}">Selecionar \u00cdcone</button>
                    </div>
                    <input type="hidden" class="action-icon" value="${buttonConfig.icon || ''}">
                </div>
                <div class="form-group">
                    <label>Tooltip:</label>
                    <input type="text" class="action-tooltip" data-prop="tooltip" value="${buttonConfig.tooltip || ''}" placeholder="ex: Ver Planos de A\u00e7\u00e3o">
                </div>
                <div class="form-group">
                    <label>Tipo de A\u00e7\u00e3o:</label>
                    <select class="action-type" data-prop="actionType">
                        <option value="navigateToGristPage" ${buttonConfig.actionType === 'navigateToGristPage' ? 'selected' : ''}>Navegar para P\u00e1gina Grist</option>
                        <option value="openUrlFromColumn" ${buttonConfig.actionType === 'openUrlFromColumn' ? 'selected' : ''}>Abrir URL de uma Coluna</option>
                        <option value="updateRecord" ${buttonConfig.actionType === 'updateRecord' ? 'selected' : ''}>Atualizar Registro (Grist)</option>
                    </select>
                </div>
                <div class="action-specific-config" data-index="${index}">
                    </div>
            `;
            container.appendChild(buttonEl);

            // --- NEW UNIFIED EVENT HANDLING ---
            buttonEl.addEventListener('change', (e) => {
                if (e.target.dataset.prop) {
                    const prop = e.target.dataset.prop;
                    buttonConfig[prop] = e.target.value;

                    // If the actionType changed, we need to re-render the specific config section
                    if (prop === 'actionType') {
                        renderActionSpecificConfig(buttonEl.querySelector('.action-specific-config'), buttonConfig, index);
                    }
                    updateDebugJson();
                }
            });

            // Adicionar event listener para o seletor de ícones
            const iconPickerBtn = buttonEl.querySelector('.btn-open-icon-picker');
            iconPickerBtn.addEventListener('click', (e) => {
                const iconInput = e.currentTarget.closest('.action-button-item').querySelector('.action-icon');
                const iconDisplay = e.currentTarget.closest('.icon-picker-display').querySelector('.current-icon');
                openIconPicker(iconInput, iconDisplay, buttonConfig);
            });

            // Initial render of action-specific config
            renderActionSpecificConfig(buttonEl.querySelector('.action-specific-config'), buttonConfig, index);
        });
    }

    // Helper function to render action-specific configuration fields
    async function renderActionSpecificConfig(container, buttonConfig, index) {
        container.innerHTML = ''; // Clear previous content
        const allGristPages = await state.lens.listAllTables(); // Assuming state.lens is available
        const allGristColumns = (state.fields || []).map(f => f.colId); // Assuming state.fields is available

        if (buttonConfig.actionType === 'navigateToGristPage') {
            container.innerHTML = `
                <div class="form-group">
                    <label>P\u00e1gina de Destino:</label>
                    <select class="action-target-page" data-prop="targetPageId">
                        <option value="">-- Selecione uma P\u00e1gina --</option>
                        ${allGristPages.map(p => `<option value="${p.id}" ${buttonConfig.targetPageId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Coluna de Filtro na P\u00e1gina de Destino:</label>
                    <input type="text" class="action-target-filter-column" data-prop="targetFilterColumn" value="${buttonConfig.targetFilterColumn || ''}" placeholder="ex: id_risco">
                </div>
                <div class="form-group">
                    <label>Valor do Filtro (deste Card):</label>
                    <select class="action-source-value-column" data-prop="sourceValueColumn">
                        <option value="">-- Selecione uma Coluna --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.sourceValueColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (buttonConfig.actionType === 'openUrlFromColumn') {
            container.innerHTML = `
                <div class="form-group">
                    <label>Coluna com a URL:</label>
                    <select class="action-url-column" data-prop="urlColumn">
                        <option value="">-- Selecione uma Coluna --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.urlColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (buttonConfig.actionType === 'updateRecord') {
            container.innerHTML = `
                <div class="form-group">
                    <label>Campo a Atualizar:</label>
                    <select class="action-update-field" data-prop="updateField">
                        <option value="">-- Selecione um Campo --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${buttonConfig.updateField === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Novo Valor:</label>
                    <input type="text" class="action-update-value" data-prop="updateValue" value="${buttonConfig.updateValue || ''}" placeholder="ex: Completo">
                </div>
            `;
        }
    }

    // NOVA FUNÇÃO: Seletor de Ícones
    function openIconPicker(inputElement, displayElement, buttonConfig) {
        if (_iconPickerPopup && _iconPickerPopup.parentNode) { _iconPickerPopup.parentNode.removeChild(_iconPickerPopup); }

        _iconPickerPopup = document.createElement("div");
        _iconPickerPopup.className = 'icon-picker-popup';
        _iconPickerPopup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
            z-index: 1070; padding: 15px; background: white; border: 1px solid #ccc; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 600px; max-height: 500px; 
            overflow-y: auto; border-radius: 5px;
        `;

        const iconsHtml = AVAILABLE_ICONS.map(iconId => `
            <div class="icon-option" data-icon-id="${iconId}" title="${iconId}">
                <svg class="icon"><use href="#${iconId}"></use></svg>
            </div>
        `).join('');

        _iconPickerPopup.innerHTML = `
            <h4 style="margin-top: 0;">Selecione um Ícone</h4>
            <div class="icon-grid" style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${iconsHtml}
            </div>
            <div style="text-align: right; margin-top: 15px;">
                <button id="icon-picker-cancel" type="button" class="btn btn-secondary">Cancelar</button>
            </div>
        `;
        
        _mainContainer.appendChild(_iconPickerPopup);

        _iconPickerPopup.querySelectorAll('.icon-option').forEach(iconEl => {
            iconEl.addEventListener('click', () => {
                const selectedIcon = iconEl.dataset.iconId;
                
                // 1. Atualizar o valor no campo de entrada oculto
                inputElement.value = selectedIcon;
                
                // 2. Atualizar o display visual
                displayElement.innerHTML = `<svg class="icon"><use href="#${selectedIcon}"></use></svg>`;
                
                // 3. Atualizar a configuração interna
                buttonConfig.icon = selectedIcon;
                updateDebugJson();

                // 4. Fechar o pop-up
                _iconPickerPopup.parentNode.removeChild(_iconPickerPopup);
                _iconPickerPopup = null;
            });
        });

        _iconPickerPopup.querySelector('#icon-picker-cancel').addEventListener('click', () => {
            _iconPickerPopup.parentNode.removeChild(_iconPickerPopup);
            _iconPickerPopup = null;
        });
    }


    function buildStylingTab(contentArea) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "sty";
        tabEl.style.display = "none";
        tabEl.innerHTML = `
            <h3>Styling Options</h3>
            <div class="styling-grid">
                <fieldset>
                    <legend><b>Widget Background</b></legend>
                    <label><input type="radio" name="bgmode" value="solid"> Solid</label>
                    <label><input type="radio" name="bgmode" value="gradient"> Gradient</label>
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
                    <label><input type="radio" name="cardscolormode" value="conditional"> By Field</label>
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
                </fieldset>
                <fieldset><legend><b>Card Border</b></legend>Thickness (px): <input type="number" id="cs-st-border-thickness" min="0" style="width:60px"> <br><label><input type="radio" name="bordermode" value="solid"> Solid</label> <label><input type="radio" name="bordermode" value="conditional"> By Field</label><div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-border-color"></div><div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-border-field"><option value="">-- field --</option></select></div></fieldset>
                <fieldset class="title-control-group" data-title-mode="no-bar"><legend><b>Card Title (when Top Bar is OFF)</b></legend>Color: <input type="color" id="cs-st-titlecolor"> Font: <select id="cs-st-titlefont"><option>Calibri</option><option>Arial</option><option>Times New Roman</option></select> Size: <input type="number" id="cs-st-titlesize" min="8" style="width:60px">px</fieldset>
                <fieldset><legend><b>Handle Area</b></legend>Width (px): <input type="number" id="cs-st-handle-width" min="1" style="width:60px"> <br><label><input type="radio" name="handlemode" value="solid"> Solid</label> <label><input type="radio" name="handlemode" value="conditional"> By Field</label><div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-handle-color"></div><div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-handle-field"><option value="">-- field --</option></select></div></fieldset>
                <fieldset><legend><b>Layout Spacing</b></legend>Widget Padding (px): <input type="number" id="cs-st-padding" min="0" style="width:60px"> <br>Card Spacing (px): <input type="number" id="cs-st-spacing" min="0" style="width:60px"></fieldset>
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
            Font: <select id="cs-st-topbar-lblfont"><option>Calibri</option><option>Arial</option></select> <br>
            Size: <input type="number" id="cs-st-topbar-lblsize" min="8" style="width:60px">px
        </div>
        <div>
            <b>Data Style:</b> <br>
            Color: <input type="color" id="cs-st-topbar-datacolor"> <br>
            Font: <select id="cs-st-topbar-datafont"><option>Calibri</option><option>Arial</option></select> <br>
            Size: <input type="number" id="cs-st-topbar-datasize" min="8" style="width:60px">px
        </div>
    </div>
</fieldset>
                <fieldset class="full-width"><legend><b>Selected Card Hover Effect</b></legend><label>Enable: <input type="checkbox" id="cs-st-sel-enabled"></label> <label style="margin-left: 20px;">Scale: <input type="number" id="cs-st-sel-scale" min="0" max="100" style="width:60px">%</label></fieldset>
            </div>
        `;
        contentArea.appendChild(tabEl);
        const setupModeSwitcher = (fieldset) => { const radios = fieldset.querySelectorAll('input[type="radio"]'); radios.forEach(radio => { radio.addEventListener('change', () => { const selectedMode = radio.value; fieldset.querySelectorAll('.style-control-group').forEach(group => { group.style.display = group.dataset.mode === selectedMode ? '' : 'none'; }); }); }); };
        tabEl.querySelectorAll('fieldset').forEach(setupModeSwitcher);
        const topBarCheckbox = tabEl.querySelector('#cs-st-topbar-enabled');
        const topBarConfigDiv = tabEl.querySelector('.top-bar-config');
        const noBarTitleFieldset = tabEl.querySelector('[data-title-mode="no-bar"]');
        const toggleTitleControls = () => { const isEnabled = topBarCheckbox.checked; topBarConfigDiv.style.display = isEnabled ? 'flex' : 'none'; noBarTitleFieldset.disabled = isEnabled; noBarTitleFieldset.style.opacity = isEnabled ? '0.5' : '1'; };
        topBarCheckbox.addEventListener('change', toggleTitleControls);

        // Handle enabling/disabling of Top Bar color controls based on "Apply text color"
        const topBarApplyTextCheckbox = tabEl.querySelector('#cs-st-topbar-apply-text');
        const topBarModeRadios = tabEl.querySelectorAll('input[name="topbarmode"]');
        const lblColorInput = tabEl.querySelector('#cs-st-topbar-lblcolor');
        const dataColorInput = tabEl.querySelector('#cs-st-topbar-datacolor');

        const updateTopBarColorInputsState = () => {
            const isConditional = tabEl.querySelector('input[name="topbarmode"][value="conditional"]').checked;
            const applyTextColor = topBarApplyTextCheckbox.checked;
            const shouldDisable = isConditional && applyTextColor;

            // The inputs are inside a div with other elements, so let's target the parent div to style it.
            const lblContainer = lblColorInput.closest('div');
            const dataContainer = dataColorInput.closest('div');

            if (lblContainer) {
                lblColorInput.disabled = shouldDisable;
                lblContainer.style.opacity = shouldDisable ? 0.5 : 1;
                lblContainer.style.pointerEvents = shouldDisable ? 'none' : 'auto';
            }
            if (dataContainer) {
                dataColorInput.disabled = shouldDisable;
                dataContainer.style.opacity = shouldDisable ? 0.5 : 1;
                dataContainer.style.pointerEvents = shouldDisable ? 'none' : 'auto';
            }
        };

        topBarApplyTextCheckbox.addEventListener('change', updateTopBarColorInputsState);
        topBarModeRadios.forEach(radio => radio.addEventListener('change', updateTopBarColorInputsState));
        const allFields = state.fields.map(f => f.colId);
        populateFieldSelect(tabEl.querySelector("#cs-st-cardscolorfield"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-border-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-topbar-field"), allFields);
        populateFieldSelect(tabEl.querySelector("#cs-st-handle-field"), allFields);
        populateStylingTab(tabEl);
        toggleTitleControls();
        tabEl.querySelectorAll('input[type="radio"]:checked').forEach(radio => { if(radio) radio.dispatchEvent(new Event('change')) });

        const fieldBgCheckbox = tabEl.querySelector('#cs-st-fieldbg-enabled');
        const fieldBgControls = tabEl.querySelector('#cs-st-fieldbg-controls');
        fieldBgCheckbox.addEventListener('change', () => {
            fieldBgControls.style.display = fieldBgCheckbox.checked ? 'block' : 'none';
        });
    }

    function populateStylingTab(tabEl) { const s = state.styling; let bgModeInput = tabEl.querySelector(`input[name='bgmode'][value='${s.widgetBackgroundMode}']`); if (bgModeInput) { bgModeInput.checked = true; } else { tabEl.querySelector("input[name='bgmode'][value='solid']").checked = true; } tabEl.querySelector("#cs-st-bgcolor").value = s.widgetBackgroundSolidColor; tabEl.querySelector("#cs-st-bggradient-type").value = s.widgetBackgroundGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-bggradient-c1").value = s.widgetBackgroundGradientColor1 || '#f9f9f9'; tabEl.querySelector("#cs-st-bggradient-c2").value = s.widgetBackgroundGradientColor2 || '#e9e9e9'; tabEl.querySelector(`input[name='cardscolormode'][value='${s.cardsColorMode}']`).checked = true; tabEl.querySelector("#cs-st-cardcolor").value = s.cardsColorSolidColor; tabEl.querySelector("#cs-st-cardgradient-type").value = s.cardsColorGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-cardgradient-c1").value = s.cardsColorGradientColor1 || '#ffffff'; tabEl.querySelector("#cs-st-cardgradient-c2").value = s.cardsColorGradientColor2 || '#f0f0f0'; tabEl.querySelector("#cs-st-cardscolorfield").value = s.cardsColorField || ""; tabEl.querySelector("#cs-st-cardscolor-apply-text").checked = s.cardsColorApplyText === true; tabEl.querySelector("#cs-st-border-thickness").value = s.cardBorderThickness; tabEl.querySelector(`input[name='bordermode'][value='${s.cardBorderMode}']`).checked = true; tabEl.querySelector("#cs-st-border-color").value = s.cardBorderSolidColor; tabEl.querySelector("#cs-st-border-field").value = s.cardBorderField || ""; tabEl.querySelector("#cs-st-titlecolor").value = s.cardTitleFontColor; tabEl.querySelector("#cs-st-titlefont").value = s.cardTitleFontStyle; tabEl.querySelector("#cs-st-titlesize").value = parseInt(s.cardTitleFontSize, 10); tabEl.querySelector("#cs-st-topbar-enabled").checked = s.cardTitleTopBarEnabled; tabEl.querySelector(`input[name='topbarmode'][value='${s.cardTitleTopBarMode}']`).checked = true; tabEl.querySelector("#cs-st-topbar-color").value = s.cardTitleTopBarSolidColor; tabEl.querySelector("#cs-st-topbargradient-type").value = s.cardTitleTopBarGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-topbargradient-c1").value = s.cardTitleTopBarGradientColor1 || '#dddddd'; tabEl.querySelector("#cs-st-topbargradient-c2").value = s.cardTitleTopBarGradientColor2 || '#cccccc'; tabEl.querySelector("#cs-st-topbar-field").value = s.cardTitleTopBarField || ""; tabEl.querySelector("#cs-st-topbar-apply-text").checked = s.cardTitleTopBarApplyText === true;tabEl.querySelector("#cs-st-topbar-lblcolor").value = s.cardTitleTopBarLabelFontColor; tabEl.querySelector("#cs-st-topbar-lblfont").value = s.cardTitleTopBarLabelFontStyle; tabEl.querySelector("#cs-st-topbar-lblsize").value = parseInt(s.cardTitleTopBarLabelFontSize, 10); tabEl.querySelector("#cs-st-topbar-datacolor").value = s.cardTitleTopBarDataFontColor; tabEl.querySelector("#cs-st-topbar-datafont").value = s.cardTitleTopBarDataFontStyle; tabEl.querySelector("#cs-st-topbar-datasize").value = parseInt(s.cardTitleTopBarDataFontSize, 10); tabEl.querySelector("#cs-st-handle-width").value = parseInt(s.handleAreaWidth, 10); tabEl.querySelector(`input[name='handlemode'][value='${s.handleAreaMode}']`).checked = true; tabEl.querySelector("#cs-st-handle-color").value = s.handleAreaSolidColor; tabEl.querySelector("#cs-st-handle-field").value = s.handleAreaField || ""; tabEl.querySelector("#cs-st-padding").value = parseInt(s.widgetPadding, 10); tabEl.querySelector("#cs-st-spacing").value = parseInt(s.cardsSpacing, 10); tabEl.querySelector("#cs-st-sel-enabled").checked = s.selectedCard.enabled;     tabEl.querySelector("#cs-st-sel-scale").value = s.selectedCard ? ((s.selectedCard.scale - 1) * 100).toFixed(0) : 0;
    s.fieldBackground = s.fieldBackground || {};
    tabEl.querySelector("#cs-st-fieldbg-enabled").checked = s.fieldBackground.enabled === true;
    tabEl.querySelector("#cs-st-fieldbg-lighten").value = s.fieldBackground.lightenPercentage || 15; }
    function readStylingTab(container) {
    const tabEl = container.querySelector('[data-tab-section="sty"]');
    const getCheckedValue = (name) => tabEl.querySelector(`input[name='${name}']:checked`)?.value;
    const s = {};
    Object.assign(s, DEFAULT_STYLING);

    const bgMode = getCheckedValue('bgmode');
    s.widgetBackgroundMode = bgMode;
    if (bgMode === 'solid') {
        s.widgetBackgroundSolidColor = tabEl.querySelector("#cs-st-bgcolor").value;
    } else if (bgMode === 'gradient') {
        s.widgetBackgroundGradientType = tabEl.querySelector("#cs-st-bggradient-type").value;
        s.widgetBackgroundGradientColor1 = tabEl.querySelector("#cs-st-bggradient-c1").value;
        s.widgetBackgroundGradientColor2 = tabEl.querySelector("#cs-st-bggradient-c2").value;
    }

    const cardsMode = getCheckedValue('cardscolormode');
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
    }

    s.cardBorderThickness = parseInt(tabEl.querySelector("#cs-st-border-thickness").value, 10) || 0;
    const borderMode = getCheckedValue('bordermode');
    s.cardBorderMode = borderMode;
    if (borderMode === 'solid') {
        s.cardBorderSolidColor = tabEl.querySelector("#cs-st-border-color").value;
    } else if (borderMode === 'conditional') {
        s.cardBorderField = tabEl.querySelector("#cs-st-border-field").value || null;
    }

    s.cardTitleFontColor = tabEl.querySelector("#cs-st-titlecolor").value;
    s.cardTitleFontStyle = tabEl.querySelector("#cs-st-titlefont").value;
    s.cardTitleFontSize = `${parseInt(tabEl.querySelector("#cs-st-titlesize").value, 10) || 20}px`;

    s.cardTitleTopBarEnabled = tabEl.querySelector("#cs-st-topbar-enabled").checked;
    const topBarMode = getCheckedValue('topbarmode');
    s.cardTitleTopBarMode = topBarMode;
    if (topBarMode === 'solid') {
        s.cardTitleTopBarSolidColor = tabEl.querySelector("#cs-st-topbar-color").value;
    } else if (topBarMode === 'gradient') {
        s.cardTitleTopBarGradientType = tabEl.querySelector("#cs-st-topbargradient-type").value;
        s.cardTitleTopBarGradientColor1 = tabEl.querySelector("#cs-st-topbargradient-c1").value;
        s.cardTitleTopBarGradientColor2 = tabEl.querySelector("#cs-st-topbargradient-c2").value;
    } else if (topBarMode === 'conditional') {
        s.cardTitleTopBarField = tabEl.querySelector("#cs-st-topbar-field").value || null;
        s.cardTitleTopBarApplyText = tabEl.querySelector("#cs-st-topbar-apply-text").checked; // <-- CORREÇÃO APLICADA
    }

    s.cardTitleTopBarLabelFontColor = tabEl.querySelector("#cs-st-topbar-lblcolor").value;
    s.cardTitleTopBarLabelFontStyle = tabEl.querySelector("#cs-st-topbar-lblfont").value;
    s.cardTitleTopBarLabelFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-lblsize").value, 10) || 16}px`;
    s.cardTitleTopBarDataFontColor = tabEl.querySelector("#cs-st-topbar-datacolor").value;
    s.cardTitleTopBarDataFontStyle = tabEl.querySelector("#cs-st-topbar-datafont").value;
    s.cardTitleTopBarDataFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-datasize").value, 10) || 16}px`;

    const handleMode = getCheckedValue('handlemode');
    s.handleAreaMode = handleMode;
    if (handleMode === 'solid') {
        s.handleAreaSolidColor = tabEl.querySelector("#cs-st-handle-color").value;
    } else if (handleMode === 'conditional') {
        s.handleAreaField = tabEl.querySelector("#cs-st-handle-field").value || null;
    }

    s.handleAreaWidth = `${parseInt(tabEl.querySelector("#cs-st-handle-width").value, 10) || 8}px`;
    s.widgetPadding = `${parseInt(tabEl.querySelector("#cs-st-padding").value, 10) || 0}px`;
    s.cardsSpacing = `${parseInt(tabEl.querySelector("#cs-st-spacing").value, 10) || 0}px`;
    s.selectedCard = { enabled: tabEl.querySelector("#cs-st-sel-enabled").checked, scale: 1 + ((parseInt(tabEl.querySelector("#cs-st-sel-scale").value, 10) || 0) / 100), colorEffect: "none" };

    s.fieldBackground = {
        enabled: tabEl.querySelector("#cs-st-fieldbg-enabled").checked,
        lightenPercentage: parseInt(tabEl.querySelector("#cs-st-fieldbg-lighten").value, 10) || 15
    };

    s.groupBoxes = state.styling.groupBoxes || [];

    return s;
}
    function buildFieldsLayoutTab(contentArea) {
    const tabEl = document.createElement("div");
    tabEl.dataset.tabSection = "fld";
    tabEl.style.display = "none";
    tabEl.innerHTML = `
            <h3>Fields & Layout</h3>
            <div class="layout-controls">
                <label>View Mode:</label>
                <label><input type="radio" name="cs-viewmode" id="cs-vm-click" value="click" /> Click Card</label>
                <label><input type="radio" name="cs-viewmode" id="cs-vm-burger" value="burger" /> Burger Icon</label>
                <span class="spacer"></span>
                <label>Number of Rows:</label>
                <input type="number" id="cs-num-rows" value="${state.numRows}" min="1" max="20" />
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
    buildGridUI(tabEl.querySelector("#cs-layout-grid"), tabEl);
    buildAvailableFieldsList(tabEl.querySelector("#cs-layout-fields"));

    const addGroupBoxBtn = tabEl.querySelector('#cs-add-group-box-btn');
    addGroupBoxBtn.addEventListener('click', () => {
        if (!Array.isArray(state.styling.groupBoxes)) {
            state.styling.groupBoxes = [];
        }
        const newGroupBox = {
            id: `gbox-${Date.now()}`,
            name: `Group ${state.styling.groupBoxes.length + 1}`,
            backgroundColor: '#e0e0e0',
            row: -1, // Indicates it's not placed on the grid yet
            col: -1,
            colSpan: 3,
            rowSpan: 2,
        };
        state.styling.groupBoxes.push(newGroupBox);
        buildAvailableGroupBoxesList(tabEl.querySelector('#cs-group-box-list'));
        updateDebugJson();
    });

    buildAvailableGroupBoxesList(tabEl.querySelector('#cs-group-box-list'));
    buildGroupBoxGridUI(tabEl.querySelector('#cs-group-box-grid'));
}

function buildAvailableGroupBoxesList(container) {
    if (!container) return;
    container.innerHTML = "";
    const unplacedGroupBoxes = (state.styling.groupBoxes || []).filter(g => g.row === -1);

    if (!unplacedGroupBoxes.length) {
        container.innerHTML = "<i>No available group boxes.</i>";
        return;
    }

    unplacedGroupBoxes.forEach(gbox => {
        const el = document.createElement("div");
        el.className = 'available-field';
        el.textContent = gbox.name;
        el.dataset.gboxid = gbox.id;
        el.draggable = true;
        el.addEventListener("dragstart", e => {
            e.dataTransfer.setData("text/gboxid", gbox.id);
        });
        container.appendChild(el);
    });
}

function buildGroupBoxGridUI(gridEl) {
    if (!gridEl) return;
    gridEl.innerHTML = ""; // Clear previous state
    
    const placedGroupBoxes = (state.styling.groupBoxes || []).filter(g => g.row > -1);

    placedGroupBoxes.forEach(gbox => {
        const box = document.createElement("div");
        box.className = 'layout-group-box'; // You'll need to style this class
        box.style.position = 'absolute';
        box.style.left = (gbox.col * COL_WIDTH) + "px";
        box.style.top = (gbox.row * 40) + "px"; // Assuming 40px row height, adjust as needed
        box.style.width = (gbox.colSpan * COL_WIDTH) + "px";
        box.style.height = (gbox.rowSpan * 40) + "px"; // Assuming 40px row height
        box.style.backgroundColor = gbox.backgroundColor;
        box.style.opacity = 0.7;
        box.style.zIndex = 0;
        box.innerHTML = `<span class="group-box-name">${gbox.name}</span>`;

        const gearIcon = document.createElement("div");
        gearIcon.innerHTML = "⚙️";
        gearIcon.className = 'field-box-icon gear'; // Reuse class
        gearIcon.style.zIndex = "10";
        gearIcon.addEventListener("click", e => {
            e.stopPropagation();
            openGroupBoxStylePopup(gbox);
        });
        box.appendChild(gearIcon);

        const removeIcon = document.createElement("div");
        removeIcon.innerHTML = "✕";
        removeIcon.className = 'field-box-icon remove'; // Reuse class from field boxes
        removeIcon.style.zIndex = "10";
        removeIcon.addEventListener("click", e => {
            e.stopPropagation();
            const idx = state.styling.groupBoxes.findIndex(g => g.id === gbox.id);
            if (idx > -1) {
                state.styling.groupBoxes.splice(idx, 1);
            }
            buildGroupBoxGridUI(gridEl);
            // No need to rebuild available list, as it was already on the grid
            updateDebugJson();
        });
        box.appendChild(removeIcon);

        const handle = document.createElement("div");
        handle.className = 'resize-handle';
        box.appendChild(handle);
        handle.addEventListener("mousedown", e => {
            e.stopPropagation();
            e.preventDefault();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const origW = parseFloat(box.style.width);
            const origH = parseFloat(box.style.height);

            const onMouseMove = moveEvt => {
                let newWidth = origW + (moveEvt.clientX - startX);
                let newHeight = origH + (moveEvt.clientY - startY);
                box.style.width = newWidth + "px";
                box.style.height = newHeight + "px";
            };

            const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                
                let newColSpan = Math.round(parseFloat(box.style.width) / COL_WIDTH);
                let newRowSpan = Math.round(parseFloat(box.style.height) / 40); // Assuming 40px row height

                gbox.colSpan = Math.max(1, Math.min(NUM_COLS - gbox.col, newColSpan));
                gbox.rowSpan = Math.max(1, newRowSpan);

                buildGroupBoxGridUI(gridEl);
                updateDebugJson();
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
        
        gridEl.appendChild(box);
    });
}

function openGroupBoxStylePopup(gbox) {
    if (_fieldStylePopup && _fieldStylePopup.parentNode) {
        _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
    }
    const existingBackdrop = document.querySelector('.popup-backdrop');
    if (existingBackdrop) {
        existingBackdrop.parentNode.removeChild(existingBackdrop);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'popup-backdrop';
    backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 1050;`;
    _mainContainer.appendChild(backdrop);

    _fieldStylePopup = document.createElement("div");
    _fieldStylePopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);`;
    _fieldStylePopup.className = 'field-style-popup'; // Reuse class

    _fieldStylePopup.innerHTML = `
        <h3 style="margin-top:0;">Edit Group Box</h3>
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="gbox-name" value="${gbox.name}" class="form-control">
        </div>
        <div class="form-group">
            <label>Background Color:</label>
            <input type="color" id="gbox-bgcolor" value="${gbox.backgroundColor}">
        </div>
        <div class="popup-actions">
            <button id="gbox-cancel" type="button" class="btn btn-secondary">Cancel</button>
            <button id="gbox-save" type="button" class="btn btn-primary">Save</button>
        </div>
    `;

    _mainContainer.appendChild(_fieldStylePopup);

    const closePopup = () => {
        if (_fieldStylePopup && _fieldStylePopup.parentNode) {
            _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
            _fieldStylePopup = null;
        }
        const backdrop = document.querySelector('.popup-backdrop');
        if (backdrop) {
            backdrop.parentNode.removeChild(backdrop);
        }
    };

    _fieldStylePopup.querySelector('#gbox-cancel').addEventListener('click', closePopup);
    _fieldStylePopup.querySelector('#gbox-save').addEventListener('click', () => {
        gbox.name = _fieldStylePopup.querySelector('#gbox-name').value;
        gbox.backgroundColor = _fieldStylePopup.querySelector('#gbox-bgcolor').value;
        
        closePopup();
        buildGroupBoxGridUI(_mainContainer.querySelector("#cs-group-box-grid"));
        updateDebugJson();
    });
}
    function buildGridUI(gridEl, tabEl) { gridEl.innerHTML = ""; for (let r = 0; r < state.numRows; r++) { const rowDiv = document.createElement("div"); rowDiv.className = 'layout-grid-row'; rowDiv.dataset.rowIndex = String(r); rowDiv.addEventListener("dragover", e => e.preventDefault()); rowDiv.addEventListener("drop", e => {
    e.preventDefault();
    const colId = e.dataTransfer.getData("text/colid");
    const gboxId = e.dataTransfer.getData("text/gboxid");
    const rect = rowDiv.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / COL_WIDTH);

    if (colId) {
        const isActionButton = e.dataTransfer.getData("text/isActionButton") === "true";
        const newLayoutItem = {
            colId,
            row: r,
            col,
            colSpan: isActionButton ? 1 : 2,
            style: { ...DEFAULT_FIELD_STYLE }
        };

        if (isActionButton) {
            newLayoutItem.isActionButton = true;
            const buttonConfig = (state.styling.actionButtons || []).find(b => b.id === colId);
            if (buttonConfig) {
                newLayoutItem.buttonConfig = buttonConfig;
            }
        }

        state.layout.push(newLayoutItem);
        buildGridUI(gridEl, tabEl);
        buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields"));
        updateDebugJson();
    } else if (gboxId) {
        const gbox = (state.styling.groupBoxes || []).find(g => g.id === gboxId);
        if (gbox) {
            gbox.row = r;
            gbox.col = col;
            // Re-render both grids and the available list
            buildGroupBoxGridUI(_mainContainer.querySelector("#cs-group-box-grid"));
            buildAvailableGroupBoxesList(_mainContainer.querySelector("#cs-group-box-list"));
            updateDebugJson();
        }
    }
}); state.layout.filter(f => f.row === r).forEach(f => { rowDiv.appendChild(createFieldBoxInConfigUI(f, gridEl, tabEl)); }); gridEl.appendChild(rowDiv); } }
    function createFieldBoxInConfigUI(fieldDef, gridEl, tabEl) {
        let fieldLabel;
        let fieldSchema;

        if (fieldDef.isActionButton) {
            fieldLabel = `[Botão] ${fieldDef.buttonConfig?.tooltip || fieldDef.colId}`;
        } else {
            fieldSchema = state.fields.find(field => field.colId === fieldDef.colId);
            fieldLabel = fieldSchema ? (fieldSchema.label || fieldSchema.colId) : fieldDef.colId;
        }

        const box = document.createElement("div");
        box.className = 'layout-field-box';
        box.textContent = fieldLabel;
        box.style.left = (fieldDef.col * COL_WIDTH) + "px";
        box.style.width = (fieldDef.colSpan * COL_WIDTH) + "px";
        
        if (!fieldDef.isActionButton) {
            const gearIcon = document.createElement("div");
            gearIcon.innerHTML = "⚙️";
            gearIcon.className = 'field-box-icon gear';
            gearIcon.addEventListener("click", e => {
                e.stopPropagation();
                openFieldStylePopup(fieldDef, fieldSchema);
            });
            box.appendChild(gearIcon);
        }

        const removeIcon = document.createElement("div");
        removeIcon.innerHTML = "✕";
        removeIcon.className = 'field-box-icon remove';
        removeIcon.addEventListener("click", e => {
            e.stopPropagation();
            const idx = state.layout.indexOf(fieldDef);
            if (idx > -1) state.layout.splice(idx, 1);
            buildGridUI(gridEl, tabEl);
            buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields"));
            updateDebugJson();
        });
        box.appendChild(removeIcon);

        box.draggable = true;
        box.addEventListener("dragstart", e => {
            e.dataTransfer.setData("text/colid", fieldDef.colId);
            if (fieldDef.isActionButton) {
                e.dataTransfer.setData("text/isActionButton", "true");
            }
            const idx = state.layout.indexOf(fieldDef);
            if (idx > -1) state.layout.splice(idx, 1);
        });

        const handle = document.createElement("div");
        handle.className = 'resize-handle';
        box.appendChild(handle);
        handle.addEventListener("mousedown", e => {
            e.stopPropagation();
            e.preventDefault();
            box.draggable = false;
            const startX = e.clientX,
                origW = parseFloat(box.style.width);
            const onMouseMove = moveEvt => {
                let newWidth = origW + (moveEvt.clientX - startX);
                box.style.width = newWidth + "px";
            };
            const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                let newSpan = Math.round(parseFloat(box.style.width) / COL_WIDTH);
                fieldDef.colSpan = Math.max(1, Math.min(NUM_COLS - fieldDef.col, newSpan));
                box.draggable = true;
                buildGridUI(gridEl, tabEl);
                updateDebugJson();
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
        return box;
    }
    function buildAvailableFieldsList(container) {
        if (!container) return;
        container.innerHTML = "";
        const usedCols = state.layout.map(l => l.colId);

        // Real fields from the table
        const availableRealFields = state.fields.filter(f => !usedCols.includes(f.colId));

        // Virtual fields for action buttons
        const availableButtonFields = (state.styling.actionButtons || [])
            .filter(btn => !usedCols.includes(btn.id))
            .map(btn => ({
                colId: btn.id,
                label: `[Botão] ${btn.tooltip || 'Nova Ação'}`,
                isActionButton: true
            }));

        const availableCols = [...availableRealFields, ...availableButtonFields];

        if (!availableCols.length) {
            container.innerHTML = "<i>All fields placed.</i>";
            return;
        }

        availableCols.forEach(field => {
            const el = document.createElement("div");
            el.className = 'available-field';
            el.textContent = field.label || field.colId;
            el.dataset.colid = field.colId;
            el.draggable = true;
            el.addEventListener("dragstart", e => {
                e.dataTransfer.setData("text/colid", field.colId);
                if (field.isActionButton) {
                    e.dataTransfer.setData("text/isActionButton", "true");
                }
            });
            container.appendChild(el);
        });
    }
    function buildActionsTab(contentArea) { const tabEl = document.createElement("div"); tabEl.dataset.tabSection = "actions";
        tabEl.style.display = "none";
        tabEl.innerHTML = `
            <h3>Card Actions & Navigation</h3>
            <p>Configure what happens when a user interacts with a card.</p>
            <fieldset>
                <legend>Primary Action (On Card Click)</legend>
                <div class="form-group">
                    <label for="cs-sp-drawer-config">Open Details Panel (Drawer):</label>
                    <select id="cs-sp-drawer-config">
                        <option value="">-- No Action / No Drawer --</option>
                    </select>
                    <p class="help-text">Select a pre-defined 'Drawer' configuration. Create them using the main ConfigManager.</p>
                </div>
                <hr>
                <div class="form-group">
                    <label for="cs-sp-size">Drawer Size:</label>
                    <select id="cs-sp-size">
                        <option value="25%">25%</option>
                        <option value="35%">35%</option>
                        <option value="50%">50%</option>
                        <option value="75%">75%</option>
                    </select>
                </div>
            </fieldset>
            <fieldset>
                <legend>Secondary Action Buttons (Icons on Card)</legend>
                <div id="cs-action-buttons-container"></div>
                <button type="button" id="cs-add-action-button" class="btn-add-item">+ Add Action Button</button>
            </fieldset>
        `;
        contentArea.appendChild(tabEl);
        const drawerSelect = tabEl.querySelector("#cs-sp-drawer-config");
        if (allConfigs && Array.isArray(allConfigs)) {
            const drawerConfigs = allConfigs.filter(c => c.componentType === 'Drawer');
            drawerConfigs.forEach(c => {
                const option = document.createElement('option');
                option.value = c.configId;
                option.textContent = c.configId || `[Drawer Sem ID]`; 
                drawerSelect.appendChild(option);
            });
        }
        if (state.sidePanel && state.sidePanel.drawerConfigId) { drawerSelect.value = state.sidePanel.drawerConfigId; }
        const spSizeSel = tabEl.querySelector("#cs-sp-size");
        const actionButtonsContainer = tabEl.querySelector("#cs-action-buttons-container");
        
        // Initial render of action buttons
        renderActionButtonsUI(actionButtonsContainer, state.styling.actionButtons || []);

        tabEl.querySelector('#cs-add-action-button').addEventListener('click', () => {
            if (!Array.isArray(state.styling.actionButtons)) {
                state.styling.actionButtons = [];
            }
            const newButton = {
                id: `action-button-${Date.now()}`,
                icon: 'icon-link',
                tooltip: 'Nova Ação',
                actionType: 'navigateToGristPage',
            };
            state.styling.actionButtons.push(newButton);

            renderActionButtonsUI(actionButtonsContainer, state.styling.actionButtons);
            buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields"));
            updateDebugJson();
        });

        // Add event listener for remove buttons (delegated to the container)
        actionButtonsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove-item')) {
                const index = parseInt(e.target.dataset.index, 10);
                const buttonToRemove = state.styling.actionButtons[index];
                if (!buttonToRemove) return;

                const buttonIdToRemove = buttonToRemove.id;

                state.styling.actionButtons.splice(index, 1);

                state.layout = state.layout.filter(item => item.colId !== buttonIdToRemove);

                renderActionButtonsUI(actionButtonsContainer, state.styling.actionButtons);
                buildGridUI(_mainContainer.querySelector("#cs-layout-grid"), _mainContainer.querySelector("[data-tab-section='fld']"));
                buildAvailableFieldsList(_mainContainer.querySelector("#cs-layout-fields"));
                updateDebugJson();
            }
        });
    }
    async function openFieldStylePopup(fieldDef, fieldSchema) { // Added fieldSchema and async
        if (_fieldStylePopup && _fieldStylePopup.parentNode) {
            _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
        }
        const existingBackdrop = document.querySelector('.popup-backdrop');
        if (existingBackdrop) {
            existingBackdrop.parentNode.removeChild(existingBackdrop);
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'popup-backdrop';
        backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 1050;`;
        _mainContainer.appendChild(backdrop);
        
        _fieldStylePopup = document.createElement("div");
        _fieldStylePopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);`;
        _fieldStylePopup.className = 'field-style-popup';
        
        const isRefList = fieldSchema && fieldSchema.type.startsWith('RefList:');
        let refListOptionsHtml = '';
        if (isRefList) {
            const referencedTableId = fieldSchema.type.split(':')[1];
            const relatedSchema = await state.lens.getTableSchema(referencedTableId);
            const currentRefListConfig = fieldDef.style.refListConfig || {};

            refListOptionsHtml = `
                <hr>
                <h4>RefList Display Options</h4>
                <div class="form-group">
                    <label>Max Rows to Display:</label>
                    <input type="number" id="fs-reflist-max-rows" min="0" value="${currentRefListConfig.maxRows || 0}" style="width:80px;">
                    <p class="help-text">0 to display all. This is ignored if pagination is enabled.</p>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="fs-reflist-paginate" ${currentRefListConfig.paginate ? 'checked' : ''}> Enable Pagination</label>
                </div>
                <div class="form-group" id="fs-reflist-pagesize-group" style="display: ${currentRefListConfig.paginate ? 'block' : 'none'};">
                    <label>Rows per Page:</label>
                    <input type="number" id="fs-reflist-page-size" min="1" value="${currentRefListConfig.pageSize || 5}" style="width:80px;">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="fs-reflist-collapsible" ${currentRefListConfig.collapsible ? 'checked' : ''}> Enable Collapse/Expand</label>
                </div>
                <div class="form-group">
                    <label>Colunas da Tabela Relacionada:</label>
                    <div id="fs-reflist-columns-config">
                        ${Object.values(relatedSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos').map(c => `
                            <div>
                                <label>
                                    <input type="checkbox" class="fs-reflist-col-checkbox" value="${c.colId}" ${currentRefListConfig.columns && currentRefListConfig.columns.includes(c.colId) ? 'checked' : ''}>
                                    ${c.label || c.colId} (${c.type})
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        _fieldStylePopup.innerHTML = ` <div class="field-style-popup-content"> <h3 style="margin-top:0;">Style: ${fieldDef.colId}</h3> <div><label><input type="checkbox" id="fs-lv"> Show Label</label></div> <div>Label Position: <label><input type="radio" name="fs-lp" value="above"> Above</label> <label><input type="radio" name="fs-lp" value="left"> Left</label> </div> <div>Data Justification: <select id="fs-dj"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select> </div> <div><label><input type="checkbox" id="fs-hl"> Limit Height</label></div> <div id="fs-hl-rows" style="display:none;"><label>Max Rows: <input type="number" id="fs-hr" min="1" style="width:50px;"></label></div> <hr> <div><label><input type="checkbox" id="fs-itf"> Is a Title Field</label></div> <p class="help-text">Title Fields appear in the Top Bar if it's enabled.</p> ${refListOptionsHtml} <div class="popup-actions"> <button id="fs-cancel" type="button" class="btn btn-secondary">Cancel</button> <button id="fs-save" type="button" class="btn btn-primary">Save</button> </div> </div> `; _mainContainer.appendChild(_fieldStylePopup); const s = { ...DEFAULT_FIELD_STYLE, ...fieldDef.style }; _fieldStylePopup.querySelector('#fs-lv').checked = s.labelVisible; _fieldStylePopup.querySelector(`input[name='fs-lp'][value='${s.labelPosition}']`).checked = true; _fieldStylePopup.querySelector('#fs-dj').value = s.dataJustify; _fieldStylePopup.querySelector('#fs-hl').checked = s.heightLimited; _fieldStylePopup.querySelector('#fs-hl-rows').style.display = s.heightLimited ? 'block' : 'none'; _fieldStylePopup.querySelector('#fs-hr').value = s.maxHeightRows; _fieldStylePopup.querySelector('#fs-itf').checked = s.isTitleField;         _fieldStylePopup.querySelector('#fs-hl').addEventListener('change', e => { _fieldStylePopup.querySelector('#fs-hl-rows').style.display = e.target.checked ? 'block' : 'none'; });

        if (isRefList) {
            const paginateCheckbox = _fieldStylePopup.querySelector('#fs-reflist-paginate');
            const pageSizeGroup = _fieldStylePopup.querySelector('#fs-reflist-pagesize-group');
            if(paginateCheckbox && pageSizeGroup) {
                paginateCheckbox.addEventListener('change', () => {
                    pageSizeGroup.style.display = paginateCheckbox.checked ? 'block' : 'none';
                });
            }
        }

                const closePopup = () => {
            if (_fieldStylePopup && _fieldStylePopup.parentNode) {
                _fieldStylePopup.parentNode.removeChild(_fieldStylePopup);
                _fieldStylePopup = null;
            }
            const backdrop = document.querySelector('.popup-backdrop');
            if (backdrop) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }; _fieldStylePopup.querySelector('#fs-cancel').addEventListener('click', closePopup); _fieldStylePopup.querySelector('#fs-save').addEventListener('click', () => { 
        const newStyle = { 
            labelVisible: _fieldStylePopup.querySelector('#fs-lv').checked, 
            labelPosition: _fieldStylePopup.querySelector('input[name="fs-lp"]:checked').value, 
            dataJustify: _fieldStylePopup.querySelector('#fs-dj').value, 
            heightLimited: _fieldStylePopup.querySelector('#fs-hl').checked, 
            maxHeightRows: parseInt(_fieldStylePopup.querySelector('#fs-hr').value, 10) || 1, 
            isTitleField: _fieldStylePopup.querySelector('#fs-itf').checked 
        }; 
        fieldDef.style = { ...DEFAULT_FIELD_STYLE, ...newStyle }; 

        // INÍCIO DA LÓGICA DE SALVAMENTO DO REFLIST (CORREÇÃO)
        if (isRefList && _fieldStylePopup) {
            fieldDef.style.refListConfig = fieldDef.style.refListConfig || {};

            const maxRowsInput = _fieldStylePopup.querySelector('#fs-reflist-max-rows');
            if (maxRowsInput) {
                fieldDef.style.refListConfig.maxRows = parseInt(maxRowsInput.value, 10);
            }

            fieldDef.style.refListConfig.paginate = _fieldStylePopup.querySelector('#fs-reflist-paginate').checked;
                            fieldDef.style.refListConfig.pageSize = parseInt(_fieldStylePopup.querySelector('#fs-reflist-page-size').value, 10) || 5;
                            fieldDef.style.refListConfig.collapsible = _fieldStylePopup.querySelector('#fs-reflist-collapsible').checked;
            
                            const selectedCols = [];            const colCheckboxes = _fieldStylePopup.querySelectorAll('input.fs-reflist-col-checkbox:checked');
            colCheckboxes.forEach(checkbox => selectedCols.push(checkbox.value));
            fieldDef.style.refListConfig.columns = selectedCols;
        }
        // FIM DA LÓGICA DE SALVAMENTO DO REFLIST
        
        closePopup(); 
        updateDebugJson(); 
        }); 
    }
    function populateFieldSelect(selectEl, fieldList) { if(!selectEl) return; while (selectEl.options.length > 1) { selectEl.remove(1); } fieldList.forEach(f => { const opt = document.createElement("option"); opt.value = f; opt.textContent = f; selectEl.appendChild(opt); }); }
    return { render, read };
})();