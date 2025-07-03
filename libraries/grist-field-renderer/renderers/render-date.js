// libraries/grist-field-renderer/renderers/render-date.js
export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    
    if (isEditing) {
        const input = document.createElement('input');
        input.type = colSchema.type.startsWith('DateTime') ? 'datetime-local' : 'date';
        input.className = 'grf-form-input';
        if (cellValue) {
            // JavaScript Date needs milliseconds, Grist provides seconds
            const d = new Date(cellValue * 1000);
            // We need to adjust for the timezone offset to avoid being off by one day
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            input.value = d.toISOString().slice(0, 16);
        }
        input.dataset.colId = colSchema.colId;
        container.appendChild(input);
        return;
    }
    
    // Read-only mode
    if (!cellValue) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    const date = new Date(cellValue * 1000);
    container.textContent = colSchema.type.startsWith('DateTime') ? date.toLocaleString() : date.toLocaleDateString();
}