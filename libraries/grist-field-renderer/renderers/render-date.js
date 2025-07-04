// libraries/grist-field-renderer/renderers/render-date.js

/**
 * Formata um objeto Date para uma string, baseado em um formato simples.
 * Substitui YYYY, MM, DD. Não é uma biblioteca completa, mas atende à necessidade.
 * @param {Date} date O objeto Date a ser formatado.
 * @param {string} format O formato, ex: "DD/MM/YYYY".
 * @returns {string} A data formatada.
 */
function formatDate(date, format) {
    if (!date || isNaN(date)) return '';
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    // Moment.js-like tokens, but very basic
    return format
        .replace('YYYY', year)
        .replace('MM', String(month).padStart(2, '0'))
        .replace('DD', String(day).padStart(2, '0'));
}

export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    const wopts = colSchema.widgetOptions || {};

    // Grist armazena timestamps em segundos. JS Date usa milissegundos.
    const date = cellValue ? new Date(cellValue * 1000) : null;
    
    if (isEditing) {
        const isDateTime = colSchema.type.startsWith('DateTime');
        const input = document.createElement('input');
        input.type = isDateTime ? 'datetime-local' : 'date';
        input.className = 'grf-form-input';
        input.dataset.colId = colSchema.colId;

        if (date) {
            // CRÍTICO: Para evitar o bug "off-by-one-day" no input, criamos uma data
            // que "engana" o fuso horário local, tratando a data UTC como se fosse local.
            // Ex: 2025-07-10 00:00:00Z vira 2025-07-10 00:00:00 no fuso do usuário.
            // Isso garante que .toISOString() nos dará a string correta.
            const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
            
            // Um <input type="date"> quer "YYYY-MM-DD"
            // Um <input type="datetime-local"> quer "YYYY-MM-DDTHH:mm"
            const sliceEnd = isDateTime ? 16 : 10;
            input.value = localDate.toISOString().slice(0, sliceEnd);
        }
        
        container.appendChild(input);
        return;
    }
    
    // Modo de visualização
    if (!date) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }

    // Se houver um formato de data definido no Grist, use-o.
    if (wopts.dateFormat) {
        // A função formatDate espera uma data "corrigida" para UTC.
        // O `date` original já está correto para essa finalidade.
        container.textContent = formatDate(date, wopts.dateFormat);
    } else {
        // Fallback para um formato padrão
        container.textContent = colSchema.type.startsWith('DateTime') 
            ? date.toLocaleString() 
            : date.toLocaleDateString();
    }
}