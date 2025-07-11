// libraries/grist-field-renderer/renderers/render-bool.js
export function renderBool(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    // MUDANÇA: Aplica o padrão correto para acessar widgetOptions, caso seja usado no futuro.
    const wopts = colSchema.widgetOptions || {};

    // A sua lógica usa o `widget` property de wopts para decidir o display.
    const displayAs = wopts.widget?.toLowerCase() === 'switch' ? 'switch' : 'checkmark';

    if (!isEditing) {
        // MUDANÇA: Um display mais claro para o modo visualização.
        container.textContent = cellValue ? '✓ Sim' : '☐ Não';
        container.style.fontFamily = 'monospace'; // Melhora alinhamento
        return;
    }
    
    // Editing mode
    if (displayAs === 'switch') {
        const label = document.createElement('label');
        label.className = 'grf-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!cellValue;
        input.dataset.colId = colSchema.colId;
        const slider = document.createElement('span');
        slider.className = 'grf-slider round';
        label.appendChild(input);
        label.appendChild(slider);
        container.appendChild(label);
    } else { // Default to checkbox
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!cellValue;
        input.dataset.colId = colSchema.colId;
        container.appendChild(input);
    }
}