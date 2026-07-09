
export const DrawerConfigEditor = (() => {
    let currentSchema = null;
    let currentTableId = null;
    let stageConfigs = {};
    let currentEditingStage = '_global';
    let _mainContainer = null;
    let _allConfigs = []; // Cache all configs for dropdowns

    const DEFAULT_STYLING = {
        displayMode: 'drawer',
        width: '400px',
        showDebugInfo: false,
        titleField: null,
        headerBackgroundMode: 'solid',
        headerBackgroundSolidColor: '#f8fafc',
        headerBackgroundGradientType: 'linear-gradient(to right, {c1}, {c2})',
        headerBackgroundGradientColor1: '#f8fafc',
        headerBackgroundGradientColor2: '#f1f5f9',
        headerBackgroundField: null,
        headerTextMode: 'solid',
        headerTextSolidColor: '#1e293b',
        headerTextField: null
    };

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
            outputEl.textContent = 'Erro ao gerar JSON: ' + e.message;
        }
    }

    async function render(container, configData, lens, tableId, allConfigs) {
        _mainContainer = container; 
        currentTableId = tableId; 
        _allConfigs = allConfigs || [];

        if (!tableId) {
            container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>';
            return;
        }
        currentSchema = await lens.getTableSchema(tableId);
        if (!currentSchema) {
            container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>';
            return;
        }

        const styling = configData.styling || configData;

        stageConfigs = {
            _global: { hiddenFields: configData.hiddenFields || [], lockedFields: configData.lockedFields || [], requiredFields: configData.requiredFields || [] },
            ...(configData.workflow?.stages || {})
        };
        currentEditingStage = '_global';

        container.innerHTML = `
            <style>
                .debug-tri-section { margin-bottom: 15px; border-left: 4px solid #ddd; padding-left: 10px; }
                .debug-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
                .debug-label.mapping { color: #0d6efd; }
                .debug-label.styling { color: #198754; }
                .debug-label.actions { color: #fd7e14; }
                .config-debugger pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; max-height: 200px; overflow: auto; }
                .drawer-tab-btn { padding: 8px 16px; cursor: pointer; border: 1px solid #ddd; border-bottom: none; background: #f1f5f9; border-radius: 4px 4px 0 0; }
                .drawer-tab-btn.active { background: #fff; font-weight: bold; border-top: 2px solid #0d6efd; }
                .drawer-tab-content { border: 1px solid #ddd; padding: 15px; background: #fff; border-radius: 0 4px 4px 4px; }
                .styling-grid { display: grid; grid-template-columns: 1fr; gap: 15px; }
                @media (min-width: 600px) { .styling-grid { grid-template-columns: 1fr 1fr; } }
            </style>
            
            <div class="drawer-tabs-nav" style="display: flex; gap: 5px; margin-bottom: -1px; position: relative; z-index: 2;">
                <button type="button" class="drawer-tab-btn active" data-tab="fields">Campos e Abas</button>
                <button type="button" class="drawer-tab-btn" data-tab="styles">Estilos</button>
                <button type="button" class="drawer-tab-btn" data-tab="workflow">Workflow</button>
            </div>

            <div id="tab-fields" class="drawer-tab-content">
                <div class="drawer-config-section">
                    <label for="displayModeSelector">Modo:</label>
                    <select id="displayModeSelector"><option value="drawer" ${styling.displayMode === 'drawer' ? 'selected' : ''}>Drawer</option><option value="modal" ${styling.displayMode === 'modal' ? 'selected' : ''}>Modal</option></select>
                </div>
                <div class="drawer-config-section">
                    <label for="drawerWidthSelector">Largura:</label>
                    <select id="drawerWidthSelector">
                        ${['25%', '35%', '40%', '50%', '60%', '75%'].map(w => `<option value="${w}" ${styling.width === w ? 'selected' : ''}>${w}</option>`).join('')}
                    </select>
                </div>
                <div class="drawer-config-section">
                     <label><input type="checkbox" id="showDebugInfoCheckbox" ${styling.showDebugInfo ? 'checked' : ''}> Show Schema Debug Info (in Drawer)</label>
                </div>

                <div class="drawer-config-section" style="border: 1px solid #dee2e6; padding: 10px; border-radius: 4px; background-color: #f8f9fa;">
                    <label style="font-weight:bold; margin-bottom: 8px;">Configurações Globais de Layout:</label>
                    <div style="display:flex; gap: 15px; margin-bottom: 10px;">
                        <div style="flex:1;">
                            <label>Espaçamento entre campos:</label>
                            <select id="layoutGapSelector">
                                <option value="20" ${configData.layout?.gap === '20' || !configData.layout?.gap ? 'selected' : ''}>Padrão (20px)</option>
                                <option value="15" ${configData.layout?.gap === '15' ? 'selected' : ''}>Compacto (15px)</option>
                                <option value="10" ${configData.layout?.gap === '10' ? 'selected' : ''}>Muito Compacto (10px)</option>
                                <option value="5" ${configData.layout?.gap === '5' ? 'selected' : ''}>Mínimo (5px)</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label>Posição dos Labels:</label>
                            <select id="layoutLabelPositionSelector">
                                <option value="above" ${configData.layout?.labelPosition !== 'left' ? 'selected' : ''}>Acima do Valor (Padrão)</option>
                                <option value="left" ${configData.layout?.labelPosition === 'left' ? 'selected' : ''}>À Esquerda do Valor</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="leftLabelOptions" style="display:${configData.layout?.labelPosition === 'left' ? 'flex' : 'none'}; gap: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
                        <div style="flex:1;">
                            <label>Alinhamento do Texto:</label>
                            <select id="layoutLabelAlignSelector">
                                <option value="left" ${configData.layout?.labelAlign === 'left' || !configData.layout?.labelAlign ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${configData.layout?.labelAlign === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right" ${configData.layout?.labelAlign === 'right' ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label>Largura do Label:</label>
                            <select id="layoutLabelWidthSelector">
                                ${[10,20,30,40,50,60,70,80,90].map(w => `<option value="${w}" ${configData.layout?.labelWidth === String(w) ? 'selected' : (w===30 && !configData.layout?.labelWidth) ? 'selected' : ''}>${w}%</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="config-section-title">Regras e Ordem dos Campos</div>
                <div class="drawer-config-section">
                    <button type="button" id="addTabBtn" class="btn btn-primary add-tab-btn">📑 + Adicionar Aba</button>
                    <ul id="unifiedFieldList" class="field-order-list"></ul>
                </div>
            </div>

            <div id="tab-styles" class="drawer-tab-content" style="display: none;">
                <h3>Estilos do Cabeçalho</h3>
                <div class="styling-grid">
                    <fieldset>
                        <legend><b>Título</b></legend>
                        <label for="drawerTitleFieldSelector">Campo do Título:</label>
                        <select id="drawerTitleFieldSelector">
                            <option value="">-- Automático (ID) --</option>
                        </select>
                    </fieldset>

                    <fieldset>
                        <legend><b>Cor de Fundo (Cabeçalho)</b></legend>
                        <label><input type="radio" name="headBgMode" value="solid"> Sólido</label>
                        <label><input type="radio" name="headBgMode" value="gradient"> Gradiente</label>
                        <label><input type="radio" name="headBgMode" value="conditional"> Por Opção de Choice</label>
                        <label><input type="radio" name="headBgMode" value="text-value"> Valor do Campo (Hex)</label>
                        
                        <div class="style-control-group" data-mode="solid">
                            <input type="color" id="drawer-head-bgcolor">
                        </div>
                        <div class="style-control-group" data-mode="gradient" style="display:none;">
                            <select id="drawer-head-bggradient-type">
                                <option value="linear-gradient(to right, {c1}, {c2})">Linear H</option>
                                <option value="linear-gradient(to bottom, {c1}, {c2})">Linear V</option>
                                <option value="radial-gradient(circle, {c1}, {c2})">Radial</option>
                            </select>
                            <input type="color" id="drawer-head-bggradient-c1">
                            <input type="color" id="drawer-head-bggradient-c2">
                        </div>
                        <div class="style-control-group" data-mode="conditional" style="display:none;">
                            <select id="drawer-head-bgfield"><option value="">-- selecionar campo --</option></select>
                        </div>
                        <div class="style-control-group" data-mode="text-value" style="display:none;">
                            <select id="drawer-head-bgfield-raw"><option value="">-- selecionar campo hex --</option></select>
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend><b>Cor do Texto e Ícones</b></legend>
                        <label><input type="radio" name="headTextMode" value="solid"> Sólido</label>
                        <label><input type="radio" name="headTextMode" value="conditional"> Por Opção de Choice</label>
                        <label><input type="radio" name="headTextMode" value="text-value"> Valor do Campo (Hex)</label>
                        
                        <div class="style-control-group" data-mode="solid">
                            <input type="color" id="drawer-head-textcolor">
                        </div>
                        <div class="style-control-group" data-mode="conditional" style="display:none;">
                            <select id="drawer-head-textfield"><option value="">-- selecionar campo --</option></select>
                        </div>
                        <div class="style-control-group" data-mode="text-value" style="display:none;">
                            <select id="drawer-head-textfield-raw"><option value="">-- selecionar campo hex --</option></select>
                        </div>
                    </fieldset>
                </div>
            </div>

            <div id="tab-workflow" class="drawer-tab-content" style="display: none;">
                <div id="workflowConfigContainer"></div>
                <div id="stageSelectorContainer" class="drawer-config-section" style="display: none;">
                    <label for="stageSelector">Editando Regras Para:</label>
                    <select id="stageSelector"></select>
                    <button id="copyStageConfigBtn" class="btn btn-secondary btn-sm">Copiar Regras...</button>
                </div>
                <p class="help-text">Configure regras de visibilidade e edição baseadas no status do registro.</p>
            </div>

            <details class="config-debugger" style="margin-top: 20px;">
                <summary>Ver Tripartição JSON (Debug)</summary>
                <div id="config-json-output"></div>
            </details>`;

        // Tab Switcher Logic
        const tabBtns = container.querySelectorAll('.drawer-tab-btn');
        const tabContents = container.querySelectorAll('.drawer-tab-content');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');
                btn.classList.add('active');
                container.querySelector(`#tab-${btn.dataset.tab}`).style.display = 'block';
            };
        });

        _renderWorkflowUI(configData.workflow, currentSchema);
        const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        const unifiedListEl = container.querySelector('#unifiedFieldList');
        const tabs = configData.tabs && configData.tabs.length > 0 ? configData.tabs : [{ title: 'Principal', isHidden: false, fields: allCols.map(c => c.colId) }];
        const usedFields = new Set();

        for (const tab of tabs) {
            unifiedListEl.appendChild(createTabCard(tab.title, tab.isHidden));
            for (const fieldId of tab.fields) {
                const col = allCols.find(c => c.colId === fieldId);
                if (col) {
                    unifiedListEl.appendChild(createFieldCard(col, configData, lens));
                    usedFields.add(fieldId);
                }
            }
        }
        for (const col of allCols) {
            if (!usedFields.has(col.colId)) {
                unifiedListEl.appendChild(createFieldCard(col, configData, lens));
            }
        }

        // Populate Styling Selects
        const allFieldIds = allCols.map(c => c.colId);
        _populateSelect(container.querySelector('#drawerTitleFieldSelector'), allFieldIds);
        _populateSelect(container.querySelector('#drawer-head-bgfield'), allFieldIds);
        _populateSelect(container.querySelector('#drawer-head-bgfield-raw'), allFieldIds);
        _populateSelect(container.querySelector('#drawer-head-textfield'), allFieldIds);
        _populateSelect(container.querySelector('#drawer-head-textfield-raw'), allFieldIds);

        // Populate Styling Tab
        _populateStylingTab(container, styling);

        _applyStageUI(currentEditingStage);
        addEventListeners(container);
        enableDragAndDrop(unifiedListEl);
        updateDebugJson(); 
    }

    function _populateSelect(select, values) {
        if (!select) return;
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
        });
    }

    function _populateStylingTab(container, s) {
        const styling = { ...DEFAULT_STYLING, ...s };
        
        container.querySelector('#drawerTitleFieldSelector').value = styling.titleField || '';
        
        // Header BG
        const bgModeInput = container.querySelector(`input[name='headBgMode'][value='${styling.headerBackgroundMode || 'solid'}']`);
        if (bgModeInput) bgModeInput.checked = true;
        container.querySelector('#drawer-head-bgcolor').value = styling.headerBackgroundSolidColor || '#f8fafc';
        container.querySelector('#drawer-head-bggradient-type').value = styling.headerBackgroundGradientType || 'linear-gradient(to right, {c1}, {c2})';
        container.querySelector('#drawer-head-bggradient-c1').value = styling.headerBackgroundGradientColor1 || '#f8fafc';
        container.querySelector('#drawer-head-bggradient-c2').value = styling.headerBackgroundGradientColor2 || '#f1f5f9';
        container.querySelector('#drawer-head-bgfield').value = styling.headerBackgroundField || '';
        container.querySelector('#drawer-head-bgfield-raw').value = styling.headerBackgroundField || '';

        // Header Text
        const textModeInput = container.querySelector(`input[name='headTextMode'][value='${styling.headerTextMode || 'solid'}']`);
        if (textModeInput) textModeInput.checked = true;
        container.querySelector('#drawer-head-textcolor').value = styling.headerTextSolidColor || '#1e293b';
        container.querySelector('#drawer-head-textfield').value = styling.headerTextField || '';
        container.querySelector('#drawer-head-textfield-raw').value = styling.headerTextField || '';

        // Mode switchers
        container.querySelectorAll('fieldset').forEach(fieldset => {
            const radios = fieldset.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                const update = () => {
                    const mode = fieldset.querySelector('input[type="radio"]:checked')?.value;
                    fieldset.querySelectorAll('.style-control-group').forEach(group => {
                        group.style.display = group.dataset.mode === mode ? 'block' : 'none';
                    });
                };
                radio.addEventListener('change', update);
                update();
            });
        });
    }

    function read(container) {
        const fullConfig = _readFromUI();
        
        // --- TRIPARTIÇÃO ---
        const mapping = {
            tableId: fullConfig.tableId,
            layout: fullConfig.layout,
            tabs: fullConfig.tabs,
            hiddenFields: fullConfig.hiddenFields,
            lockedFields: fullConfig.lockedFields,
            requiredFields: fullConfig.requiredFields,
            refListFieldConfig: fullConfig.refListFieldConfig,
            styleOverrides: fullConfig.styleOverrides,
            widgetOverrides: fullConfig.widgetOverrides,
            fieldOptions: fullConfig.fieldOptions
        };
        
        const styling = {
            displayMode: fullConfig.displayMode,
            width: fullConfig.width,
            showDebugInfo: fullConfig.showDebugInfo,
            ..._readStylingFromUI(container)
        };
        
        const actions = {
            workflow: fullConfig.workflow
        };
        
        return { mapping, styling, actions };
    }

    function _readStylingFromUI(container) {
        const getVal = id => container.querySelector(id)?.value;
        const getRadio = name => container.querySelector(`input[name="${name}"]:checked`)?.value;

        const bgMode = getRadio('headBgMode');
        const bgField = (bgMode === 'text-value') ? getVal('#drawer-head-bgfield-raw') : getVal('#drawer-head-bgfield');
        
        const textMode = getRadio('headTextMode');
        const textField = (textMode === 'text-value') ? getVal('#drawer-head-textfield-raw') : getVal('#drawer-head-textfield');

        return {
            titleField: getVal('#drawerTitleFieldSelector'),
            headerBackgroundMode: bgMode,
            headerBackgroundSolidColor: getVal('#drawer-head-bgcolor'),
            headerBackgroundGradientType: getVal('#drawer-head-bggradient-type'),
            headerBackgroundGradientColor1: getVal('#drawer-head-bggradient-c1'),
            headerBackgroundGradientColor2: getVal('#drawer-head-bggradient-c2'),
            headerBackgroundField: bgField,
            headerTextMode: textMode,
            headerTextSolidColor: getVal('#drawer-head-textcolor'),
            headerTextField: textField
        };
    }

    function _readFromUI() {
        if (!currentSchema) return {};
        const container = _mainContainer;
        if (!container || !container.querySelector('#displayModeSelector')) return {};

        _persistCurrentStageUI(currentEditingStage);

        const drawerConfig = {
            tableId: currentTableId,
            displayMode: container.querySelector('#displayModeSelector').value,
            width: container.querySelector('#drawerWidthSelector').value,
            showDebugInfo: container.querySelector('#showDebugInfoCheckbox')?.checked || false,
            layout: {
                gap: container.querySelector('#layoutGapSelector')?.value || '20',
                labelPosition: container.querySelector('#layoutLabelPositionSelector')?.value || 'above',
                labelAlign: container.querySelector('#layoutLabelAlignSelector')?.value || 'left',
                labelWidth: container.querySelector('#layoutLabelWidthSelector')?.value || '30'
            },
            tabs: [],
            refListFieldConfig: {},
            styleOverrides: {},
            widgetOverrides: {},
            fieldOptions: {},
            workflow: {
                enabled: container.querySelector('#workflowEnabledCheckbox')?.checked || false,
                stageField: container.querySelector('#stageFieldSelector')?.value || null,
                stages: stageConfigs
            },
            hiddenFields: stageConfigs['_global'].hiddenFields,
            lockedFields: stageConfigs['_global'].lockedFields,
            requiredFields: stageConfigs['_global'].requiredFields
        };

        let currentTab = null;
        const listItems = container.querySelectorAll('#unifiedFieldList > li');

        listItems.forEach(item => {
            if (item.classList.contains('tab-card')) {
                if (currentTab) drawerConfig.tabs.push(currentTab);
                currentTab = { 
                    title: item.querySelector('.tab-card-input').value, 
                    isHidden: item.querySelector('.is-tab-hidden-checkbox')?.checked || false,
                    fields: [] 
                };
            } else if (item.classList.contains('field-card')) {
                if (!currentTab) currentTab = { title: 'Principal', isHidden: false, fields: [] };
                const colId = item.dataset.colId;
                currentTab.fields.push(colId);

                const customLabelInput = item.querySelector('.custom-label-input');
                if (customLabelInput && customLabelInput.value.trim() !== '') {
                    if (!drawerConfig.fieldOptions[colId]) drawerConfig.fieldOptions[colId] = {};
                    drawerConfig.fieldOptions[colId].customLabel = customLabelInput.value.trim();
                }

                const rendererSelect = item.querySelector('.special-renderer-select');
                if (rendererSelect && rendererSelect.value) {
                    if (!drawerConfig.fieldOptions[colId]) drawerConfig.fieldOptions[colId] = {};
                    if (rendererSelect.value === 'colorPicker') drawerConfig.fieldOptions[colId].colorPicker = true;
                    if (rendererSelect.value === 'progressBar') drawerConfig.fieldOptions[colId].progressBar = true;
                }

                const refListConfigPanel = item.querySelector('.reflist-config-panel');
                if (refListConfigPanel) {
                    const refConfig = {
                        _refListConfig: {
                            displayAs: refListConfigPanel.querySelector('.reflist-display-as').value,
                            collapsible: refListConfigPanel.querySelector('.reflist-collapsible-checkbox').checked,
                            cardConfigId: refListConfigPanel.querySelector('.reflist-card-config-id').value.trim(),
                            showAddButton: refListConfigPanel.querySelector('.reflist-show-add-checkbox').checked,
                            addRecordConfigId: refListConfigPanel.querySelector('.reflist-add-config-id').value.trim()
                        }
                    };
                    refListConfigPanel.querySelectorAll('tbody tr').forEach(row => {
                        const refColId = row.dataset.refColId;
                        refConfig[refColId] = {
                            showInTable: row.querySelector('[data-config-key="showInTable"]').checked,
                            hideInModal: row.querySelector('[data-config-key="hideInModal"]').checked,
                            lockInModal: row.querySelector('[data-config-key="lockInModal"]').checked,
                            requireInModal: row.querySelector('[data-config-key="requireInModal"]').checked
                        };
                    });
                    refConfig._options = { zebra: item.querySelector('.reflist-zebra-checkbox')?.checked || false };
                    drawerConfig.refListFieldConfig[colId] = refConfig;
                }

                const styleConfigPanel = item.querySelector('.style-config-panel');
                if (styleConfigPanel) {
                    const overrides = {
                        ignoreConditional: styleConfigPanel.querySelector('[data-style-key="ignoreConditional"]')?.checked || false,
                        ignoreHeader: styleConfigPanel.querySelector('[data-style-key="ignoreHeader"]')?.checked || false,
                        ignoreCell: styleConfigPanel.querySelector('[data-style-key="ignoreCell"]')?.checked || false,
                    };
                    if (overrides.ignoreConditional || overrides.ignoreHeader || overrides.ignoreCell) {
                        drawerConfig.styleOverrides[colId] = overrides;
                    }
                }

                const widgetConfigPanel = item.querySelector('.widget-config-panel');
                if (widgetConfigPanel) {
                    const isColorPicker = widgetConfigPanel.querySelector('.is-color-picker-checkbox')?.checked;
                    const widgetTypeRadio = widgetConfigPanel.querySelector('.widget-type-radio:checked');
                    const widgetType = widgetTypeRadio?.value;
                    if (isColorPicker) {
                        drawerConfig.widgetOverrides[colId] = {
                            widget: 'ColorPicker',
                            options: {
                                colorPaletteId: widgetConfigPanel.querySelector('.color-palette-id-select').value,
                                mode: widgetConfigPanel.querySelector('.color-mode-select').value,
                                swatches: widgetConfigPanel.querySelector('.color-swatches-input').value.trim()
                            }
                        };
                    } else if (widgetType === 'ProgressBar') {
                        const striped = widgetConfigPanel.querySelector('.progress-striped')?.checked || false;
                        const progressType = widgetConfigPanel.querySelector('.progress-type')?.value || 'linear';
                        const labelPosition = widgetConfigPanel.querySelector('.progress-label-pos')?.value || 'middle';
                        const rules = [];
                        widgetConfigPanel.querySelectorAll('.color-rule-row').forEach(row => {
                            const threshold = parseFloat(row.querySelector('.rule-threshold').value);
                            const color = row.querySelector('.rule-color').value;
                            if (!isNaN(threshold)) rules.push({ threshold, color });
                        });
                        drawerConfig.widgetOverrides[colId] = { 
                            widget: 'ProgressBar', 
                            options: { striped, progressType, labelPosition, colorRules: rules } 
                        };
                    } else if (widgetType) {
                        drawerConfig.widgetOverrides[colId] = { widget: widgetType, options: {} };
                    }
                }
            }
        });

        if (currentTab) drawerConfig.tabs.push(currentTab);
        return drawerConfig;
    }

    function _persistCurrentStageUI(stageName) { if (!stageName) return; const stageData = { hiddenFields: [], lockedFields: [], requiredFields: [] }; document.querySelectorAll('#unifiedFieldList .field-card').forEach(card => { const colId = card.dataset.colId; if (card.querySelector('.is-hidden-checkbox').checked) stageData.hiddenFields.push(colId); if (card.querySelector('.is-locked-checkbox').checked) stageData.lockedFields.push(colId); if (card.querySelector('.is-required-checkbox').checked) stageData.requiredFields.push(colId); }); stageConfigs[stageName] = stageData; }
    function _applyStageUI(stageName) { 
        currentEditingStage = stageName; 
        const stageData = stageConfigs[stageName] || { hiddenFields: [], lockedFields: [], requiredFields: [] }; 
        const svgEyeOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#94a3b8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        const svgLockClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        const svgLockOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
        const svgAsteriskReq = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="7.05" y1="7.05" x2="16.95" y2="16.95"></line><line x1="7.05" y1="16.95" x2="16.95" y2="7.05"></line></svg>`;
        const svgAsteriskOpt = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#cbd5e1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="7.05" y1="7.05" x2="16.95" y2="16.95"></line><line x1="7.05" y1="16.95" x2="16.95" y2="7.05"></line></svg>`;

        document.querySelectorAll('#unifiedFieldList .field-card').forEach(card => { 
            const colId = card.dataset.colId; 
            const isHidden = stageData.hiddenFields.includes(colId);
            const isLocked = stageData.lockedFields.includes(colId);
            const isRequired = stageData.requiredFields.includes(colId);

            card.querySelector('.is-hidden-checkbox').checked = isHidden; 
            card.querySelector('.is-locked-checkbox').checked = isLocked; 
            card.querySelector('.is-required-checkbox').checked = isRequired; 
            
            const iconHidden = card.querySelector('.icon-hidden');
            const iconLocked = card.querySelector('.icon-locked');
            const iconRequired = card.querySelector('.icon-required');
            
            if (iconHidden) iconHidden.innerHTML = isHidden ? svgEyeClosed : svgEyeOpen;
            if (iconLocked) iconLocked.innerHTML = isLocked ? svgLockClosed : svgLockOpen;
            if (iconRequired) iconRequired.innerHTML = isRequired ? svgAsteriskReq : svgAsteriskOpt;
        }); 
        const copyBtn = document.getElementById('copyStageConfigBtn'); 
        if (copyBtn) { copyBtn.disabled = (stageName === '_global'); } 
    }
    
    function _handleCopyStageConfig() { 
        const sourceStage = currentEditingStage; 
        if (!sourceStage || sourceStage === '_global') return; 
        _persistCurrentStageUI(sourceStage); 
        const sourceConfig = stageConfigs[sourceStage]; 
        const stageSelector = document.getElementById('stageSelector'); 
        const otherStages = Array.from(stageSelector.options).map(opt => opt.value).filter(val => val !== '_global' && val !== sourceStage); 
        if (otherStages.length === 0) return; 
        const modal = document.createElement('div'); 
        modal.className = 'copy-stage-modal'; 
        modal.innerHTML = ` <div class="copy-stage-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:20px; border-radius:8px; box-shadow:0 0 20px rgba(0,0,0,0.3); z-index:10000;"> <h3>Copiar regras de "${sourceStage}" para:</h3> <div class="copy-stage-list"> <label><input type="checkbox" id="rep-all" /> Marcar todos</label> <div id="rep-list"></div> </div> <div class="copy-stage-actions" style="margin-top:15px; display:flex; gap:10px;"> <button id="rep-ok" class="btn btn-primary">OK</button> <button id="rep-cancel" class="btn btn-secondary">Cancelar</button> </div> </div> `; 
        document.body.appendChild(modal); 
        const list = modal.querySelector('#rep-list'); 
        otherStages.forEach(stage => { list.innerHTML += ` <div> <label><input type="checkbox" class="rep-cb" value="${stage}"> ${stage}</label></div> `; }); 
        modal.querySelector('#rep-all').onchange = e => { list.querySelectorAll('.rep-cb').forEach(cb => cb.checked = e.target.checked); }; 
        modal.querySelector('#rep-cancel').onclick = () => document.body.removeChild(modal); 
        modal.querySelector('#rep-ok').onclick = () => { const targets = Array.from(list.querySelectorAll('.rep-cb:checked')).map(cb => cb.value); targets.forEach(targetStage => { stageConfigs[targetStage] = JSON.parse(JSON.stringify(sourceConfig)); }); document.body.removeChild(modal); updateDebugJson(); }; 
    }

    function _renderWorkflowUI(workflowConfig, tableSchema) { 
        const container = document.getElementById('workflowConfigContainer'); 
        const choiceColumns = Object.values(tableSchema).filter(col => col.type === 'Choice'); 
        container.innerHTML = `<div class="workflow-section"><label class="config-toggle"><input type="checkbox" id="workflowEnabledCheckbox" ${workflowConfig?.enabled ? 'checked' : ''}> Habilitar Workflow Condicional</label><div id="workflowControls" style="display: ${workflowConfig?.enabled ? 'flex' : 'none'}; flex-direction:column; gap:10px; margin-top:10px;"><label for="stageFieldSelector">Campo de Estágio:</label><select id="stageFieldSelector"><option value="">Selecione...</option>${choiceColumns.map(col => `<option value="${col.colId}" ${workflowConfig?.stageField === col.colId ? 'selected' : ''}>${col.label}</option>`).join('')}</select></div></div>`; 
        const enabledCheckbox = container.querySelector('#workflowEnabledCheckbox'); 
        const controlsContainer = container.querySelector('#workflowControls'); 
        const stageFieldSelector = container.querySelector('#stageFieldSelector'); 
        const stageSelectorContainer = document.getElementById('stageSelectorContainer'); 
        const stageSelector = document.getElementById('stageSelector'); 
        document.getElementById('copyStageConfigBtn').addEventListener('click', _handleCopyStageConfig); 
        function updateStageDropdown() { 
            const stageFieldId = stageFieldSelector.value; 
            const workflowEnabled = enabledCheckbox.checked; 
            if (workflowEnabled && stageFieldId) { 
                stageSelectorContainer.style.display = 'flex'; 
                const stageColumn = tableSchema[stageFieldId]; 
                const choices = stageColumn?.widgetOptions?.choices || []; 
                stageSelector.innerHTML = `<option value="_global"> Padrão(Global)</option>`; 
                choices.forEach(choice => { stageSelector.innerHTML += `<option value="${choice}"> ${choice}</option>`; }); 
                stageSelector.value = '_global'; _applyStageUI('_global'); 
            } else { 
                stageSelectorContainer.style.display = 'none'; _applyStageUI('_global'); 
            } 
        } 
        enabledCheckbox.addEventListener('change', () => { controlsContainer.style.display = enabledCheckbox.checked ? 'flex' : 'none'; updateStageDropdown(); }); 
        stageFieldSelector.addEventListener('change', updateStageDropdown); 
        stageSelector.addEventListener('change', (e) => { _persistCurrentStageUI(currentEditingStage); _applyStageUI(e.target.value); }); 
        updateStageDropdown(); 
    }

    function addEventListeners(container) { 
        container.addEventListener('change', updateDebugJson); 
        container.addEventListener('input', updateDebugJson); 
        container.querySelector('#addTabBtn').addEventListener('click', () => { 
            const list = container.querySelector('#unifiedFieldList'); 
            list.appendChild(createTabCard('Nova Aba')); 
        });
        const posSelector = container.querySelector('#layoutLabelPositionSelector');
        if (posSelector) {
            posSelector.addEventListener('change', (e) => {
                const leftOptions = container.querySelector('#leftLabelOptions');
                if (leftOptions) leftOptions.style.display = e.target.value === 'left' ? 'flex' : 'none';
            });
        }
    }

    function createTabCard(title, isHidden = false) { 
        const card = document.createElement('li'); card.className = 'tab-card'; card.draggable = true; 
        
        const svgEyeOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#94a3b8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        card.innerHTML = ` 
            <span class="tab-card-icon">📑</span> 
            <input type="text" class="tab-card-input" value="${title}"> 
            <input type="checkbox" class="is-tab-hidden-checkbox" style="display:none;" ${isHidden ? 'checked' : ''}>
            <div class="icon-toggle icon-tab-hidden" title="Visibilidade da Aba" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px; margin-left:8px;">
                ${isHidden ? svgEyeClosed : svgEyeOpen}
            </div>
            <button type="button" class="delete-tab-btn" title="Deletar Aba">🗑️</button> 
        `; 
        
        card.querySelector('.delete-tab-btn').addEventListener('click', (e) => { 
            e.stopPropagation();
            if (confirm(`Deletar aba?`)) card.remove(); 
        }); 

        const hiddenCb = card.querySelector('.is-tab-hidden-checkbox');
        const iconHidden = card.querySelector('.icon-tab-hidden');
        iconHidden.addEventListener('click', (e) => {
            e.stopPropagation();
            hiddenCb.checked = !hiddenCb.checked;
            iconHidden.innerHTML = hiddenCb.checked ? svgEyeClosed : svgEyeOpen;
            updateDebugJson();
        });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-tab-btn') || e.target.closest('.icon-toggle') || e.target.closest('input')) return;
            if (e.ctrlKey || e.shiftKey) {
                card.classList.toggle('selected');
            } else {
                document.querySelectorAll('#unifiedFieldList .selected').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
            }
        });

        return card; 
    }

    function enableDragAndDrop(listElement) { 
        if (!listElement) return; 
        
        let draggedItem = null; 
        let selectedItems = [];

        listElement.addEventListener('dragstart', e => { 
            const targetItem = e.target.closest('li');
            if (!targetItem.classList.contains('selected')) {
                document.querySelectorAll('#unifiedFieldList .selected').forEach(el => el.classList.remove('selected'));
                targetItem.classList.add('selected');
            }
            
            selectedItems = Array.from(listElement.querySelectorAll('.selected'));
            draggedItem = targetItem;
            
            setTimeout(() => {
                selectedItems.forEach(item => item.classList.add('dragging'));
            }, 0); 
        }); 
        
        listElement.addEventListener('dragend', () => { 
            if (selectedItems) {
                selectedItems.forEach(item => item.classList.remove('dragging'));
            }
            draggedItem = null;
            selectedItems = [];
        }); 
        
        listElement.addEventListener('dragover', e => { 
            e.preventDefault(); 
            if (!draggedItem) return;
            
            const afterElement = getDragAfterElement(listElement, e.clientY); 
            
            selectedItems.forEach(item => {
                if (afterElement == null) {
                    listElement.appendChild(item); 
                } else {
                    listElement.insertBefore(item, afterElement); 
                }
            });
        }); 
    }

    function getDragAfterElement(container, y) { 
        const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging), .tab-card:not(.dragging)')]; 
        return draggableElements.reduce((closest, child) => { 
            const box = child.getBoundingClientRect(); 
            const offset = y - box.top - box.height / 2; 
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; 
            else return closest; 
        }, { offset: Number.NEGATIVE_INFINITY }).element; 
    }

    function openConfigPopup(title, contentContainer, gearIcon) {
        const modal = document.createElement('div');
        modal.className = 'field-config-modal';
        modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:600px; max-height:85vh; overflow-y:auto; background:white; padding:24px; border-radius:12px; box-shadow:0 20px 40px rgba(0,0,0,0.3); z-index:2147483647; display:flex; flex-direction:column; gap:15px; border:1px solid #e2e8f0; font-family:sans-serif;';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2147483647; backdrop-filter:blur(2px);';
        
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:15px;';
        header.innerHTML = `<h3 style="margin:0; font-size:18px; color:#1e293b;">${title}</h3> <button class="btn-close" style="background:none; border:none; font-size:24px; cursor:pointer; color:#64748b; line-height:1;">&times;</button>`;
        
        modal.appendChild(header);
        
        contentContainer.style.display = 'block'; // Ensure container is visible
        const panels = contentContainer.querySelectorAll('.style-config-panel, .widget-config-panel, .reflist-config-panel');
        panels.forEach(p => p.style.display = 'block'); // Always show panels inside modal
        
        modal.appendChild(contentContainer);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        const close = () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
            contentContainer.style.display = 'none'; // Hide container again
            panels.forEach(p => p.style.display = 'none'); // Hide when putting back
            gearIcon.parentNode.appendChild(contentContainer);
            updateDebugJson();
        };
        header.querySelector('.btn-close').onclick = close;
        overlay.onclick = close;
    }

    function createFieldCard(col, configData, lens) {
        const card = document.createElement('li'); card.className = 'field-card'; card.dataset.colId = col.colId; card.draggable = true; 
        const styleOverrides = configData.styleOverrides?.[col.colId] || {}; 
        
        const styleConfigHtml = ` 
            <div class="style-config-panel" style="display: none; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;"> 
                <h5 style="margin-top:0; color:#334155; font-size:14px;">Estilos</h5> 
                <div class="style-config-list" style="display:flex; flex-direction:column; gap:8px; font-size:13px;"> 
                    <label><input type="checkbox" data-style-key="ignoreConditional" ${styleOverrides.ignoreConditional ? 'checked' : ''}> Ignorar Formatação Condicional</label> 
                    <label><input type="checkbox" data-style-key="ignoreHeader" ${styleOverrides.ignoreHeader ? 'checked' : ''}> Ignorar Estilo do Cabeçalho</label> 
                    <label><input type="checkbox" data-style-key="ignoreCell" ${styleOverrides.ignoreCell ? 'checked' : ''}> Ignorar Estilo da Célula</label> 
                </div> 
            </div> `;

        let widgetConfigHtml = '';
        const currentWidgetOverride = configData.widgetOverrides?.[col.colId];

        if (col.type === 'Text') {
            const widgetCfg = configData.widgetOverrides?.[col.colId] || {};
            const isColorWidget = widgetCfg === 'ColorPicker' || widgetCfg?.widget === 'ColorPicker';
            const isDynamicUI = widgetCfg?.widget === 'DynamicUI';
            const colorMode = widgetCfg?.options?.mode || 'picker';
            const swatches = widgetCfg?.options?.swatches || '';
            widgetConfigHtml = `
            <div class="widget-config-panel" style="display: none; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                <h5 style="margin-top:0; color:#334155; font-size:14px;">Widget</h5>
                <div class="drawer-config-section"><label><input type="radio" name="widget-type-${col.colId}" value="" ${!isColorWidget && !isDynamicUI ? 'checked' : ''} class="widget-type-radio"> Padrão</label></div>
                <div class="drawer-config-section"><label><input type="checkbox" class="is-color-picker-checkbox" ${isColorWidget ? 'checked' : ''}> Habilitar Componente de Cor</label></div>
                <div class="drawer-config-section"><label><input type="radio" name="widget-type-${col.colId}" value="DynamicUI" ${isDynamicUI ? 'checked' : ''} class="widget-type-radio"> Dynamic UI (JSON)</label></div>
                <div class="drawer-config-section"><label><input type="radio" name="widget-type-${col.colId}" value="Image" ${widgetCfg?.widget === 'Image' ? 'checked' : ''} class="widget-type-radio"> Imagem (URL/Anexo)</label></div>
                <div class="color-options-container" style="display: ${isColorWidget ? 'block' : 'none'}; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                    <div class="drawer-config-section">
                        <label style="font-size: 11px; font-weight: bold; color: #0056b3;">Vincular Paleta Global:</label>
                        <select class="color-palette-id-select" style="width:100%; font-size: 11px; border-color: #0056b3;">
                            <option value="">-- Manual --</option>
                            ${_allConfigs.filter(c => c.componentType === 'Color Options').map(c => `<option value="${c.configId}" ${widgetCfg?.options?.colorPaletteId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                        </select>
                    </div>
                    <div class="color-manual-swatches" style="display: ${widgetCfg?.options?.colorPaletteId ? 'none' : 'block'}">
                        <div class="drawer-config-section">
                            <label>Modo de Exibição:</label>
                            <select class="color-mode-select"><option value="picker" ${colorMode === 'picker' ? 'selected' : ''}>Apenas Seletor</option><option value="swatches" ${colorMode === 'swatches' ? 'selected' : ''}>Apenas Sugestões</option><option value="both" ${colorMode === 'both' ? 'selected' : ''}>Ambos</option></select>
                        </div>
                        <div class="drawer-config-section"><label>Sugestões (Hex):</label><input type="text" class="color-swatches-input" value="${swatches}" placeholder="#ffffff, #000000"></div>
                    </div>
                </div>
            </div>`;
        } else if (col.type === 'Numeric' || col.type === 'Int') {
            const isProgressBar = currentWidgetOverride?.widget === 'ProgressBar';
            const progressOptions = currentWidgetOverride?.options || {};
            widgetConfigHtml = `
            <div class="widget-config-panel" style="display: none; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                <h5 style="margin-top:0; color:#334155; font-size:14px;">Widget</h5>
                <label><input type="radio" name="widget-type-${col.colId}" value="" ${!isProgressBar ? 'checked' : ''} class="widget-type-radio"> Padrão</label>
                <label><input type="radio" name="widget-type-${col.colId}" value="ProgressBar" ${isProgressBar ? 'checked' : ''} class="widget-type-radio"> Barra de Progresso</label>
                <div class="progress-options" style="display: ${isProgressBar ? 'block' : 'none'}; padding: 8px; background: #f8f9fa;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <label style="font-size: 10px;">Tipo:</label>
                            <select class="progress-type" style="width: 100%; font-size: 11px;">
                                <option value="linear" ${progressOptions.progressType === 'linear' ? 'selected' : ''}>Linear</option>
                                <option value="circular" ${progressOptions.progressType === 'circular' ? 'selected' : ''}>Circular</option>
                            </select>
                        </div>
                        <div class="progress-label-pos-container" style="display: ${progressOptions.progressType === 'circular' ? 'block' : 'none'}">
                            <label style="font-size: 10px;">Pos. Valor:</label>
                            <select class="progress-label-pos" style="width: 100%; font-size: 11px;">
                                <option value="middle" ${progressOptions.labelPosition === 'middle' ? 'selected' : ''}>Centro</option>
                                <option value="above" ${progressOptions.labelPosition === 'above' ? 'selected' : ''}>Acima</option>
                                <option value="left" ${progressOptions.labelPosition === 'left' ? 'selected' : ''}>Esquerda</option>
                                <option value="right" ${progressOptions.labelPosition === 'right' ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>
                    </div>
                    <div class="progress-internal-container" style="display: ${progressOptions.progressType === 'circular' ? 'block' : 'none'}; padding: 4px; background: #f1f5f9; border-radius: 4px; margin-bottom: 8px;">
                        <label style="font-size: 10px; cursor: pointer;">
                            <input type="checkbox" class="progress-show-internal" ${progressOptions.showInternalBar ? 'checked' : ''}> Barra Interna
                        </label>
                        <select class="progress-internal-col" style="width: 100%; font-size: 11px; display: ${progressOptions.showInternalBar ? 'block' : 'none'}; margin-top: 2px;">
                            <option value="">-- Coluna Interna --</option>
                            ${Object.values(currentSchema || {}).filter(c => ['Numeric', 'Int', 'Any'].includes(c.type)).map(c => `<option value="${c.colId}" ${progressOptions.internalBarColId === c.colId ? 'selected' : ''}>${c.label}</option>`).join('')}
                        </select>
                    </div>
                    <label><input type="checkbox" class="progress-striped" ${progressOptions.striped ? 'checked' : ''}> Listrado</label>
                    <div class="rules-container">${(progressOptions.colorRules || []).map(r => `<div class="color-rule-row"><input type="number" class="rule-threshold" value="${r.threshold}"><input type="color" class="rule-color" value="${r.color}"><button type="button" class="btn-danger remove-rule-btn">x</button></div>`).join('')}</div>
                    <button type="button" class="btn btn-sm btn-secondary add-rule-btn">+ Adicionar Regra</button>
                </div>
            </div>`;
        }

        let refListConfigHtml = '';
        if (col.type.startsWith('RefList:')) {
            const fieldConfig = configData.refListFieldConfig?.[col.colId] || {};
            const refListConfig = fieldConfig._refListConfig || {};
            const isZebra = fieldConfig?._options?.zebra === true;
            const cardConfigs = _allConfigs.filter(c => c.componentType === 'CardSystem' || c.componentType === 'Card System');
            const drawerConfigs = _allConfigs.filter(c => c.componentType === 'Drawer');

            const cardConfigOptions = `<option value="">-- Selecione um Card --</option>` + 
                cardConfigs.map(c => `<option value="${c.configId}" ${refListConfig.cardConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} [${c.configId}]</option>`).join('');
            
            const drawerConfigOptions = `<option value="">-- Selecione um Drawer --</option>` + 
                drawerConfigs.map(c => `<option value="${c.configId}" ${refListConfig.addRecordConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} [${c.configId}]</option>`).join('');

            refListConfigHtml = `
            <div class="reflist-config-panel" style="display: none; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                <h5 style="margin-top:0; color:#334155; font-size:14px;">Opções de Sub-Tabela (RefList)</h5>
                <div class="drawer-config-section"><label>Exibir como:</label><select class="reflist-display-as"><option value="table" ${refListConfig.displayAs === 'table' ? 'selected' : ''}>Tabela Simples</option><option value="cards" ${refListConfig.displayAs === 'cards' ? 'selected' : ''}>Cards</option><option value="tabulator" ${refListConfig.displayAs === 'tabulator' ? 'selected' : ''}>Tabulator</option></select></div>
                <div class="drawer-config-section"><label><input type="checkbox" class="reflist-zebra-checkbox" ${isZebra ? 'checked' : ''}> Tabela Zebrada</label><label><input type="checkbox" class="reflist-collapsible-checkbox" ${refListConfig.collapsible ? 'checked' : ''}> Retrátil</label></div>
                
                <div class="reflist-card-options" style="display: ${refListConfig.displayAs === 'cards' ? 'block' : 'none'};">
                    <label>Config de Card:</label>
                    <select class="reflist-card-config-id">${cardConfigOptions}</select>
                </div>
                
                <div class="reflist-add-options">
                    <label><input type="checkbox" class="reflist-show-add-checkbox" ${refListConfig.showAddButton !== false ? 'checked' : ''}> Mostrar Botão "Adicionar"</label>
                    <div style="margin-top:5px;">
                        <label style="font-size:11px; display:block;">Drawer para Adição:</label>
                        <select class="reflist-add-config-id" style="width:100%; font-size:11px;">${drawerConfigOptions}</select>
                    </div>
                </div>

                <div class="reflist-column-config" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;"><label>Colunas da Sub-Tabela:</label><div class="reflist-columns-container"><p>Carregando colunas...</p></div></div>
            </div>`;
        }

        const hasCustomStyle = Object.keys(styleOverrides).length > 0;
        const hasCustomWidget = !!currentWidgetOverride || !!configData.fieldOptions?.[col.colId];
        const hasCustomRefList = !!configData.refListFieldConfig?.[col.colId];
        const hasCustomConfig = hasCustomStyle || hasCustomWidget || hasCustomRefList;
        const gearColor = hasCustomConfig ? '#3b82f6' : '#cbd5e1';

        // HTML entities for icons
        const svgEyeOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#94a3b8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        const svgLockClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        const svgLockOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
        const svgAsteriskReq = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="7.05" y1="7.05" x2="16.95" y2="16.95"></line><line x1="7.05" y1="16.95" x2="16.95" y2="7.05"></line></svg>`;
        const svgAsteriskOpt = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#cbd5e1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="7.05" y1="7.05" x2="16.95" y2="16.95"></line><line x1="7.05" y1="16.95" x2="16.95" y2="7.05"></line></svg>`;
        const svgGear = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

        const customLabelHtml = `
            <div class="custom-label-panel" style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                <label style="font-size: 11px; font-weight: bold; color: #334155; display:block; margin-bottom:4px;">Nome de Exibição (Alias):</label>
                <input type="text" class="custom-label-input" value="${configData.fieldOptions?.[col.colId]?.customLabel || ''}" placeholder="${col.label}" style="width:100%; font-size:12px; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                <small style="font-size:10px; color:#64748b; margin-top:4px; display:block;">Sobrescreve o nome original no Drawer (Não altera no Grist).</small>
            </div>
        `;

        card.innerHTML = ` 
        <div class="field-card-main" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; height:32px; box-sizing:border-box;"> 
            <div class="field-card-left" style="display:flex; align-items:center; gap:10px; overflow:hidden;"> 
                <button type="button" class="btn-config-popup" style="background:none; border:none; cursor:pointer; color:${gearColor}; display:flex; align-items:center; padding:4px;" title="Configurações (Estilo, Widget)">${svgGear}</button>
                <span class="field-card-label" style="font-weight:600; font-size:13px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${col.label} <span class="field-card-type" style="font-weight:normal; font-size:11px; color:#94a3b8;">(${col.type})</span></span> 
            </div> 
            <div class="field-card-right" style="display:flex; align-items:center; gap:12px; flex-shrink:0;"> 
                <input type="checkbox" class="is-hidden-checkbox" style="display:none;"> 
                <input type="checkbox" class="is-locked-checkbox" style="display:none;"> 
                <input type="checkbox" class="is-required-checkbox" style="display:none;"> 
                
                <div class="icon-toggle icon-hidden" title="Visibilidade" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;"></div>
                <div class="icon-toggle icon-locked" title="Travado" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;"></div>
                <div class="icon-toggle icon-required" title="Obrigatório" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;"></div>
            </div> 
        </div>
        <div class="extra-panels-container" style="display:none;">
            ${customLabelHtml}
            ${styleConfigHtml} 
            ${widgetConfigHtml} 
            ${refListConfigHtml}
        </div>
        `; 
        
        // Setup Icon Toggles
        const hiddenCb = card.querySelector('.is-hidden-checkbox');
        const lockedCb = card.querySelector('.is-locked-checkbox');
        const requiredCb = card.querySelector('.is-required-checkbox');
        const iconHidden = card.querySelector('.icon-hidden');
        const iconLocked = card.querySelector('.icon-locked');
        const iconRequired = card.querySelector('.icon-required');

        const updateIcons = () => {
            iconHidden.innerHTML = hiddenCb.checked ? svgEyeClosed : svgEyeOpen;
            iconLocked.innerHTML = lockedCb.checked ? svgLockClosed : svgLockOpen;
            iconRequired.innerHTML = requiredCb.checked ? svgAsteriskReq : svgAsteriskOpt;
        };
        updateIcons(); // Initial call

        const handleIconClick = (cb, type) => {
            const isSelected = card.classList.contains('selected');
            const itemsToUpdate = isSelected 
                ? Array.from(document.querySelectorAll('#unifiedFieldList .field-card.selected'))
                : [card];
            
            const newValue = !cb.checked;
            
            itemsToUpdate.forEach(item => {
                const itemCb = item.querySelector(type === 'hidden' ? '.is-hidden-checkbox' : type === 'locked' ? '.is-locked-checkbox' : '.is-required-checkbox');
                const itemIcon = item.querySelector(type === 'hidden' ? '.icon-hidden' : type === 'locked' ? '.icon-locked' : '.icon-required');
                
                if (itemCb && itemIcon) {
                    itemCb.checked = newValue;
                    if (type === 'hidden') itemIcon.innerHTML = newValue ? svgEyeClosed : svgEyeOpen;
                    if (type === 'locked') itemIcon.innerHTML = newValue ? svgLockClosed : svgLockOpen;
                    if (type === 'required') itemIcon.innerHTML = newValue ? svgAsteriskReq : svgAsteriskOpt;
                }
            });
            updateDebugJson();
        };

        iconHidden.onclick = (e) => { e.stopPropagation(); handleIconClick(hiddenCb, 'hidden'); };
        iconLocked.onclick = (e) => { e.stopPropagation(); handleIconClick(lockedCb, 'locked'); };
        iconRequired.onclick = (e) => { e.stopPropagation(); handleIconClick(requiredCb, 'required'); };

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-config-popup') || e.target.closest('.icon-toggle') || e.target.closest('input') || e.target.closest('.extra-panels-container') || e.target.closest('.field-box-icon') || e.target.closest('.resize-handle')) return;
            if (e.ctrlKey || e.shiftKey) {
                card.classList.toggle('selected');
            } else {
                document.querySelectorAll('#unifiedFieldList .selected').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
            }
        });

        // Bind Popup
        card.querySelector('.btn-config-popup').onclick = () => {
            const container = card.querySelector('.extra-panels-container');
            openConfigPopup(`Configurar "${col.label}"`, container, card.querySelector('.btn-config-popup'));
        };
        
        const colorPaletteSelect = card.querySelector('.color-palette-id-select');
        if (colorPaletteSelect) {
            colorPaletteSelect.onchange = () => {
                const manualContainer = card.querySelector('.color-manual-swatches');
                if (manualContainer) manualContainer.style.display = colorPaletteSelect.value ? 'none' : 'block';
                updateDebugJson();
            };
        }

        if (card.querySelector('.reflist-display-as')) {
            const select = card.querySelector('.reflist-display-as');
            select.onchange = () => {
                card.querySelector('.reflist-card-options').style.display = select.value === 'cards' ? 'block' : 'none';
                updateDebugJson();
            };
        }

        const progressTypeSelect = card.querySelector('.progress-type');
        if (progressTypeSelect) {
            progressTypeSelect.onchange = () => {
                const lpContainer = card.querySelector('.progress-label-pos-container');
                const intContainer = card.querySelector('.progress-internal-container');
                if (lpContainer) lpContainer.style.display = (progressTypeSelect.value === 'circular') ? 'block' : 'none';
                if (intContainer) intContainer.style.display = (progressTypeSelect.value === 'circular') ? 'block' : 'none';
                updateDebugJson();
            };
        }

        const showInternalCheck = card.querySelector('.progress-show-internal');
        if (showInternalCheck) {
            showInternalCheck.onchange = () => {
                const colSelect = card.querySelector('.progress-internal-col');
                if (colSelect) colSelect.style.display = showInternalCheck.checked ? 'block' : 'none';
                updateDebugJson();
            };
        }

        // We load reflist columns inside the popup now, so it still works.
        const addRefListLoader = async () => {
            const panel = card.querySelector('.reflist-config-panel');
            if (panel) {
                const referencedTableId = col.type.split(':')[1];
                const referencedSchema = await lens.getTableSchema(referencedTableId);
                const fieldConfig = configData.refListFieldConfig?.[col.colId] || {};
                const columnsContainer = panel.querySelector('.reflist-columns-container');
                if (referencedSchema) {
                    columnsContainer.innerHTML = `<table class="reflist-config-table"><thead><tr><th>Campo</th><th>Exibir</th><th>Oculto</th><th>Travado</th><th>Obrig.</th></tr></thead><tbody>${Object.values(referencedSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos').map(refCol => {
                        const colConfig = fieldConfig[refCol.colId] || { showInTable: true };
                        return `<tr data-ref-col-id="${refCol.colId}"><td>${refCol.label}</td><td><input type="checkbox" data-config-key="showInTable" ${colConfig.showInTable ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="hideInModal" ${colConfig.hideInModal ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="lockInModal" ${colConfig.lockInModal ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="requireInModal" ${colConfig.requireInModal ? 'checked' : ''}></td></tr>`;
                    }).join('')}</tbody></table>`;
                }
            }
        };
        if (col.type.startsWith('RefList:')) {
            addRefListLoader();
        }

        return card;
    }

    return { render, read };
})();
