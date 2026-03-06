// libraries/grist-field-renderer/renderers/render-text.js
export function renderText(options) {
    const { container, colSchema, cellValue, isEditing, isLocked } = options;
    // MUDANÇA: Aplica o padrão correto para acessar widgetOptions, preservando sua lógica.
    const wopts = colSchema.widgetOptions || {};

    // NOVO: Lógica para campos travados no modo de edição.
    // Se estiver em modo de edição e o campo estiver travado, renderiza como texto simples e para a execução.
    if (isEditing && isLocked) {
        if (wopts.widget === 'Markdown') {
            let html = String(cellValue || '').replace(/\n/g, '<br>');
            container.innerHTML = html; // Assume-se que o conteúdo já foi sanitizado anteriormente.
        } else {
            container.textContent = String(cellValue ?? '(vazio)');
        }
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        return;
    }

    if (!isEditing) {
        // Read-only mode
        if (wopts.widget === 'Markdown') {
            // WARNING: Use a sanitizing library like DOMPurify in a real app
            let html = String(cellValue || '').replace(/\n/g, '<br>');
            container.innerHTML = html;
        } else {
            // To render line breaks, we replace newline characters with <br> tags.
            // We must also escape any existing HTML in the cell value to prevent XSS.
            const textValue = String(cellValue ?? '');
            const tempDiv = document.createElement('div');
            tempDiv.textContent = textValue;
            const escapedHtml = tempDiv.innerHTML;
            const finalHtml = escapedHtml.replace(/\n/g, '<br>');
            container.innerHTML = finalHtml || '(vazio)';
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