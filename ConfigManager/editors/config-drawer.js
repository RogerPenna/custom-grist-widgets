// ConfigManager/editors/config-drawer.js
import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';

const tableLens = new GristTableLens(grist);
let currentSchema = null;
const configJsonTextareaEl = document.getElementById('configJsonTextarea');

let stageConfigs = {};
let currentEditingStage = '_global';

function _persistCurrentStageUI(stageName) {
    if (!stageName) return;
    const stageData = { hiddenFields: [], lockedFields: [], requiredFields: [] };
    document.querySelectorAll('#unifiedFieldList .field-card').forEach(card => {
        const colId = card.dataset.colId;
        if (card.querySelector('.is-hidden-checkbox').checked) stageData.hiddenFields.push(colId);
        if (card.querySelector('.is-locked-checkbox').checked) stageData.lockedFields.push(colId);
        if (card.querySelector('.is-required-checkbox').checked) stageData.requiredFields.push(colId);
    });
    stageConfigs[stageName] = stageData;
}

function _applyStageUI(stageName) {
    currentEditingStage = stageName;
    const stageData = stageConfigs[stageName] || { hiddenFields: [], lockedFields: [], requiredFields: [] };
    document.querySelectorAll('#unifiedFieldList .field-card').forEach(card => {
        const colId = card.dataset.colId;
        card.querySelector('.is-hidden-checkbox').checked = stageData.hiddenFields.includes(colId);
        card.querySelector('.is-locked-checkbox').checked = stageData.lockedFields.includes(colId);
        card.querySelector('.is-required-checkbox').checked = stageData.requiredFields.includes(colId);
    });
    const copyBtn = document.getElementById('copyStageConfigBtn');
    if (copyBtn) {
        copyBtn.disabled = (stageName === '_global');
        copyBtn.title = (stageName === '_global') ? "Não é possível copiar as regras do estágio Padrão" : "Copiar regras deste estágio para outros";
    }
}

function updateJsonFromUI() {
    if (!currentSchema) return;
    const container = document.getElementById('specializedUiContainer');
    
    _persistCurrentStageUI(currentEditingStage);

    const drawerConfig = {
        displayMode: container.querySelector('#displayModeSelector').value,
        width: container.querySelector('#drawerWidthSelector').value,
        tabs: [],
        refListFieldConfig: {},
        styleOverrides: {}
    };
    
    let currentTab = null;
    container.querySelectorAll('#unifiedFieldList > li').forEach(item => {
        if (item.classList.contains('tab-card')) {
            if (currentTab) drawerConfig.tabs.push(currentTab);
            currentTab = { title: item.querySelector('.tab-card-input').value, fields: [] };
        } else if (item.classList.contains('field-card')) {
            if (!currentTab) currentTab = { title: 'Principal', fields: [] };
            const colId = item.dataset.colId;
            currentTab.fields.push(colId);

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
        }
    });
    if (currentTab) drawerConfig.tabs.push(currentTab);
    
    const globalRules = stageConfigs['_global'] || { hiddenFields: [], lockedFields: [], requiredFields: [] };
    drawerConfig.hiddenFields = globalRules.hiddenFields;
    drawerConfig.lockedFields = globalRules.lockedFields;
    drawerConfig.requiredFields = globalRules.requiredFields;
    
    const workflowEnabled = container.querySelector('#workflowEnabledCheckbox')?.checked;
    if (workflowEnabled) {
        const stageField = container.querySelector('#stageFieldSelector')?.value;
        if (stageField) {
            const stages = { ...stageConfigs };
            delete stages['_global'];
            drawerConfig.workflow = { enabled: true, stageField, stages };
        } else {
            drawerConfig.workflow = { enabled: true, stageField: null, stages: {} };
        }
    } else {
        drawerConfig.workflow = { enabled: false };
    }
    
    configJsonTextareaEl.value = JSON.stringify(drawerConfig, null, 2);
}

