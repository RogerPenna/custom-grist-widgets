// libraries/grist-field-renderer/renderers/render-indicator-json.js

export function renderIndicatorJson(options) {
    const { container, cellValue, isEditing, onUpdate } = options;
    const MONTH_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    let data = {};
    try {
        data = typeof cellValue === 'string' ? JSON.parse(cellValue) : (cellValue || {});
    } catch (e) {
        console.error("Error parsing indicator JSON:", e);
    }

    // Default to current year if not specified
    const currentYear = new Date().getFullYear().toString();
    
    // Fallback para o editor também
    let yearData = data[currentYear];
    if (!yearData && (data.jan !== undefined || data.fev !== undefined)) {
        yearData = data;
    }
    yearData = yearData || {};

    if (!isEditing) {
        const values = MONTH_KEYS.map(m => yearData[m]).filter(v => v !== null && v !== undefined);
        container.textContent = values.length > 0 ? `${values.length} meses preenchidos em ${currentYear}` : "Vazio";
        return;
    }

    container.innerHTML = `
        <div class="indicator-editor">
            <div class="year-header">Ano: ${currentYear}</div>
            <div class="months-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;">
                ${MONTH_KEYS.map(m => `
                    <div class="month-input-group">
                        <label style="font-size: 10px; display: block; color: #666;">${m.toUpperCase()}</label>
                        <input type="number" class="month-input" data-month="${m}" value="${yearData[m] ?? ''}" style="width: 100%; box-sizing: border-box; padding: 4px;">
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const inputs = container.querySelectorAll('.month-input');
    inputs.forEach(input => {
        input.onchange = () => {
            const month = input.dataset.month;
            const val = input.value === '' ? null : parseFloat(input.value);
            
            if (!data[currentYear]) data[currentYear] = {};
            data[currentYear][month] = val;
            
            onUpdate(JSON.stringify(data));
        };
    });
}
