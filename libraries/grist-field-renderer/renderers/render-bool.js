// libraries/grist-field-renderer/renderers/render-bool.js
export function renderBool(options) {
    const { container, colSchema, cellValue, isEditing, displayAs = 'checkmark' } = options;
    
    if (!isEditing) {
        container.textContent = cellValue ? '✓' : '☐';
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