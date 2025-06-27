// custom-grist-widgets/TesteDebug/debug-widget-main.js
document.addEventListener('DOMContentLoaded', function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableEl = document.getElementById('schemaTable');
    const schemaTableBodyEl = schemaTableEl.querySelector('tbody');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableHeadEl = document.getElementById('recordsTable').querySelector('thead');
    const recordsTableBodyEl = document.getElementById('recordsTable').querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');
    const tableSelectorEl = document.getElementById('tableSelector');

    let tableLens;
    let isRendering = false;
    let debounceTimer;

    function applyGristCellStyles(cellElement, columnSchema, cellValue, record) {
        cellElement.style.color = '';
        cellElement.style.backgroundColor = '';
        cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = '';
        cellElement.style.textAlign = '';

        let styleAppliedByRule = false;

        if (columnSchema.conditionalFormattingRules && columnSchema.conditionalFormattingRules.length > 0) {
            for (const rule of columnSchema.conditionalFormattingRules) {
                if (record && record[rule.helperColumnId] === true) {
                    if (rule.style) {
                        if (rule.style.textColor) cellElement.style.color = rule.style.textColor;
                        if (rule.style.fillColor) cellElement.style.backgroundColor = rule.style.fillColor;
                        if (rule.style.fontBold !== undefined) cellElement.style.fontWeight = rule.style.fontBold ? 'bold' : 'normal';
                        if (rule.style.fontItalic !== undefined) cellElement.style.fontStyle = rule.style.fontItalic ? 'italic' : 'normal';
                        styleAppliedByRule = true;
                    }
                }
            }
        }

        if (columnSchema.widgetOptions) {
            const wo = columnSchema.widgetOptions;
            if (wo.alignment) cellElement.style.textAlign = wo.alignment;
            if (!styleAppliedByRule) {
                if (wo.textColor) cellElement.style.color = wo.textColor;
                if (wo.fillColor) cellElement.style.backgroundColor = wo.fillColor;
                if (wo.fontBold) cellElement.style.fontWeight = 'bold';
                if (wo.fontItalic) cellElement.style.fontStyle = 'italic';
            }
        }
        
        if ((columnSchema.type === 'Choice' || columnSchema.type === 'ChoiceList') && 
            columnSchema.widgetOptions?.choiceOptions && 
            cellValue != null && 
            columnSchema.widgetOptions.choiceOptions[String(cellValue)]) {
            const choiceStyle = columnSchema.widgetOptions.choiceOptions[String(cellValue)];
            if (choiceStyle.textColor) cellElement.style.color = choiceStyle.textColor;
            if (choiceStyle.fillColor) cellElement.style.backgroundColor = choiceStyle.fillColor;
            if (typeof choiceStyle.fontBold !== 'undefined') cellElement.style.fontWeight = choiceStyle.fontBold ? 'bold' : 'normal';
            if (typeof choiceStyle.fontItalic !== 'undefined') cellElement.style.fontStyle = choiceStyle.fontItalic ? 'italic' : 'normal';
        }
    }

    async function initializeDebugWidget(tableId) {
        if (!tableId) {
            errorMessageEl.textContent = "Nenhuma tabela foi selecionada para exibir.";
            loadingMessageEl.style.display = 'none';
            tableInfoContainerEl.style.display = 'none';
            return;
        }
        if (isRendering) { console.warn(`Renderização já em progresso, pulando.`); return; }
        isRendering = true;

        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            const schema = await tableLens.getTableSchema(tableId);
            const records = await tableLens.fetchTableRecords(tableId);

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Clear previous content
            while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
            while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
            while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);

            // Render Schema
            columnCountEl.textContent = schema.length;
            const schemaHeaderRow = schemaTableEl.querySelector('thead tr');
            while(schemaHeaderRow.cells.length > 8) schemaHeaderRow.deleteCell(-1);

            schema.forEach(col => {
                const row = schemaTableBodyEl.insertRow();
                row.insertCell().textContent = col.id;
                row.insertCell().textContent = col.label;
                row.insertCell().textContent = col.type;
                row.insertCell().textContent = col.isFormula ? 'Sim' : 'Não';
                row.insertCell().innerHTML = `<pre>${JSON.stringify(col.choices, null, 2)}</pre>`;
                row.insertCell().innerHTML = `<pre>${JSON.stringify(col.widgetOptions, null, 2)}</pre>`;
                row.insertCell().textContent = col.referencedTableId || '-';
                row.insertCell().textContent = col.displayColId || '-';
                const rulesCell = row.insertCell();
                if (col.conditionalFormattingRules && col.conditionalFormattingRules.length > 0) {
                    let rulesHtml = '<ul style="margin:0; padding-left:15px;">';
                    col.conditionalFormattingRules.forEach(rule => {
                        rulesHtml += `<li style="margin-bottom:3px;"><strong>Helper:</strong> ${rule.helperColumnId}<br/><span style="font-size:0.9em;">Cond: <pre style="display:inline;font-size:inherit;">${rule.conditionFormula}</pre><br/>Estilo: <pre style="display:inline;font-size:inherit;">${JSON.stringify(rule.style, null, 1)}</pre></span></li>`;
                    });
                    rulesCell.innerHTML = rulesHtml + '</ul>';
                } else { rulesCell.textContent = '-'; }
            });

            if (schemaHeaderRow && schemaHeaderRow.cells.length === 8) {
                const thRules = document.createElement('th');
                thRules.textContent = "Regras Cond. (Definição)";
                schemaHeaderRow.appendChild(thRules);
            }

            // Render Records
            recordCountEl.textContent = records.length;
            if (records.length > 0 && schema.length > 0) {
                const headerRow = recordsTableHeadEl.insertRow();
                schema.forEach(col => {
                     const th = document.createElement('th'); th.textContent = col.label; headerRow.appendChild(th);
                });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    for (const colSchema of schema) {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        cell.textContent = cellValue === null || cellValue === undefined ? '(vazio)' : String(cellValue);
                        if (Array.isArray(cellValue)) cell.textContent = `[${cellValue.join(', ')}]`;
                        applyGristCellStyles(cell, colSchema, cellValue, record);
                    }
                }
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="${schema.length || 1}">Nenhum registro.</td></tr>`;
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
            const selectedTableId = await grist.selectedTable.getTableId();
            
            tableSelectorEl.innerHTML = ''; // Clear previous options
            allTables.forEach(table => {
                const option = document.createElement('option');
                option.value = table.id;
                option.textContent = table.name;
                if (table.id === selectedTableId) {
                    option.selected = true;
                }
                tableSelectorEl.appendChild(option);
            });
            
            // Initial render
            await initializeDebugWidget(selectedTableId);
            
        } catch (error) {
            console.error("Erro ao inicializar o seletor de tabelas:", error);
            errorMessageEl.textContent = `ERRO: ${error.message}.`;
        }
    }
    
    tableSelectorEl.addEventListener('change', (event) => {
        const newTableId = event.target.value;
        initializeDebugWidget(newTableId);
    });

    grist.ready({ requiredAccess: 'full' });
    
    // This event listener syncs the widget with the main Grist page
    grist.onRecords(async (records, tableId) => {
        if (!tableId || isRendering) return;

        // If the table selected in Grist is different from the one in our dropdown, update our view.
        if (tableSelectorEl.value !== tableId) {
            tableSelectorEl.value = tableId;
            // Debounce the re-render to avoid flashing on quick selections
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                initializeDebugWidget(tableId);
            }, 150);
        }
    });

    // Start the whole process once Grist is ready.
    populateTableSelectorAndRenderInitial();
});