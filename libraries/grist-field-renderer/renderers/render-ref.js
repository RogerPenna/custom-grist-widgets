// libraries/grist-field-renderer/renderers/render-ref.js
// VERSÃO FINAL E LIMPA

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    // Assegura que temos um colSchema antes de prosseguir
    if (!colSchema || !colSchema.type) {
        container.textContent = `[Schema Inválido]`;
        return;
    }
    
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

        // Busca o schema e os registros da tabela de destino
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        let displayColId = null;

        // Lógica para encontrar a coluna de exibição para o dropdown
        const displayColIdNum = colSchema.displayCol;
        if (displayColIdNum) {
            // A lógica correta é procurar a coluna de exibição na tabela de destino
            const displayColInfo = Object.values(refSchema).find(c => c.id === displayColIdNum);
            
            if(displayColInfo) {
                // Se a coluna de display for uma fórmula de referência, precisamos da lógica
                // que acabamos de colocar no TableLens. Para evitar duplicação, vamos fazer
                // uma chamada simples aqui para descobrir o nome da coluna final.
                // Esta é uma simplificação, mas eficaz para o dropdown.
                const sourceTableId = record.gristHelper_tableId;
                const sourceSchema = await tableLens.getTableSchema(sourceTableId);
                const helperCol = Object.values(sourceSchema).find(c => c.id === displayColIdNum);
                if (helperCol && helperCol.formula?.includes('.')) {
                    displayColId = helperCol.formula.split('.').pop();
                } else {
                    displayColId = displayColInfo.colId;
                }
            }
        }
        
        // Fallback se a lógica acima falhar
        if (!displayColId) {
            const firstSensibleColumn = Object.values(refSchema).find(c => c && c.type === 'Text' && !c.isFormula);
            displayColId = firstSensibleColumn ? firstSensibleColumn.colId : 'id';
        }

        // Preenche o dropdown
        allRefRecords.forEach(rec => {
            const optionText = rec[displayColId] || `ID: ${rec.id}`;
            const optionValue = rec.id;
            const option = new Option(optionText, optionValue);
            option.selected = cellValue != null && String(cellValue) === String(optionValue);
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
    
    // Confia na função do TableLens, que agora está corrigida.
    const { displayValue } = await tableLens.resolveReference(colSchema, record);
    container.textContent = displayValue;
}