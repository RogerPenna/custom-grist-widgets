// libraries/grist-field-renderer/renderers/render-ref.js
// VERSÃO FINAL E CORRIGIDA (MODO DE EDIÇÃO CONSERTADO)

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container || !colSchema || !colSchema.type) {
        container.textContent = `[Schema Inválido]`;
        return;
    }
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- MODO DE EDIÇÃO (LÓGICA CORRIGIDA) ---
    if (isEditing) {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.add(new Option('-- Selecione --', ''));

        // Busca o schema e os registros da tabela de destino
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // --- INÍCIO DA LÓGICA DE DESCOBERTA (AGORA CORRETA) ---
        let finalDisplayColId = null;
        const displayColIdNum = colSchema.displayCol;

        if (displayColIdNum) {
            // Busca o schema da tabela de ORIGEM (onde a coluna helper está).
            const sourceTableId = record.gristHelper_tableId;
            if (sourceTableId) {
                const sourceSchema = await tableLens.getTableSchema(sourceTableId);
                const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);

                if (displayColHelperSchema) {
                    // Se for uma fórmula de referência, extrai o nome da coluna final.
                    if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                        finalDisplayColId = displayColHelperSchema.formula.split('.').pop();
                    } else {
                        // Se a displayCol não for uma fórmula de ref, assume que é o colId direto.
                        finalDisplayColId = displayColHelperSchema.colId;
                    }
                }
            }
        }
        // --- FIM DA LÓGICA DE DESCOBERTA ---
        
        // Fallback se a lógica acima falhar
        if (!finalDisplayColId) {
            const firstSensibleColumn = Object.values(refSchema).find(c => c && c.type === 'Text' && !c.isFormula);
            finalDisplayColId = firstSensibleColumn ? firstSensibleColumn.colId : 'id';
        }

        // Preenche o dropdown usando o finalDisplayColId correto
        allRefRecords.forEach(rec => {
            const optionText = rec[finalDisplayColId] || `ID: ${rec.id}`;
            const optionValue = rec.id;
            const option = new Option(optionText, optionValue);
            option.selected = cellValue != null && String(cellValue) === String(optionValue);
            select.add(option);
        });
        container.appendChild(select);
        return;
    }

    // --- MODO DE VISUALIZAÇÃO (JÁ FUNCIONANDO) ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    const { displayValue } = await tableLens.resolveReference(colSchema, record);
    container.textContent = displayValue;
}