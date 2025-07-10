// libraries/grist-field-renderer/renderers/render-ref.js

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing } = options;

    if (!container) return;
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- LÓGICA PARA MODO DE EDIÇÃO (MODAL/DRAWER) ---
    if (isEditing) {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.add(new Option('-- Selecione --', ''));

        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId, { mode: 'raw' }),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // CORREÇÃO: Lógica robusta para encontrar a coluna de exibição
        let displayColId;
        if (colSchema.displayCol) {
            const displayColInfo = refSchema.find(c => c.id === colSchema.displayCol);
            if (displayColInfo) displayColId = displayColInfo.colId;
        }
        if (!displayColId) {
            // Fallback: se não houver displayCol, usa a primeira coluna de texto da tabela
            const firstVisibleColumn = Object.values(refSchema).find(c => !c.colId.startsWith('gristHelper_') && !c.isFormula);
            if (firstVisibleColumn) displayColId = firstVisibleColumn.colId;
        }
        // Fallback final se nada for encontrado
        if (!displayColId) displayColId = 'id';


        allRefRecords.forEach(record => {
            const optionText = record[displayColId] || `ID: ${record.id}`;
            const optionValue = record.id;
            const option = new Option(optionText, optionValue);
            
            if (cellValue != null && String(cellValue) === String(optionValue)) {
                option.selected = true;
            }
            select.add(option);
        });

        container.appendChild(select);
        return;
    }

    // --- LÓGICA PARA MODO DE VISUALIZAÇÃO ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }

    const [refSchema, refRecord] = await Promise.all([
        tableLens.getTableSchema(refTableId, { mode: 'raw' }),
        tableLens.fetchRecordById(refTableId, cellValue)
    ]);
    
    if (refRecord) {
        // CORREÇÃO: Usa a mesma lógica robusta aqui
        let displayColId;
        if (colSchema.displayCol) {
            const displayColInfo = Object.values(refSchema).find(c => c.id === colSchema.displayCol);
            if (displayColInfo) displayColId = displayColInfo.colId;
        }
        if (!displayColId) {
            const firstVisibleColumn = refSchema.find(c => !c.colId.startsWith('gristHelper_') && !c.isFormula);
            if (firstVisibleColumn) displayColId = firstVisibleColumn.colId;
        }
        if (!displayColId) displayColId = 'id';

        container.textContent = refRecord[displayColId] || `[Ref: ${cellValue}]`;
    } else {
        container.textContent = `[Ref Inválido: ${cellValue}]`;
    }
}