// libraries/grist-field-renderer/renderers/render-text.js
export function renderText(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    if (!isEditing) {
        content.textContent = String(cellValue);
        return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'grf-form-input';
    input.value = cellValue !== null ? String(cellValue) : '';
    input.dataset.colId = colSchema.colId;
    container.appendChild(input);
}