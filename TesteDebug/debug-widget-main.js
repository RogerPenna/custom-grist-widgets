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

    let lastProcessedRecordIdForOnRecord = undefined;
    let isRendering = false;
    let debounceTimer;

    function applyGristCellStyles(cellElement, columnSchema, cellValue, record) {
        // Resetar estilos inline antes de aplicar novos
        cellElement.style.color = '';
        cellElement.style.backgroundColor = '';
        cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = '';

        let ruleAppliedSomeStyle = false;

        // 1. Aplicar Estilos de Regras Condicionais (a última regra TRUE prevalece)
        if (columnSchema.conditionalFormattingRules && columnSchema.conditionalFormattingRules.length > 0) {
            for (const rule of columnSchema.conditionalFormattingRules) {
                if (record && record[rule.helperColumnId] === true) {
                    // console.log(`Aplicando regra ID ${rule.id} (Helper: ${rule.helperColumnId}) para col ${columnSchema.id}`);
                    if (rule.style) {
                        if (rule.style.textColor) { cellElement.style.color = rule.style.textColor; ruleAppliedSomeStyle = true; }
                        if (rule.style.fillColor) { cellElement.style.backgroundColor = rule.style.fillColor; ruleAppliedSomeStyle = true; }
                        if (rule.style.fontBold) { cellElement.style.fontWeight = 'bold'; ruleAppliedSomeStyle = true; }
                        else if (rule.style.fontBold === false) { cellElement.style.fontWeight = 'normal'; ruleAppliedSomeStyle = true;} // Permitir desativar bold
                        // Adicionar para fontItalic, etc.
                    }
                }
            }
        }

        // 2. Aplicar Estilos de WidgetOptions da Coluna (se nenhuma regra definiu explicitamente a propriedade)
        if (columnSchema.widgetOptions) {
            const wo = columnSchema.widgetOptions;
            if (wo.textColor && !cellElement.style.color) cellElement.style.color = wo.textColor;
            if (wo.fillColor && !cellElement.style.backgroundColor) cellElement.style.backgroundColor = wo.fillColor;
            if (wo.fontBold && !cellElement.style.fontWeight) cellElement.style.fontWeight = 'bold';
            if (wo.fontItalic && !cellElement.style.fontStyle) cellElement.style.fontStyle = 'italic';
            // Alignment
            if (wo.alignment) cellElement.style.textAlign = wo.alignment;
        }
        
        // 3. Aplicar Estilos de ChoiceOptions (pode sobrescrever)
        if ((columnSchema.type === 'Choice' || columnSchema.type === 'ChoiceList') && 
            columnSchema.widgetOptions && columnSchema.widgetOptions.choiceOptions && 
            cellValue && columnSchema.widgetOptions.choiceOptions[String(cellValue)]) {
            const choiceStyle = columnSchema.widgetOptions.choiceOptions[String(cellValue)];
            if (choiceStyle.textColor) cellElement.style.color = choiceStyle.textColor;
            if (choiceStyle.fillColor) cellElement.style.backgroundColor = choiceStyle.fillColor;
            if (typeof choiceStyle.fontBold !== 'undefined') cellElement.style.fontWeight = choiceStyle.fontBold ? 'bold' : 'normal';
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

        const subTableContainer = document.createElement('div'); /* ... estilos ... */
        subTableContainer.style.marginTop = '5px'; subTableContainer.style.border = '1px dashed #aaa';
        subTableContainer.style.padding = '5px'; subTableContainer.style.backgroundColor = '#fdfdfd';
        const subTable = document.createElement('table'); /* ... estilos ... */
        subTable.style.fontSize = '0.9em'; subTable.style.width = '100%';

        const subThead = subTable.createTHead(); const subThRow = subThead.insertRow();
        const relatedColsToDisplay = relatedSchema.filter(col => !col.id.startsWith("gristHelper_"));
        relatedColsToDisplay.forEach(col => { /* ... criar th ... */
            const th = document.createElement('th'); th.textContent = col.label;
            th.style.backgroundColor = "#e9e9e9"; th.style.padding = "4px"; subThRow.appendChild(th);
        });

        const subTbody = subTable.createTBody();
        for (const relRec of relatedRecords) {
            const subTr = subTbody.insertRow();
            subTr.onclick = function(event) { /* ... alert ... */
                event.stopPropagation();
                alert(`Relacionado ID: ${relRec.id} Tabela: ${relRec.gristHelper_tableId}`);
            };
            for (const colSchema of relatedColsToDisplay) {
                const td = subTr.insertCell(); td.style.padding = "4px";
                const cellValue = relRec[colSchema.id]; let displayText = "";
                let contentContainer = document.createElement('div');

                if (colSchema.type.startsWith('Ref:') /* ... lógica Ref ... */) {
                    // ... (código para Ref como na sua última versão, usando currentDepth + 1)
                } else if (colSchema.type.startsWith('RefList:') /* ... lógica RefList ... */) {
                    // ... (código para RefList como na sua última versão, usando currentDepth + 1)
                } else if (Array.isArray(cellValue) && cellValue[0] === 'L') {
                    displayText = `[Lista] ${cellValue.slice(1).join(', ')}`;
                } else if (colSchema.type.startsWith("Date") || colSchema.type.startsWith("DateTime")) {
                    if (typeof cellValue === 'number' && cellValue !== 0) {
                        const dateObj = new Date(cellValue * 1000);
                        displayText = colSchema.type.startsWith("DateTime") ? dateObj.toLocaleString() : dateObj.toLocaleDateString();
                    } else { displayText = '(vazio)'; }
                } else if (cellValue === null || cellValue === undefined) {
                    displayText = '(vazio)'; td.style.fontStyle = 'italic'; td.style.color = '#999';
                } else {
                    displayText = String(cellValue);
                }
                if (displayText) contentContainer.appendChild(document.createTextNode(displayText));
                td.appendChild(contentContainer);
                applyGristCellStyles(td, colSchema, cellValue, relRec); // Passa relRec
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
            const currentTable = await tableLens.getCurrentTableInfo({ keepEncoded: false }); // << KEEPENCODED FALSE

            if (!currentTable || !currentTable.records) throw new Error("Nenhuma tabela selecionada ou dados não puderam ser carregados.");
            
            console.log(`DEBUG WIDGET [${callTimestamp}]: Dados para renderizar: Tabela: ${currentTable.tableId}, Registros: ${currentTable.records.length}, IDs: ${currentTable.records.map(r => r.id).join(', ')}`);
            if (currentTable.records.length > 0) {
                 console.log("DEBUG WIDGET: Amostra do primeiro registro com colunas helper:", JSON.parse(JSON.stringify(currentTable.records[0])));
            }

            tableNameEl.textContent = `Tabela: ${currentTable.tableId}`;
            tableInfoContainerEl.style.display = 'block';

            columnCountEl.textContent = currentTable.schema.length;
            const schemaHeaderRow = document.getElementById('schemaTable').querySelector('thead tr');
            // Limpa cabeçalhos antigos do schema, exceto os 8 primeiros se já existirem
            while(schemaHeaderRow.cells.length > 8) schemaHeaderRow.deleteCell(-1);

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
                const rulesCell = row.insertCell(); // Célula para regras
                if (col.conditionalFormattingRules && col.conditionalFormattingRules.length > 0) {
                    let rulesHtml = '<ul>';
                    col.conditionalFormattingRules.forEach(rule => {
                        rulesHtml += `<li><strong>HelperCol:</strong> ${rule.helperColumnId}<br/>
                                          Cond: <pre>${rule.conditionFormula}</pre>
                                          Estilo: <pre>${JSON.stringify(rule.style, null, 2)}</pre>
                                      </li>`;
                    });
                    rulesCell.innerHTML = rulesHtml + '</ul>';
                } else { rulesCell.textContent = '-'; }
            });
             if (schemaHeaderRow && schemaHeaderRow.cells.length === 8) { // Adiciona cabeçalho para regras se não existir
                 const thRules = document.createElement('th');
                 thRules.textContent = "Regras Cond. (Definição)";
                 schemaHeaderRow.appendChild(thRules);
            }


            recordCountEl.textContent = currentTable.records.length;
            if (currentTable.records.length > 0 && currentTable.schema.length > 0) {
                const headerRow = recordsTableHeadEl.insertRow();
                currentTable.schema.forEach(col => { /* ... criar th ... */
                     const th = document.createElement('th'); th.textContent = col.label; headerRow.appendChild(th);
                });

                for (const record of currentTable.records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row'; row.dataset.recordId = record.id;
                    row.dataset.tableId = currentTable.tableId; record.gristHelper_tableId = currentTable.tableId;
                    row.onclick = function() { /* ... alert ... */
                         alert(`Linha ID: ${this.dataset.recordId} Tabela: ${this.dataset.tableId}`);
                    };

                    for (const colSchema of currentTable.schema) {
                        const cell = row.insertCell();
                        const cellValue = record[colSchema.id];
                        let cellContentContainer = document.createElement('div');
                        let displayText = "";

                        if (colSchema.type.startsWith('Ref:') && typeof cellValue === 'number' && cellValue > 0 && colSchema.referencedTableId) {
                            // ... (lógica Ref como antes) ...
                        } else if (colSchema.type.startsWith('RefList:') && colSchema.referencedTableId) {
                            // ... (lógica RefList como antes, chamando renderRelatedDataTable) ...
                        } else if (colSchema.type.startsWith("Date") || colSchema.type.startsWith("DateTime")) {
                            if (typeof cellValue === 'number' && cellValue !== 0) { // Timestamps Grist (segundos)
                                const dateObj = new Date(cellValue * 1000);
                                const dateFormat = colSchema.widgetOptions?.dateFormat; // Ex: "DD/MM/YYYY"
                                if (dateFormat === "DD/MM/YYYY") { // Exemplo de formatação manual simples
                                    displayText = `${String(dateObj.getUTCDate()).padStart(2,'0')}/${String(dateObj.getUTCMonth() + 1).padStart(2,'0')}/${dateObj.getUTCFullYear()}`;
                                } else {
                                     displayText = colSchema.type.startsWith("DateTime") ? dateObj.toLocaleString() : dateObj.toLocaleDateString();
                                }
                            } else if (cellValue) { // Se já veio como string (pouco provável com keepEncoded:false)
                                displayText = String(cellValue);
                            } else { displayText = '(vazio)'; }
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
                        applyGristCellStyles(cell, colSchema, cellValue, record); // Passa o record para avaliar as helpers

                        const detail = document.createElement('div');
                        detail.className = 'cell-detail';
                        detail.innerHTML = `(Raw: <pre style="display:inline; padding:1px 2px; font-size:0.9em;">${JSON.stringify(cellValue)}</pre> Tipo: ${colSchema.type})`;
                        cell.appendChild(detail);
                    }
                }
            }
            // ... (else if para schema/records vazios)
            
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
        if (currentId === lastProcessedRecordIdForOnRecord && (currentId !== null || lastProcessedRecordIdForOnRecord !== undefined) ) {
            console.log("DEBUG WIDGET: onRecord - Mesmo ID ou ambos nulos (após primeiro processamento), pulando re-renderização.");
            return;
        }
        lastProcessedRecordIdForOnRecord = currentId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            console.log(`DEBUG WIDGET: Timeout do onRecord. Chamando initializeDebugWidget para ID: ${lastProcessedRecordIdForOnRecord}`);
            await initializeDebugWidget();
        }, 150);
    });

    setTimeout(async () => {
        if (lastProcessedRecordIdForOnRecord === undefined && !isRendering) {
            console.log("DEBUG WIDGET: Fazendo chamada inicial a initializeDebugWidget.");
            await initializeDebugWidget();
        } else {
            console.log("DEBUG WIDGET: Pulando chamada inicial (onRecord já pode ter processado ou renderização em progresso).");
        }
    }, 250);
});