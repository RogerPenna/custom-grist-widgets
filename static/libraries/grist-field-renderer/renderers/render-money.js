// libraries/grist-field-renderer/renderers/render-money.js

export function renderMoney(options) {
    const { container, cellValue, isEditing, fieldOptions } = options;
    const params = fieldOptions || {};
    
    if (isEditing) {
        container.innerHTML = `<input type="number" step="0.01" class="grf-form-input" value="${cellValue || ''}">`;
        const input = container.querySelector('input');
        input.onchange = () => options.onUpdate(parseFloat(input.value));
        return;
    }

    const value = parseFloat(cellValue);
    if (isNaN(value)) {
        container.innerHTML = cellValue || '';
        return;
    }

    const symbol = params.symbol || 'R$';
    const decimal = params.decimal || ',';
    const thousand = params.thousand || '.';
    
    // Simple money formatting
    const parts = value.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
    const formatted = symbol + ' ' + parts.join(decimal);

    container.innerHTML = `<span style="font-family: monospace; font-weight: 600;">${formatted}</span>`;
}
