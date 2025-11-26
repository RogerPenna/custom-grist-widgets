// libraries/grist-drawer-component/drawer-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { openModal } from '../grist-modal-component/modal-component.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let drawerPanel, drawerOverlay, drawerHeader, drawerTitle;
let currentTableId, currentRecordId;
let currentSchema = {};
let currentDrawerOptions = {};
let isEditing = false;
let currentRecord = null;

// =================================================================================
// --- INÍCIO DA SEÇÃO DE FUNÇÕES AUXILIARES (DEFINIDAS NO TOPO) ---
// =================================================================================
function _switchToTab(tabElement, panelElement) {
    drawerPanel.querySelectorAll('.drawer-tab.is-active').forEach(t => t.classList.remove('is-active'));
    drawerPanel.querySelectorAll('.drawer-tab-content.is-active').forEach(p => p.classList.remove('is-active'));
    tabElement.classList.add('is-active');
    panelElement.classList.add('is-active');
}

function _updateButtonVisibility() {
    drawerPanel.querySelector('#drawer-edit-btn').style.display = isEditing ? 'none' : 'inline-block';
    drawerPanel.querySelector('#drawer-delete-btn').style.display = isEditing ? 'none' : 'inline-block';
    const saveBtn = drawerPanel.querySelector('#drawer-save-btn');
    saveBtn.style.display = isEditing ? 'inline-block' : 'none';
    if (!isEditing) saveBtn.disabled = false;
    drawerPanel.querySelector('#drawer-cancel-btn').style.display = isEditing ? 'inline-block' : 'none';
}

function _handleEdit() {
    isEditing = true;
    _renderDrawerContent();
    _updateButtonVisibility();
}

function _handleCancel() {
    isEditing = false;
    _renderDrawerContent();
    _updateButtonVisibility();
}

async function _handleAdd() {
    const schema = await tableLens.getTableSchema(currentTableId, { mode: 'clean' });
    openModal({
        title: `Adicionar em ${currentTableId}`,
        tableId: currentTableId,
        record: {},
        schema,
        onSave: async (newRecord) => {
            await dataWriter.addRecord(currentTableId, newRecord);
            publish('data-changed', { tableId: currentTableId, action: 'add' });
        },
    });
}

async function _handleDelete() {
    if (confirm(`Tem certeza que deseja deletar o registro ${currentRecordId}?`)) {
        await dataWriter.deleteRecords(currentTableId, [currentRecordId]);
        publish('data-changed', { tableId: currentTableId, recordId: currentRecordId, action: 'delete' });
        closeDrawer();
    }
}

