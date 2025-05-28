// custom-grist-widgets/TesteDebug/debug-widget-main.js
document.addEventListener('DOMContentLoaded', function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableEl = document.getElementById('schemaTable'); // Referência à tabela de schema
    const schemaTableBodyEl = schemaTableEl.querySelector('tbody');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableHeadEl = document.getElementById('recordsTable').querySelector('thead');
    const recordsTableBodyEl = document.getElementById('recordsTable').querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');

    let lastProcessedRecordIdForOnRecord = undefined;
    let isRendering = false;
    let debounceTimer;

    function applyGristCellStyles(cellElement, columnSchema, cellValue, record) {
        cellElement.style.color = '';
        cellElement.style.backgroundColor = '';
        cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = '';
        cellElement.style.textAlign = ''; // Reset alignment

        let styleAppliedByRuleOrChoice = false;

        // 1. Aplicar Estilos de Regras Condicionais (a última regra TRUE prevalece)
        if (columnSchema.conditionalFormattingRules && columnSchema.conditionalFormattingRules.length > 0) {
            for (const rule of columnSchema.conditionalFormattingRules) {
                if (record && record[rule.helperColumnId] === true) { // Checa a coluna helper booleana
                    // console.log(`Aplicando regra ID ${rule.id} (Helper: ${rule.helperColumnId}) para col ${columnSchema.id}`);
                    if (rule.style) {
                        if (rule.style.textColor) cellElement.style.color = rule.style.textColor;
                        if (rule.style.fillColor) cellElement.style.backgroundColor = rule.style.fillColor;
                        if (rule.style.fontBold !== undefined) cellElement.style.fontWeight = rule.style.fontBold ? 'bold' : 'normal';
                        if (rule.style.fontItalic !== undefined) cellElement.style.fontStyle = rule.style.fontItalic ? 'italic' : 'normal';
                        // Adicionar outros como fontUnderline, etc.
                        styleAppliedByRuleOrChoice = true;
                    }
                }
            }
        }

        // 2. Aplicar Estilos de ChoiceOptions (se não houve regra ou se a regra não definiu a propriedade)
        // Geralmente, o estilo de uma Choice específica tem alta prioridade.
        if ((columnSchema.type === 'Choice' || columnSchema.type === 'ChoiceList') &&
            columnSchema.widgetOptions && columnSchema.widgetOptions.choiceOptions &&
            cellValue != null && columnSchema.widgetOptions.choiceOptions[String(cellValue)]) {
            const choiceStyle = columnSchema.widgetOptions.choiceOptions[String(cellValue)];
            if (choiceStyle.textColor) cellElement.style.color = choiceStyle.textColor;
            if (choiceStyle.fillColor) cellElement.style.backgroundColor = choiceStyle.fillColor;
            if (typeof choiceStyle.fontBold !== 'undefined') cellElement.style.fontWeight = choiceStyle.fontBold ? 'bold' : 'normal';
            if (typeof choiceStyle.fontItalic !== 'undefined') cellElement.style.fontStyle = choiceStyle.fontItalic ? 'italic' : 'normal';
            styleAppliedByRuleOrChoice = true;
        }
        
        // 3. Aplicar Estilos de WidgetOptions da Coluna (como fallback se nada mais foi aplicado)
        if (!styleAppliedByRuleOrChoice && columnSchema.widgetOptions) {
            const wo = columnSchema.widgetOptions;
            if (wo.textColor) cellElement.style.color = wo.textColor;
            if (wo.fillColor) cellElement.style.backgroundColor = wo.fillColor;
            if (wo.fontBold) cellElement.style.fontWeight = 'bold';
            if (wo.fontItalic) cellElement.style.fontStyle = 'italic';
        }
        // Sempre aplicar alinhamento se definido no widgetOptions da coluna (não é usualmente definido por regras ou choices)
        if (columnSchema.widgetOptions && columnSchema.widgetOptions.alignment) {
             cellElement.style.textAlign = columnSchema.widgetOptions.alignment;
        }
    }

    async function renderRelatedDataTable(relatedRecords, parentCell, tableLens, currentDepth, maxDepth) {
        if (currentDepth > maxDepth) {
            const limitMsg = document.createElement('div'); limitMsg.className = 'cell-detail';
            limitMsg.innerHTML = '<em>(Limite de prof. relações atingido)</em>'; parentCell.appendChild(limitMsg); return;
        }
        if (!relatedRecords || relatedRecords.length === 0) return;
        
        const relatedSchema = relatedRecords[0]?.gristHelper_schema;
        if(!relatedSchema || relatedSchema.length === 0) {
            console.warn("renderRelatedDataTable: Schema da tabela relacionada não encontrado."); return;
        }

        const subTableContainer = document.createElement('div');
        subTableContainer.style.marginTop = '5px'; subTableContainer.style.border = '1px dashed #aaa';
        subTableContainer.style.padding = '5px'; subTableContainer.style.backgroundColor = '#fdfdfd';
        const subTable = document.createElement('table');
        subTable.style.fontSize = '0.9em'; subTable.style.width = '100%';

        const subThead = subTable.createTHead(); const subThRow = subThead.insertRow();
        const relatedColsToDisplay = relatedSchema.filter(col => !col.id.startsWith("gristHelper_"));
        relatedColsToDisplay.forEach(col => {
            const th = document.createElement('th'); th.textContent = col.label;
            th.style.backgroundColor = "#e9e9e9"; th.style.padding = "4px"; subThRow.appendChild(th);
        });

        const subTbody = subTable.createTBody();
        for (const relRec of relatedRecords) {
            const subTr = subTbody.insertRow();
            subTr.onclick = function(event) {
                event.stopPropagation();
                alert(`Relacionado ID: ${relRec.id} Tabela: ${relRec.gristHelper_tableId}`);
            };
            for (const colSchema of relatedColsToDisplay) {
                const td = subTr.insertCell(); td.style.padding = "4px";
                const cellValue = relRec[colSchema.id]; let displayText = "";
                let contentContainer = document.createElement('div');

                if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                    if (currentDepth + 1 <= maxDepth) {
                        const nestedRefRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue, {keepEncoded: false});
                        if (nestedRefRecord) {
                            const nestedRefSchema = await tableLens.getTableSchema(colSchema.referencedTableId); // Schema já terá regras
                            const displayCol = nestedRefSchema.find(c => c.id === colSchema.displayColId) || nestedRefSchema.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || (nestedRefSchema.length > 0 ? nestedRefSchema[0] : {id: 'id'});
                            displayText = `[Ref] ${nestedRefRecord[displayCol?.id] || cellValue} (ID: ${cellValue})`;
                        } else { displayText = `[Ref] ID: ${cellValue} (Reg. não enc.)`; }
                    } else { displayText = `[Ref] ID: ${cellValue} (Limite prof.)`; }
                } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                    displayText = `[RefList]`;
                    contentContainer.appendChild(document.createTextNode(displayText));
                    if (currentDepth + 1 <= maxDepth) {
                        const nestedRelatedRecords = await tableLens.fetchRelatedRecords(relRec, colSchema.id, {keepEncoded: false});
                        if (nestedRelatedRecords.length > 0) {
                             const placeholderNode = Array.from(contentContainer.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("[RefList]"));
                             if(placeholderNode) placeholderNode.remove();
                             await renderRelatedDataTable(nestedRelatedRecords, contentContainer, tableLens, currentDepth + 1, maxDepth);
                        } else { contentContainer.appendChild(document.createTextNode(` (vazio)`)); }
                    } else { contentContainer.appendChild(document.createTextNode(` (limite prof.)`)); }
                    displayText = "";
                } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                    displayText = `[Lista] ${cellValue.slice(1).join(', ')}`;
                } else if (colSchema.type.startsWith("Date") || colSchema.type.startsWith("DateTime")) {
                    if (typeof cellValue === 'number' && cellValue !== 0) {
                        const dateObj = new Date(cellValue * 1000);
                        const dateFormat = colSchema.widgetOptions?.dateFormat;
                        if (dateFormat === "DD/MM/YYYY") {
                            displayText = `${String(dateObj.getUTCDate()).padStart(2,'0')}/${String(dateObj.getUTCMonth() + 1).padStart(2,'0')}/${dateObj.getUTCFullYear()}`;
                        } else if (dateFormat === "YYYY-MM-DD") {
                             displayText = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2,'0')}-${String(dateObj.getUTCDate()).padStart(2,'0')}`;
                        }
                        else { displayText = colSchema.type.startsWith("DateTime") ? dateObj.toLocaleString() : dateObj.toLocaleDateString(); }
                    } else if (cellValue) { displayText = String(cellValue); }
                    else { displayText = '(vazio)'; }
                } else if (cellValue === null || cellValue === undefined) {
                    displayText = '(vazio)'; td.style.fontStyle = 'italic'; td.style.color = '#999';
                } else {
                    displayText = String(cellValue);
                }
                if (displayText) contentContainer.appendChild(document.createTextNode(displayText));
                td.appendChild(contentContainer);
                applyGristCellStyles(td, colSchema, cellValue, relRec);
            }
        }
        subTableContainer.appendChild(subTable); parentCell.appendChild(subTableContainer);
    }

    async function initializeDebugWidget() {
        const callTimestamp = Date.now();
        console.log(`DEBUG WIDGET: initializeDebugWidget() INICIADO [${callTimestamp}]`);
        if (isRendering) { console.warn(`DEBUG WIDGET: Renderização já em progresso [${callTimestamp}], pulando.`); return; }
        isRendering = true;

        errorMessageEl.textContent = "";
        while (schemaTableBodyEl.firstChild) schemaTableBodyEl.removeChild(schemaTableBodyEl.firstChild);
        while (recordsTableHeadEl.firstChild) recordsTableHeadEl.removeChild(recordsTableHeadEl.firstChild);
        while (recordsTableBodyEl.firstChild) recordsTableBodyEl.removeChild(recordsTableBodyEl.firstChild);
        loadingMessageEl.style.display = 'block'; tableInfoContainerEl.style.display = 'none';

        try {
            if (typeof GristTableLens === 'undefined') throw new Error("Biblioteca GristTableLens não carregada.");
            const tableLens = new GristTableLens(grist);
            const currentTable = await tableLens.getCurrentTableInfo({ keepEncoded: false });

            if (!currentTable || !currentTable.records) throw new Error("Nenhuma tabela selecionada ou dados não puderam ser carregados.");
            
            console.log(`DEBUG WIDGET [${callTimestamp}]: Dados para renderizar: Tabela: ${currentTable.tableId}, Registros: ${currentTable.records.length}, IDs: ${currentTable.records.map(r => r.id).join(', ')}`);
            if (currentTable.records.length > 0) {
                 console.log("DEBUG WIDGET: Amostra do primeiro registro (com colunas helper, se keepEncoded:false):", JSON.parse(JSON.stringify(currentTable.records[0])));
            }

            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

            const schemaHeaderRow = schemaTableEl.querySelector('thead tr');
            while(schemaHeaderRow.cells.length > 8) schemaHeaderRow.deleteCell(-1); // Reseta para 8 colunas base
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
                const rulesCell = row.insertCell();
                if (col.conditionalFormattingRules && col.conditionalFormattingRules.length > 0) {
                    let rulesHtml = '<ul style="margin:0; padding-left:15px;">';
                    col.conditionalFormattingRules.forEach(rule => {
                        rulesHtml += `<li style="margin-bottom:3px;"><strong>Helper:</strong> ${rule.helperColumnId}<br/>
                                          <span style="font-size:0.9em;">Cond: <pre style="display:inline;font-size:inherit;">${rule.conditionFormula}</pre><br/>
                                          Estilo: <pre style="display:inline;font-size:inherit;">${JSON.stringify(rule.style, null, 1)}</pre></span>
                                      </li>`;
                    });
                    rulesCell.innerHTML = rulesHtml + '</ul>';
                } else { rulesCell.textContent = '-'; }
            });
             if (schemaHeaderRow && schemaHeaderRow.cells.length === 8) {
                 const thRules = document.createElement('th');
                 thRules.textContent = "Regras Cond. (Definição)";
                 schemaHeaderRow.appendChild(thRules);
            }

            recordCountEl.textContent = currentTable.records.length;
            if (currentTable.records.length > 0 && currentTable.schema.length > 0) {
                const headerRow = recordsTableHeadEl.insertRow();
                currentTable.schema.forEach(col => {
                     const th = document.createElement('th'); th.textContent = col.label; headerRow.appendChild(th);
                });

                for (const record of currentTable.records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row'; row.dataset.recordId = record.id;
                    row.dataset.tableId = currentTable.tableId; record.gristHelper_tableId = currentTable.tableId;
                    row.onclick = function() {
                         alert(`Linha ID: ${this.dataset.recordId} Tabela: ${this.dataset.tableId}`);
                    };

                    for (const colSchema of currentTable.schema) {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        let cellContentContainer = document.createElement('div');
                        let displayText = "";

                        if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                            const relatedRecord = await tableLens.fetchRecordById(colSchema.referencedTableId, cellValue, {keepEncoded: false});
                            if (relatedRecord) {
                                const relatedSchemaForRef = await tableLens.getTableSchema(colSchema.referencedTableId);
                                const displayCol = relatedSchemaForRef.find(c => c.id === colSchema.displayColId) || relatedSchemaForRef.find(c => c.label.toLowerCase() === 'name' || c.label.toLowerCase() === 'nome') || (relatedSchemaForRef.length > 0 ? relatedSchemaForRef[0] : {id:'id'});
                                displayText = `[Ref] ${relatedRecord[displayCol?.id] !== undefined ? relatedRecord[displayCol.id] : cellValue} (ID: ${cellValue})`;
                            } else { displayText = `[Ref] ID: ${cellValue} (Reg. não enc.)`; }
                        } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                            displayText = `[RefList]`;
                            cellContentContainer.appendChild(document.createTextNode(displayText));
                            const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.id, {keepEncoded: false});
                            if (relatedRecords.length > 0) {
                                 const placeholderNode = Array.from(cellContentContainer.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("[RefList]"));
                                 if(placeholderNode) placeholderNode.remove();
                                await renderRelatedDataTable(relatedRecords, cellContentContainer, tableLens, 1, 2);
                            } else { cellContentContainer.appendChild(document.createTextNode(` (vazio)`)); }
                            displayText = "";
                        } else if (colSchema.type.startsWith("Date") || colSchema.type.startsWith("DateTime")) {
                            if (typeof cellValue === 'number' && cellValue !== 0) {
                                const dateObj = new Date(cellValue * 1000);
                                const dateFormat = colSchema.widgetOptions?.dateFormat;
                                if (dateFormat === "DD/MM/YYYY") {
                                    displayText = `${String(dateObj.getUTCDate()).padStart(2,'0')}/${String(dateObj.getUTCMonth() + 1).padStart(2,'0')}/${dateObj.getUTCFullYear()}`;
                                } else if (dateFormat === "YYYY-MM-DD") {
                                     displayText = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2,'0')}-${String(dateObj.getUTCDate()).padStart(2,'0')}`;
                                } else { displayText = colSchema.type.startsWith("DateTime") ? dateObj.toLocaleString() : dateObj.toLocaleDateString(); }
                            } else if (cellValue) { displayText = String(cellValue); }
                            else { displayText = '(vazio)'; }
                        } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                            displayText = `[Lista] ${cellValue.slice(1).join(', ')}`;
                        } else if (cellValue === null || cellValue === undefined) {
                            displayText = '(vazio)'; cell.style.fontStyle = 'italic'; cell.style.color = '#999';
                        } else {
                            displayText = String(cellValue);
                        }

                        if (displayText) {
                           cellContentContainer.insertBefore(document.createTextNode(displayText), cellContentContainer.firstChild);
                        }
                        cell.appendChild(cellContentContainer);
                        applyGristCellStyles(cell, colSchema, cellValue, record);

                        const detail = document.createElement('div');
                        detail.className = 'cell-detail';
                        detail.innerHTML = `(Raw: <pre style="display:inline; padding:1px 2px; font-size:0.9em;">${JSON.stringify(cellValue)}</pre> Tipo: ${colSchema.type})`;
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
        // console.log(`DEBUG WIDGET: grist.onRecord disparado. ID do Registro: ${currentId}. Último ID Processado: ${lastProcessedRecordIdForOnRecord}`);
        if (currentId === lastProcessedRecordIdForOnRecord && (currentId !== null || lastProcessedRecordIdForOnRecord !== undefined) ) {
            // console.log("DEBUG WIDGET: onRecord - Mesmo ID ou ambos nulos (após primeiro processamento), pulando re-renderização.");
            return;
        }
        lastProcessedRecordIdForOnRecord = currentId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            console.log(`DEBUG WIDGET: Timeout do onRecord. Chamando initializeDebugWidget para ID: ${lastProcessedRecordIdForOnRecord}`);
            await initializeDebugWidget(); // Sempre busca a tabela inteira para o debug widget
        }, 150);
    });

    setTimeout(async () => {
        if (lastProcessedRecordIdForOnRecord === undefined && !isRendering) {
            console.log("DEBUG WIDGET: Fazendo chamada inicial a initializeDebugWidget.");
            await initializeDebugWidget();
        } else {
            // console.log("DEBUG WIDGET: Pulando chamada inicial (onRecord já pode ter processado ou renderização em progresso).");
        }
    }, 250);
});