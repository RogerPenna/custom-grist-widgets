// libraries/grist-field-renderer/renderers/render-text.js
export function renderText(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');

    if (!isEditing) {
        // Read-only mode
        if (wopts.widget === 'Markdown') {
            // WARNING: Use a sanitizing library like DOMPurify in a real app
            let html = String(cellValue || '').replace(/\n/g, '<br>');
            container.innerHTML = html;
        } else {
            container.textContent = String(cellValue);
        }
        return;
    }

    // Editing mode
    let input;
    if (wopts.widget === 'Markdown') {
        input = document.createElement('textarea');
        input.rows = 5;
    } else {
        input = document.createElement('input');
        if (colSchema.type === 'Numeric' || colSchema.type === 'Int') {
            input.type = 'number';
            input.step = (colSchema.type === 'Numeric') ? 'any' : '1';
        } else {
            input.type = 'text';
        }
    }
    input.className = 'grf-form-input';
    input.value = (cellValue === null || cellValue === undefined) ? '' : String(cellValue);
    input.dataset.colId = colSchema.colId;
    container.appendChild(input);
}