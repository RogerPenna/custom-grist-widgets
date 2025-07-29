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

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-drawer-component/drawer-style.css';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
        .drawer-body { display: flex; flex-direction: column; overflow: hidden; height: 100%; }
        .drawer-tabs{display:flex;border-bottom:1px solid #e0e0e0;flex-shrink:0;}
        .drawer-tab{padding:10px 15px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
        .drawer-tab.is-active{font-weight:bold;color:#007bff;border-bottom-color:#007bff;}
        .drawer-tab-panels{flex-grow:1;overflow-y:auto;}
        .drawer-tab-content{display:none;padding:20px;}.drawer-tab-content.is-active{display:block;}
        .drawer-header-buttons button { margin-left: 10px; }
        .is-locked-style { background-color: #f1f3f5; cursor: not-allowed; opacity: 0.8; padding: 6px 8px; border-radius: 4px; border: 1px solid #ced4da; min-height: 20px; }
        .drawer-field-label { display: flex; align-items: center; }
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
    drawerPanel.innerHTML = `<div class="drawer-header"><h2 id="drawer-title"></h2><div class="drawer-header-buttons"><button id="drawer-add-btn">+ Adicionar Novo</button><button id="drawer-delete-btn">🗑️ Deletar</button><button id="drawer-edit-btn">✏️ Editar</button><button id="drawer-save-btn" style="display:none;">✔️ Salvar</button><button id="drawer-cancel-btn" style="display:none;">❌ Cancelar</button><button class="drawer-close-btn">×</button></div></div><div class="drawer-body"><div class="drawer-tabs"></div><div class="drawer-tab-panels"></div></div>`;
    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);
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

function _switchToTab(tabElement, panelElement) {
    drawerPanel.querySelectorAll('.drawer-tab.is-active').forEach(t => t.classList.remove('is-active'));
    drawerPanel.querySelectorAll('.drawer-tab-content.is-active').forEach(p => p.classList.remove('is-active'));
    tabElement.classList.add('is-active');
    panelElement.classList.add('is-active');
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
            const result = await dataWriter.addRecord(currentTableId, newRecord);
            publish('data-changed', { tableId: currentTableId, recordId: result.id, action: 'add' });
            await _renderDrawerContent();
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

function _updateButtonVisibility() {
    drawerPanel.querySelector('#drawer-edit-btn').style.display = isEditing ? 'none' : 'inline-block';
    drawerPanel.querySelector('#drawer-delete-btn').style.display = isEditing ? 'none' : 'inline-block';
    drawerPanel.querySelector('#drawer-save-btn').style.display = isEditing ? 'inline-block' : 'none';
    drawerPanel.querySelector('#drawer-cancel-btn').style.display = isEditing ? 'inline-block' : 'none';
}

async function _handleSave() {
    const changes = {};
    const formElements = drawerPanel.querySelectorAll('[data-col-id]');
    
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        const colSchema = currentSchema[colId];
        
        if (colSchema && !colSchema.isFormula) {
            let value;
            
            if (colSchema.type === 'Bool' && el.tagName === 'SELECT') {
                if (el.value === 'true') value = true;
                else if (el.value === 'false') value = false;
                else value = null;
            } else if (colSchema.type === 'ChoiceList' && el.tagName === 'SELECT' && el.multiple) {
                const selectedOptions = Array.from(el.selectedOptions).map(opt => opt.value);
                value = selectedOptions.length > 0 ? ['L', ...selectedOptions] : null;
            } else if (el.type === 'checkbox') {
                value = el.checked;
            } else if (colSchema.type.startsWith('Date')) {
                value = el.value;
                if (!value) {
                    value = null;
                } else if (colSchema.type === 'Date') {
                    const parts = value.split('-');
                    value = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)) / 1000;
                } else { // DateTime
                    value = new Date(value).getTime() / 1000;
                }
            } else {
                value = el.value;
            }
            
            changes[colId] = value;
        }
    });

    if (Object.keys(changes).length > 0) {
        await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
    }
    
    publish('data-changed', { tableId: currentTableId, recordId: currentRecordId, action: 'update' });

    isEditing = false;
    await _renderDrawerContent();
    _updateButtonVisibility();
}

async function _renderDrawerContent() {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    tabsContainer.innerHTML = '';
    panelsContainer.innerHTML = '';

    const {
        hiddenFields = [],
        lockedFields = [],
        tabs = null,
        refListColumns = {} // ** ADICIONADO: Extrai a nova configuração **
    } = currentDrawerOptions;

    const [cleanSchema, rawSchema] = await Promise.all([
        tableLens.getTableSchema(currentTableId),
        tableLens.getTableSchema(currentTableId, { mode: 'raw' })
    ]);
    Object.keys(cleanSchema).forEach(colId => {
        if (rawSchema[colId] && rawSchema[colId].description) {
            cleanSchema[colId].description = rawSchema[colId].description;
        }
    });
    currentSchema = cleanSchema;
    const record = await tableLens.fetchRecordById(currentTableId, currentRecordId);
    if (!record) { closeDrawer(); return; }
    
    const ruleIdToColIdMap = new Map();
    Object.values(currentSchema).forEach(col => {
        if (col?.colId?.startsWith('gristHelper_')) ruleIdToColIdMap.set(col.id, col.id);
    });

    if (tabs && Array.isArray(tabs) && tabs.length > 0) {
        // ** MODIFICADO: Passa a nova configuração adiante **
        renderConfiguredTabs(tabs, hiddenFields, lockedFields, record, ruleIdToColIdMap, refListColumns);
    } else {
        // ** MODIFICADO: Passa a nova configuração adiante **
        renderDefaultTabs(hiddenFields, lockedFields, record, ruleIdToColIdMap, refListColumns);
    }
}

