// libraries/grist-field-renderer/renderers/render-ref.js

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- MODO DE EDIÇÃO (já corrigido e deve funcionar) ---
    if (isEditing) {
        // (Vou colar o código de edição corrigido da resposta anterior para garantir)
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.add(new Option('-- Selecione --', ''));

        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        const refSchemaAsArray = Object.values(refSchema);
        let displayColId;
        if (colSchema.displayCol) {
            const displayColInfo = refSchemaAsArray.find(c => c.id === colSchema.displayCol);
            if (displayColInfo) displayColId = displayColInfo.colId;
        }
        if (!displayColId) {
            const firstVisibleColumn = refSchemaAsArray.find(c => c && !c.isFormula && c.type !== 'Attachments');
            if (firstVisibleColumn) displayColId = firstVisibleColumn.colId;
        }
        if (!displayColId) displayColId = 'id';

        allRefRecords.forEach(rec => {
            const optionText = rec[displayColId] || `ID: ${rec.id}`;
            const optionValue = rec.id;
            const option = new Option(optionText, optionValue);
            if (cellValue != null && String(cellValue) === String(optionValue)) {
                option.selected = true;
            }
            select.add(option);
        });

        container.appendChild(select);
        return;
    }

    // --- MODO DE VISUALIZAÇÃO (LÓGICA MANUAL E EXPLÍCITA) ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    // Passo 1: Buscar tudo o que precisamos, de forma explícita.
    const [referencedRecord, referencedSchema] = await Promise.all([
        tableLens.fetchRecordById(refTableId, cellValue),
        tableLens.getTableSchema(refTableId) // Pede o schema completo da tabela de destino
    ]);
    
    if (!referencedRecord) {
        container.textContent = `[Ref não encontrado: ${cellValue}]`;
        return;
    }

    // Passo 2: Fazer a lógica de busca do displayColId manualmente AQUI.
    let displayColId = null;
    if (colSchema.displayCol) {
        // Procuramos no schema da tabela de destino (referencedSchema)
        const displayColInfo = Object.values(referencedSchema).find(c => c.id === colSchema.displayCol);
        if (displayColInfo) {
            displayColId = displayColInfo.colId;
        }
    }
    
    // Passo 3: Se encontrarmos o displayColId, pegamos o valor.
    if (displayColId) {
        // Se a coluna de display for uma fórmula, Grist já a calculou no registro.
        container.textContent = referencedRecord[displayColId];
    } else {
        // Se, por algum motivo, não encontramos o displayColId, usamos um fallback.
        // Tente encontrar a primeira coluna "sensata" para exibir.
        const fallbackColumn = Object.values(referencedSchema).find(c => c && c.type === 'Text' && !c.isFormula);
        if (fallbackColumn) {
            container.textContent = referencedRecord[fallbackColumn.colId];
        } else {
            // Último recurso
            container.textContent = `[Ref: ${cellValue}]`;
        }
    }
}