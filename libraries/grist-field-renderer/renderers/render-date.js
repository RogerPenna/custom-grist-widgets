// libraries/grist-field-renderer/renderers/render-date.js

/**
 * A simple helper to format a date object according to Grist's dateFormat option.
 * A production app might use a more robust library like date-fns.
 * @param {Date} date - The JavaScript Date object.
 * @param {string} format - The format string (e.g., 'YYYY-MM-DD').
 * @returns {string} The formatted date string.
 */
function formatDate(date, format) {
    // If no format is provided, use a sensible default
    if (!format) return date.toLocaleDateString();

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = date.getUTCFullYear();

    return format
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day);
}

export function renderDate(options) {
    const { container, colSchema, cellValue, isEditing } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    
    // --- RENDER EDIT MODE ---
    if (isEditing) {
        const input = document.createElement('input');
        const isDateTime = colSchema.type.startsWith('DateTime');
        input.type = isDateTime ? 'datetime-local' : 'date';
        input.className = 'grf-form-input';

        if (cellValue) {
            // Grist stores timestamps as seconds in UTC. JS Date uses milliseconds.
            const d = new Date(cellValue * 1000);
            
            // To correctly populate a local time input, we must format the UTC date
            // into an ISO-like string that the input understands, WITHOUT timezone conversion.
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const minutes = String(d.getUTCMinutes()).padStart(2, '0');

            if (isDateTime) {
                input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                input.value = `${year}-${month}-${day}`;
            }
        }
        
        input.dataset.colId = colSchema.colId;
        container.appendChild(input);
        return;
    }
    
    // --- RENDER READ-ONLY MODE ---
    if (!cellValue) {
        container.textContent = '(vazio)';
        container.className += ' grf-readonly-empty';
        return;
    }

    const date = new Date(cellValue * 1000);
    const isDateTime = colSchema.type.startsWith('DateTime');

    if (isDateTime) {
        // For DateTime, a localized string is usually best.
        container.textContent = date.toLocaleString();
    } else {
        // For Date, respect the format defined in Grist's widgetOptions.
        container.textContent = formatDate(date, wopts.dateFormat);
    }
}