async function _handleSave() {
    const changes = {};
    // Use more specific selector to only target inputs inside the value container
    const formElements = drawerPanel.querySelectorAll('.drawer-field-value [data-col-id]');
    const formColIds = new Set(Array.from(formElements).map(el => el.dataset.colId));

    console.log('[Drawer Debug] _handleSave called. Found formElements:', formElements.length);
    console.log('[Drawer Debug] Form Column IDs:', Array.from(formColIds));

    // First, process the values from the form
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        const colSchema = currentSchema[colId];
        
        console.log(`[Drawer Debug] Processing element for ${colId}. Tag: ${el.tagName}, Type: ${el.type}, Value: '${el.value}'`);

        if (!colSchema) {
            console.warn(`[Drawer Debug] Schema NOT FOUND for ${colId}. Skipping.`);
            return;
        }

        if (colSchema.isFormula) {
             console.log(`[Drawer Debug] Field ${colId} is a FORMULA. Skipping save.`);
             return; 
        }

        let value;
        if (colSchema.type === 'Bool' && el.tagName === 'SELECT') {
            if (el.value === 'true') value = true; else if (el.value === 'false') value = false; else value = null;
        } else if (colSchema.type === 'ChoiceList' && el.tagName === 'SELECT' && el.multiple) {
            const selectedOptions = Array.from(el.selectedOptions).map(opt => opt.value);
            value = selectedOptions.length > 0 ? ['L', ...selectedOptions] : null;
        } else if (el.type === 'checkbox') {
            value = el.checked;
        } else if (el.type === 'color') {
                value = el.value;
        } else if (colSchema.type.startsWith('Date')) {
            value = el.value;
            if (!value) { value = null; } else if (colSchema.type === 'Date') {
                const parts = value.split('-');
                value = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)) / 1000;
            } else { value = new Date(value).getTime() / 1000; }
        } else if (colSchema.type.startsWith('Ref')) {
            // Ensure reference values are numbers
            value = el.value ? Number(el.value) : 0;
        }
        else { value = el.value; }
        
        console.log(`[Drawer Debug] Value resolved for ${colId}:`, value);
        changes[colId] = value;
    });

    // Now, ensure fields not in the form are preserved, IGNORING formula columns
    for (const colId in currentSchema) {
        const colSchema = currentSchema[colId];
        if (!formColIds.has(colId) && !colSchema.isFormula && currentRecord.hasOwnProperty(colId)) {
            changes[colId] = currentRecord[colId];
        }
    }

    console.log('[Drawer Debug] Final changes object:', changes);

    if (Object.keys(changes).length > 0) {
        await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
    } else {
        console.warn('[Drawer Debug] No changes detected to save.');
    }
    publish('data-changed', { tableId: currentTableId, recordId: currentRecordId, action: 'update' });
    isEditing = false;
    await _renderDrawerContent();
    _updateButtonVisibility();
}

function _getCombinedRules(record) {
    const { hiddenFields = [], lockedFields = [], requiredFields = [], workflow = {} } = currentDrawerOptions;
    let finalHidden = hiddenFields;
    let finalLocked = lockedFields;
    let finalRequired = requiredFields;
    if (workflow.enabled && workflow.stageField && record) {
        const stageValue = record[workflow.stageField];
        if (stageValue && workflow.stages && workflow.stages[stageValue]) {
            const stageRules = workflow.stages[stageValue];
            if (stageRules.hasOwnProperty('hiddenFields')) finalHidden = stageRules.hiddenFields;
            if (stageRules.hasOwnProperty('lockedFields')) finalLocked = stageRules.lockedFields;
            if (stageRules.hasOwnProperty('requiredFields')) finalRequired = stageRules.requiredFields;
        }
    }
    return { hidden: [...new Set(finalHidden)], locked: [...new Set(finalLocked)], required: [...new Set(finalRequired)] };
}

function _handleStageChange(event) {
    const stageFieldId = currentDrawerOptions.workflow.stageField;
    currentRecord[stageFieldId] = event.target.value;
    const newRules = _getCombinedRules(currentRecord);
    drawerPanel.querySelectorAll('.drawer-field-row').forEach(row => {
        const colId = row.dataset.colId;
        if (!colId || colId === stageFieldId) return;
        const shouldBeHidden = newRules.hidden.includes(colId);
        row.style.display = shouldBeHidden ? 'none' : '';
        const input = row.querySelector(`[data-col-id="${colId}"]`);
        if (input) {
            const shouldBeLocked = newRules.locked.includes(colId);
            input.disabled = shouldBeLocked;
            input.closest('.drawer-field-value').classList.toggle('is-locked-style', shouldBeLocked);
        }
        const label = row.querySelector('.drawer-field-label');
        if (label) {
            let indicator = label.querySelector('.required-indicator');
            const shouldBeRequired = newRules.required.includes(colId);
            if (shouldBeRequired && !indicator) {
                indicator = document.createElement('span'); indicator.className = 'required-indicator'; indicator.textContent = '*'; label.appendChild(indicator);
            } else if (!shouldBeRequired && indicator) {
                indicator.remove();
            }
        }
    });
    _validateForm();
}

