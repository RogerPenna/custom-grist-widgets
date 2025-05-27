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

    async function renderRelatedDataTable(relatedRecords, parentCell, tableLens, currentDepth, maxDepth) {
        if (currentDepth > maxDepth) {
            const limitMsg = document.createElement('div');
            limitMsg.className = 'cell-detail';
            limitMsg.innerHTML = '<em>(Limite de profundidade de relações atingido)</em>';
            parentCell.appendChild(limitMsg);
            return;
        }

        if (!relatedRecords || relatedRecords.length === 0) {
            return; // Não adiciona nada se não houver registros
        }
        
        // Usa o schema que foi adicionado aos relatedRecords em fetchRelatedRecords
        const relatedSchema = relatedRecords[0]?.gristHelper_schema;
        if(!relatedSchema || relatedSchema.length === 0) {
            console.warn("Não foi possível obter o schema para a tabela relacionada.");
            parentCell.innerHTML += '<div class="cell-detail"><em>(Schema da tabela relacionada não encontrado)</em></div>';
            return;
        }


        const subTableContainer = document.createElement('div');
        subTableContainer.style.marginTop = '5px';
        subTableContainer.style.border = '1px dashed #aaa';
        subTableContainer.style.padding = '5px';
        subTableContainer.style.backgroundColor = '#fdfdfd';

        const subTable = document.createElement('table');
        subTable.style.fontSize = '0.9em';
        subTable.style.width = '100%';

        const subThead = subTable.createTHead();
        const subThRow = subThead.insertRow();
        const relatedColsToDisplay = relatedSchema.filter(col => !col.id.startsWith("gristHelper_"));

        relatedColsToDisplay.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.style.backgroundColor = "#e9e9e9";
            th.style.padding = "4px";
            subThRow.appendChild(th);
        });

        const subTbody = subTable.createTBody();
        for (const relRec of relatedRecords) {
            const subTr = subTbody.insertRow();
            subTr.onclick = function(event) {
                event.stopPropagation();
                alert(`Clicou na linha relacionada ID: ${relRec.id} da Tabela: ${relRec.gristHelper_tableId}\n(Placeholder para abrir gaveta de detalhes para ESTE item)`);
            };

            for (const colSchema of relatedColsToDisplay) {
                const td = subTr.insertCell();
                td.style.padding = "4px";
                const cellValue = relRec[colSchema.id];
                let displayValue = cellValue;
                let contentContainer = document.createElement('div'); // Para aninhar texto e sub-tabelas

                if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                    if (currentDepth + 1 <= maxDepth) { // Verifica profundidade antes de buscar
                        const nestedRefRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue);
                        if (nestedRefRecord) {
                            const nestedRefSchema = await tableLens.getTableSchema(colSchema.referencedTableId);
                            const displayCol = nestedRefSchema.find(c => c.id === colSchema.displayColId) || nestedRefSchema.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || nestedRefSchema[0];
                            displayText = `[Ref] ${nestedRefRecord[displayCol.id] || cellValue} (ID: ${cellValue})`;
                        } else {
                             displayText = `[Ref] ID: ${cellValue} (Registro não encontrado)`;
                        }
                    } else {
                        displayText = `[Ref] ID: ${cellValue} (Limite profundidade)`;
                    }
                } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                    displayText = `[RefList]`;
                    contentContainer.appendChild(document.createTextNode(displayText));
                    if (currentDepth + 1 <= maxDepth) {
                        const nestedRelatedRecords = await tableLens.fetchRelatedRecords(relRec, colSchema.id); // Passa o registro atual da sub-tabela
                        if (nestedRelatedRecords.length > 0) {
                             const placeholderNode = Array.from(contentContainer.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("[RefList]"));
                             if(placeholderNode) placeholderNode.remove();
                             await renderRelatedDataTable(nestedRelatedRecords, contentContainer, tableLens, currentDepth + 1, maxDepth);
                        } else {
                            contentContainer.appendChild(document.createTextNode(` (vazio)`));
                        }
                    } else {
                         contentContainer.appendChild(document.createTextNode(` (limite profundidade)`));
                    }
                    displayText = ""; // Já tratado pelo contentContainer
                } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                    displayText = `[Lista] ${cellValue.slice(1).join(', ')}`;
                } else if (cellValue === null || cellValue === undefined) {
                    displayText = '(vazio)';
                    td.style.fontStyle = 'italic';
                    td.style.color = '#999';
                } else {
                    displayText = String(cellValue);
                }

                if (displayText) contentContainer.appendChild(document.createTextNode(displayText));
                td.appendChild(contentContainer);
                applyGristCellStyles(td, colSchema, cellValue);
            }
        }
        subTableContainer.appendChild(subTable);
        parentCell.appendChild(subTableContainer);
    }


    async function initializeDebugWidget() {
    console.log("DEBUG WIDGET: initializeDebugWidget() CHAMADO"); // NOVO LOG
    errorMessageEl.textContent = "";
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
    // LOG PARA VERIFICAR OS DADOS BRUTOS RECEBIDOS
    if (currentTable && currentTable.records) {
        console.log("DEBUG WIDGET: Dados recebidos de tableLens.getCurrentTableInfo():");
        console.log(" - ID da Tabela:", currentTable.tableId);
        console.log(" - Número de registros recebidos:", currentTable.records.length);
        console.log(" - IDs dos registros recebidos:", currentTable.records.map(r => r.id));
        // Log mais detalhado dos primeiros registros, se houver muitos
        // Cuidado ao logar objetos muito grandes, pode poluir o console.
        // Fazendo uma cópia para evitar problemas com objetos proxy do Grist no console.
        console.log(" - Amostra de registros (até 5):", JSON.parse(JSON.stringify(currentTable.records.slice(0, 5))));
    } else {
        console.error("DEBUG WIDGET: currentTable ou currentTable.records está indefinido após chamada a tableLens!");
    }
    // FIM DO LOG DE VERIFICAÇÃO
            if (!currentTable) {
                errorMessageEl.textContent = "Nenhuma tabela selecionada ou dados não puderam ser carregados.";
                loadingMessageEl.style.display = 'none';
                return;
            }

            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

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

                for (const record of currentTable.records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.dataset.recordId = record.id;
                    row.dataset.tableId = currentTable.tableId; // Adiciona tableId ao dataset
                    record.gristHelper_tableId = currentTable.tableId; // Enriquece o objeto record


                    row.onclick = function() {
                        alert(`Clicou na linha ID: ${this.dataset.recordId} da Tabela: ${this.dataset.tableId}\n(Placeholder para abrir gaveta de detalhes)`);
                    };

                    for (const colSchema of currentTable.schema) {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        let cellContentContainer = document.createElement('div');
                        let displayText = "";

                        if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                            const relatedRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue);
                            if (relatedRecord) {
                                const relatedSchemaForRef = await tableLens.getTableSchema(colSchema.referencedTableId);
                                const displayCol = relatedSchemaForRef.find(c => c.id === colSchema.displayColId) || relatedSchemaForRef.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || relatedSchemaForRef[0];
                                displayText = `[Ref] ${relatedRecord[displayCol?.id] || cellValue} (ID: ${cellValue})`;
                            } else {
                                displayText = `[Ref] ID: ${cellValue} (Registro não encontrado)`;
                            }
                        } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                            displayText = `[RefList]`;
                            cellContentContainer.appendChild(document.createTextNode(displayText));
                            const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.id);
                            if (relatedRecords.length > 0) {
                                 const placeholderNode = Array.from(cellContentContainer.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("[RefList]"));
                                 if(placeholderNode) placeholderNode.remove();
                                await renderRelatedDataTable(relatedRecords, cellContentContainer, tableLens, 1, 2); // Profundidade inicial 1, max 2
                            } else {
                                 cellContentContainer.appendChild(document.createTextNode(` (vazio)`));
                            }
                            displayText = ""; // Conteúdo já está em cellContentContainer
                        } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                            displayText = `[Lista] ${cellValue.slice(1).join(', ')}`;
                        } else if (cellValue === null || cellValue === undefined) {
                            displayText = '(vazio)';
                            cell.style.fontStyle = 'italic';
                            cell.style.color = '#999';
                        } else {
                            displayText = String(cellValue);
                        }

                        if (displayText) {
                           cellContentContainer.insertBefore(document.createTextNode(displayText), cellContentContainer.firstChild);
                        }
                        cell.appendChild(cellContentContainer);
                        applyGristCellStyles(cell, colSchema, record[colSchema.id]);

                        const detail = document.createElement('div');
                        detail.className = 'cell-detail';
                        detail.innerHTML = `(Raw: <pre style="display:inline; padding:1px 2px; font-size:0.9em;">${JSON.stringify(record[colSchema.id])}</pre> Tipo: ${colSchema.type})`;
                        cell.appendChild(detail);
                    }
                }
            } else if (currentTable.schema.length === 0) {
                recordsTableBodyEl.innerHTML = '<tr><td colspan="1">Nenhuma coluna definida.</td></tr>';
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="${currentTable.schema.length}">Nenhum registro.</td></tr>`;
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
    initializeDebugWidget(); // Para carregar na primeira vez
});