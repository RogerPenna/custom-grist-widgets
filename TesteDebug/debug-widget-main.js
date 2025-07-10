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

    // 3. Define helper functions
    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) {
        cellElement.style.color = ''; cellElement.style.backgroundColor = ''; cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = ''; cellElement.style.textAlign = '';
        if(rawColumnSchema.widgetOptions) { try { const wopts = JSON.parse(rawColumnSchema.widgetOptions); if (wopts.alignment) { cellElement.style.textAlign = wopts.alignment; } } catch(e) {} }
        if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') {
            const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || [];
            const ruleIdList = rawColumnSchema.rules.slice(1);
            for (let i = 0; i < ruleIdList.length; i++) {
                const ruleNumId = ruleIdList[i];
                const helperColId = ruleIdToColIdMap.get(ruleNumId);
                if (helperColId && record[helperColId] === true) {
                    const style = ruleOptions[i];
                    if (style) {
                         if (style.textColor) cellElement.style.color = style.textColor;
                         if (style.fillColor) cellElement.style.backgroundColor = style.fillColor;
                         if (style.fontBold) cellElement.style.fontWeight = 'bold';
                         if (style.fontItalic) cellElement.style.fontStyle = 'italic';
                    }
                    return;
                }
            }
        }
    }

    // 4. The main function to draw everything on the screen
    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        currentTableId = tableId;
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            // Fetch all necessary data
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);
            
            // MUDANÇA: Iterar sobre os valores do objeto schema
            const schemaAsArray = Object.values(schema); 
            const ruleIdToColIdMap = new Map();
            schemaAsArray.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content from tables
            schemaTableHeadEl.innerHTML = '';
            schemaTableBodyEl.innerHTML = '';
            recordsTableHeadEl.innerHTML = '';
            recordsTableBodyEl.innerHTML = '';

            // Render Schema Table
            // MUDANÇA: Usar .length do array gerado
            columnCountEl.textContent = schemaAsArray.length;
            if (schemaAsArray.length > 0) {
                const allKeys = new Set();
                // MUDANÇA: Iterar sobre o array gerado
                schemaAsArray.forEach(col => Object.keys(col).forEach(key => allKeys.add(key)));
                const sortedKeys = Array.from(allKeys).sort();
                sortedKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    schemaTableHeadEl.appendChild(th);
                });
                // MUDANÇA: Iterar sobre o array gerado
                schemaAsArray.forEach(col => {
                    const row = schemaTableBodyEl.insertRow();
                    sortedKeys.forEach(key => {
                        const cell = row.insertCell();
                        const value = col[key];
                        if (value === null || value === undefined) {
                            cell.textContent = '';
                        } else if (typeof value === 'object') {
                            cell.innerHTML = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
                        } else {
                            cell.textContent = String(value);
                        }
                    });
                });
            }

            // Render Records Table
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
                    
                    row.onclick = () => openDrawer(tableId, record.id);

                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        // MUDANÇA: Acessar o schema diretamente pela chave (colId)
                        const colSchema = schema[key]; // Mais rápido e direto que .find()
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
        try {
            const allTables = await tableLens.listAllTables();
            const selectedTableId = await grist.selectedTable.getTableId() || (allTables.length > 0 ? allTables[0].id : null);
            tableSelectorEl.innerHTML = '';
            allTables.forEach(table => {
                const option = document.createElement('option');
                option.value = table.id;
                option.textContent = table.name;
                if (table.id === selectedTableId) { option.selected = true; }
                tableSelectorEl.appendChild(option);
            });
            await initializeDebugWidget(selectedTableId);
        } catch (error) {
            console.error("Erro ao inicializar:", error);
            errorMessageEl.textContent = `ERRO: ${error.message}.`;
        }
    }
    
    // 6. Set up all event listeners
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => {
        if (!tableId || isRendering || tableSelectorEl.value === tableId) return;
        tableSelectorEl.value = tableId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150);
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