function _isFieldEmpty(element, colSchema) {
    if (!element) return true;
    const type = colSchema.type || 'Any';
    let value;
    if (element.type === 'checkbox') { value = element.checked; }
    else if (element.tagName === 'SELECT' && element.multiple) { value = Array.from(element.selectedOptions).map(opt => opt.value); }
    else { value = element.value; }
    if (type === 'Bool') return value !== true;
    if (type === 'ChoiceList' || type.startsWith('RefList')) return !value || value.length === 0;
    return !value || String(value).trim() === '';
}

function _validateForm() {
    if (!isEditing) return;
    const rules = _getCombinedRules(currentRecord);
    const saveButton = drawerPanel.querySelector('#drawer-save-btn');
    let isFormValid = true;
    for (const colId of rules.required) {
        if (rules.hidden.includes(colId)) continue;
        const fieldElement = drawerPanel.querySelector(`[data-col-id="${colId}"]`);
        const colSchema = currentSchema[colId];
        if (colSchema && _isFieldEmpty(fieldElement, colSchema)) {
            isFormValid = false;
            break;
        }
    }
    saveButton.disabled = !isFormValid;
    saveButton.title = isFormValid ? 'Salvar alterações' : 'Preencha todos os campos obrigatórios (*) para salvar.';
}

function _addFormListeners() {
    const formElements = drawerPanel.querySelectorAll('.drawer-field-value [data-col-id]');
    formElements.forEach(el => {
        el.addEventListener('change', _validateForm);
        el.addEventListener('keyup', _validateForm);
        el.addEventListener('input', _validateForm);
    });
    const { workflow = {} } = currentDrawerOptions;
    if (isEditing && workflow.enabled && workflow.stageField) {
        const stageFieldElement = drawerPanel.querySelector(`[data-col-id="${workflow.stageField}"]`);
        if (stageFieldElement) {
            stageFieldElement.addEventListener('change', _handleStageChange);
        }
    }
}

// =================================================================================
// --- FIM DA SEÇÃO DE FUNÇÕES AUXILIARES ---
// =================================================================================

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;

    // A função de carregamento de ícones está correta e pode permanecer.
    async function ensureIconsLoaded() {
        if (document.getElementById('grf-icon-symbols')) return;
        try {
            const response = await fetch('/libraries/icons/icons.svg');
            if (!response.ok) return;
            const svgText = await response.text();
            const div = document.createElement('div');
            div.id = 'grf-icon-symbols';
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {
            console.error('DrawerComponent: Falha ao carregar ícones:', error);
        }
    }
    ensureIconsLoaded();

    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../libraries/grist-drawer-component/drawer-style.css'; document.head.appendChild(link);
    const style = document.createElement('style');

    // CSS DE PRODUÇÃO FINAL
    style.textContent = `
        .drawer-header-buttons .icon, .drawer-close-btn .icon {
            color: #424242; /* Cor de ícone padrão (cinza escuro) */
            transition: color 0.2s;
        }
        .drawer-header-buttons button:hover .icon, .drawer-close-btn:hover .icon {
            color: #000000;
        }
        .drawer-header-buttons .icon { width: 20px; height: 20px; } 
        .drawer-close-btn .icon { width: 24px; height: 24px; } 
        .required-indicator { color: #dc3545; font-weight: bold; margin-left: 4px; } 
        .grf-tooltip-trigger { position: relative; display: inline-block; margin-left: 8px; width: 16px; height: 16px; border-radius: 50%; background-color: #adb5bd; color: white; font-size: 11px; font-weight: bold; text-align: center; line-height: 16px; cursor: help; } 
        .grf-tooltip-trigger:before, .grf-tooltip-trigger:after { position: absolute; left: 50%; transform: translateX(-50%); opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease; z-index: 10; } 
        .grf-tooltip-trigger:after { content: attr(data-tooltip); bottom: 150%; background-color: rgba(0, 0, 0, 0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: normal; line-height: 1.4; white-space: pre-wrap; width: 250px; } 
        .grf-tooltip-trigger:before { content: ''; bottom: 150%; margin-bottom: -5px; border-style: solid; border-width: 5px 5px 0 5px; border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent; } 
        .grf-tooltip-trigger:hover:before, .grf-tooltip-trigger:hover:after { opacity: 1; visibility: visible; }
    `;
    document.head.appendChild(style);

    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';

    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';

    // --- HTML CORRIGIDO COM OS IDs DE ÍCONE CORRETOS DO SEU ARQUIVO ---
    drawerPanel.innerHTML = `
        <div class="drawer-header"><h2 id="drawer-title"></h2>
            <div class="drawer-header-actions">
                <div class="drawer-header-buttons">
                    <button id="drawer-add-btn" title="Adicionar Novo"><svg class="icon"><use href="#icon-plus-circle-alt"></use></svg></button>
                    <button id="drawer-delete-btn" title="Deletar"><svg class="icon"><use href="#icon-trashbin"></use></svg></button>
                    <button id="drawer-edit-btn" title="Editar"><svg class="icon"><use href="#icon-edit"></use></svg></button>
                    <button id="drawer-save-btn" title="Salvar" style="display:none;"><svg class="icon"><use href="#icon-save"></use></svg></button>
                    <button id="drawer-cancel-btn" title="Cancelar" style="display:none;"><svg class="icon"><use href="#icon-close-circle"></use></svg></button>
                </div>
                <button class="drawer-close-btn" title="Fechar"><svg class="icon"><use href="#icon-close-circle"></use></svg></button>
            </div>
        </div>
        <div class="drawer-body"><div class="drawer-tabs"></div><div class="drawer-tab-panels"></div></div>`;

    document.body.appendChild(drawerOverlay); document.body.appendChild(drawerPanel);
    drawerHeader = drawerPanel.querySelector('.drawer-header');
    drawerTitle = drawerPanel.querySelector('#drawer-title');

    drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer);
    drawerPanel.querySelector('#drawer-edit-btn').addEventListener('click', _handleEdit);
    drawerPanel.querySelector('#drawer-save-btn').addEventListener('click', _handleSave);
    drawerPanel.querySelector('#drawer-cancel-btn').addEventListener('click', _handleCancel);
    drawerPanel.querySelector('#drawer-add-btn').addEventListener('click', _handleAdd);
    drawerPanel.querySelector('#drawer-delete-btn').addEventListener('click', _handleDelete);
    drawerOverlay.addEventListener('click', closeDrawer);
}

