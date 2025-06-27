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

    // =================================================================
    // =========== MAJOR FIX: Corrected applyGristCellStyles ===========
    // =================================================================
    // This function now correctly uses a pre-built map to find the right helper column.
    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) {
        // Reset styles first
        cellElement.style.color = '';
        cellElement.style.backgroundColor = '';
        cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = '';
        cellElement.style.textAlign = ''; // Also reset alignment

        // Set alignment from widgetOptions if present
        if(rawColumnSchema.widgetOptions) {
            try {
                const wopts = JSON.parse(rawColumnSchema.widgetOptions);
                if (wopts.alignment) {
                    cellElement.style.textAlign = wopts.alignment;
                }
            } catch(e) {/* ignore invalid JSON */}
        }


        // Check if the column has conditional formatting rules linked to it.
        if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') {
            
            // Safely parse widgetOptions and get the styles array.
            const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || [];
            
            // Get the list of numeric rule IDs for this column, skipping the 'L' marker.
            const ruleIdList = rawColumnSchema.rules.slice(1);
            
            // Loop through the rule IDs that belong to THIS column.
            for (let i = 0; i < ruleIdList.length; i++) {
                const ruleNumId = ruleIdList[i];
                
                // Use the map to find the string ID (e.g., 'gristHelper_ConditionalRule2') of the helper column.
                const helperColId = ruleIdToColIdMap.get(ruleNumId);
                
                // If we found the helper column's ID AND its value in the current record is true...
                if (helperColId && record[helperColId] === true) {
                    
                    // ...then get the style that corresponds to this rule's position in the list.
                    const style = ruleOptions[i];
                    
                    if (style) {
                         if (style.textColor) cellElement.style.color = style.textColor;
                         if (style.fillColor) cellElement.style.backgroundColor = style.fillColor;
                         if (style.fontBold) cellElement.style.fontWeight = 'bold';
                         if (style.fontItalic) cellElement.style.fontStyle = 'italic';
                    }
                    
                    // We found the first matching rule for this cell, so we can stop.
                    return;
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
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);

            // =================================================================
            // ========== NEW: Create the Rule ID to Column ID map ===========
            // =================================================================
            // This map is essential for linking a rule's numeric ID to its string colId.
            const ruleIdToColIdMap = new Map();
            schema.forEach(col => {
                if (col.colId && col.colId.startsWith('gristHelper_ConditionalRule')) {
                    ruleIdToColIdMap.set(col.id, col.colId);
                }
            });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content
            while (schemaTableHeadEl.firstChild) schemaTableHeadEl.removeChild(schemaTableHeadEl.firstChild);
            while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
            while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
            while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);

            // RENDER SCHEMA (Raw mode)
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

            // RENDER RECORDS (including helper columns)
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort(); // Sort headers for consistency
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
                        
                        // Find the raw schema for this column ('key')
                        const colSchema = schema.find(c => c.colId === key);
                        if(colSchema){
                             // Pass the map to the styling function
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