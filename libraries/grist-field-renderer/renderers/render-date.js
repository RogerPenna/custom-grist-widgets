// libraries/grist-field-renderer/renderers/render-date.js

/**
 * Formata um objeto Date para uma string, usando seus componentes UTC.
 * Isso evita qualquer problema de fuso horário na exibição.
 * @param {Date} date O objeto Date a ser formatado.
 * @param {string} format O formato, ex: "DD/MM/YYYY".
 * @returns {string} A data formatada.
 */
function formatDate(date, format) {
    if (!date || isNaN(date)) return '';
    // Usa sempre os componentes UTC para evitar o bug de "um dia a menos".
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    // Substituições básicas, podem ser expandidas se necessário.
    return format
        .replace(/YYYY/g, year)
        .replace(/MM/g, String(month).padStart(2, '0'))
        .replace(/DD/g, String(day).padStart(2, '0'));
}

export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    const wopts = colSchema.widgetOptions || {};
    const isDateTime = colSchema.type.startsWith('DateTime');

    // Grist armazena timestamps em segundos. JS Date usa milissegundos.
    const date = cellValue ? new Date(cellValue * 1000) : null;
    
    if (isEditing) {
        const input = document.createElement('input');
        input.type = isDateTime ? 'datetime-local' : 'date';
        input.className = 'grf-form-input';
        input.dataset.colId = colSchema.colId;

        if (date) {
            // A lógica para preencher o input no modo de edição já está correta.
            const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
            const sliceEnd = isDateTime ? 16 : 10;
            input.value = localDate.toISOString().slice(0, sliceEnd);
        }
        
        container.appendChild(input);
        return;
    }
    
    // =================================================================
    // ========= CORREÇÃO DEFINITIVA PARA A VISUALIZAÇÃO DA DATA =======
    // =================================================================
    if (!date) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }

    // Determina o formato a ser usado, com um fallback sensato.
    const dateFormat = wopts.dateFormat || 'DD/MM/YYYY';

    if (isDateTime) {
        const timeFormat = wopts.timeFormat || 'HH:mm'; // Ex: HH:mm
        
        // Formata a data e a hora usando componentes UTC.
        const datePart = formatDate(date, dateFormat);
        const timePart = timeFormat
            .replace(/HH/g, String(date.getUTCHours()).padStart(2, '0'))
            .replace(/mm/g, String(date.getUTCMinutes()).padStart(2, '0'))
            .replace(/ss/g, String(date.getUTCSeconds()).padStart(2, '0'));

        container.textContent = `${datePart} ${timePart}`;

    } else {
        // Para campos de Data, usa apenas a nossa função de formatação segura.
        container.textContent = formatDate(date, dateFormat);
    }
}