async function _renderDrawerContent() {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    tabsContainer.innerHTML = ''; panelsContainer.innerHTML = '';

    // MUDANÇA AQUI: Lê a nova configuração styleOverrides
    const { tabs = null, refListFieldConfig = {}, styleOverrides = {} } = currentDrawerOptions;

    const [cleanSchema, rawSchema] = await Promise.all([tableLens.getTableSchema(currentTableId), tableLens.getTableSchema(currentTableId, { mode: 'raw' })]);
    Object.keys(cleanSchema).forEach(colId => { if (rawSchema[colId] && rawSchema[colId].description) cleanSchema[colId].description = rawSchema[colId].description; });
    currentSchema = cleanSchema;

    if (currentRecordId === 'new') {
        currentRecord = {};
    } else {
        currentRecord = await tableLens.fetchRecordById(currentTableId, currentRecordId);
    }

    if (!currentRecord) {
        console.error("Drawer Error: Record not found and it is not a new record.");
        closeDrawer();
        return;
    }

    const rules = _getCombinedRules(currentRecord);
    const ruleIdToColIdMap = new Map();
    Object.values(currentSchema).forEach(col => { if (col?.colId?.startsWith('gristHelper_')) ruleIdToColIdMap.set(col.id, col.id); });

    if (tabs && Array.isArray(tabs) && tabs.length > 0) {
        // Passa styleOverrides para a função de renderização
        renderConfiguredTabs(tabs, rules.hidden, rules.locked, rules.required, currentRecord, ruleIdToColIdMap, refListFieldConfig, styleOverrides);
    } else {
        renderDefaultTabs(rules.hidden, rules.locked, rules.required, currentRecord, ruleIdToColIdMap, refListFieldConfig, styleOverrides);
    }

    if (isEditing) {
        _addFormListeners();
        _validateForm();
    }

    // Publish an event to notify that the drawer has finished rendering.
    publish('drawer-rendered', { tableId: currentTableId, recordId: currentRecordId, isEditing: isEditing });

    // --- DEBUG INFO RENDER ---
    if (currentDrawerOptions.showDebugInfo) {
        const debugDiv = document.createElement('div');
        debugDiv.style.padding = '10px';
        debugDiv.style.borderTop = '2px solid red';
        debugDiv.style.backgroundColor = '#fff0f0';
        debugDiv.innerHTML = `<h3>Schema Debug Info (TableLens)</h3>
        <textarea rows="10" style="width: 100%; font-family: monospace;">${JSON.stringify(currentSchema, null, 2)}</textarea>`;
        drawerPanel.querySelector('.drawer-body').appendChild(debugDiv);
    }
}


