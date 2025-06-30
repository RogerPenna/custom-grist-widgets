// custom-grist-widgets/TesteDebug/debug-widget-main.js

// =================================================================
// ========= CRITICAL FIX: Add imports at the very top =============
// =================================================================
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
// We don't need to import renderField here, as only the drawer uses it directly.

document.addEventListener('DOMContentLoaded', function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    //... (other element selectors are fine)
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

    // The logic inside these functions is fine.
    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) { cellElement.style.color = ''; cellElement.style.backgroundColor = ''; cellElement.style.fontWeight = ''; cellElement.style.fontStyle = ''; cellElement.style.textAlign = ''; if(rawColumnSchema.widgetOptions) { try { const wopts = JSON.parse(rawColumnSchema.widgetOptions); if (wopts.alignment) { cellElement.style.textAlign = wopts.alignment; } } catch(e) {} } if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') { const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || []; const ruleIdList = rawColumnSchema.rules.slice(1); for (let i = 0; i < ruleIdList.length; i++) { const ruleNumId = ruleIdList[i]; const helperColId = ruleIdToColIdMap.get(ruleNumId); if (helperColId && record[helperColId] === true) { const style = ruleOptions[i]; if (style) { if (style.textColor) cellElement.style.color = style.textColor; if (style.fillColor) cellElement.style.backgroundColor = style.fillColor; if (style.fontBold) cellElement.style.fontWeight = 'bold'; if (style.fontItalic) cellElement.style.fontStyle = 'italic'; } return; } } } }
    async function renderRelatedDataTable(relatedRecords, parentCell, tableLens, ruleIdToColIdMap) { if (!relatedRecords || relatedRecords.length === 0) return; const subTable = document.createElement('table'); const subThead = subTable.createTHead(); const subThRow = subThead.insertRow(); const relatedTableId = relatedRecords[0].gristHelper_tableId; const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'}); relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')).forEach(col => { const th = document.createElement('th'); th.textContent = col.label || col.colId; subThRow.appendChild(th); }); const subTbody = subTable.createTBody(); for (const relRec of relatedRecords) { const subTr = subTbody.insertRow(); for (const colSchema of relatedSchema.filter(c => !c.colId.startsWith('gristHelper_'))) { const td = subTr.insertCell(); const cellValue = relRec[colSchema.colId]; td.textContent = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue); applyGristCellStyles(td, colSchema, relRec, ruleIdToColIdMap); } } parentCell.appendChild(subTable); }
    
    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        errorMessageEl.textContent = ""; loadingMessageEl.style.display = 'block'; tableInfoContainerEl.style.display = 'none';

        try {
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            // =================================================================
            // ========== CRITICAL FIX: Restore the missing line =============
            // =================================================================
            const records = await tableLens.fetchTableRecords(tableId);

            const ruleIdToColIdMap = new Map();
            schema.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content
            while (schemaTableHeadEl.firstChild) schemaTableHeadEl.removeChild(schemaTableHeadEl.firstChild);
            while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
            while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
            while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);

            // Render Schema - this logic is correct.
            columnCountEl.textContent = schema.length;
            if (schema.length > 0) { const allKeys = new Set(); schema.forEach(col => Object.keys(col).forEach(key => allKeys.add(key))); const sortedKeys = Array.from(allKeys).sort(); sortedKeys.forEach(key => { const th = document.createElement('th'); th.textContent = key; schemaTableHeadEl.appendChild(th); }); schema.forEach(col => { const row = schemaTableBodyEl.insertRow(); sortedKeys.forEach(key => { const cell = row.insertCell(); const value = col[key]; if (value === null || value === undefined) { cell.textContent = ''; } else if (typeof value === 'object') { cell.innerHTML = `<pre>${JSON.stringify(value, null, 2)}</pre>`; } else { cell.textContent = String(value); } }); }); }

            // Render Records - this logic is correct, but needs to use the imported `openDrawer`.
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort();
                recordHeaderKeys.forEach(key => { const th = document.createElement('th'); th.textContent = key; recordsTableHeadEl.appendChild(th); });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    // =================================================================
                    // ========== CRITICAL FIX: Use imported openDrawer() ============
                    // =================================================================
                    row.onclick = () => openDrawer(tableId, record.id);

                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const cellValue = record[key];
                        const colSchema = schema.find(c => c.colId === key);
                        let contentContainer = document.createElement('div');
                        if (colSchema && colSchema.type.startsWith('RefList:')) { let displayText = `[RefList]`; if (Array.isArray(cellValue) && cellValue[0] === 'L') { displayText += ` (${cellValue.length - 1} items)`; } contentContainer.textContent = displayText; const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId); if (relatedRecords.length > 0) { await renderRelatedDataTable(relatedRecords, contentContainer, tableLens, ruleIdToColIdMap); } } else { let displayText = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue); contentContainer.textContent = displayText; }
                        cell.appendChild(contentContainer);
                        if (colSchema) { applyGristCellStyles(cell, colSchema, record, ruleIdToColIdMap); }
                    }
                }
            } else { recordsTableBodyEl.innerHTML = `<tr><td colspan="1">Nenhum registro.</td></tr>`; }
        } catch (error) {
            console.error(`Erro em initializeDebugWidget para tabela ${tableId}:`, error);
            errorMessageEl.textContent = `ERRO: ${error.message}. Veja o console.`;
        } finally {
            loadingMessageEl.style.display = 'none';
            isRendering = false;
        }
    }
    
    // This setup logic is correct.
    async function populateTableSelectorAndRenderInitial() { try { tableLens = new GristTableLens(grist); const allTables = await tableLens.listAllTables(); const selectedTableId = await grist.selectedTable.getTableId() || (allTables.length > 0 ? allTables[0].id : null); tableSelectorEl.innerHTML = ''; allTables.forEach(table => { const option = document.createElement('option'); option.value = table.id; option.textContent = table.name; if (table.id === selectedTableId) { option.selected = true; } tableSelectorEl.appendChild(option); }); await initializeDebugWidget(selectedTableId); } catch (error) { console.error("Erro ao inicializar:", error); errorMessageEl.textContent = `ERRO: ${error.message}.`; } }
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => { if (!tableId || isRendering || tableSelectorEl.value === tableId) return; tableSelectorEl.value = tableId; clearTimeout(debounceTimer); debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150); });
    populateTableSelectorAndRenderInitial();
});