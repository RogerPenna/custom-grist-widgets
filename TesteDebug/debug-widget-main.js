// custom-grist-widgets/TesteDebug/debug-widget-main.js
document.addEventListener('DOMContentLoaded', function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableEl = document.getElementById('schemaTable');
    const schemaTableHeadEl = schemaTableEl.querySelector('thead tr');
    const schemaTableBodyEl = schemaTableEl.querySelector('tbody');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableHeadEl = document.getElementById('recordsTable').querySelector('thead');
    const recordsTableBodyEl = document.getElementById('recordsTable').querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');
    const tableSelectorEl = document.getElementById('tableSelector');

    let tableLens;
    let isRendering = false;
    let debounceTimer;

    // This function now expects the RAW schema for applying styles.
    // It finds helperColumnId from the 'rules' property of the main column.
    function applyGristCellStyles(cellElement, rawColumnSchema, record) {
        cellElement.style.color = '';
        cellElement.style.backgroundColor = '';
        cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = '';

        if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') {
            const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || [];
            
            for (let i = 0; i < rawColumnSchema.rules.slice(1).length; i++) {
                const ruleNumId = rawColumnSchema.rules[i + 1];
                // This is a bit inefficient but required for raw mode. Find the helper column in the full record.
                let helperColId = null;
                for (const key in record) {
                    if (key.startsWith('gristHelper_ConditionalRule') && record[key] === true) {
                        // This is an assumption that the order is correct. A more robust way would be to map ruleNumId to colId beforehand.
                        // Let's assume for now the presence of a 'true' value is enough.
                        const style = ruleOptions[i];
                        if (style) {
                             if (style.textColor) cellElement.style.color = style.textColor;
                             if (style.fillColor) cellElement.style.backgroundColor = style.fillColor;
                             if (style.fontBold) cellElement.style.fontWeight = 'bold';
                             if (style.fontItalic) cellElement.style.fontStyle = 'italic';
                             return; // Apply first matching rule
                        }
                    }
                }
            }
        }
    }

    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            // =================================================================
            // ============ CRITICAL CHANGE: Requesting 'raw' mode ===========
            // =================================================================
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content
            while (schemaTableHeadEl.firstChild) schemaTableHeadEl.removeChild(schemaTableHeadEl.firstChild);
            while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
            while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
            while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);

            // RENDER SCHEMA (Now in RAW mode)
            columnCountEl.textContent = schema.length;
            if (schema.length > 0) {
                // Create a dynamic header from all possible keys in the raw metadata
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

            // RENDER RECORDS (including helper columns)
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]);
                recordHeaderKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    recordsTableHeadEl.appendChild(th);
                });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const cellValue = record[key];
                        cell.textContent = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue);
                        
                        // Find the raw schema for this column to apply styles
                        const colSchema = schema.find(c => c.colId === key);
                        if(colSchema){
                             applyGristCellStyles(cell, colSchema, record);
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
    
    async function populateTableSelectorAndRenderInitial() {
        try {
            tableLens = new GristTableLens(grist);
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
        } catch (error) { console.error("Erro ao inicializar:", error); errorMessageEl.textContent = `ERRO: ${error.message}.`; }
    }
    
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));

    grist.ready({ requiredAccess: 'full' });
    
    grist.onRecords((records, tableId) => {
        if (!tableId || isRendering || tableSelectorEl.value === tableId) return;
        tableSelectorEl.value = tableId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150);
    });

    populateTableSelectorAndRenderInitial();
});