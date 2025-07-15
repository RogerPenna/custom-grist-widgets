// custom-grist-widgets/TesteDebug/debug-widget-main.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', function () {
    // 1. Get references to all the HTML elements
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableEl = document.getElementById('schemaTable');
    const schemaTableHeadEl = schemaTableEl.querySelector('thead tr');
    const schemaTableBodyEl = schemaTableEl.querySelector('tbody');
    // NOVO: Referência para o contêiner dos controles de campo
    const fieldControlsContainerEl = document.getElementById('fieldControlsContainer');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableEl = document.getElementById('recordsTable');
    const recordsTableHeadEl = recordsTableEl.querySelector('thead tr');
    const recordsTableBodyEl = recordsTableEl.querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');
    const tableSelectorEl = document.getElementById('tableSelector');

    // 2. Initialize state variables
    const tableLens = new GristTableLens(grist);
    let currentTableId; 
    let isRendering = false;
    let debounceTimer;

    // NOVO: Variáveis de estado para controlar os campos travados/ocultos.
    let fieldsToLock = [];
    let fieldsToHide = [];

    // 3. Define helper functions
    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) {
        // ... (função applyGristCellStyles permanece inalterada) ...
    }

    // NOVO: Função para renderizar os controles de travamento/visibilidade
    function renderFieldControls(schemaAsArray) {
        fieldControlsContainerEl.innerHTML = ''; // Limpa controles antigos

        const title = document.createElement('h3');
        title.textContent = 'Controles do Drawer (Travar/Ocultar Campos)';
        title.style.marginTop = '20px';
        fieldControlsContainerEl.appendChild(title);

        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
        gridContainer.style.gap = '10px';
        
        // Filtra colunas de helper para não mostrar controles para elas
        const visibleCols = schemaAsArray.filter(c => c && c.colId && !c.colId.startsWith('gristHelper_'));

        visibleCols.forEach(col => {
            const controlDiv = document.createElement('div');
            controlDiv.style.border = '1px solid #ccc';
            controlDiv.style.padding = '8px';
            controlDiv.style.borderRadius = '4px';

            const colLabel = document.createElement('strong');
            colLabel.textContent = col.label || col.colId;
            controlDiv.appendChild(colLabel);

            // Checkbox para Ocultar (isHidden)
            const hideLabel = document.createElement('label');
            hideLabel.style.display = 'block';
            hideLabel.style.marginTop = '5px';
            const hideCheckbox = document.createElement('input');
            hideCheckbox.type = 'checkbox';
            hideCheckbox.checked = fieldsToHide.includes(col.colId);
            hideCheckbox.onchange = (e) => {
                if (e.target.checked) {
                    fieldsToHide.push(col.colId);
                } else {
                    fieldsToHide = fieldsToHide.filter(id => id !== col.colId);
                }
                console.log('Campos a Ocultar:', fieldsToHide);
            };
            hideLabel.appendChild(hideCheckbox);
            hideLabel.appendChild(document.createTextNode(' Ocultar no Drawer'));
            controlDiv.appendChild(hideLabel);

            // Checkbox para Travar (isLocked)
            const lockLabel = document.createElement('label');
            lockLabel.style.display = 'block';
            const lockCheckbox = document.createElement('input');
            lockCheckbox.type = 'checkbox';
            lockCheckbox.checked = fieldsToLock.includes(col.colId);
            lockCheckbox.onchange = (e) => {
                if (e.target.checked) {
                    fieldsToLock.push(col.colId);
                } else {
                    fieldsToLock = fieldsToLock.filter(id => id !== col.colId);
                }
                console.log('Campos a Travar:', fieldsToLock);
            };
            lockLabel.appendChild(lockCheckbox);
            lockLabel.appendChild(document.createTextNode(' Travar no Drawer'));
            controlDiv.appendChild(lockLabel);

            gridContainer.appendChild(controlDiv);
        });

        fieldControlsContainerEl.appendChild(gridContainer);
    }


    // 4. The main function to draw everything on the screen
    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        
        // NOVO: Reseta os controles se a tabela for trocada.
        if (currentTableId !== tableId) {
            fieldsToLock = [];
            fieldsToHide = [];
        }

        currentTableId = tableId;
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);
            const schemaAsArray = Object.values(schema); 
            const ruleIdToColIdMap = new Map();
            schemaAsArray.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            schemaTableHeadEl.innerHTML = '';
            schemaTableBodyEl.innerHTML = '';
            recordsTableHeadEl.innerHTML = '';
            recordsTableBodyEl.innerHTML = '';

            columnCountEl.textContent = schemaAsArray.length;
            if (schemaAsArray.length > 0) {
                // ... (lógica de renderização da tabela de schema inalterada) ...
            }
            
            // NOVO: Chama a função para renderizar os controles
            renderFieldControls(schemaAsArray);

            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort();
                recordHeaderKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    recordsTableHeadEl.appendChild(th);
                });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.style.cursor = 'pointer';
                    
                    // MODIFICADO: Passa as opções de travamento/ocultação para o openDrawer.
                    row.onclick = () => openDrawer(tableId, record.id, {
                        lockedFields: fieldsToLock,
                        hiddenFields: fieldsToHide
                    });

                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const colSchema = schema[key];
                        const cellValue = record[key];
                        cell.textContent = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue);
                        if (colSchema) {
                            applyGristCellStyles(cell, colSchema, record, ruleIdToColIdMap);
                        }
                    }
                }
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="1">Nenhum registro.</td></tr>`;
            }
        } catch (error) {
            console.error(`Erro em initializeDebugWidget para tabela ${tableId}:`, error);
            errorMessageEl.textContent = `ERRO: ${error.message}. Veja o console.`;
        } finally {
            loadingMessageEl.style.display = 'none';
            isRendering = false;
        }
    }
    
    // 5. Setup functions that run once on page load
    async function populateTableSelectorAndRenderInitial() {
        // ... (função populateTableSelectorAndRenderInitial permanece inalterada) ...
    }
    
    // 6. Set up all event listeners
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => {
        // ... (listener grist.onRecords permanece inalterado) ...
    });
    subscribe('data-changed', (event) => {
        console.log("Debug Widget ouviu o evento 'data-changed':", event.detail);
        if (event.detail.tableId === currentTableId || event.detail.referencedTableId === currentTableId) {
            console.log("A mudança afeta a tabela atual. Atualizando a visualização...");
            initializeDebugWidget(currentTableId);
        }
    });

    // 7. Start the application
    populateTableSelectorAndRenderInitial();
});