function renderConfiguredTabs(configuredTabs, hiddenFields, lockedFields, requiredFields, record, ruleIdToColIdMap, refListFieldConfig, styleOverrides) {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    tabsContainer.innerHTML = ''; panelsContainer.innerHTML = '';
    configuredTabs.forEach((tabConfig, index) => {
        const tabEl = document.createElement('div'); tabEl.className = 'drawer-tab'; tabEl.textContent = tabConfig.title; tabsContainer.appendChild(tabEl);
        const panelEl = document.createElement('div'); panelEl.className = 'drawer-tab-content'; panelsContainer.appendChild(panelEl);
        tabEl.addEventListener('click', () => _switchToTab(tabEl, panelEl));
        if (index === 0) _switchToTab(tabEl, panelEl);
        tabConfig.fields.forEach(fieldId => {
            const colSchema = currentSchema[fieldId];
            if (colSchema && !hiddenFields.includes(colSchema.colId)) {
                renderSingleField(panelEl, colSchema, record, lockedFields, requiredFields, ruleIdToColIdMap, refListFieldConfig, styleOverrides);
            }
        });
    });
}

function renderDefaultTabs(hiddenFields, lockedFields, requiredFields, record, ruleIdToColIdMap, refListFieldConfig, styleOverrides) {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    const allCols = Object.values(currentSchema);
    let mainCols = allCols.filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos' && !hiddenFields.includes(c.colId));
    const helperCols = allCols.filter(c => c && (c.colId.startsWith('gristHelper_') || c.type === 'ManualSortPos') && !hiddenFields.includes(c.colId));
    const fieldOrder = currentDrawerOptions.fieldOrder || [];
    if (fieldOrder.length > 0) {
        const orderMap = new Map(fieldOrder.map((id, index) => [id, index]));
        mainCols.sort((a, b) => { const indexA = orderMap.get(a.colId); const indexB = orderMap.get(b.colId); if (indexA !== undefined && indexB !== undefined) return indexA - indexB; if (indexA !== undefined) return -1; if (indexB !== undefined) return 1; return (a.parentPos || 0) - (b.parentPos || 0); });
    } else { mainCols.sort((a, b) => (a.parentPos || 0) - (b.parentPos || 0)); }
    const tabs = { "Principal": mainCols };
    if (helperCols.length > 0) { tabs["Dados do Sistema"] = helperCols; }
    Object.entries(tabs).forEach(([tabName, cols], index) => {
        const tabEl = document.createElement('div'); tabEl.className = 'drawer-tab'; tabEl.textContent = tabName; tabsContainer.appendChild(tabEl);
        const panelEl = document.createElement('div'); panelEl.className = 'drawer-tab-content'; panelsContainer.appendChild(panelEl);
        tabEl.addEventListener('click', () => _switchToTab(tabEl, panelEl));
        if (index === 0) _switchToTab(tabEl, panelEl);
        cols.forEach(colSchema => {
            renderSingleField(panelEl, colSchema, record, lockedFields, requiredFields, ruleIdToColIdMap, refListFieldConfig, styleOverrides);
        });
    });
}

