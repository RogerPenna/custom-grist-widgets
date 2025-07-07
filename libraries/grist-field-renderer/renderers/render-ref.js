// libraries/grist-field-renderer/renderers/render-ref.js
export async function renderRef(options) {
    // CORREÇÃO: Espera 'container' em vez de 'content' e é mais robusto.
    const { container, colSchema, cellValue, tableLens } = options;

    // Garante que não quebre se o container não for passado.
    if (!container) return;

    // O cellValue para um Ref é o ID do registro referenciado.
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    const refRecord = await tableLens.fetchRecordById(refTableId, cellValue);
    
    if (refRecord) {
        const refSchema = await tableLens.getTableSchema(refTableId, { mode: 'raw' });
        const displayCol = refSchema.find(c => c.id === colSchema.displayCol);
        container.textContent = displayCol ? refRecord[displayCol.colId] : `[Ref: ${cellValue}]`;
    } else {
        container.textContent = `[Ref Inválido: ${cellValue}]`;
    }
}