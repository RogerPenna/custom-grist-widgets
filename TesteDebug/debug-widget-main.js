// custom-grist-widgets/TesteDebug/debug-widget-main.js
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../libraries/grist-data-writer.js';
import { openModal } from '../libraries/grist-modal-component/modal-component.js';

document.addEventListener('DOMContentLoaded', function () {
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
    const addNewBtn = document.getElementById('add-new-record-btn');

    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist);
    let currentTableId; // Keep track of the currently displayed table
    let isRendering = false;
    let debounceTimer;

    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) { cellElement.style.color = ''; cellElement.style.backgroundColor = ''; cellElement.style.fontWeight = ''; cellElement.style.fontStyle = ''; cellElement.style.textAlign = ''; if(rawColumnSchema.widgetOptions) { try { const wopts = JSON.parse(rawColumnSchema.widgetOptions); if (wopts.alignment) { cellElement.style.textAlign = wopts.alignment; } } catch(e) {} } if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') { const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || []; const ruleIdList = rawColumnSchema.rules.slice(1); for (let i = 0; i < ruleIdList.length; i++) { const ruleNumId = ruleIdList[i]; const helperColId = ruleIdToColIdMap.get(ruleNumId); if (helperColId && record[helperColId] === true) { const style = ruleOptions[i]; if (style) { if (style.textColor) cellElement.style.color = style.textColor; if (style.fillColor) cellElement.style.backgroundColor = style.fillColor; if (style.fontBold) cellElement.style.fontWeight = 'bold'; if (style.fontItalic) cellElement.style.fontStyle = 'italic'; } return; } } } }
    async function renderRelatedDataTable(relatedRecords, parentCell, tableLens, ruleIdToColIdMap) { if (!relatedRecords || relatedRecords.length === 0) return; const subTable = document.createElement('table'); const subThead = subTable.createTHead(); const subThRow = subThead.insertRow(); const relatedTableId = relatedRecords[0].gristHelper_tableId; const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'}); const columnsToDisplay = relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')); columnsToDisplay.forEach(col => { const th = document.createElement('th'); th.textContent = col.label || col.colId; subThRow.appendChild(th); }); const subTbody = subTable.createTBody(); for (const relRec of relatedRecords) { const subTr = subTbody.insertRow(); for (const colSchema of columnsToDisplay) { const td = subTr.insertCell(); td.textContent = (relRec[colSchema.colId] === null || relRec[colSchema.colId] === undefined) ? '(vazio)' : String(relRec[colSchema.colId]); applyGristCellStyles(td, colSchema, relRec, ruleIdToColIdMap); } } parentCell.appendChild(subTable); }
    
    async function handleEditRecord(tableId, recordId) {
        const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
        const record = await tableLens.fetchRecordById(tableId, recordId);
        openModal({
            title: `Editando Registro ${recordId} em ${tableId}`,
            tableId, record, schema,
            onSave: async (changes) => {
                await dataWriter.updateRecord(tableId, recordId, changes);
                initializeDebugWidget(tableId); // Refresh view on save
            }
        });
    }

    async function handleAddRecord(tableId) {
        const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
        openModal({
            title: `Adicionando Novo Registro em ${tableId}`,
            tableId, record: {}, schema, // Pass an empty record for "add" mode
            onSave: async (newRecord) => {
                await dataWriter.addRecord(tableId, newRecord);
                initializeDebugWidget(tableId); // Refresh view on save
            }
        });
    }

    async function handleDeleteRecord(tableId, recordId) {
        if (confirm(`Tem certeza que deseja deletar o registro ${recordId}?`)) {
            await dataWriter.deleteRecords(tableId, [recordId]);
            initializeDebugWidget(tableId); // Refresh view on delete
        }
    }

    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        currentTableId = tableId;
        errorMessageEl.textContent = ""; loadingMessageEl.style.display = 'block'; tableInfoContainerEl.style.display = 'none';

        try {
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);
            const ruleIdToColIdMap = new Map();
            schema.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content
            schemaTableHeadEl.innerHTML = ''; schemaTableBodyEl.innerHTML = '';
            recordsTableHeadEl.innerHTML = ''; recordsTableBodyEl.innerHTML = '';

            // Render Schema Table
            columnCountEl.textContent = schema.length;
            if (schema.length > 0) { const allKeys = new Set(); schema.forEach(col => Object.keys(col).forEach(key => allKeys.add(key))); const sortedKeys = Array.from(allKeys).sort(); sortedKeys.forEach(key => { const th = document.createElement('th'); th.textContent = key; schemaTableHeadEl.appendChild(th); }); schema.forEach(col => { const row = schemaTableBodyEl.insertRow(); sortedKeys.forEach(key => { const cell = row.insertCell(); const value = col[key]; if (value === null || value === undefined) { cell.textContent = ''; } else if (typeof value === 'object') { cell.innerHTML = `<pre>${JSON.stringify(value, null, 2)}</pre>`; } else { cell.textContent = String(value); } }); }); }

            // Render Records Table
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort();
                recordHeaderKeys.forEach(key => { const th = document.createElement('th'); th.textContent = key; recordsTableHeadEl.appendChild(th); });
                // Add the Actions header
                const thActions = document.createElement('th');
                thActions.textContent = 'Ações';
                recordsTableHeadEl.appendChild(thActions);

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const colSchema = schema.find(c => c.colId === key);
                        let contentContainer = document.createElement('div');
                        if (colSchema && colSchema.type.startsWith('RefList:')) {
                            const cellValue = record[key];
                            let displayText = `[RefList]`;
                            if (Array.isArray(cellValue) && cellValue[0] === 'L') { displayText += ` (${cellValue.length - 1} items)`; }
                            contentContainer.textContent = displayText;
                            const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
                            if (relatedRecords.length > 0) { await renderRelatedDataTable(relatedRecords, contentContainer, tableLens, ruleIdToColIdMap); }
                        } else {
                            contentContainer.textContent = (record[key] === null || record[key] === undefined) ? '(vazio)' : String(record[key]);
                        }
                        cell.appendChild(contentContainer);
                        if (colSchema) { applyGristCellStyles(cell, colSchema, record, ruleIdToColIdMap); }
                    }
                    // Add the actions cell with buttons
                    const actionsCell = row.insertCell();
                    actionsCell.className = 'actions-cell';
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '✏️';
                    editBtn.title = 'Editar Registro';
                    editBtn.onclick = (e) => { e.stopPropagation(); handleEditRecord(tableId, record.id); };
                    actionsCell.appendChild(editBtn);
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.title = 'Deletar Registro';
                    deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeleteRecord(tableId, record.id); };
                    actionsCell.appendChild(deleteBtn);
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
    addNewBtn.addEventListener('click', () => { if (currentTableId) handleAddRecord(currentTableId); });

    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => { if (!tableId || isRendering || tableSelectorEl.value === tableId) return; tableSelectorEl.value = tableId; clearTimeout(debounceTimer); debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150); });
    
    populateTableSelectorAndRenderInitial();
});