function renderSingleField(panelEl, colSchema, record, lockedFields, requiredFields, ruleIdToColIdMap, refListFieldConfig = {}, styleOverrides = {}) {

    const row = document.createElement('div');
    row.className = 'drawer-field-row';
    row.dataset.colId = colSchema.colId;

    const label = document.createElement('label');
    label.className = 'drawer-field-label';
    const labelText = colSchema.label || colSchema.colId;
    const isFieldRequired = requiredFields.includes(colSchema.colId);

    let labelHtml = labelText;
    if (isFieldRequired) {
        labelHtml += ` <span class="required-indicator">*</span>`;
    }

    if (colSchema.description && colSchema.description.trim() !== '') {
        const sanitizedDescription = colSchema.description.replace(/"/g, '&quot;');
        labelHtml += ` <span class="grf-tooltip-trigger" data-tooltip="${sanitizedDescription}">?</span>`;
    }

    label.innerHTML = labelHtml;

    const valueContainer = document.createElement('div');
    valueContainer.className = 'drawer-field-value';

    row.appendChild(label);
    row.appendChild(valueContainer);
    panelEl.appendChild(row);

    // Treat formula columns as locked to prevent editing in UI, matching save logic
    const isLocked = lockedFields.includes(colSchema.colId); // Reverted: Do not auto-lock formulas.

    const renderOptions = {
        container: valueContainer,
        colSchema: colSchema,
        record: record,
        isEditing: isEditing,
        isLocked: isLocked, // Pass explicit locked state (includes formulas)
        labelElement: label,
        styleOverride: styleOverrides[colSchema.colId],
        tableLens: tableLens,
        fieldOptions: {}
    };

    const widgetOverride = currentDrawerOptions.widgetOverrides?.[colSchema.colId];
    let widgetType = null;
    let widgetOptions = {};

    if (typeof widgetOverride === 'string') {
        widgetType = widgetOverride;
    } else if (typeof widgetOverride === 'object' && widgetOverride !== null) {
        widgetType = widgetOverride.widget;
        widgetOptions = widgetOverride.options || {};
    }

    if (widgetType === 'ColorPicker') {
        renderOptions.fieldOptions.colorPicker = true;
    } else if (widgetType === 'ProgressBar') {
        renderOptions.fieldOptions.progressBar = true;
        renderOptions.fieldOptions.widgetOptions = widgetOptions;
    }

    if (colSchema.type.startsWith('RefList:') && refListFieldConfig[colSchema.colId]) {
        renderOptions.fieldConfig = refListFieldConfig[colSchema.colId];
    }

    renderField(renderOptions);
}

export async function openDrawer(tableId, recordId, options = {}) {
    _initializeDrawerDOM();
    currentTableId = tableId;
    currentRecordId = recordId;
    // For new records, automatically enter edit mode.
    isEditing = recordId === 'new' || options.mode === 'edit' || false;
    currentDrawerOptions = options;
    if (drawerPanel) { drawerPanel.classList.remove('is-modal'); }
    if (drawerOverlay) { drawerOverlay.classList.remove('is-modal-overlay'); }
    if (options.displayMode === 'modal') {
        drawerPanel.classList.add('is-modal');
        drawerOverlay.classList.add('is-modal-overlay');
    }
    if (options.width && drawerPanel) { drawerPanel.style.width = options.width || ''; }
    document.body.classList.add('grist-drawer-is-open');
    drawerPanel.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawerTitle.textContent = recordId === 'new' ? `New Record` : `Detalhes do Registro ${recordId}`;
    _updateButtonVisibility();
    try {
        await _renderDrawerContent();
    } catch (error) {
        console.error("Error opening drawer:", error);
        drawerPanel.querySelector('.drawer-tab-panels').innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

export function closeDrawer() {
    if (!drawerPanel) return;
    document.body.classList.remove('grist-drawer-is-open');
    drawerPanel.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
    drawerPanel.style.width = '';
    drawerPanel.classList.remove('is-modal');
    drawerOverlay.classList.remove('is-modal-overlay');
}