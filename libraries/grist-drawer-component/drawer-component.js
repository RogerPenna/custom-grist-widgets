// libraries/grist-drawer-component/drawer-component.js

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { openModal } from '../grist-modal-component/modal-component.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let drawerPanel, drawerOverlay, drawerHeader, drawerTitle;
let currentTableId, currentRecordId;
let isEditing = false;

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-drawer-component/drawer-style.css';
    document.head.appendChild(link);

    // This CSS is restored from your original code
    const style = document.createElement('style');
    style.textContent = `
        .drawer-tabs{display:flex;border-bottom:1px solid #e0e0e0;flex-shrink:0;}
        .drawer-tab{padding:10px 15px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
        .drawer-tab.is-active{font-weight:bold;color:#007bff;border-bottom-color:#007bff;}
        .drawer-tab-content{display:none;padding:20px;}.drawer-tab-content.is-active{display:block;}
        .drawer-header-buttons button { margin-left: 10px; }
    `;
    document.head.appendChild(style);

    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';

    // The full HTML structure with all buttons is restored and enhanced
    drawerPanel.innerHTML = `
        <div class="drawer-header">
            <h2 id="drawer-title"></h2>
            <div class="drawer-header-buttons">
                <button id="drawer-add-btn">+ Adicionar Novo</button>
                <button id="drawer-delete-btn">🗑️ Deletar</button>
                <button id="drawer-edit-btn">✏️ Editar</button>
                <button id="drawer-save-btn" style="display:none;">✔️ Salvar</button>
                <button id="drawer-cancel-btn" style="display:none;">❌ Cancelar</button>
                <button class="drawer-close-btn">×</button>
            </div>
        </div>
        <div class="drawer-body">
            <div class="drawer-tabs"></div>
            <div class="drawer-tab-panels"></div>
        </div>
    `;
    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);
    
    drawerHeader = drawerPanel.querySelector('.drawer-header');
    drawerTitle = drawerPanel.querySelector('#drawer-title');
    
    // Wire up all the buttons
    drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer);
    drawerPanel.querySelector('#drawer-edit-btn').addEventListener('click', _handleEdit);
    drawerPanel.querySelector('#drawer-save-btn').addEventListener('click', _handleSave);
    drawerPanel.querySelector('#drawer-cancel-btn').addEventListener('click', _handleCancel);
    drawerPanel.querySelector('#drawer-add-btn').addEventListener('click', _handleAdd);
    drawerPanel.querySelector('#drawer-delete-btn').addEventListener('click', _handleDelete);
    drawerOverlay.addEventListener('click', closeDrawer);
}

// Restored from your original code
function _switchToTab(tabElement, panelElement) {
    drawerPanel.querySelectorAll('.drawer-tab.is-active').forEach(t => t.classList.remove('is-active'));
    drawerPanel.querySelectorAll('.drawer-tab-content.is-active').forEach(p => p.classList.remove('is-active'));
    tabElement.classList.add('is-active');
    panelElement.classList.add('is-active');
}

// New action handlers
function _handleEdit() {
    isEditing = true;
    _renderDrawerContent(); // Re-render the content in edit mode
    _updateButtonVisibility();
}

async function _handleSave() {
    const changes = {};
    const formElements = drawerPanel.querySelectorAll('[data-col-id]');
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        changes[colId] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    
    await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
    isEditing = false;
    openDrawer(currentTableId, currentRecordId); // Refresh with new data
    _updateButtonVisibility();
}

function _handleCancel() {
    isEditing = false;
    _renderDrawerContent(); // Re-render in read-only mode
    _updateButtonVisibility();
}

async function _handleAdd() {
    const schema = await tableLens.getTableSchema(currentTableId, { mode: 'raw' });
    openModal({
        title: `Adicionar em ${currentTableId}`, tableId: currentTableId, record: {}, schema,
        onSave: async (newRecord) => {
            await dataWriter.addRecord(currentTableId, newRecord);
        }
    });
}

async function _handleDelete() {
    if (confirm(`Tem certeza que deseja deletar o registro ${currentRecordId}?`)) {
        await dataWriter.deleteRecords(currentTableId, [currentRecordId]);
        closeDrawer(); // Close the drawer as the record no longer exists
    }
}

function _updateButtonVisibility() {
    drawerPanel.querySelector('#drawer-edit-btn').style.display = isEditing ? 'none' : 'inline-block';
    drawerPanel.querySelector('#drawer-delete-btn').style.display = isEditing ? 'none' : 'inline-block';
    drawerPanel.querySelector('#drawer-save-btn').style.display = isEditing ? 'inline-block' : 'none';
    drawerPanel.querySelector('#drawer-cancel-btn').style.display = isEditing ? 'inline-block' : 'none';
}

// A new internal function to render the content, supporting both read and edit modes
async function _renderDrawerContent() {
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    
    tabsContainer.innerHTML = '';
    panelsContainer.innerHTML = '';

    const schema = await tableLens.getTableSchema(currentTableId, { mode: 'raw' });
    const record = await tableLens.fetchRecordById(currentTableId, currentRecordId);
    if (!record) throw new Error(`Record ${currentRecordId} not found.`);
    const ruleIdToColIdMap = new Map();
    schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

    // Using the tab logic from your original code
    const tabs = { "Main": schema.filter(col => !col.colId.startsWith('gristHelper_')) };
    Object.entries(tabs).forEach(([tabName, cols], index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'drawer-tab';
        tabEl.textContent = tabName;
        const panelEl = document.createElement('div');
        panelEl.className = 'drawer-tab-content';
        
        tabsContainer.appendChild(tabEl);
        panelsContainer.appendChild(panelEl);

        if (index === 0) {
            tabEl.classList.add('is-active');
            panelEl.classList.add('is-active');
        }
        tabEl.onclick = () => _switchToTab(tabEl, panelEl);

        cols.forEach(colSchema => {
            const row = document.createElement('div');
            row.className = 'drawer-field-row';
            const label = document.createElement('label');
            label.className = 'drawer-field-label';
            label.textContent = colSchema.label || colSchema.colId;
            const valueContainer = document.createElement('div');
            valueContainer.className = 'drawer-field-value';
            row.appendChild(label);
            row.appendChild(valueContainer);
            panelEl.appendChild(row);

            renderField({
                container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap,
                isEditing: isEditing && !colSchema.isFormula // Pass edit flag, disable for formulas
            });
        });
    });
}

// The main public function
export async function openDrawer(tableId, recordId) {
    _initializeDrawerDOM();
    currentTableId = tableId;
    currentRecordId = recordId;
    isEditing = false; // Always open in read-only mode first

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
}