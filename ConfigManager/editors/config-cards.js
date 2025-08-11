// --- START OF COMPLETE AND FINAL config-cards.js ---

window.CardConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _fieldStylePopup = null;

    function updateDebugJson(container) { if (!container) return; const outputEl = container.querySelector('#config-json-output'); if (!outputEl) return; try { const currentConfig = read(container); outputEl.textContent = JSON.stringify(currentConfig, null, 2); } catch (e) { outputEl.textContent = "Erro ao ler a configuração: " + e.message; } }

    async function render(container, config, lens, tableId, allConfigs = []) {
        _mainContainer = container;
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
            allConfigs: allConfigs,
            tableId: tableId
        };
        state.layout.forEach(field => { if (!field.style) field.style = { ...DEFAULT_FIELD_STYLE }; });
        container.innerHTML = "";
        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [createTabButton("Styling", "sty", container), createTabButton("Fields Layout", "fld", container), createTabButton("Actions", "sid", container)].forEach(t => tabsRow.appendChild(t));
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
        buildSidePanelTab(contentArea);
        updateDebugJson(container);
        switchTab("sty", container);
    }

function read(container) {
    const newStyling = readStylingTab(container);
    const layoutTab = container.querySelector("[data-tab-section='fld']");
    const viewMode = layoutTab.querySelector("#cs-vm-click").checked ? "click" : "burger";
    const numRows = parseInt(layoutTab.querySelector("#cs-num-rows").value, 10) || DEFAULT_NUM_ROWS;
    
    // --- INÍCIO DA CORREÇÃO ---
    // A lógica para ler a aba de Ações estava faltando.
    const sidePanelTab = container.querySelector("[data-tab-section='sid']");
    const sidePanel = {
        size: sidePanelTab.querySelector("#cs-sp-size").value,
        drawerConfigId: sidePanelTab.querySelector("#cs-sp-drawer-config").value || null
    };
    // --- FIM DA CORREÇÃO ---
    
    return {
        tableId: state.tableId,
        styling: newStyling,
        sidePanel, // Agora usa o objeto corrigido
        layout: state.layout,
        viewMode,
        numRows
    };
}


    const DEFAULT_FIELD_STYLE = { labelVisible: true, labelPosition: 'above', labelFont: 'inherit', labelFontSize: 'inherit', labelColor: 'inherit', labelOutline: false, labelOutlineColor: '#ffffff', dataJustify: 'left', heightLimited: false, maxHeightRows: 1, isTitleField: false };
    const DEFAULT_STYLING = { widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9", cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0", cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc", cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px", cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px", handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0", widgetPadding: "10px", cardsSpacing: "15px", selectedCard: { enabled: false, scale: 1.05, colorEffect: "none" } };
    const DEFAULT_NUM_ROWS = 1; const NUM_COLS = 10; const CONFIG_WIDTH = 700; const COL_WIDTH = CONFIG_WIDTH / NUM_COLS;
    
    function createTabButton(label, tabId, container) { const btn = document.createElement("button"); btn.type = "button"; btn.textContent = label; btn.className = 'config-tab-button'; btn.addEventListener("click", () => switchTab(tabId, container)); btn.dataset.tabId = tabId; return btn; }
    function switchTab(tabId, container) { const contentDiv = container.querySelector("#card-config-contents"); if (!contentDiv) return; contentDiv.querySelectorAll("[data-tab-section]").forEach(t => (t.style.display = "none")); container.querySelectorAll("[data-tab-id]").forEach(b => b.classList.remove('active')); const newActiveTab = contentDiv.querySelector(`[data-tab-section='${tabId}']`); if (newActiveTab) newActiveTab.style.display = "block"; const activeBtn = container.querySelector(`[data-tab-id='${tabId}']`); if (activeBtn) activeBtn.classList.add('active'); }
    
    function buildStylingTab(contentArea) { const tabEl = document.createElement("div"); tabEl.dataset.tabSection = "sty"; tabEl.style.display = "none"; tabEl.innerHTML = ` <h3>Styling Options</h3> <div class="styling-grid"> <fieldset><legend><b>Widget Background</b></legend> <label><input type="radio" name="bgmode" value="solid"/> Solid</label> <label><input type="radio" name="bgmode" value="gradient"/> Gradient</label> <label><input type="radio" name="bgmode" value="conditional"/> By Field</label> <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-bgcolor"/></div> <div class="style-control-group" data-mode="gradient" style="display:none;"> <select id="cs-st-bggradient-type"><option value="linear-gradient(to right, {c1}, {c2})">Linear H</option><option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option><option value="radial-gradient(circle, {c1}, {c2})">Radial</option></select> <input type="color" id="cs-st-bggradient-c1"/> <input type="color" id="cs-st-bggradient-c2"/> </div> <div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-bgfield"><option value="">-- field --</option></select></div> </fieldset> <fieldset><legend><b>Cards Color</b></legend> <label><input type="radio" name="cardscolormode" value="solid"/> Solid</label> <label><input type="radio" name="cardscolormode" value="gradient"/> Gradient</label> <label><input type="radio" name="cardscolormode" value="conditional"/> By Field</label> <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-cardcolor"/></div> <div class="style-control-group" data-mode="gradient" style="display:none;"> <select id="cs-st-cardgradient-type"><option value="linear-gradient(to right, {c1}, {c2})">Linear H</option><option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option><option value="radial-gradient(circle, {c1}, {c2})">Radial</option></select> <input type="color" id="cs-st-cardgradient-c1"/> <input type="color" id="cs-st-cardgradient-c2"/> </div> <div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-cardscolorfield"><option value="">-- field --</option></select></div> </fieldset> <fieldset><legend><b>Card Border</b></legend> Thickness (px): <input type="number" id="cs-st-border-thickness" min="0" style="width:60px"/> <br> <label><input type="radio" name="bordermode" value="solid"/> Solid</label> <label><input type="radio" name="bordermode" value="conditional"/> By Field</label> <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-border-color"/></div> <div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-border-field"><option value="">-- field --</option></select></div> </fieldset> <fieldset class="title-control-group" data-title-mode="no-bar"> <legend><b>Card Title (when Top Bar is OFF)</b></legend> Color: <input type="color" id="cs-st-titlecolor"/> Font: <select id="cs-st-titlefont"><option>Calibri</option><option>Arial</option><option>Times New Roman</option></select> Size: <input type="number" id="cs-st-titlesize" min="8" style="width:60px"/>px </fieldset> <fieldset> <legend><b>Handle Area</b></legend> Width (px): <input type="number" id="cs-st-handle-width" min="1" style="width:60px"/> <br> <label><input type="radio" name="handlemode" value="solid"/> Solid</label> <label><input type="radio" name="handlemode" value="conditional"/> By Field</label> <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-handle-color"/></div> <div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-handle-field"><option value="">-- field --</option></select></div> </fieldset> <fieldset><legend><b>Layout Spacing</b></legend> Widget Padding (px): <input type="number" id="cs-st-padding" min="0" style="width:60px"/> <br> Card Spacing (px): <input type="number" id="cs-st-spacing" min="0" style="width:60px"/> </fieldset> <fieldset class="full-width title-control-group" data-title-mode="top-bar"> <legend><b>Card Title Top Bar</b></legend> <label><input type="checkbox" id="cs-st-topbar-enabled"/> Enable Top Bar</label> <div class="top-bar-config" style="display: none;"> <div><b>Bar Background:</b> <br> <label><input type="radio" name="topbarmode" value="solid"/> Solid</label> <label><input type="radio" name="topbarmode" value="gradient"/> Gradient</label> <label><input type="radio" name="topbarmode" value="conditional"/> By Field</label> <div class="style-control-group" data-mode="solid"><input type="color" id="cs-st-topbar-color"/></div> <div class="style-control-group" data-mode="gradient" style="display:none;"> <select id="cs-st-topbargradient-type"><option value="linear-gradient(to right, {c1}, {c2})">Linear H</option><option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option><option value="radial-gradient(circle, {c1}, {c2})">Radial</option></select> <input type="color" id="cs-st-topbargradient-c1"/> <input type="color" id="cs-st-topbargradient-c2"/> </div> <div class="style-control-group" data-mode="conditional" style="display:none;"><select id="cs-st-topbar-field"><option value="">-- field --</option></select></div> </div> <div><b>Label Style:</b> <br>Color: <input type="color" id="cs-st-topbar-lblcolor"/> <br>Font: <select id="cs-st-topbar-lblfont"><option>Calibri</option><option>Arial</option></select> <br>Size: <input type="number" id="cs-st-topbar-lblsize" min="8" style="width:60px"/>px</div> <div><b>Data Style:</b> <br>Color: <input type="color" id="cs-st-topbar-datacolor"/> <br>Font: <select id="cs-st-topbar-datafont"><option>Calibri</option><option>Arial</option></select> <br>Size: <input type="number" id="cs-st-topbar-datasize" min="8" style="width:60px"/>px</div> </div> </fieldset> <fieldset class="full-width"><legend><b>Selected Card Hover Effect</b></legend> <label>Enable: <input type="checkbox" id="cs-st-sel-enabled"/></label> <label style="margin-left: 20px;">Scale: <input type="number" id="cs-st-sel-scale" min="0" max="100" style="width:60px"/>%</label> </fieldset> </div> `; contentArea.appendChild(tabEl); const setupModeSwitcher = (fieldset) => { const radios = fieldset.querySelectorAll('input[type="radio"]'); radios.forEach(radio => { radio.addEventListener('change', () => { const selectedMode = radio.value; fieldset.querySelectorAll('.style-control-group').forEach(group => { group.style.display = group.dataset.mode === selectedMode ? '' : 'none'; }); }); }); }; tabEl.querySelectorAll('fieldset').forEach(setupModeSwitcher); const topBarCheckbox = tabEl.querySelector('#cs-st-topbar-enabled'); const topBarConfigDiv = tabEl.querySelector('.top-bar-config'); const noBarTitleFieldset = tabEl.querySelector('[data-title-mode="no-bar"]'); const toggleTitleControls = () => { const isEnabled = topBarCheckbox.checked; topBarConfigDiv.style.display = isEnabled ? 'flex' : 'none'; noBarTitleFieldset.disabled = isEnabled; noBarTitleFieldset.style.opacity = isEnabled ? '0.5' : '1'; }; topBarCheckbox.addEventListener('change', toggleTitleControls); const allFields = state.fields.map(f => f.colId); populateFieldSelect(tabEl.querySelector("#cs-st-bgfield"), allFields); populateFieldSelect(tabEl.querySelector("#cs-st-cardscolorfield"), allFields); populateFieldSelect(tabEl.querySelector("#cs-st-border-field"), allFields); populateFieldSelect(tabEl.querySelector("#cs-st-topbar-field"), allFields); populateFieldSelect(tabEl.querySelector("#cs-st-handle-field"), allFields); populateStylingTab(tabEl); toggleTitleControls(); tabEl.querySelectorAll('input[type="radio"]:checked').forEach(radio => radio.dispatchEvent(new Event('change'))); }
    function populateFieldSelect(selectEl, fieldList) { if(!selectEl) return; while (selectEl.options.length > 1) { selectEl.remove(1); } fieldList.forEach(f => { const opt = document.createElement("option"); opt.value = f; opt.textContent = f; selectEl.appendChild(opt); }); }
    function populateStylingTab(tabEl) { const s = state.styling; tabEl.querySelector(`input[name='bgmode'][value='${s.widgetBackgroundMode}']`).checked = true; tabEl.querySelector("#cs-st-bgcolor").value = s.widgetBackgroundSolidColor; tabEl.querySelector("#cs-st-bggradient-type").value = s.widgetBackgroundGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-bggradient-c1").value = s.widgetBackgroundGradientColor1 || '#f9f9f9'; tabEl.querySelector("#cs-st-bggradient-c2").value = s.widgetBackgroundGradientColor2 || '#e9e9e9'; tabEl.querySelector("#cs-st-bgfield").value = s.widgetBackgroundField || ""; tabEl.querySelector(`input[name='cardscolormode'][value='${s.cardsColorMode}']`).checked = true; tabEl.querySelector("#cs-st-cardcolor").value = s.cardsColorSolidColor; tabEl.querySelector("#cs-st-cardgradient-type").value = s.cardsColorGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-cardgradient-c1").value = s.cardsColorGradientColor1 || '#ffffff'; tabEl.querySelector("#cs-st-cardgradient-c2").value = s.cardsColorGradientColor2 || '#f0f0f0'; tabEl.querySelector("#cs-st-cardscolorfield").value = s.cardsColorField || ""; tabEl.querySelector("#cs-st-border-thickness").value = s.cardBorderThickness; tabEl.querySelector(`input[name='bordermode'][value='${s.cardBorderMode}']`).checked = true; tabEl.querySelector("#cs-st-border-color").value = s.cardBorderSolidColor; tabEl.querySelector("#cs-st-border-field").value = s.cardBorderField || ""; tabEl.querySelector("#cs-st-titlecolor").value = s.cardTitleFontColor; tabEl.querySelector("#cs-st-titlefont").value = s.cardTitleFontStyle; tabEl.querySelector("#cs-st-titlesize").value = parseInt(s.cardTitleFontSize, 10); tabEl.querySelector("#cs-st-topbar-enabled").checked = s.cardTitleTopBarEnabled; tabEl.querySelector(`input[name='topbarmode'][value='${s.cardTitleTopBarMode}']`).checked = true; tabEl.querySelector("#cs-st-topbar-color").value = s.cardTitleTopBarSolidColor; tabEl.querySelector("#cs-st-topbargradient-type").value = s.cardTitleTopBarGradientType || 'linear-gradient(to right, {c1}, {c2})'; tabEl.querySelector("#cs-st-topbargradient-c1").value = s.cardTitleTopBarGradientColor1 || '#dddddd'; tabEl.querySelector("#cs-st-topbargradient-c2").value = s.cardTitleTopBarGradientColor2 || '#cccccc'; tabEl.querySelector("#cs-st-topbar-field").value = s.cardTitleTopBarField || ""; tabEl.querySelector("#cs-st-topbar-lblcolor").value = s.cardTitleTopBarLabelFontColor; tabEl.querySelector("#cs-st-topbar-lblfont").value = s.cardTitleTopBarLabelFontStyle; tabEl.querySelector("#cs-st-topbar-lblsize").value = parseInt(s.cardTitleTopBarLabelFontSize, 10); tabEl.querySelector("#cs-st-topbar-datacolor").value = s.cardTitleTopBarDataFontColor; tabEl.querySelector("#cs-st-topbar-datafont").value = s.cardTitleTopBarDataFontStyle; tabEl.querySelector("#cs-st-topbar-datasize").value = parseInt(s.cardTitleTopBarDataFontSize, 10); tabEl.querySelector("#cs-st-handle-width").value = parseInt(s.handleAreaWidth, 10); tabEl.querySelector(`input[name='handlemode'][value='${s.handleAreaMode}']`).checked = true; tabEl.querySelector("#cs-st-handle-color").value = s.handleAreaSolidColor; tabEl.querySelector("#cs-st-handle-field").value = s.handleAreaField || ""; tabEl.querySelector("#cs-st-padding").value = parseInt(s.widgetPadding, 10); tabEl.querySelector("#cs-st-spacing").value = parseInt(s.cardsSpacing, 10); tabEl.querySelector("#cs-st-sel-enabled").checked = s.selectedCard.enabled; tabEl.querySelector("#cs-st-sel-scale").value = Math.round(((s.selectedCard.scale || 1) - 1) * 100); }
    function readStylingTab(container) {
    const tabEl = container.querySelector('[data-tab-section="sty"]');
    const getCheckedValue = (name) => tabEl.querySelector(`input[name='${name}']:checked`)?.value;

    const s = {}; // Começamos com um objeto vazio
    Object.assign(s, DEFAULT_STYLING); // Preenchemos com os padrões para garantir que todas as chaves existam

    // Lógica inteligente: só lê o que está selecionado
    const bgMode = getCheckedValue('bgmode');
    s.widgetBackgroundMode = bgMode;
    if (bgMode === 'solid') {
        s.widgetBackgroundSolidColor = tabEl.querySelector("#cs-st-bgcolor").value;
    } else if (bgMode === 'gradient') {
        s.widgetBackgroundGradientType = tabEl.querySelector("#cs-st-bggradient-type").value;
        s.widgetBackgroundGradientColor1 = tabEl.querySelector("#cs-st-bggradient-c1").value;
        s.widgetBackgroundGradientColor2 = tabEl.querySelector("#cs-st-bggradient-c2").value;
    } else if (bgMode === 'conditional') {
        s.widgetBackgroundField = tabEl.querySelector("#cs-st-bgfield").value || null;
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
    }
    s.cardTitleTopBarLabelFontColor = tabEl.querySelector("#cs-st-topbar-lblcolor").value;
    s.cardTitleTopBarLabelFontStyle = tabEl.querySelector("#cs-st-topbar-lblfont").value;
    s.cardTitleTopBarLabelFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-lblsize").value, 10) || 16}px`;
    s.cardTitleTopBarDataFontColor = tabEl.querySelector("#cs-st-topbar-datacolor").value;
    s.cardTitleTopBarDataFontStyle = tabEl.querySelector("#cs-st-topbar-datafont").value;
    s.cardTitleTopBarDataFontSize = `${parseInt(tabEl.querySelector("#cs-st-topbar-datasize").value, 10) || 16}px`;

    s.handleAreaWidth = `${parseInt(tabEl.querySelector("#cs-st-handle-width").value, 10) || 8}px`;
    const handleMode = getCheckedValue('handlemode');
    s.handleAreaMode = handleMode;
    if (handleMode === 'solid') {
        s.handleAreaSolidColor = tabEl.querySelector("#cs-st-handle-color").value;
    } else if (handleMode === 'conditional') {
        s.handleAreaField = tabEl.querySelector("#cs-st-handle-field").value || null;
    }
    
    s.widgetPadding = `${parseInt(tabEl.querySelector("#cs-st-padding").value, 10) || 0}px`;
    s.cardsSpacing = `${parseInt(tabEl.querySelector("#cs-st-spacing").value, 10) || 0}px`;
    s.selectedCard = {
        enabled: tabEl.querySelector("#cs-st-sel-enabled").checked,
        scale: 1 + ((parseInt(tabEl.querySelector("#cs-st-sel-scale").value, 10) || 0) / 100),
        colorEffect: "none"
    };

    return s;
}
    function buildFieldsLayoutTab(contentArea) { const tabEl = document.createElement("div"); tabEl.dataset.tabSection = "fld"; tabEl.style.display = "none"; tabEl.innerHTML = ` <h3>Fields & Layout</h3> <div class="layout-controls"> <label>View Mode:</label> <label><input type="radio" name="cs-viewmode" id="cs-vm-click" value="click" /> Click Card</label> <label><input type="radio" name="cs-viewmode" id="cs-vm-burger" value="burger" /> Burger Icon</label> <span class="spacer"></span> <label>Number of Rows:</label> <input type="number" id="cs-num-rows" value="${state.numRows}" min="1" max="20" /> </div> <p class="help-text">Drag fields onto the grid below. Resize by dragging the right edge.</p> <div id="cs-layout-grid" class="layout-grid" style="--col-width: ${COL_WIDTH}px; --num-cols: ${NUM_COLS};"></div> <div class="available-fields-container"> <b>Available Fields:</b> <div id="cs-layout-fields" class="available-fields-list"></div> </div>`; contentArea.appendChild(tabEl); if (state.viewMode === "burger") { tabEl.querySelector("#cs-vm-burger").checked = true; } else { tabEl.querySelector("#cs-vm-click").checked = true; } const rowInput = tabEl.querySelector("#cs-num-rows"); rowInput.addEventListener("change", () => { state.numRows = parseInt(rowInput.value, 10) || 1; buildGridUI(tabEl.querySelector("#cs-layout-grid"), tabEl); }); buildGridUI(tabEl.querySelector("#cs-layout-grid"), tabEl); buildAvailableFieldsList(tabEl.querySelector("#cs-layout-fields")); }
    function buildGridUI(gridEl, tabEl) { gridEl.innerHTML = ""; for (let r = 0; r < state.numRows; r++) { const rowDiv = document.createElement("div"); rowDiv.className = 'layout-grid-row'; rowDiv.dataset.rowIndex = String(r); rowDiv.addEventListener("dragover", e => e.preventDefault()); rowDiv.addEventListener("drop", e => { e.preventDefault(); const colId = e.dataTransfer.getData("text/colid"); if (!colId) return; const rect = rowDiv.getBoundingClientRect(); const col = Math.floor((e.clientX - rect.left) / COL_WIDTH); state.layout.push({ colId, row: r, col, colSpan: 2, style: {...DEFAULT_FIELD_STYLE} }); buildGridUI(gridEl, tabEl); buildAvailableFieldsList(tabEl.querySelector("#cs-layout-fields")); }); state.layout.filter(f => f.row === r).forEach(f => { rowDiv.appendChild(createFieldBoxInConfigUI(f, gridEl, tabEl)); }); gridEl.appendChild(rowDiv); } }
    function createFieldBoxInConfigUI(fieldDef, gridEl, tabEl) { const fieldSchema = state.fields.find(field => field.colId === fieldDef.colId); const box = document.createElement("div"); box.className = 'layout-field-box'; box.textContent = fieldSchema ? (fieldSchema.label || fieldSchema.colId) : fieldDef.colId; box.style.left = (fieldDef.col * COL_WIDTH) + "px"; box.style.width = (fieldDef.colSpan * COL_WIDTH) + "px"; const gearIcon = document.createElement("div"); gearIcon.innerHTML = "⚙️"; gearIcon.className = 'field-box-icon gear'; gearIcon.addEventListener("click", e => { e.stopPropagation(); openFieldStylePopup(fieldDef); }); box.appendChild(gearIcon); const removeIcon = document.createElement("div"); removeIcon.innerHTML = "✕"; removeIcon.className = 'field-box-icon remove'; removeIcon.addEventListener("click", e => { e.stopPropagation(); const idx = state.layout.indexOf(fieldDef); if (idx > -1) state.layout.splice(idx, 1); buildGridUI(gridEl, tabEl); buildAvailableFieldsList(tabEl.querySelector("#cs-layout-fields")); }); box.appendChild(removeIcon); box.draggable = true; box.addEventListener("dragstart", e => { e.dataTransfer.setData("text/colid", fieldDef.colId); const idx = state.layout.indexOf(fieldDef); if (idx > -1) state.layout.splice(idx, 1); }); const handle = document.createElement("div"); handle.className = 'resize-handle'; box.appendChild(handle); handle.addEventListener("mousedown", e => { e.stopPropagation(); e.preventDefault(); box.draggable = false; const startX = e.clientX, origW = parseFloat(box.style.width); const onMouseMove = moveEvt => { let newWidth = origW + (moveEvt.clientX - startX); box.style.width = newWidth + "px"; }; const onMouseUp = () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); let newSpan = Math.round(parseFloat(box.style.width) / COL_WIDTH); fieldDef.colSpan = Math.max(1, Math.min(NUM_COLS - fieldDef.col, newSpan)); box.draggable = true; buildGridUI(gridEl, tabEl); }; document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp); }); return box; }
    function buildAvailableFieldsList(container) { container.innerHTML = ""; const usedCols = state.layout.map(l => l.colId); const availableCols = state.fields.filter(f => !usedCols.includes(f.colId)); if (!availableCols.length) { container.innerHTML = "<i>All fields placed.</i>"; return; } availableCols.forEach(field => { const el = document.createElement("div"); el.className = 'available-field'; el.textContent = field.label || field.colId; el.dataset.colid = field.colId; el.draggable = true; el.addEventListener("dragstart", e => e.dataTransfer.setData("text/colid", field.colId)); container.appendChild(el); }); }
    function buildSidePanelTab(contentArea) {
    const tabEl = document.createElement("div");
    tabEl.dataset.tabSection = "sid";
    tabEl.style.display = "none";
    
    // O HTML permanece o mesmo
    tabEl.innerHTML = `
        <h3>Side Panel & Actions</h3>
        <p>Configure what happens when a user clicks on a card.</p>
        <fieldset>
            <legend>Action on Click</legend>
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
    `;
    contentArea.appendChild(tabEl);

    // --- LOG DE DEPURAÇÃO ---
    console.log("[buildSidePanelTab] Verificando state.allConfigs:", state.allConfigs);
    
    const drawerSelect = tabEl.querySelector("#cs-sp-drawer-config");
    
    if (state.allConfigs && Array.isArray(state.allConfigs)) {
        const drawerConfigs = state.allConfigs.filter(c => c.componentType === 'Drawer');

        // --- LOG 2 ---
        console.log(`Encontradas ${drawerConfigs.length} configurações de Drawer.`);

        drawerConfigs.forEach(c => {
            const option = document.createElement('option');
            option.value = c.configId;
            option.textContent = c.configId || `[Drawer Sem ID]`; 
            drawerSelect.appendChild(option);
        });
    } else {
        console.error("[buildSidePanelTab] ERRO: state.allConfigs não é um array válido.");
    }

    if (state.sidePanel && state.sidePanel.drawerConfigId) {
        drawerSelect.value = state.sidePanel.drawerConfigId;
    }

    const spSizeSel = tabEl.querySelector("#cs-sp-size");
    spSizeSel.value = state.sidePanel.size || "35%";
}
    function openFieldStylePopup(fieldDef) { if (_fieldStylePopup && _fieldStylePopup.parentNode) { _fieldStylePopup.parentNode.removeChild(_fieldStylePopup); } _fieldStylePopup = document.createElement("div"); _fieldStylePopup.style.cssText = ` position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; `; _fieldStylePopup.className = 'field-style-popup'; _fieldStylePopup.innerHTML = ` <div class="field-style-popup-content"> <h3 style="margin-top:0;">Style: ${fieldDef.colId}</h3> <div><label><input type="checkbox" id="fs-lv"> Show Label</label></div> <div>Label Position: <label><input type="radio" name="fs-lp" value="above"> Above</label> <label><input type="radio" name="fs-lp" value="left"> Left</label> </div> <div>Data Justification: <select id="fs-dj"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select> </div> <div><label><input type="checkbox" id="fs-hl"> Limit Height</label></div> <div id="fs-hl-rows" style="display:none;"><label>Max Rows: <input type="number" id="fs-hr" min="1" style="width:50px;"></label></div> <hr> <div><label><input type="checkbox" id="fs-itf"> Is a Title Field</label></div> <p class="help-text">Title Fields appear in the Top Bar if it's enabled.</p> <div class="popup-actions"> <button id="fs-cancel" type="button" class="btn btn-secondary">Cancel</button> <button id="fs-save" type="button" class="btn btn-primary">Save</button> </div> </div> `; _mainContainer.appendChild(_fieldStylePopup); const s = { ...DEFAULT_FIELD_STYLE, ...fieldDef.style }; _fieldStylePopup.querySelector('#fs-lv').checked = s.labelVisible; _fieldStylePopup.querySelector(`input[name='fs-lp'][value='${s.labelPosition}']`).checked = true; _fieldStylePopup.querySelector('#fs-dj').value = s.dataJustify; _fieldStylePopup.querySelector('#fs-hl').checked = s.heightLimited; _fieldStylePopup.querySelector('#fs-hl-rows').style.display = s.heightLimited ? 'block' : 'none'; _fieldStylePopup.querySelector('#fs-hr').value = s.maxHeightRows; _fieldStylePopup.querySelector('#fs-itf').checked = s.isTitleField; _fieldStylePopup.querySelector('#fs-hl').addEventListener('change', e => { _fieldStylePopup.querySelector('#fs-hl-rows').style.display = e.target.checked ? 'block' : 'none'; }); const closePopup = () => { if (_fieldStylePopup && _fieldStylePopup.parentNode) { _fieldStylePopup.parentNode.removeChild(_fieldStylePopup); } _fieldStylePopup = null; }; _fieldStylePopup.querySelector('#fs-cancel').addEventListener('click', closePopup); _fieldStylePopup.querySelector('#fs-save').addEventListener('click', () => { const newStyle = { labelVisible: _fieldStylePopup.querySelector('#fs-lv').checked, labelPosition: _fieldStylePopup.querySelector('input[name="fs-lp"]:checked').value, dataJustify: _fieldStylePopup.querySelector('#fs-dj').value, heightLimited: _fieldStylePopup.querySelector('#fs-hl').checked, maxHeightRows: parseInt(_fieldStylePopup.querySelector('#fs-hr').value, 10) || 1, isTitleField: _fieldStylePopup.querySelector('#fs-itf').checked }; fieldDef.style = { ...DEFAULT_FIELD_STYLE, ...newStyle }; closePopup(); updateDebugJson(_mainContainer); }); }

    return { render, read };
})();

// --- END OF COMPLETE AND FINAL config-cards.js ---