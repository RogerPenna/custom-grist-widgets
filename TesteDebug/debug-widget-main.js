// custom-grist-widgets/TesteDebug/debug-widget-main.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
// Import the event bus subscriber. This is essential for auto-refreshing.
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
    let currentTableId; // Keep track of the currently displayed table
    let isRendering = false;
    let debounceTimer;

    // 3. Define helper functions (these are only used by this widget's main table view)
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
        currentTableId = tableId; // Set the current table ID
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            // Fetch all necessary data
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);
            const ruleIdToColIdMap = new Map();
            schema.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content from tables
            schemaTableHeadEl.innerHTML = '';
            schemaTableBodyEl.innerHTML = '';
            recordsTableHeadEl.innerHTML = '';
            recordsTableBodyEl.innerHTML = '';

            // Render Schema Table
            columnCountEl.textContent = schema.length;
            if (schema.length > 0) {
                const allKeys = new Set();
                schema.forEach(col => Object.keys(col).forEach(key => allKeys.add(key)));
                const sortedKeys = Array.from(allKeys).sort();
                sortedKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    schemaTableHeadEl.appendChild(th);
                });
                schema.forEach(col => {
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
                    
                    // The row's only job is to open the drawer
                    row.onclick = () => openDrawer(tableId, record.id);

                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const colSchema = schema.find(c => c.colId === key);
                        const cellValue = record[key];
                        
                        // Simple text rendering for the main debug table
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
    
    // Listen for Grist's onRecords to sync the dropdown if the user changes tables
    grist.onRecords((records, tableId) => {
        if (!tableId || isRendering || tableSelectorEl.value === tableId) return;
        tableSelectorEl.value = tableId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150);
    });
    
    // ==========================================================
    // ===== THE CRITICAL FIX: SUBSCRIBE TO THE EVENT BUS =======
    // ==========================================================
    // This makes the widget "reactive" to changes made in other components.
    subscribe('data-changed', (event) => {
        console.log("Debug Widget ouviu o evento 'data-changed':", event.detail);
        // Check if the change affected the table we are currently viewing
        if (event.detail.tableId === currentTableId || event.detail.referencedTableId === currentTableId) {
            console.log("A mudança afeta a tabela atual. Atualizando a visualização...");
            // If so, re-render everything to show the up-to-date data.
            initializeDebugWidget(currentTableId);
        }
    });

    // 7. Start the application
    populateTableSelectorAndRenderInitial();
});