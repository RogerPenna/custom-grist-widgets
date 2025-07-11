// libraries/grist-field-renderer/renderers/render-ref.js

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- MODO DE EDIÇÃO (CORRIGIDO) ---
    if (isEditing) {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.add(new Option('-- Selecione --', ''));

        // Pede o schema no modo 'clean' que é otimizado e o correto para UI
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId), // Não precisa de modo, o padrão já é o 'clean' completo
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // CORREÇÃO: Usa Object.values() para iterar sobre o objeto de schema
        const refSchemaAsArray = Object.values(refSchema);
        let displayColId;
        if (colSchema.displayCol) {
            const displayColInfo = refSchemaAsArray.find(c => c.id === colSchema.displayCol);
            if (displayColInfo) displayColId = displayColInfo.colId;
        }
        // Fallback robusto
        if (!displayColId) {
            const firstVisibleColumn = refSchemaAsArray.find(c => c && !c.isFormula && c.type !== 'Attachments');
            if (firstVisibleColumn) displayColId = firstVisibleColumn.colId;
        }
        if (!displayColId) displayColId = 'id'; // Último recurso

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

    // --- MODO DE VISUALIZAÇÃO (SIMPLIFICADO E CORRIGIDO) ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    // Usa a função do tableLens que encapsula toda a lógica de resolução.
    // É mais eficiente e garante consistência.
    // Passamos o 'record' do options, que é o registro da tabela principal (ex: Integracao_Funcionarios)
    const { displayValue, referencedRecord } = await tableLens.resolveReference(colSchema, record);
    
    if (referencedRecord) {
        // A função resolveReference já nos deu o valor correto a ser exibido.
        container.textContent = displayValue;
    } else {
        // Se o registro de referência não foi encontrado.
        container.textContent = displayValue; // Ex: "[Ref not found: 1]"
    }
}