// custom-grist-widgets/TesteDebug/debug-widget-main.js
document.addEventListener('DOMContentLoaded', function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableBodyEl = document.getElementById('schemaTable').querySelector('tbody');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableHeadEl = document.getElementById('recordsTable').querySelector('thead');
    const recordsTableBodyEl = document.getElementById('recordsTable').querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');

    function applyGristCellStyles(cellElement, columnSchema, cellValue) {
        // ... (código da função applyGristCellStyles como na resposta anterior) ...
        if (!columnSchema || !columnSchema.widgetOptions) return;
         const wo = columnSchema.widgetOptions;
         if (wo.textColor) cellElement.style.color = wo.textColor;
         if (wo.fillColor) cellElement.style.backgroundColor = wo.fillColor;
         if (wo.fontBold) cellElement.style.fontWeight = 'bold';
         if (wo.fontItalic) cellElement.style.fontStyle = 'italic';
         if ((columnSchema.type === 'Choice' || columnSchema.type === 'ChoiceList') && wo.choiceOptions && cellValue && wo.choiceOptions[String(cellValue)]) {
             const choiceStyle = wo.choiceOptions[String(cellValue)];
             if (choiceStyle.textColor) cellElement.style.color = choiceStyle.textColor;
             if (choiceStyle.fillColor) cellElement.style.backgroundColor = choiceStyle.fillColor;
         }
    }

    async function initializeDebugWidget() {
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            if (typeof GristTableLens === 'undefined') {
                errorMessageEl.textContent = "ERRO: Biblioteca GristTableLens não carregada. Verifique o caminho do script no HTML.";
                loadingMessageEl.style.display = 'none';
                return;
            }
            const tableLens = new GristTableLens(grist); // Usa a GristTableLens global

            const currentTable = await tableLens.getCurrentTableInfo();

            if (!currentTable) {
                errorMessageEl.textContent = "Nenhuma tabela selecionada ou dados não puderam ser carregados.";
                loadingMessageEl.style.display = 'none';
                return;
            }

            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Popular Schema
            schemaTableBodyEl.innerHTML = "";
            columnCountEl.textContent = currentTable.schema.length;
            currentTable.schema.forEach(col => {
                const row = schemaTableBodyEl.insertRow();
                row.insertCell().textContent = col.id;
                row.insertCell().textContent = col.label;
                row.insertCell().textContent = col.type;
                row.insertCell().textContent = col.isFormula ? 'Sim' : 'Não';
                row.insertCell().innerHTML = `<pre>${JSON.stringify(col.choices, null, 2)}</pre>`;
                row.insertCell().innerHTML = `<pre>${JSON.stringify(col.widgetOptions, null, 2)}</pre>`;
                row.insertCell().textContent = col.referencedTableId || '-';
                row.insertCell().textContent = col.displayColId || '-';
            });

            // Popular Registros
            recordsTableHeadEl.innerHTML = "";
            recordsTableBodyEl.innerHTML = "";
            recordCountEl.textContent = currentTable.records.length;

            if (currentTable.records.length > 0 && currentTable.schema.length > 0) {
                const headerRow = recordsTableHeadEl.insertRow();
                currentTable.schema.forEach(col => {
                    const th = document.createElement('th');
                    th.textContent = col.label;
                    headerRow.appendChild(th);
                });

                currentTable.records.forEach(record => {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.dataset.recordId = record.id; // Armazena o ID do registro na linha
                    row.onclick = function() {
                        alert(`Clicou na linha ID: ${this.dataset.recordId}\n(Placeholder para abrir gaveta de detalhes)`);
                        // Futuramente: drawerComponent.openWithData(record);
                    };

                    currentTable.schema.forEach(colSchema => {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        
                        let displayValue = cellValue;
                        if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                            displayValue = `[Lista] ${cellValue.slice(1).join(', ')}`;
                        } else if (Array.isArray(cellValue) && cellValue[0] === 'R') {
                            displayValue = `[Ref] Tabela: ${cellValue[1]}, ID: ${cellValue[2]}`;
                        } else if (Array.isArray(cellValue) && cellValue[0] === 'r') {
                             displayValue = `[RefList] Tabela: ${cellValue[1]}, IDs: ${JSON.stringify(cellValue[2])}`;
                        } else if (cellValue === null || cellValue === undefined) {
                            displayValue = '(vazio)';
                            cell.style.fontStyle = 'italic';
                            cell.style.color = '#999';
                        }

                        cell.textContent = String(displayValue); // Garante que é string
                        applyGristCellStyles(cell, colSchema, record[colSchema.id]);

                        const detail = document.createElement('div');
                        detail.className = 'cell-detail';
                        detail.innerHTML = `(Raw: <pre style="display:inline; padding:1px 2px; font-size:0.9em;">${JSON.stringify(record[colSchema.id])}</pre> Tipo: ${colSchema.type})`;
                        cell.appendChild(detail);
                    });
                });
            } else if (currentTable.schema.length === 0) {
                recordsTableBodyEl.innerHTML = '<tr><td colspan="1">Nenhuma coluna definida para esta tabela.</td></tr>';
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="${currentTable.schema.length}">Nenhum registro encontrado.</td></tr>`;
            }
            loadingMessageEl.style.display = 'none';

        } catch (error) {
            console.error("Erro ao inicializar widget de debug:", error);
            errorMessageEl.textContent = `ERRO: ${error.message}. Veja o console.`;
            loadingMessageEl.style.display = 'none';
        }
    }

    grist.ready({ requiredAccess: 'full' });
    grist.onRecord(initializeDebugWidget); 
    // Chamar uma vez no início também, caso onRecord não seja disparado imediatamente
    // ou se o widget for carregado sem um registro selecionado inicialmente.
    initializeDebugWidget(); 
});