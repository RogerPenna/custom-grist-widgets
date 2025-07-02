// libraries/grist-field-renderer/renderers/render-date.js
export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    const date = new Date(cellValue * 1000);
    if (!isEditing) {
        content.textContent = colSchema.type === 'DateTime' ? date.toLocaleString() : date.toLocaleDateString();
        return;
    }
    const input = document.createElement('input');
    input.type = colSchema.type === 'DateTime' ? 'datetime-local' : 'date';
    input.className = 'grf-form-input';
    // Input format requires 'YYYY-MM-DD'
    input.value = date.toISOString().slice(0, 16);
    input.dataset.colId = colSchema.colId;
    container.appendChild(input);
}