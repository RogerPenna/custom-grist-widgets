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

    let lastProcessedRecordIdForOnRecord = undefined; // Usar undefined para distinguir de null (nenhum registro selecionado)
    let isRendering = false;
    let debounceTimer;


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
            return;
        }
        
        const relatedSchema = relatedRecords[0]?.gristHelper_schema;
        if(!relatedSchema || relatedSchema.length === 0) {
            console.warn("Não foi possível obter o schema para a tabela relacionada em renderRelatedDataTable.");
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
                let displayText = "";
                let contentContainer = document.createElement('div');

                if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                    if (currentDepth + 1 <= maxDepth) {
                        const nestedRefRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue);
                        if (nestedRefRecord) {
                            const nestedRefSchema = await tableLens.getTableSchema(colSchema.referencedTableId);
                            const displayCol = nestedRefSchema.find(c => c.id === colSchema.displayColId) || nestedRefSchema.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || (nestedRefSchema.length > 0 ? nestedRefSchema[0] : {id: 'id'});
                            displayText = `[Ref] ${nestedRefRecord[displayCol?.id] || cellValue} (ID: ${cellValue})`;
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
                        const nestedRelatedRecords = await tableLens.fetchRelatedRecords(relRec, colSchema.id);
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
                    displayText = "";
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
        const callTimestamp = Date.now();
        console.log(`DEBUG WIDGET: initializeDebugWidget() INICIADO [${callTimestamp}]`);

        if (isRendering) {
            console.warn(`DEBUG WIDGET: Renderização já em progresso [${callTimestamp}], pulando.`);
            return;
        }
        isRendering = true;

        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';
        
        // Limpeza agressiva
        while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
        while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
        while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);

        try {
            if (typeof GristTableLens === 'undefined') {
                errorMessageEl.textContent = "ERRO: Biblioteca GristTableLens não carregada.";
                throw new Error("GristTableLens not loaded"); // Lança erro para cair no finally
            }
            const tableLens = new GristTableLens(grist);
            const currentTable = await tableLens.getCurrentTableInfo();

            if (!currentTable || !currentTable.records) {
                errorMessageEl.textContent = "Nenhuma tabela selecionada ou dados não puderam ser carregados.";
                throw new Error("No table data from GristTableLens");
            }

            console.log(`DEBUG WIDGET [${callTimestamp}]: Dados para renderizar: Tabela: ${currentTable.tableId}, Registros: ${currentTable.records.length}, IDs: ${currentTable.records.map(r => r.id).join(', ')}`);
            // console.log(" - Amostra (até 5):", JSON.parse(JSON.stringify(currentTable.records.slice(0, 5))));


            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

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
                    row.dataset.tableId = currentTable.tableId;
                    record.gristHelper_tableId = currentTable.tableId;

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
                                const displayCol = relatedSchemaForRef.find(c => c.id === colSchema.displayColId) || relatedSchemaForRef.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || (relatedSchemaForRef.length > 0 ? relatedSchemaForRef[0] : {id:'id'});
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
                                await renderRelatedDataTable(relatedRecords, cellContentContainer, tableLens, 1, 2);
                            } else {
                                 cellContentContainer.appendChild(document.createTextNode(` (vazio)`));
                            }
                            displayText = "";
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
                if (recordsTableBodyEl.rows.length !== currentTable.records.length) {
                    console.error(`DISCREPÂNCIA APÓS RENDERIZAÇÃO [${callTimestamp}]! Esperado: ${currentTable.records.length}, DOM: ${recordsTableBodyEl.rows.length}`);
                 }
            } else if (currentTable.schema.length === 0) {
                recordsTableBodyEl.innerHTML = '<tr><td colspan="1">Nenhuma coluna definida.</td></tr>';
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="${currentTable.schema.length || 1}">Nenhum registro.</td></tr>`;
            }
            
        } catch (error) {
            console.error(`Erro em initializeDebugWidget [${callTimestamp}]:`, error);
            errorMessageEl.textContent = `ERRO: ${error.message}. Veja o console.`;
        } finally {
            loadingMessageEl.style.display = 'none';
            isRendering = false;
            console.log(`DEBUG WIDGET: initializeDebugWidget() CONCLUÍDO [${callTimestamp}]`);
        }
    }

    grist.ready({ requiredAccess: 'full' });

    grist.onRecord(async (record) => {
        const currentId = record ? record.id : null;
        console.log(`DEBUG WIDGET: grist.onRecord disparado. ID do Registro: ${currentId}. Último ID Processado: ${lastProcessedRecordIdForOnRecord}`);

        if (currentId === lastProcessedRecordIdForOnRecord) {
            console.log("DEBUG WIDGET: onRecord - Mesmo ID ou ambos nulos, pulando re-renderização desnecessária.");
            return;
        }
        lastProcessedRecordIdForOnRecord = currentId;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            console.log(`DEBUG WIDGET: Timeout do onRecord. Chamando initializeDebugWidget para ID: ${lastProcessedRecordIdForOnRecord}`);
            await initializeDebugWidget(); // Sempre busca a tabela inteira para o debug widget
        }, 150); // Aumentado o debounce para dar mais margem
    });

    // Chamada inicial com um pequeno atraso para dar prioridade ao primeiro onRecord, se ocorrer
    setTimeout(async () => {
        // Só faz a chamada inicial se onRecord ainda não tiver definido um ID (ou seja, não processou nada ainda)
        // E se não houver uma renderização em andamento.
        if (lastProcessedRecordIdForOnRecord === undefined && !isRendering) {
            console.log("DEBUG WIDGET: Fazendo chamada inicial a initializeDebugWidget.");
            await initializeDebugWidget();
        } else {
            console.log("DEBUG WIDGET: Pulando chamada inicial (onRecord já pode ter processado ou renderização em progresso).");
        }
    }, 250); // Aumentado o atraso para a chamada inicial
});