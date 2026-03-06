// libraries/grist-field-renderer/renderers/render-color-picker.js
export function renderColorPicker(options) {
    const { container, cellValue, isEditing, isLocked } = options;

    if (isEditing && !isLocked) {
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'grf-form-input';
        input.dataset.colId = options.colSchema.colId;
        input.value = (cellValue === null || cellValue === undefined) ? '#000000' : String(cellValue);
        container.appendChild(input);
    } else {
        const colorBox = document.createElement('div');
        colorBox.className = 'grf-color-box';
        colorBox.style.backgroundColor = String(cellValue ?? '#FFFFFF');
        container.appendChild(colorBox);

        const colorText = document.createElement('span');
        colorText.textContent = String(cellValue ?? '(vazio)');
        container.appendChild(colorText);

        if (isLocked) {
            container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        }
    }
}
