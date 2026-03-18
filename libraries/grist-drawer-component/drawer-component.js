// libraries/grist-drawer-component/drawer-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { openModal } from '../grist-modal-component/modal-component.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

let drawerPanel, drawerOverlay, drawerHeader, drawerTitle;
let currentTableId, currentRecordId;
let currentSchema = {};
let currentDrawerOptions = {};
let isEditing = false;
let currentRecord = null;

// Ferramentas de dados dinâmicas (Suporta Headless ou Grist padrão)
let tableLens;
let dataWriter;

function _ensureTools(options = {}) {
    if (options.tableLens) {
        tableLens = options.tableLens;
    } else if (!tableLens) {
        try { tableLens = new GristTableLens(window.grist); } catch (e) { console.warn("[Drawer] GristTableLens não pôde ser instanciado.", e); }
    }
    if (options.dataWriter) {
        dataWriter = options.dataWriter;
    } else if (!dataWriter) {
        try { dataWriter = new GristDataWriter(window.grist); } catch (e) { console.warn("[Drawer] GristDataWriter não pôde ser instanciado.", e); }
    }
}

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
        tableLens: tableLens,
        dataWriter: dataWriter
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
    const formElements = drawerPanel.querySelectorAll('.drawer-field-value [data-col-id]');
    const formColIds = new Set(Array.from(formElements).map(el => el.dataset.colId));

    formElements.forEach(el => {
        const colId = el.dataset.colId;
        const colSchema = currentSchema[colId];
        if (!colSchema || colSchema.isFormula) return;

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
            value = el.value ? Number(el.value) : 0;
        }
        else { value = el.value; }
        changes[colId] = value;
    });

    for (const colId in currentSchema) {
        const colSchema = currentSchema[colId];
        if (!formColIds.has(colId) && !colSchema.isFormula && currentRecord.hasOwnProperty(colId)) {      
            changes[colId] = currentRecord[colId];
        }
    }

    if (Object.keys(changes).length > 0) {
        await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
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
}

function _addFormListeners() {
    const formElements = drawerPanel.querySelectorAll('.drawer-field-value [data-col-id]');
    formElements.forEach(el => {
        el.addEventListener('change', _validateForm);
        el.addEventListener('keyup', _validateForm);
        el.addEventListener('input', _validateForm);
    });
}

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;

    async function ensureIconsLoaded() {
        if (document.getElementById('grf-icon-symbols')) return;
        try {
            const response = await fetch('../libraries/icons/icons.svg');
            if (!response.ok) return;
            const svgText = await response.text();
            const div = document.createElement('div');
            div.id = 'grf-icon-symbols';
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {}
    }
    ensureIconsLoaded();

    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../libraries/grist-drawer-component/drawer-style.css'; document.head.appendChild(link);
    
    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    drawerOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9998;display:none;backdrop-filter:blur(2px);";

    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';
    drawerPanel.style.cssText = "position:fixed;top:0;right:-600px;width:600px;height:100%;background:white;z-index:9999;transition:right 0.3s ease-out;box-shadow:-5px 0 25px rgba(0,0,0,0.15);display:flex;flex-direction:column;font-family:'Manrope',sans-serif;";

    drawerPanel.innerHTML = `
        <div class="drawer-header" style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <h2 id="drawer-title" style="margin:0;font-size:18px;font-weight:800;color:#1e293b;"></h2>
            <div class="drawer-header-actions" style="display:flex;gap:10px;align-items:center;">
                <div class="drawer-header-buttons" style="display:flex;gap:8px;">
                    <button id="drawer-add-btn" title="Adicionar Novo" style="background:none;border:none;cursor:pointer;"><svg class="icon" style="width:20px;height:20px;fill:none;stroke:#64748b;stroke-width:2;"><use href="#icon-plus-circle-alt"></use></svg></button>
                    <button id="drawer-delete-btn" title="Deletar" style="background:none;border:none;cursor:pointer;"><svg class="icon" style="width:20px;height:20px;fill:none;stroke:#64748b;stroke-width:2;"><use href="#icon-trashbin"></use></svg></button>
                    <button id="drawer-edit-btn" title="Editar" style="background:none;border:none;cursor:pointer;"><svg class="icon" style="width:20px;height:20px;fill:none;stroke:#64748b;stroke-width:2;"><use href="#icon-edit"></use></svg></button>
                    <button id="drawer-save-btn" title="Salvar" style="display:none;background:none;border:none;cursor:pointer;"><svg class="icon" style="width:20px;height:20px;fill:none;stroke:#3b82f6;stroke-width:2;"><use href="#icon-save"></use></svg></button>
                    <button id="drawer-cancel-btn" title="Cancelar" style="display:none;background:none;border:none;cursor:pointer;"><svg class="icon" style="width:20px;height:20px;fill:none;stroke:#ef4444;stroke-width:2;"><use href="#icon-close-circle"></use></svg></button>
                </div>
                <button class="drawer-close-btn" title="Fechar" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;display:flex;align-items:center;">&times;</button>
            </div>
        </div>
        <div class="drawer-body" style="flex:1;overflow-y:auto;padding:20px;">
            <div class="drawer-tabs" style="display:flex;gap:15px;margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:10px;"></div>
            <div class="drawer-tab-panels"></div>
        </div>`;

    document.body.appendChild(drawerOverlay); document.body.appendChild(drawerPanel);
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

    const { tabs = null, refListFieldConfig = {}, styleOverrides = {} } = currentDrawerOptions;

    const [cleanSchema, rawSchema] = await Promise.all([
        tableLens.getTableSchema(currentTableId), 
        tableLens.getTableSchema(currentTableId, { mode: 'raw' })
    ]);
    
    currentSchema = cleanSchema;

    if (currentRecordId === 'new') {
        currentRecord = {};
    } else {
        currentRecord = await tableLens.fetchRecordById(currentTableId, currentRecordId);
    }

    if (!currentRecord) {
        closeDrawer();
        return;
    }

    const rules = _getCombinedRules(currentRecord);

    if (tabs && Array.isArray(tabs) && tabs.length > 0) {
        renderConfiguredTabs(tabs, rules.hidden, rules.locked, rules.required, currentRecord, refListFieldConfig, styleOverrides);
    } else {
        renderDefaultTabs(rules.hidden, rules.locked, rules.required, currentRecord, refListFieldConfig, styleOverrides);
    }

    if (isEditing) {
        _addFormListeners();
        _validateForm();
    }
    publish('drawer-rendered', { tableId: currentTableId, recordId: currentRecordId, isEditing: isEditing });
}

