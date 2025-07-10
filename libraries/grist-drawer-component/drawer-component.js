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
// MUDANÇA: Inicializa como um objeto vazio, pois é isso que a API retorna agora.
let currentSchema = {};
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
    // MUDANÇA: O schema já é um objeto (dicionário), que é o que o modal espera.
    const schema = await tableLens.getTableSchema(currentTableId, { mode: 'clean' });
    openModal({
        title: `Adicionar em ${currentTableId}`,
        tableId: currentTableId,
        record: {},
        schema, // Passa o objeto de schema diretamente
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
        // MUDANÇA: Acesso direto ao schema usando o colId como chave. Mais rápido e correto.
        const colSchema = currentSchema[colId];
        let value;

        if (colSchema) {
            if (colSchema.type === 'ChoiceList' && el.tagName === 'SELECT' && el.multiple) {
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
        } else {
            value = el.value;
        }
        changes[colId] = value;
    });

    await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
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

    // MUDANÇA: Pega o schema como objeto e o registro.
    currentSchema = await tableLens.getTableSchema(currentTableId, { mode: 'clean' });
    const record = await tableLens.fetchRecordById(currentTableId, currentRecordId);

    if (!record) {
        console.error(`Record ${currentRecordId} not found.`);
        closeDrawer();
        return;
    }
    const ruleIdToColIdMap = new Map();
    // MUDANÇA: Itera sobre os valores do objeto schema.
    Object.values(currentSchema).forEach(col => {
        if (col.colId?.startsWith('gristHelper_')) {
            ruleIdToColIdMap.set(col.id, col.colId);
        }
    });

    // MUDANÇA: Converte o objeto schema em um array e filtra.
    const columnsToRender = Object.values(currentSchema).filter(col => !col.colId.startsWith('gristHelper_'));
    const tabs = { "Main": columnsToRender };

    // MUDANÇA: Esta é a linha que estava causando o erro.
    // A variável `cols` já é um array (resultado do .filter acima), então o forEach aqui está correto.
    // O erro estava em como `cols` era gerado.
    Object.entries(tabs).forEach(([tabName, cols], index) => {
        const panelEl = document.createElement('div');
        panelEl.className = 'drawer-tab-content is-active';
        panelsContainer.appendChild(panelEl);

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
                container: valueContainer,
                labelElement: label,
                colSchema,
                record,
                tableLens,
                ruleIdToColIdMap,
                isEditing: isEditing
            });
        });
    });
}

export async function openDrawer(tableId, recordId, options = {}) {
    _initializeDrawerDOM();
    currentTableId = tableId;
    currentRecordId = recordId;
    isEditing = options.mode === 'edit' || false;
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