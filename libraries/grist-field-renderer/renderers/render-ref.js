// libraries/grist-field-renderer/renderers/render-ref.js
export async function renderRef(options) {
    const { content, colSchema, cellValue, tableLens } = options;
    const refTableId = colSchema.type.split(':')[1];
    const refRecord = await tableLens.fetchRecordById(refTableId, cellValue);
    if (refRecord) {
        const refSchema = await tableLens.getTableSchema(refTableId, { mode: 'raw' });
        const displayCol = refSchema.find(c => c.id === colSchema.displayCol);
        content.textContent = displayCol ? refRecord[displayCol.colId] : `[Ref: ${cellValue}]`;
    } else {
        content.textContent = `[Ref Inválido: ${cellValue}]`;
    }
}