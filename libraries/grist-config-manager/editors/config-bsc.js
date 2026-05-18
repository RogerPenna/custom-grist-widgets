// libraries/grist-config-manager/editors/config-bsc.js

export const BscConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _targetTableId = null;
    let _tableLens = null;

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

    function syncState() {
        if (!_mainContainer) return;
        const current = read(_mainContainer);
        
        // Flatten tripartition back into state
        state.modelsTable = current.mapping.modelsTable;
        state.perspectivesTable = current.mapping.perspectivesTable;
        state.objectivesTable = current.mapping.objectivesTable;
        state.refModelCol = current.mapping.refModelCol;
        state.refPerspCol = current.mapping.refPerspCol;
        state.relationshipField = current.mapping.relationshipField;
        state.typeField = current.mapping.typeField;
        state.defaultCardConfigId = current.mapping.defaultCardConfigId;
        state.typeConfigMap = current.mapping.typeConfigMap;

        state.useColoris = current.styling.useColoris;
        state.showSwotTab = current.styling.showSwotTab;
        state.showPestalTab = current.styling.showPestalTab;
        state.arrowColor = current.styling.arrowColor;
        state.arrowColorPaletteId = current.styling.arrowColorPaletteId;
        state.arrowThickness = current.styling.arrowThickness;
        state.showArrowOutline = current.styling.showArrowOutline;
        state.arrowOutlineColor = current.styling.arrowOutlineColor;
        state.arrowOutlineColorPaletteId = current.styling.arrowOutlineColorPaletteId;
        state.arrowOutlineThickness = current.styling.arrowOutlineThickness;

        state.drawerConfigId = current.actions.drawerConfigId;
        state.showAddPerspective = current.actions.showAddPerspective;
        state.addPerspectiveConfigId = current.actions.addPerspectiveConfigId;
        state.showAddObjective = current.actions.showAddObjective;
        state.addObjectiveConfigId = current.actions.addObjectiveConfigId;
    }

    function rebuildAll() {
        if (!_mainContainer) return;
        const contentArea = _mainContainer.querySelector("#bsc-config-contents");
        const activeTab = _mainContainer.querySelector(".config-tab-button.active")?.dataset.tabId || "gen";
        
        contentArea.innerHTML = "";
        buildGeneralTab(contentArea);
        buildColumnsTab(contentArea);
        buildStyleTab(contentArea);
        buildActionsTab(contentArea);
        
        switchTab(activeTab, _mainContainer);
        updateDebugJson();
    }

    async function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        _targetTableId = tableId;
        _tableLens = tableLens;
        const options = config || {};
        
        // Se vier de um widget unificado (GTL.fetchConfig), as ações estarão na raiz ou dentro de .actions
        const actions = options.actions || options;
        const styling = options.styling || options;

        state = {
            useColoris: styling.useColoris || false,
            showSwotTab: styling.showSwotTab !== undefined ? styling.showSwotTab : true,
            showPestalTab: styling.showPestalTab !== undefined ? styling.showPestalTab : true,
            arrowColor: styling.arrowColor || 'rgba(0, 86, 168, 0.8)',
            arrowColorPaletteId: styling.arrowColorPaletteId || '',
            arrowThickness: styling.arrowThickness || 4,
            showArrowOutline: styling.showArrowOutline !== undefined ? styling.showArrowOutline : true,
            arrowOutlineColor: styling.arrowOutlineColor || 'rgba(255, 255, 255, 0.5)',
            arrowOutlineColorPaletteId: styling.arrowOutlineColorPaletteId || '',
            arrowOutlineThickness: styling.arrowOutlineThickness || 0.2,

            drawerConfigId: actions.drawerConfigId || null,
            showAddPerspective: actions.showAddPerspective || false,
            addPerspectiveConfigId: actions.addPerspectiveConfigId || null,
            showAddObjective: actions.showAddObjective || false,
            addObjectiveConfigId: actions.addObjectiveConfigId || null,
            
            // Dynamic Mapping
            modelsTable: options.modelsTable || options.mapping?.modelsTable || 'Modelos',
            perspectivesTable: options.perspectivesTable || options.mapping?.perspectivesTable || 'Perspectivas',
            objectivesTable: options.objectivesTable || options.mapping?.objectivesTable || 'Objetivos',
            typeField: options.typeField || options.mapping?.typeField || 'TipoModelo',
            typeConfigMap: options.typeConfigMap || options.mapping?.typeConfigMap || {},
            defaultCardConfigId: options.defaultCardConfigId || options.mapping?.defaultCardConfigId || options.perspectivesConfigId || options.mapping?.perspectivesConfigId || null,

            refModelCol: options.refModelCol || options.mapping?.refModelCol || 'ref_model',
            refPerspCol: options.refPerspCol || options.mapping?.refPerspCol || 'ref_persp',
            relationshipField: options.relationshipField || options.mapping?.relationshipField || 'ref_obj',
            
            receivedConfigs: receivedConfigs,
            allTables: await tableLens.listAllTables()
        };

        // Fetch schemas for dynamic field selection
        state.modelsSchema = await tableLens.getTableSchema(state.modelsTable);
        state.perspectivesSchema = await tableLens.getTableSchema(state.perspectivesTable);
        state.objectivesSchema = await tableLens.getTableSchema(state.objectivesTable);

        container.innerHTML = `
            <style>
                .debug-tri-section { margin-bottom: 15px; border-left: 4px solid #ddd; padding-left: 10px; }
                .debug-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
                .debug-label.mapping { color: #0d6efd; }
                .debug-label.styling { color: #198754; }
                .debug-label.actions { color: #fd7e14; }
                .config-debugger pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; max-height: 200px; overflow: auto; }
                
                .palette-picker-container {
                    background: #f1f5f9;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid #cbd5e1;
                    margin-top: 5px;
                }
                .palette-color-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-top: 10px;
                }
                .palette-color-swatch {
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: 1px solid #94a3b8;
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                .palette-color-swatch:hover {
                    transform: scale(1.1);
                }
                .palette-color-swatch.active {
                    border: 2px solid #000;
                    box-shadow: 0 0 0 2px #fff inset;
                }
            </style>
        `;

        // Create Tabs
        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [
            createTabButton("General", "gen", container),
            createTabButton("Cards", "cols", container),
            createTabButton("Style", "style", container),
            createTabButton("Actions", "act", container)
        ].forEach(t => tabsRow.appendChild(t));
        container.appendChild(tabsRow);

        const debugSection = document.createElement("div");
        debugSection.innerHTML = `
            <details class="config-debugger">
                <summary>Ver Tripartição JSON (Debug)</summary>
                <div id="config-json-output"></div>
            </details>`;
        container.appendChild(debugSection);

        // Content Area
        const contentArea = document.createElement("div");
        contentArea.className = 'config-content';
        contentArea.id = "bsc-config-contents";
        container.appendChild(contentArea);

        // Build Tabs
        buildGeneralTab(contentArea);
        buildColumnsTab(contentArea);
        buildStyleTab(contentArea);
        buildActionsTab(contentArea);

        // Initialize
        switchTab("act", container); // Default to Actions as it's the main feature for now

        container.addEventListener('change', updateDebugJson);
        container.addEventListener('input', updateDebugJson);
        updateDebugJson();
    }

    function read(container) {
        const genTab = container.querySelector("[data-tab-section='gen']");
        const colsTab = container.querySelector("[data-tab-section='cols']");
        const styleTab = container.querySelector("[data-tab-section='style']");
        const actTab = container.querySelector("[data-tab-section='act']");

        const typeConfigMap = {};
        if (colsTab) {
            colsTab.querySelectorAll(".dynamic-card-mapping").forEach(row => {
                const choice = row.dataset.choice;
                const configId = row.querySelector("select").value;
                if (configId) typeConfigMap[choice] = configId;
            });
        }

        const fullConfig = {
            useColoris: styleTab ? styleTab.querySelector('#bsc-cfg-use-coloris').checked : state.useColoris,
            showSwotTab: styleTab ? styleTab.querySelector('#bsc-cfg-show-swot').checked : state.showSwotTab,
            showPestalTab: styleTab ? styleTab.querySelector('#bsc-cfg-show-pestal').checked : state.showPestalTab,
            
            arrowColor: styleTab ? styleTab.querySelector('#bsc-cfg-arrow-color').value : state.arrowColor,
            arrowColorPaletteId: styleTab ? styleTab.querySelector('#bsc-cfg-arrow-color-palette-id').value : state.arrowColorPaletteId,
            
            arrowThickness: styleTab ? parseFloat(styleTab.querySelector('#bsc-cfg-arrow-thickness').value) : state.arrowThickness,
            showArrowOutline: styleTab ? styleTab.querySelector('#bsc-cfg-show-arrow-outline').checked : state.showArrowOutline,
            
            arrowOutlineColor: styleTab ? styleTab.querySelector('#bsc-cfg-arrow-outline-color').value : state.arrowOutlineColor,
            arrowOutlineColorPaletteId: styleTab ? styleTab.querySelector('#bsc-cfg-arrow-outline-color-palette-id').value : state.arrowOutlineColorPaletteId,
            
            arrowOutlineThickness: styleTab ? parseFloat(styleTab.querySelector('#bsc-cfg-arrow-outline-thickness').value) : state.arrowOutlineThickness,

            modelsTable: genTab ? genTab.querySelector('#bsc-cfg-models-table').value : state.modelsTable,
            perspectivesTable: genTab ? genTab.querySelector('#bsc-cfg-perspectives-table').value : state.perspectivesTable,
            objectivesTable: genTab ? genTab.querySelector('#bsc-cfg-objectives-table').value : state.objectivesTable,
            refModelCol: genTab ? genTab.querySelector('#bsc-cfg-ref-model-col').value : state.refModelCol,
            refPerspCol: genTab ? genTab.querySelector('#bsc-cfg-ref-persp-col').value : state.refPerspCol,
            relationshipField: genTab ? genTab.querySelector('#bsc-cfg-rel-field').value : state.relationshipField,
            
            typeField: colsTab ? colsTab.querySelector('#bsc-cfg-type-field').value : state.typeField,
            defaultCardConfigId: colsTab ? colsTab.querySelector('#bsc-cfg-default-card-id').value : state.defaultCardConfigId,
            typeConfigMap: typeConfigMap,

            drawerConfigId: actTab ? actTab.querySelector('#bsc-cfg-drawer-id').value : state.drawerConfigId,
            showAddPerspective: actTab ? actTab.querySelector('#bsc-cfg-show-add-persp').checked : state.showAddPerspective,
            addPerspectiveConfigId: actTab ? actTab.querySelector('#bsc-cfg-add-persp-id').value : state.addPerspectiveConfigId,
            showAddObjective: actTab ? actTab.querySelector('#bsc-cfg-show-add-obj').checked : state.showAddObjective,
            addObjectiveConfigId: actTab ? actTab.querySelector('#bsc-cfg-add-obj-id').value : state.addObjectiveConfigId
        };

        // --- TRIPARTIÇÃO ---
        const mapping = {
            tableId: _targetTableId,
            modelsTable: fullConfig.modelsTable,
            perspectivesTable: fullConfig.perspectivesTable,
            objectivesTable: fullConfig.objectivesTable,
            refModelCol: fullConfig.refModelCol,
            refPerspCol: fullConfig.refPerspCol,
            relationshipField: fullConfig.relationshipField,
            typeField: fullConfig.typeField,
            defaultCardConfigId: fullConfig.defaultCardConfigId,
            typeConfigMap: fullConfig.typeConfigMap
        };

        const styling = {
            useColoris: fullConfig.useColoris,
            showSwotTab: fullConfig.showSwotTab,
            showPestalTab: fullConfig.showPestalTab,
            arrowColor: fullConfig.arrowColor,
            arrowColorPaletteId: fullConfig.arrowColorPaletteId,
            arrowThickness: fullConfig.arrowThickness,
            showArrowOutline: fullConfig.showArrowOutline,
            arrowOutlineColor: fullConfig.arrowOutlineColor,
            arrowOutlineColorPaletteId: fullConfig.arrowOutlineColorPaletteId,
            arrowOutlineThickness: fullConfig.arrowOutlineThickness
        };

        const actions = {
            drawerConfigId: fullConfig.drawerConfigId,
            showAddPerspective: fullConfig.showAddPerspective,
            addPerspectiveConfigId: fullConfig.addPerspectiveConfigId,
            showAddObjective: fullConfig.showAddObjective,
            addObjectiveConfigId: fullConfig.addObjectiveConfigId
        };

        return { mapping, styling, actions };
    }

    // --- Tab Helpers ---

    function createTabButton(label, tabId, container) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.className = 'config-tab-button';
        btn.addEventListener("click", () => switchTab(tabId, container));
        btn.dataset.tabId = tabId;
        return btn;
    }

    function switchTab(tabId, container) {
        const contentDiv = container.querySelector("#bsc-config-contents");
        if (!contentDiv) return;

        contentDiv.querySelectorAll("[data-tab-section]").forEach(t => (t.style.display = "none"));
        container.querySelectorAll("[data-tab-id]").forEach(b => b.classList.remove('active'));

        const newActiveTab = contentDiv.querySelector(`[data-tab-section='${tabId}']`);
        if (newActiveTab) newActiveTab.style.display = "block";

        const activeBtn = container.querySelector(`[data-tab-id='${tabId}']`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- Tab Builders ---

    function buildGeneralTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "gen";
        tabEl.style.display = "none";

        const createTableOptions = (selectedId) => state.allTables.map(t =>
            `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name} (${t.id})</option>`
        ).join('');

        const createColumnOptions = (schema, selectedId) => {
            if (!schema) return `<option value="">-- Selecione a Tabela Primeiro --</option>`;
            return Object.values(schema).map(col =>
                `<option value="${col.colId}" ${col.colId === selectedId ? 'selected' : ''}>${col.label} (${col.colId})</option>`
            ).join('');
        };

        tabEl.innerHTML = `
            <h3>Configuração das Tabelas Fonte</h3>
            <fieldset>
                <legend><b>Tabelas do Modelo BSC</b></legend>
                <div class="form-group">
                    <label for="bsc-cfg-models-table">Tabela de Modelos:</label>
                    <select id="bsc-cfg-models-table" class="form-control">
                        ${createTableOptions(state.modelsTable)}
                    </select>
                </div>
                <div class="form-group">
                    <label for="bsc-cfg-perspectives-table">Tabela de Perspectivas:</label>
                    <select id="bsc-cfg-perspectives-table" class="form-control">
                        ${createTableOptions(state.perspectivesTable)}
                    </select>
                </div>
                <div class="form-group">
                    <label for="bsc-cfg-objectives-table">Tabela de Objetivos:</label>
                    <select id="bsc-cfg-objectives-table" class="form-control">
                        ${createTableOptions(state.objectivesTable)}
                    </select>
                </div>
            </fieldset>

            <fieldset>
                <legend><b>Mapeamento Avançado de Colunas</b></legend>
                <div class="form-group">
                    <label for="bsc-cfg-ref-model-col">Vínculo Perspectiva -> Modelo:</label>
                    <select id="bsc-cfg-ref-model-col" class="form-control">
                        <option value="">-- Selecionar Coluna --</option>
                        ${createColumnOptions(state.perspectivesSchema, state.refModelCol)}
                    </select>
                    <p class="help-text">Nome da coluna na tabela de <b>Perspectivas</b> que aponta para o Modelo.</p>
                </div>
                <div class="form-group">
                    <label for="bsc-cfg-ref-persp-col">Vínculo Objetivo -> Perspectiva:</label>
                    <select id="bsc-cfg-ref-persp-col" class="form-control">
                        <option value="">-- Selecionar Coluna --</option>
                        ${createColumnOptions(state.objectivesSchema, state.refPerspCol)}
                    </select>
                    <p class="help-text">Nome da coluna na tabela de <b>Objetivos</b> que aponta para a Perspectiva.</p>
                </div>
                <div class="form-group">
                    <label for="bsc-cfg-rel-field">Vínculo Relacionamento (Setas):</label>
                    <select id="bsc-cfg-rel-field" class="form-control">
                        <option value="">-- Selecionar Coluna --</option>
                        ${createColumnOptions(state.objectivesSchema, state.relationshipField)}
                    </select>
                    <p class="help-text">Nome da coluna na tabela de <b>Objetivos</b> que aponta para o objetivo de origem da seta.</p>
                </div>
            </fieldset>
        `;
        container.appendChild(tabEl);

        // Listeners for Table changes to refresh schemas
        tabEl.querySelector('#bsc-cfg-models-table').addEventListener('change', async (e) => {
            syncState();
            state.modelsTable = e.target.value;
            state.modelsSchema = await _tableLens.getTableSchema(state.modelsTable);
            rebuildAll();
        });

        tabEl.querySelector('#bsc-cfg-perspectives-table').addEventListener('change', async (e) => {
            syncState();
            state.perspectivesTable = e.target.value;
            state.perspectivesSchema = await _tableLens.getTableSchema(state.perspectivesTable);
            rebuildAll();
        });

        tabEl.querySelector('#bsc-cfg-objectives-table').addEventListener('change', async (e) => {
            syncState();
            state.objectivesTable = e.target.value;
            state.objectivesSchema = await _tableLens.getTableSchema(state.objectivesTable);
            rebuildAll();
        });
    }

    function buildColumnsTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "cols";
        tabEl.style.display = "none";

        // Filter for Card System configs
        const cardConfigs = state.receivedConfigs.filter(c => c.componentType === 'Card System');
        const createCardOptions = (selectedId) => cardConfigs.map(c =>
            `<option value="${c.configId}" ${c.configId === selectedId ? 'selected' : ''}>
                ${c.widgetTitle} (${c.configId})
            </option>`
        ).join('');

        // Create options for Choice columns in Models table
        const choiceColumns = Object.values(state.modelsSchema || {}).filter(col => 
            col.type === 'Choice' || col.type === 'Text'
        );
        const createFieldOptions = (selectedId) => choiceColumns.map(col =>
            `<option value="${col.colId}" ${col.colId === selectedId ? 'selected' : ''}>${col.label} (${col.colId})</option>`
        ).join('');

        // Detect choices if typeField is a Choice column
        let choiceRowsHtml = '';
        const selectedCol = state.modelsSchema ? state.modelsSchema[state.typeField] : null;
        if (selectedCol && selectedCol.type === 'Choice') {
            const choices = selectedCol.widgetOptions?.choices || [];
            choiceRowsHtml = choices.map(choice => `
                <div class="form-group dynamic-card-mapping" data-choice="${choice}">
                    <label>${choice}:</label>
                    <select class="form-control">
                        <option value="">-- Usar Padrão --</option>
                        ${createCardOptions(state.typeConfigMap[choice])}
                    </select>
                </div>
            `).join('');
        }

        tabEl.innerHTML = `
            <h3>Configuração de Exibição (Cards)</h3>
            <fieldset>
                <legend><b>Mapeamento Dinâmico por Tipo de Modelo</b></legend>
                
                <div class="form-group">
                    <label for="bsc-cfg-type-field">Coluna que define o Tipo (na tabela de Modelos):</label>
                    <select id="bsc-cfg-type-field" class="form-control">
                        <option value="">-- Selecionar Coluna --</option>
                        ${createFieldOptions(state.typeField)}
                    </select>
                    <p class="help-text">Escolha uma coluna do tipo "Choice" na tabela de Modelos.</p>
                </div>

                <div class="form-group">
                    <label for="bsc-cfg-default-card-id">Card Padrão (Fallback):</label>
                    <select id="bsc-cfg-default-card-id" class="form-control">
                        <option value="">-- Selecionar Card --</option>
                        ${createCardOptions(state.defaultCardConfigId)}
                    </select>
                    <p class="help-text">Card usado se não houver mapeamento específico ou a coluna de tipo estiver vazia.</p>
                </div>

                ${choiceRowsHtml ? `
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc;">
                        <h4>Configuração por Opção:</h4>
                        ${choiceRowsHtml}
                    </div>
                ` : ''}

            </fieldset>
        `;
        container.appendChild(tabEl);
        
        // Listener to refresh tab when typeField changes to show choices
        const fieldSelect = tabEl.querySelector('#bsc-cfg-type-field');
        if (fieldSelect) {
            fieldSelect.addEventListener('change', async (e) => {
                syncState();
                state.typeField = e.target.value;
                rebuildAll();
            });
        }
    }

    function buildStyleTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "style";
        tabEl.style.display = "none";

        tabEl.innerHTML = `
            <h3>Visual Style & Tabs</h3>
            
            <fieldset>
                <legend><b>Abas Adicionais</b></legend>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="bsc-cfg-show-swot" ${state.showSwotTab ? 'checked' : ''}>
                        Mostrar Aba SWOT
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="bsc-cfg-show-pestal" ${state.showPestalTab ? 'checked' : ''}>
                        Mostrar Aba PESTAL
                    </label>
                </div>
            </fieldset>

            <fieldset>
                <legend><b>Estilo das Setas (Relacionamentos)</b></legend>
                
                ${renderPaletteColorPicker('arrow-color', 'Cor Interna', state.arrowColor, state.arrowColorPaletteId)}

                <div class="form-group" style="margin-top:10px;">
                    <label for="bsc-cfg-arrow-thickness">Espessura (px):</label>
                    <input type="number" id="bsc-cfg-arrow-thickness" class="form-control" value="${state.arrowThickness}" step="0.5" min="1">
                </div>
                
                <div class="form-group" style="margin-top:15px;">
                    <label>
                        <input type="checkbox" id="bsc-cfg-show-arrow-outline" ${state.showArrowOutline ? 'checked' : ''}>
                        Habilitar Outline (Contorno)
                    </label>
                </div>
                
                <div id="arrow-outline-settings" style="display: ${state.showArrowOutline ? 'block' : 'none'}; margin-left: 20px;">
                    ${renderPaletteColorPicker('arrow-outline-color', 'Cor do Contorno', state.arrowOutlineColor, state.arrowOutlineColorPaletteId)}
                    <div class="form-group" style="margin-top:10px;">
                        <label for="bsc-cfg-arrow-outline-thickness">Espessura do Contorno (proporcional):</label>
                        <input type="number" id="bsc-cfg-arrow-outline-thickness" class="form-control" value="${state.arrowOutlineThickness}" step="0.1" min="0">
                    </div>
                </div>
            </fieldset>

            <h3>Outras Configurações</h3>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="bsc-cfg-use-coloris" ${state.useColoris ? 'checked' : ''}>
                    Use Coloris library (Legacy)
                </label>
            </div>
        `;
        container.appendChild(tabEl);

        tabEl.querySelector('#bsc-cfg-show-arrow-outline').addEventListener('change', (e) => {
            tabEl.querySelector('#arrow-outline-settings').style.display = e.target.checked ? 'block' : 'none';
        });

        // Initialize Palette Listeners
        setupPaletteListeners(tabEl, 'arrow-color');
        setupPaletteListeners(tabEl, 'arrow-outline-color');
    }

    function renderPaletteColorPicker(idPrefix, label, currentValue, currentPaletteId) {
        const palettes = state.receivedConfigs.filter(c => c.componentType === 'Color Options');
        const paletteOptions = palettes.map(p => `<option value="${p.configId}" ${p.configId === currentPaletteId ? 'selected' : ''}>${p.widgetTitle}</option>`).join('');
        
        // Ensure hex for <input type="color">
        const ensureHex = (val) => {
            if (!val || typeof val !== 'string') return '#000000';
            if (val.startsWith('#')) return val;
            // Fallback for rgba or other formats that the color input doesn't like
            return '#000000'; 
        };

        return `
            <div class="palette-linked-picker" data-id-prefix="${idPrefix}">
                <label style="font-weight: bold; font-size: 11px; color: #64748b; text-transform: uppercase;">${label}</label>
                <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <div style="flex: 1;">
                        <label style="font-size: 10px;">Vincular Paleta:</label>
                        <select id="bsc-cfg-${idPrefix}-palette-id" class="form-control palette-id-select">
                            <option value="">-- Manual (Hex) --</option>
                            ${paletteOptions}
                        </select>
                    </div>
                    <div style="width: 60px;">
                        <label style="font-size: 10px;">Cor:</label>
                        <input type="color" id="bsc-cfg-${idPrefix}" class="form-control color-manual-input" value="${ensureHex(currentValue)}">
                    </div>
                </div>
                <div id="${idPrefix}-palette-container" class="palette-picker-container" style="display: ${currentPaletteId ? 'block' : 'none'};">
                    <div class="palette-color-grid"></div>
                </div>
            </div>
        `;
    }

    function setupPaletteListeners(tabEl, idPrefix) {
        const paletteSelect = tabEl.querySelector(`#bsc-cfg-${idPrefix}-palette-id`);
        const manualInput = tabEl.querySelector(`#bsc-cfg-${idPrefix}`);
        const paletteContainer = tabEl.querySelector(`#${idPrefix}-palette-container`);
        const grid = paletteContainer.querySelector('.palette-color-grid');

        const updateGrid = () => {
            const paletteId = paletteSelect.value;
            if (!paletteId) {
                paletteContainer.style.display = 'none';
                return;
            }
            paletteContainer.style.display = 'block';
            grid.innerHTML = '';
            
            const palette = state.receivedConfigs.find(c => c.configId === paletteId);
            if (palette) {
                try {
                    const data = JSON.parse(palette.stylingJson || palette.configJson || '{}');
                    const colors = data.colors || [];
                    colors.forEach(c => {
                        const swatch = document.createElement('div');
                        swatch.className = 'palette-color-swatch' + (c.hex.toUpperCase() === manualInput.value.toUpperCase() ? ' active' : '');
                        swatch.style.backgroundColor = c.hex;
                        swatch.title = c.label || c.hex;
                        swatch.onclick = () => {
                            manualInput.value = c.hex;
                            grid.querySelectorAll('.palette-color-swatch').forEach(s => s.classList.remove('active'));
                            swatch.classList.add('active');
                            // Trigger manual input change to update debug/state
                            manualInput.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        grid.appendChild(swatch);
                    });
                } catch(e) { console.error("Error parsing palette JSON:", e); }
            }
        };

        paletteSelect.addEventListener('change', updateGrid);
        updateGrid();
    }

    function buildActionsTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "act";
        tabEl.style.display = "none";

        // Filter for Drawer configs
        const drawerConfigs = state.receivedConfigs.filter(c => c.componentType === 'Drawer');
        const createDrawerOptions = (selectedId) => drawerConfigs.map(c =>
            `<option value="${c.configId}" ${c.configId === selectedId ? 'selected' : ''}>
                ${c.widgetTitle} (${c.configId})
            </option>`
        ).join('');

        tabEl.innerHTML = `
            <h3>Actions Configuration</h3>
            <fieldset>
                <legend><b>Card Click Action</b></legend>
                <div class="form-group">
                    <label for="bsc-cfg-drawer-id">Open Drawer Configuration:</label>
                    <select id="bsc-cfg-drawer-id" class="form-control">
                        <option value="">-- Default / None --</option>
                        ${createDrawerOptions(state.drawerConfigId)}
                    </select>
                    <p class="help-text">
                        Select a Drawer Configuration to open when a card is clicked. 
                    </p>
                </div>
            </fieldset>

            <fieldset>
                <legend><b>Global "Add New" Buttons</b></legend>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="bsc-cfg-show-add-persp" ${state.showAddPerspective ? 'checked' : ''}>
                        Habilitar Botão "Adicionar Perspectiva"
                    </label>
                    <div style="margin-top:5px; margin-left:20px;">
                        <label for="bsc-cfg-add-persp-id" style="font-size:11px;">Configuração da Gaveta:</label>
                        <select id="bsc-cfg-add-persp-id" class="form-control">
                            <option value="">-- Default --</option>
                            ${createDrawerOptions(state.addPerspectiveConfigId)}
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-top:15px;">
                    <label>
                        <input type="checkbox" id="bsc-cfg-show-add-obj" ${state.showAddObjective ? 'checked' : ''}>
                        Habilitar Botão "Adicionar Objetivo"
                    </label>
                    <div style="margin-top:5px; margin-left:20px;">
                        <label for="bsc-cfg-add-obj-id" style="font-size:11px;">Configuração da Gaveta:</label>
                        <select id="bsc-cfg-add-obj-id" class="form-control">
                            <option value="">-- Default --</option>
                            ${createDrawerOptions(state.addObjectiveConfigId)}
                        </select>
                    </div>
                </div>
            </fieldset>
        `;
        container.appendChild(tabEl);
    }

    return {
        render,
        read
    };
})();
