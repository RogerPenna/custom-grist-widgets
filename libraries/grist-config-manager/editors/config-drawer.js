
export const DrawerConfigEditor = (() => {
    let currentSchema = null;
    let currentTableId = null;
    let stageConfigs = {};
    let currentEditingStage = '_global';
    let _mainContainer = null;

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
                <div class="config-section-title">Layout e Regras de Campos</div>
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
        const tabs = configData.tabs && configData.tabs.length > 0 ? configData.tabs : [{ title: 'Principal', fields: allCols.map(c => c.colId) }];
        const usedFields = new Set();

        for (const tab of tabs) {
            unifiedListEl.appendChild(createTabCard(tab.title));
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
                currentTab = { title: item.querySelector('.tab-card-input').value, fields: [] };
            } else if (item.classList.contains('field-card')) {
                if (!currentTab) currentTab = { title: 'Principal', fields: [] };
                const colId = item.dataset.colId;
                currentTab.fields.push(colId);

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
                                mode: widgetConfigPanel.querySelector('.color-mode-select').value,
                                swatches: widgetConfigPanel.querySelector('.color-swatches-input').value.trim()
                            }
                        };
                    } else if (widgetType === 'ProgressBar') {
                        const striped = widgetConfigPanel.querySelector('.progress-striped')?.checked || false;
                        const rules = [];
                        widgetConfigPanel.querySelectorAll('.color-rule-row').forEach(row => {
                            const threshold = parseFloat(row.querySelector('.rule-threshold').value);
                            const color = row.querySelector('.rule-color').value;
                            if (!isNaN(threshold)) rules.push({ threshold, color });
                        });
                        drawerConfig.widgetOverrides[colId] = { widget: 'ProgressBar', options: { striped, colorRules: rules } };
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
    function _applyStageUI(stageName) { currentEditingStage = stageName; const stageData = stageConfigs[stageName] || { hiddenFields: [], lockedFields: [], requiredFields: [] }; document.querySelectorAll('#unifiedFieldList .field-card').forEach(card => { const colId = card.dataset.colId; card.querySelector('.is-hidden-checkbox').checked = stageData.hiddenFields.includes(colId); card.querySelector('.is-locked-checkbox').checked = stageData.lockedFields.includes(colId); card.querySelector('.is-required-checkbox').checked = stageData.requiredFields.includes(colId); }); const copyBtn = document.getElementById('copyStageConfigBtn'); if (copyBtn) { copyBtn.disabled = (stageName === '_global'); } }
    
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
    }

    function createTabCard(title) { 
        const card = document.createElement('li'); card.className = 'tab-card'; card.draggable = true; 
        card.innerHTML = ` <span class="tab-card-icon">📑</span> <input type="text" class="tab-card-input" value="${title}"> <button type="button" class="delete-tab-btn" title="Deletar Aba">🗑️</button> `; 
        card.querySelector('.delete-tab-btn').addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (confirm(`Deletar aba?`)) card.remove(); 
        }); 
        return card; 
    }

    function enableDragAndDrop(listElement) { 
        if (!listElement) return; 
        let draggedItem = null; 
        listElement.addEventListener('dragstart', e => { draggedItem = e.target.closest('li'); setTimeout(() => draggedItem.classList.add('dragging'), 0); }); 
        listElement.addEventListener('dragend', () => { if (draggedItem) draggedItem.classList.remove('dragging'); }); 
        listElement.addEventListener('dragover', e => { 
            e.preventDefault(); 
            const afterElement = getDragAfterElement(listElement, e.clientY); 
            if (afterElement == null) listElement.appendChild(draggedItem); 
            else listElement.insertBefore(draggedItem, afterElement); 
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

    function createFieldCard(col, configData, lens) {
        const card = document.createElement('li'); card.className = 'field-card'; card.dataset.colId = col.colId; card.draggable = true; 
        const styleOverrides = configData.styleOverrides?.[col.colId] || {}; 
        
        const styleConfigHtml = ` 
            <div class="field-card-extra-actions"> <button type="button" class="btn btn-secondary btn-sm toggle-style-config">Configurar Estilos</button> </div> 
            <div class="style-config-panel" style="display: none;"> 
                <h5>Opções de Estilo para "${col.label}"</h5> 
                <div class="style-config-list"> 
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
            const colorMode = widgetCfg?.options?.mode || 'picker';
            const swatches = widgetCfg?.options?.swatches || '';
            widgetConfigHtml = `
            <div class="field-card-extra-actions"> <button type="button" class="btn btn-secondary btn-sm toggle-widget-config">Configurar Widget</button> </div>
            <div class="widget-config-panel" style="display: none; padding: 10px; background: #f1f5f9; border-radius: 4px; margin-top: 5px;">
                <h5>Configuração de Cor para "${col.label}"</h5>
                <div class="drawer-config-section"><label><input type="checkbox" class="is-color-picker-checkbox" ${isColorWidget ? 'checked' : ''}> Habilitar Componente de Cor</label></div>
                <div class="color-options-container" style="display: ${isColorWidget ? 'block' : 'none'}; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <div class="drawer-config-section">
                        <label>Modo de Exibição:</label>
                        <select class="color-mode-select"><option value="picker" ${colorMode === 'picker' ? 'selected' : ''}>Apenas Seletor</option><option value="swatches" ${colorMode === 'swatches' ? 'selected' : ''}>Apenas Sugestões</option><option value="both" ${colorMode === 'both' ? 'selected' : ''}>Ambos</option></select>
                    </div>
                    <div class="drawer-config-section"><label>Sugestões (Hex):</label><input type="text" class="color-swatches-input" value="${swatches}" placeholder="#ffffff, #000000"></div>
                </div>
            </div>`;
        } else if (col.type === 'Numeric' || col.type === 'Int') {
            const isProgressBar = currentWidgetOverride?.widget === 'ProgressBar';
            const progressOptions = currentWidgetOverride?.options || {};
            widgetConfigHtml = `
            <div class="field-card-extra-actions"> <button type="button" class="btn btn-secondary btn-sm toggle-widget-config">Configurar Widget</button> </div>
            <div class="widget-config-panel" style="display: none;">
                <h5>Tipo de Widget para "${col.label}"</h5>
                <label><input type="radio" name="widget-type-${col.colId}" value="" ${!isProgressBar ? 'checked' : ''} class="widget-type-radio"> Padrão</label>
                <label><input type="radio" name="widget-type-${col.colId}" value="ProgressBar" ${isProgressBar ? 'checked' : ''} class="widget-type-radio"> Barra de Progresso</label>
                <div class="progress-options" style="display: ${isProgressBar ? 'block' : 'none'}; padding: 8px; background: #f8f9fa;">
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
            refListConfigHtml = `
            <div class="field-card-extra-actions"> <button type="button" class="btn btn-secondary btn-sm toggle-reflist-config">Configurar Sub-Tabela</button> </div>
            <div class="reflist-config-panel" style="display: none; padding: 10px; background: #f8f9fa; border-radius: 4px; margin-top: 5px; border: 1px solid #dee2e6;">
                <h5>Opções de Sub-Tabela (RefList)</h5>
                <div class="drawer-config-section"><label>Exibir como:</label><select class="reflist-display-as"><option value="table" ${refListConfig.displayAs === 'table' ? 'selected' : ''}>Tabela Simples</option><option value="cards" ${refListConfig.displayAs === 'cards' ? 'selected' : ''}>Cards</option><option value="tabulator" ${refListConfig.displayAs === 'tabulator' ? 'selected' : ''}>Tabulator</option></select></div>
                <div class="drawer-config-section"><label><input type="checkbox" class="reflist-zebra-checkbox" ${isZebra ? 'checked' : ''}> Tabela Zebrada</label><label><input type="checkbox" class="reflist-collapsible-checkbox" ${refListConfig.collapsible ? 'checked' : ''}> Retrátil</label></div>
                <div class="reflist-card-options" style="display: ${refListConfig.displayAs === 'cards' ? 'block' : 'none'};"><label>ID Config Card:</label><input type="text" class="reflist-card-config-id" value="${refListConfig.cardConfigId || ''}"></div>
                <div class="reflist-add-options"><label><input type="checkbox" class="reflist-show-add-checkbox" ${refListConfig.showAddButton !== false ? 'checked' : ''}> Mostrar Botão "Adicionar"</label><input type="text" class="reflist-add-config-id" value="${refListConfig.addRecordConfigId || ''}" placeholder="Drawer ID"></div>
                <div class="reflist-column-config" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;"><label>Colunas da Sub-Tabela:</label><div class="reflist-columns-container"><p>Carregando colunas...</p></div></div>
            </div>`;
        }
        
        card.innerHTML = ` <div class="field-card-main"> <div class="field-card-left"> <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span> </div> <div class="field-card-right"> <div class="field-card-controls"> <label><input type="checkbox" class="is-hidden-checkbox"> Oculto</label> <label><input type="checkbox" class="is-locked-checkbox"> Travado</label> <label><input type="checkbox" class="is-required-checkbox"> Obrigatório</label> </div> </div> </div> ${styleConfigHtml} ${widgetConfigHtml} ${refListConfigHtml} `; 
        
        card.querySelector('.toggle-style-config').onclick = () => { const p = card.querySelector('.style-config-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; };
        if (card.querySelector('.toggle-widget-config')) card.querySelector('.toggle-widget-config').onclick = () => { const p = card.querySelector('.widget-config-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; };
        if (card.querySelector('.toggle-reflist-config')) card.querySelector('.toggle-reflist-config').onclick = async () => {
            const panel = card.querySelector('.reflist-config-panel');
            if (panel.style.display === 'none') {
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
                panel.style.display = 'block';
            } else panel.style.display = 'none';
        };
        return card;
    }

    return { render, read };
})();
