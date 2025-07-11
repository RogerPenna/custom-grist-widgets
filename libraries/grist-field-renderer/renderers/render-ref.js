// libraries/grist-field-renderer/renderers/render-ref.js
export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- MODO DE EDIÇÃO ---
    if (isEditing) {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.add(new Option('-- Selecione --', ''));

        // MUDANÇA: Usa 'clean' que é mais leve e já está no formato de objeto.
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId, { mode: 'clean' }),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // MUDANÇA: Itera sobre os valores do objeto de schema.
        const refSchemaAsArray = Object.values(refSchema);
        let displayColId;
        if (colSchema.displayCol) {
            const displayColInfo = refSchemaAsArray.find(c => c.id === colSchema.displayCol);
            if (displayColInfo) displayColId = displayColInfo.colId;
        }
        if (!displayColId) {
            const firstVisibleColumn = refSchemaAsArray.find(c => c && !c.colId.startsWith('gristHelper_') && !c.isFormula);
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

    // --- MODO DE VISUALIZAÇÃO ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    // MUDANÇA: Usa a função interna do tableLens que já faz exatamente isso. É mais eficiente.
    const { displayValue, referencedRecord } = await tableLens.resolveReference(colSchema, record);
    
    if (referencedRecord) {
        container.textContent = displayValue;
    } else {
        container.textContent = `[Ref Inválido: ${cellValue}]`;
    }
}