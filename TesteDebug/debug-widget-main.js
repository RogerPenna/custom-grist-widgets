// custom-grist-widgets/TesteDebug/debug-widget-main.js
document.addEventListener('DOMContentLoaded', function () {
    // ... (elementos do DOM e applyGristCellStyles como antes) ...
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

    // Função para renderizar uma sub-tabela de dados relacionados
    function renderRelatedDataTable(relatedRecords, relatedSchema, parentCell) {
        if (!relatedRecords || relatedRecords.length === 0) {
            parentCell.innerHTML += '<div class="cell-detail"><em>(Sem registros relacionados)</em></div>';
            return;
        }

        const subTable = document.createElement('table');
        subTable.style.marginTop = '5px';
        subTable.style.border = '1px dashed #999';
        subTable.style.fontSize = '0.9em';

        const subThead = subTable.createTHead();
        const subThRow = subThead.insertRow();
        // Usar o schema da tabela relacionada para os cabeçalhos
        const relatedColsToDisplay = relatedSchema.filter(col => !col.id.startsWith("gristHelper_")); // Não mostrar colunas helper

        relatedColsToDisplay.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.style.backgroundColor = "#f9f9f9";
            subThRow.appendChild(th);
        });

        const subTbody = subTable.createTBody();
        relatedRecords.forEach(relRec => {
            const subTr = subTbody.insertRow();
            relatedColsToDisplay.forEach(colSchema => {
                const td = subTr.insertCell();
                const cellValue = relRec[colSchema.id];
                // Simplificando a exibição do valor relacionado por agora
                td.textContent = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue);
                applyGristCellStyles(td, colSchema, cellValue); // Aplicar estilos também às células relacionadas
            });
        });
        parentCell.appendChild(subTable);
    }


    async function initializeDebugWidget() {
        // ... (início da função como antes) ...
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            if (typeof GristTableLens === 'undefined') {
                errorMessageEl.textContent = "ERRO: Biblioteca GristTableLens não carregada.";
                loadingMessageEl.style.display = 'none';
                return;
            }
            const tableLens = new GristTableLens(grist);
            const currentTable = await tableLens.getCurrentTableInfo();

            if (!currentTable) {
                errorMessageEl.textContent = "Nenhuma tabela selecionada ou dados não puderam ser carregados.";
                loadingMessageEl.style.display = 'none';
                return;
            }

            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

            // Popular Schema (como antes)
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

                for (const record of currentTable.records) { // Usando for...of para permitir await dentro do loop
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.dataset.recordId = record.id;
                    row.onclick = function() {
                        alert(`Clicou na linha ID: ${this.dataset.recordId}\n(Placeholder para abrir gaveta de detalhes)`);
                    };

                    for (const colSchema of currentTable.schema) {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        let displayValue = cellValue;

                        if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                            // Busca o registro referenciado para mostrar o displayCol (se houver)
                            // ou apenas o ID se não houver displayCol
                            const relatedRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue);
                            if (relatedRecord && colSchema.displayColId && relatedRecord[colSchema.displayColId] !== undefined) {
                                displayValue = `[Ref] ${relatedRecord[colSchema.displayColId]} (ID: ${cellValue})`;
                            } else {
                                displayValue = `[Ref] ID: ${cellValue} (Tabela: ${colSchema.referencedTableId})`;
                            }
                            // Poderia adicionar um link/botão para buscar e mostrar mais detalhes desta referência aqui
                        } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                            displayValue = `[RefList] (clique para ver)`; // Placeholder
                            const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.id);
                            if (relatedRecords.length > 0) {
                                const relatedSchema = await tableLens.getTableSchema(colSchema.referencedTableId); // Obter schema da tabela relacionada
                                renderRelatedDataTable(relatedRecords, relatedSchema, cell); // Passa a célula atual como pai
                                cell.style.padding = '0'; // Remover padding para a sub-tabela ocupar a célula
                                displayValue = ""; // Limpa o texto placeholder se a tabela foi renderizada
                            } else {
                                displayValue = `[RefList] (vazio)`;
                            }
                        } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                            displayValue = `[Lista] ${cellValue.slice(1).join(', ')}`;
                        } else if (cellValue === null || cellValue === undefined) {
                            displayValue = '(vazio)';
                            cell.style.fontStyle = 'italic';
                            cell.style.color = '#999';
                        }

                        if (displayValue) cell.appendChild(document.createTextNode(String(displayValue)));
                        applyGristCellStyles(cell, colSchema, record[colSchema.id]);

                        const detail = document.createElement('div');
                        detail.className = 'cell-detail';
                        detail.innerHTML = `(Raw: <pre style="display:inline; padding:1px 2px; font-size:0.9em;">${JSON.stringify(record[colSchema.id])}</pre> Tipo: ${colSchema.type})`;
                        if (displayValue) cell.appendChild(detail); // Só adiciona detail se houver displayValue
                    }
                }
            } else if (currentTable.schema.length === 0) {
                // ... (tratamento de erro como antes)
            } else {
                // ... (tratamento de erro como antes)
            }
            loadingMessageEl.style.display = 'none';

        } catch (error) {
            // ... (tratamento de erro como antes) ...
        }
    }

    grist.ready({ requiredAccess: 'full' });
    grist.onRecord(initializeDebugWidget);
    initializeDebugWidget();
});