function renderConfiguredTabs(configuredTabs, hiddenFields, lockedFields, requiredFields, record, refListFieldConfig, styleOverrides) {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    configuredTabs.forEach((tabConfig, index) => {
        const tabEl = document.createElement('div'); 
        tabEl.className = 'drawer-tab' + (index === 0 ? ' is-active' : ''); 
        tabEl.style.cssText = "cursor:pointer;font-weight:700;font-size:13px;color:#64748b;padding-bottom:8px;transition:all 0.2s;white-space:nowrap;border-bottom:2px solid transparent;";
        tabEl.textContent = tabConfig.title; 
        tabsContainer.appendChild(tabEl);

        const panelEl = document.createElement('div'); 
        panelEl.className = 'drawer-tab-content' + (index === 0 ? ' is-active' : ''); 
        panelEl.style.display = index === 0 ? 'block' : 'none';
        panelsContainer.appendChild(panelEl);

        tabEl.addEventListener('click', () => {
            tabsContainer.querySelectorAll('.drawer-tab').forEach(t => { 
                t.classList.remove('is-active'); 
                t.style.color = '#64748b'; 
                t.style.borderBottomColor = 'transparent'; 
            });
            panelsContainer.querySelectorAll('.drawer-tab-content').forEach(p => p.style.display = 'none');
            tabEl.classList.add('is-active');
            tabEl.style.color = '#3b82f6';
            tabEl.style.borderBottomColor = '#3b82f6';
            panelEl.style.display = 'block';
        });
        
        if (index === 0) {
            tabEl.style.color = '#3b82f6';
            tabEl.style.borderBottomColor = '#3b82f6';
        }

        tabConfig.fields.forEach(fieldId => {
            const colSchema = currentSchema[fieldId];
            if (colSchema && !hiddenFields.includes(colSchema.colId)) {
                renderSingleField(panelEl, colSchema, record, lockedFields, requiredFields, refListFieldConfig, styleOverrides);
            }
        });
    });
}

function renderDefaultTabs(hiddenFields, lockedFields, requiredFields, record, refListFieldConfig, styleOverrides) {
    const allCols = Object.values(currentSchema);
    let mainCols = allCols.filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos' && !hiddenFields.includes(c.colId));
    mainCols.sort((a, b) => (a.parentPos || 0) - (b.parentPos || 0));
    
    renderConfiguredTabs([{ title: "Principal", fields: mainCols.map(c => c.colId) }], hiddenFields, lockedFields, requiredFields, record, refListFieldConfig, styleOverrides);
}

function renderSingleField(panelEl, colSchema, record, lockedFields, requiredFields, refListFieldConfig = {}, styleOverrides = {}) {
    const row = document.createElement('div');
    row.className = 'drawer-field-row';
    row.style.marginBottom = '20px';
    row.dataset.colId = colSchema.colId;

    const label = document.createElement('label');
    label.style.cssText = "display:block;font-weight:800;font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.025em;";
    label.textContent = colSchema.label || colSchema.colId;

    const valueContainer = document.createElement('div');
    valueContainer.className = 'drawer-field-value';
    valueContainer.style.minHeight = "24px";
    valueContainer.style.fontSize = "14px";
    valueContainer.style.color = "#1e293b";

    row.appendChild(label);
    row.appendChild(valueContainer);
    panelEl.appendChild(row);

    const isLocked = lockedFields.includes(colSchema.colId);      

    renderField({
        container: valueContainer,
        colSchema: colSchema,
        record: record,
        isEditing: isEditing,
        isLocked: isLocked,
        labelElement: label,
        styleOverride: styleOverrides[colSchema.colId],
        tableLens: tableLens
    });
}

export async function openDrawer(tableId, recordId, options = {}) {
    _ensureTools(options);
    _initializeDrawerDOM();
    currentTableId = tableId;
    currentRecordId = recordId;
    isEditing = recordId === 'new' || options.mode === 'edit' || false;
    currentDrawerOptions = options;

    drawerOverlay.style.display = 'block';
    drawerPanel.style.right = '0';
    drawerTitle.textContent = recordId === 'new' ? `Novo Registro` : `Registro #${recordId}`;     
    
    _updateButtonVisibility();
    try {
        await _renderDrawerContent();
    } catch (error) {
        console.error("Error opening drawer:", error);
    }
}

export function closeDrawer() {
    if (!drawerPanel) return;
    drawerPanel.style.right = '-600px';
    drawerOverlay.style.display = 'none';
}

// Compatibilidade global
window.GristDrawer = {
    open: openDrawer,
    close: closeDrawer
};
