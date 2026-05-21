// libraries/grist-field-renderer/renderers/render-text.js
export function renderText(options) {
    const { container, colSchema, cellValue, isEditing, isLocked, tableLens } = options;
    const wopts = colSchema.widgetOptions || {};

    if (isEditing && isLocked) {
        if (wopts.widget === 'Markdown') {
            let html = String(cellValue || '').replace(/\n/g, '<br>');
            container.innerHTML = html;
        } else {
            const isNumeric = colSchema.type === 'Numeric' || colSchema.type === 'Int';
            container.textContent = (isNumeric && tableLens) ? tableLens.formatValue(cellValue, colSchema) : String(cellValue ?? '(vazio)');
        }
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        return;
    }

    if (!isEditing) {
        // Read-only mode
        if (wopts.widget === 'Markdown') {
            let html = String(cellValue || '').replace(/\n/g, '<br>');
            container.innerHTML = html;
        } else {
            const isNumeric = colSchema.type === 'Numeric' || colSchema.type === 'Int';
            if (isNumeric && tableLens) {
                container.textContent = tableLens.formatValue(cellValue, colSchema);
            } else {
                const textValue = String(cellValue ?? '');
                const tempDiv = document.createElement('div');
                tempDiv.textContent = textValue;
                const escapedHtml = tempDiv.innerHTML;
                const finalHtml = escapedHtml.replace(/\n/g, '<br>');
                container.innerHTML = finalHtml || '(vazio)';
            }
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
            // No modo de edição, permitimos qualquer precisão para entrada
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