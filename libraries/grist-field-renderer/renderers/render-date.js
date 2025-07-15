// libraries/grist-field-renderer/renderers/render-date.js

export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing, isLocked } = options;
    const wopts = colSchema.widgetOptions || {};
    const isDateTime = colSchema.type.startsWith('DateTime');

    // Grist armazena timestamps em segundos. JS Date usa milissegundos.
    const date = cellValue ? new Date(cellValue * 1000) : null;

    // NOVO: Lógica para campos travados no modo de edição.
    // Usa a mesma lógica de renderização do modo de visualização.
    if (isEditing && isLocked) {
        if (!date) {
            container.textContent = '(vazio)';
            container.className = 'grf-readonly-empty';
        } else if (isDateTime) {
            container.textContent = date.toLocaleString();
        } else {
            const dateFormat = wopts.dateFormat || 'DD/MM/YYYY';
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth() + 1;
            const day = date.getUTCDate();
            container.textContent = dateFormat
                .replace(/YYYY/g, year)
                .replace(/MM/g, String(month).padStart(2, '0'))
                .replace(/DD/g, String(day).padStart(2, '0'));
        }
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        return;
    }
    
    // 1. LÓGICA PARA MODO DE EDIÇÃO
    if (isEditing) {
        const input = document.createElement('input');
        input.type = isDateTime ? 'datetime-local' : 'date';
        input.className = 'grf-form-input';
        input.dataset.colId = colSchema.colId;

        if (date) {
            if (isDateTime) {
                // Para DateTime, queremos o valor no fuso LOCAL do usuário.
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                // Para Date, queremos o valor do calendário UTC.
                const year = date.getUTCFullYear();
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const day = String(date.getUTCDate()).padStart(2, '0');
                input.value = `${year}-${month}-${day}`;
            }
        }
        container.appendChild(input);
        return;
    }
    
    // 2. LÓGICA PARA MODO DE VISUALIZAÇÃO
    if (!date) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    if (isDateTime) {
        container.textContent = date.toLocaleString();
    } else {
        const dateFormat = wopts.dateFormat || 'DD/MM/YYYY';
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        
        container.textContent = dateFormat
            .replace(/YYYY/g, year)
            .replace(/MM/g, String(month).padStart(2, '0'))
            .replace(/DD/g, String(day).padStart(2, '0'));
    }
}