export async function render(container, configData, tableSchema) {
    currentSchema = tableSchema;
    if (!currentSchema) { container.innerHTML = '<p>Selecione uma tabela.</p>'; return; }

    stageConfigs = {
        _global: {
            hiddenFields: configData.hiddenFields || [],
            lockedFields: configData.lockedFields || [],
            requiredFields: configData.requiredFields || []
        },
        ...(configData.workflow?.stages || {})
    };
    currentEditingStage = '_global';

    let html = `
        <div class="drawer-config-section">
             <label for="displayModeSelector">Modo:</label>
            <select id="displayModeSelector"><option value="drawer" ${configData.displayMode === 'drawer' ? 'selected' : ''}>Drawer</option><option value="modal" ${configData.displayMode === 'modal' ? 'selected' : ''}>Modal</option></select>
        </div>
        <div class="drawer-config-section">
            <label for="drawerWidthSelector">Largura:</label>
            <select id="drawerWidthSelector">${['25%', '40%', '50%', '60%', '75%'].map(w => `<option value="${w}" ${configData.width === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
        </div>
        <div id="workflowConfigContainer"></div>
        <div class="config-section-title">Layout e Regras de Campos</div>
        <div id="stageSelectorContainer" class="drawer-config-section" style="display: none;">
             <label for="stageSelector">Editando Regras Para:</label>
             <select id="stageSelector"></select>
             <button id="copyStageConfigBtn" class="btn btn-secondary btn-sm">Copiar Regras...</button>
        </div>
        <div class="drawer-config-section">
            <button type="button" id="addTabBtn" class="btn btn-primary add-tab-btn">📑 + Adicionar Aba</button>
            <ul id="unifiedFieldList" class="field-order-list"></ul>
        </div>
    `;
    container.innerHTML = html;

    _renderWorkflowUI(configData.workflow, tableSchema);

    const allCols = Object.values(tableSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
    const unifiedListEl = container.querySelector('#unifiedFieldList');
    const tabs = configData.tabs || [{ title: 'Principal', fields: allCols.map(c => c.colId) }];

    const usedFields = new Set();
    for (const tab of tabs) {
        unifiedListEl.appendChild(createTabCard(tab.title));
        for (const fieldId of tab.fields) {
            const col = allCols.find(c => c.colId === fieldId);
            if (col) {
                const card = createFieldCard(col, configData);
                unifiedListEl.appendChild(card);
                usedFields.add(fieldId);
            }
        }
    }
    for (const col of allCols) {
        if (!usedFields.has(col.colId)) {
            const card = createFieldCard(col, configData);
            unifiedListEl.appendChild(card);
        }
    }
    
    _applyStageUI(currentEditingStage);
    addEventListeners(container);
    enableDragAndDrop(unifiedListEl);
    updateJsonFromUI();
}

export function read(container) {
    updateJsonFromUI();
    return JSON.parse(configJsonTextareaEl.value || '{}');
}

function _handleCopyStageConfig() { /* ...código inalterado... */ }
function _renderWorkflowUI(workflowConfig, tableSchema) { /* ...código inalterado... */ }
function addEventListeners(container) { /* ...código inalterado... */ }
function createTabCard(title) { /* ...código inalterado... */ }
function enableDragAndDrop(listElement) { /* ...código inalterado... */ }
function getDragAfterElement(container, y) { /* ...código inalterado... */ }

function createFieldCard(col, configData) {
    const card = document.createElement('li');
    card.className = 'field-card';
    card.dataset.colId = col.colId;
    card.draggable = true;
    
    const styleOverrides = configData.styleOverrides?.[col.colId] || {};
    const styleConfigHtml = `
        <div class="field-card-extra-actions">
            <button type="button" class="btn btn-secondary btn-sm toggle-style-config">Configurar Estilos</button>
        </div>
        <div class="style-config-panel" style="display: none;">
            <h5>Opções de Estilo para "${col.label}"</h5>
            <div class="style-config-list">
                <label><input type="checkbox" data-style-key="ignoreConditional" ${styleOverrides.ignoreConditional ? 'checked' : ''}> Ignorar Formatação Condicional</label>
                <label><input type="checkbox" data-style-key="ignoreHeader" ${styleOverrides.ignoreHeader ? 'checked' : ''}> Ignorar Estilo do Cabeçalho</label>
                <label><input type="checkbox" data-style-key="ignoreCell" ${styleOverrides.ignoreCell ? 'checked' : ''}> Ignorar Estilo da Célula</label>
            </div>
        </div>
    `;

    let refListConfigHtml = '';
    if (col.type.startsWith('RefList:')) {
        const fieldConfig = configData.refListFieldConfig?.[col.colId] || {};
        const isZebra = fieldConfig?._options?.zebra === true;
        refListConfigHtml = `
            <div class="field-card-extra-actions">
                <label class="reflist-option-label"><input type="checkbox" class="reflist-zebra-checkbox" ${isZebra ? 'checked' : ''}> Tabela Zebrada</label>
                <button type="button" class="btn btn-secondary btn-sm toggle-reflist-config">Configurar Colunas</button>
            </div>
            <div class="reflist-config-panel" style="display: none;"><p>Carregando...</p></div>`;
    }

    card.innerHTML = `
        <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span>
        <div class="field-card-controls">
            <label><input type="checkbox" class="is-hidden-checkbox"> Oculto</label>
            <label><input type="checkbox" class="is-locked-checkbox"> Travado</label>
            <label><input type="checkbox" class="is-required-checkbox"> Obrigatório</label>
        </div>
        ${styleConfigHtml}
        ${refListConfigHtml}
    `;

    const toggleStyleBtn = card.querySelector('.toggle-style-config');
    if (toggleStyleBtn) {
        toggleStyleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const panel = card.querySelector('.style-config-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    const toggleRefListBtn = card.querySelector('.toggle-reflist-config');
    if (toggleRefListBtn) {
        toggleRefListBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            const panel = card.querySelector('.reflist-config-panel');
            if (panel.style.display === 'none') {
                const referencedTableId = col.type.split(':')[1];
                const referencedSchema = await tableLens.getTableSchema(referencedTableId);
                const fieldConfig = configData.refListFieldConfig?.[col.colId] || {};
                let tableRowsHtml = `<tr><td colspan="5">Schema não encontrado.</td></tr>`;
                if (referencedSchema) {
                    tableRowsHtml = Object.values(referencedSchema)
                        .filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos')
                        .map(refCol => {
                            const colConfig = fieldConfig[refCol.colId] || { showInTable: true };
                            return `<tr data-ref-col-id="${refCol.colId}"><td>${refCol.label}</td><td><input type="checkbox" data-config-key="showInTable" ${colConfig.showInTable ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="hideInModal" ${colConfig.hideInModal ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="lockInModal" ${colConfig.lockInModal ? 'checked' : ''}></td><td><input type="checkbox" data-config-key="requireInModal" ${colConfig.requireInModal ? 'checked' : ''}></td></tr>`;
                        }).join('');
                }
                panel.innerHTML = `<table class="reflist-config-table"><thead><tr><th>Campo</th><th>Exibir</th><th>Oculto</th><th>Travado</th><th>Obrig.</th></tr></thead><tbody>${tableRowsHtml}</tbody></table>`;
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    }
    return card;
}

// ==========================================================
// FUNÇÕES DE APOIO QUE ESTAVAM DUPLICADAS (AGORA ÚNICAS)
// ==========================================================
_handleCopyStageConfig = function() { const sourceStage = currentEditingStage; if (!sourceStage || sourceStage === '_global') { alert("Selecione um estágio válido para copiar as regras."); return; } _persistCurrentStageUI(sourceStage); const sourceConfig = stageConfigs[sourceStage]; if (!sourceConfig) { alert("Não foi possível encontrar a configuração para o estágio de origem."); return; } const stageSelector = document.getElementById('stageSelector'); const otherStages = Array.from(stageSelector.options).map(opt => opt.value).filter(val => val !== '_global' && val !== sourceStage); if (otherStages.length === 0) { alert("Não há outros estágios para os quais copiar as regras."); return; } const modal = document.createElement('div'); modal.className = 'copy-stage-modal'; modal.innerHTML = ` <div class="copy-stage-content"> <h3>Copiar regras de "${sourceStage}" para:</h3> <div class="copy-stage-list"> <label><input type="checkbox" id="rep-all" /> Marcar todos</label> <div id="rep-list"></div> </div> <div class="copy-stage-actions"> <button id="rep-ok" class="btn btn-primary">OK</button> <button id="rep-cancel" class="btn btn-secondary">Cancelar</button> </div> </div> `; document.body.appendChild(modal); const list = modal.querySelector('#rep-list'); otherStages.forEach(stage => { list.innerHTML += `<div><label><input type="checkbox" class="rep-cb" value="${stage}"> ${stage}</label></div>`; }); modal.querySelector('#rep-all').onchange = e => { list.querySelectorAll('.rep-cb').forEach(cb => cb.checked = e.target.checked); }; modal.querySelector('#rep-cancel').onclick = () => document.body.removeChild(modal); modal.querySelector('#rep-ok').onclick = () => { const targets = Array.from(list.querySelectorAll('.rep-cb:checked')).map(cb => cb.value); if (targets.length > 0) { targets.forEach(targetStage => { stageConfigs[targetStage] = JSON.parse(JSON.stringify(sourceConfig)); }); alert(`Regras copiadas para: ${targets.join(', ')}.\nAs mudanças serão aplicadas ao salvar.`); updateJsonFromUI(); } document.body.removeChild(modal); }; };
_renderWorkflowUI = function(workflowConfig, tableSchema) { const container = document.getElementById('workflowConfigContainer'); const choiceColumns = Object.values(tableSchema).filter(col => col.type === 'Choice'); container.innerHTML = `<div class="workflow-section"><label class="config-toggle"><input type="checkbox" id="workflowEnabledCheckbox" ${workflowConfig?.enabled ? 'checked' : ''}> Habilitar Workflow Condicional</label><div id="workflowControls" style="display: ${workflowConfig?.enabled ? 'flex' : 'none'};"><label for="stageFieldSelector">Campo de Estágio:</label><select id="stageFieldSelector"><option value="">Selecione...</option>${choiceColumns.map(col => `<option value="${col.colId}" ${workflowConfig?.stageField === col.colId ? 'selected' : ''}>${col.label}</option>`).join('')}</select></div></div>`; const enabledCheckbox = container.querySelector('#workflowEnabledCheckbox'); const controlsContainer = container.querySelector('#workflowControls'); const stageFieldSelector = container.querySelector('#stageFieldSelector'); const stageSelectorContainer = document.getElementById('stageSelectorContainer'); const stageSelector = document.getElementById('stageSelector'); document.getElementById('copyStageConfigBtn').addEventListener('click', _handleCopyStageConfig); function updateStageDropdown() { const stageFieldId = stageFieldSelector.value; const workflowEnabled = enabledCheckbox.checked; if (workflowEnabled && stageFieldId) { stageSelectorContainer.style.display = 'flex'; const stageColumn = tableSchema[stageFieldId]; const choices = stageColumn?.widgetOptions?.choices || []; stageSelector.innerHTML = `<option value="_global">Padrão (Global)</option>`; choices.forEach(choice => { stageSelector.innerHTML += `<option value="${choice}">${choice}</option>`; }); stageSelector.value = '_global'; _applyStageUI('_global'); } else { stageSelectorContainer.style.display = 'none'; _applyStageUI('_global'); } } enabledCheckbox.addEventListener('change', () => { controlsContainer.style.display = enabledCheckbox.checked ? 'flex' : 'none'; updateStageDropdown(); updateJsonFromUI(); }); stageFieldSelector.addEventListener('change', () => { updateStageDropdown(); updateJsonFromUI(); }); stageSelector.addEventListener('change', () => { _persistCurrentStageUI(currentEditingStage); _applyStageUI(stageSelector.value); }); if (workflowConfig?.enabled) { updateStageDropdown(); if (stageSelector.options.length > 1) { stageSelector.value = workflowConfig.stageField ? '_global' : stageSelector.options[1].value; _applyStageUI(stageSelector.value); } } };
addEventListeners = function(container) { container.addEventListener('change', updateJsonFromUI); const fieldOrderList = container.querySelector('#unifiedFieldList'); if (fieldOrderList) fieldOrderList.addEventListener('drop', () => setTimeout(updateJsonFromUI, 0)); };
createTabCard = function(title) { const card = document.createElement('li'); card.className = 'tab-card'; card.draggable = true; card.innerHTML = ` <span class="tab-card-icon">📑</span> <input type="text" class="tab-card-input" value="${title}"> <button type="button" class="delete-tab-btn" title="Deletar Aba">🗑️</button> `; card.querySelector('.delete-tab-btn').addEventListener('click', (e) => { e.preventDefault(); const tabTitle = card.querySelector('.tab-card-input').value; if (confirm(`Tem certeza que deseja deletar a aba "${tabTitle}"?`)) { const fieldsToMove = []; let nextSibling = card.nextElementSibling; while (nextSibling && nextSibling.classList.contains('field-card')) { fieldsToMove.push(nextSibling); nextSibling = nextSibling.nextElementSibling; } let insertionPoint = null; let previousSibling = card.previousElementSibling; while (previousSibling) { if (previousSibling.classList.contains('tab-card')) { insertionPoint = previousSibling; break; } previousSibling = previousSibling.previousElementSibling; } for (let i = fieldsToMove.length - 1; i >= 0; i--) { const field = fieldsToMove[i]; if (insertionPoint) { insertionPoint.insertAdjacentElement('afterend', field); } else { card.parentElement.prepend(field); } } card.remove(); updateJsonFromUI(); } }); return card; };
enableDragAndDrop = function(listElement) { if (!listElement) return; let draggedItem = null; listElement.addEventListener('dragstart', e => { draggedItem = e.target.closest('li'); setTimeout(() => draggedItem.classList.add('dragging'), 0); }); listElement.addEventListener('dragend', () => { if (draggedItem) draggedItem.classList.remove('dragging'); }); listElement.addEventListener('dragover', e => { e.preventDefault(); const afterElement = getDragAfterElement(listElement, e.clientY); if (afterElement == null) { listElement.appendChild(draggedItem); } else { listElement.insertBefore(draggedItem, afterElement); } }); };
getDragAfterElement = function(container, y) { const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging), .tab-card:not(.dragging)')]; return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; };