function renderConfiguredTabs(configuredTabs, hiddenFields, lockedFields, record, ruleIdToColIdMap, refListColumns) {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');

    configuredTabs.forEach((tabConfig, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'drawer-tab';
        tabEl.textContent = tabConfig.title;
        tabsContainer.appendChild(tabEl);
        
        const panelEl = document.createElement('div');
        panelEl.className = 'drawer-tab-content';
        panelsContainer.appendChild(panelEl);

        tabEl.addEventListener('click', () => _switchToTab(tabEl, panelEl));
        if (index === 0) _switchToTab(tabEl, panelEl);

        tabConfig.fields.forEach(fieldId => {
            const colSchema = currentSchema[fieldId];
            if (colSchema && !hiddenFields.includes(colSchema.colId)) {
                // ** MODIFICADO: Passa a nova configuração para a função de renderização individual **
                renderSingleField(panelEl, colSchema, record, lockedFields, ruleIdToColIdMap, refListColumns);
            }
        });
    });
}

// ** RESTAURADO: Funcionalidade completa da renderização de abas padrão **
function renderDefaultTabs(hiddenFields, lockedFields, record, ruleIdToColIdMap, refListColumns) {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    
    const allCols = Object.values(currentSchema);
    let mainCols = allCols.filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos' && !hiddenFields.includes(c.colId));
    const helperCols = allCols.filter(c => c && (c.colId.startsWith('gristHelper_') || c.type === 'ManualSortPos') && !hiddenFields.includes(c.colId));

    const fieldOrder = currentDrawerOptions.fieldOrder || [];
    if (fieldOrder.length > 0) {
        const orderMap = new Map(fieldOrder.map((id, index) => [id, index]));
        mainCols.sort((a, b) => {
            const indexA = orderMap.get(a.colId);
            const indexB = orderMap.get(b.colId);
            if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
            if (indexA !== undefined) return -1;
            if (indexB !== undefined) return 1;
            return (a.parentPos || 0) - (b.parentPos || 0);
        });
    } else {
        mainCols.sort((a,b) => (a.parentPos || 0) - (b.parentPos || 0));
    }

    const tabs = { "Principal": mainCols };
    if (helperCols.length > 0) {
        tabs["Dados do Sistema"] = helperCols;
    }

    Object.entries(tabs).forEach(([tabName, cols], index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'drawer-tab';
        tabEl.textContent = tabName;
        tabsContainer.appendChild(tabEl);
        
        const panelEl = document.createElement('div');
        panelEl.className = 'drawer-tab-content';
        panelsContainer.appendChild(panelEl);

        tabEl.addEventListener('click', () => _switchToTab(tabEl, panelEl));
        if (index === 0) _switchToTab(tabEl, panelEl);

        cols.forEach(colSchema => {
             // ** MODIFICADO: Passa a nova configuração para a função de renderização individual **
            renderSingleField(panelEl, colSchema, record, lockedFields, ruleIdToColIdMap, refListColumns);
        });
    });
}

// ** MODIFICADO: Função central que aplica a nova lógica **
function renderSingleField(panelEl, colSchema, record, lockedFields, ruleIdToColIdMap, refListColumns = {}) {
    const row = document.createElement('div');
    row.className = 'drawer-field-row';
    const label = document.createElement('label');
    label.className = 'drawer-field-label';
    
    const labelText = colSchema.label || colSchema.colId;
    if (colSchema.description && colSchema.description.trim() !== '') {
        const sanitizedDescription = colSchema.description.replace(/"/g, '"');
        label.innerHTML = `${labelText} <span class="grf-tooltip-trigger" data-tooltip="${sanitizedDescription}">?</span>`;
    } else {
        label.textContent = labelText;
    }
    
    const valueContainer = document.createElement('div');
    valueContainer.className = 'drawer-field-value';
    row.appendChild(label);
    row.appendChild(valueContainer);
    panelEl.appendChild(row);

    const isFieldLocked = lockedFields.includes(colSchema.colId);

    const renderOptions = {
        container: valueContainer,
        labelElement: label,
        colSchema: colSchema,
        record,
        tableLens,
        ruleIdToColIdMap,
        isEditing: isEditing,
        isLocked: isFieldLocked
    };
    
    // **A ÚNICA NOVA LÓGICA É AQUI:**
    // Verifica se existe uma config de coluna para esta RefList e a adiciona.
    if (colSchema.type.startsWith('RefList:') && refListColumns[colSchema.colId]) {
        renderOptions.fieldConfig = refListColumns[colSchema.colId];
    }

    renderField(renderOptions);
}

export async function openDrawer(tableId, recordId, options = {}) {
    _initializeDrawerDOM();
    currentTableId = tableId;
    currentRecordId = recordId;
    isEditing = options.mode === 'edit' || false;
    currentDrawerOptions = options; 

    if (drawerPanel) drawerPanel.classList.remove('is-modal');
    if (drawerOverlay) drawerOverlay.classList.remove('is-modal-overlay');

    if (options.displayMode === 'modal') {
        drawerPanel.classList.add('is-modal');
        drawerOverlay.classList.add('is-modal-overlay');
    }

    if (options.width && drawerPanel) {
        drawerPanel.style.width = options.width || '';
    }

    document.body.classList.add('grist-drawer-is-open');
    drawerPanel.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawerTitle.textContent = `Detalhes do Registro ${recordId}`;
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