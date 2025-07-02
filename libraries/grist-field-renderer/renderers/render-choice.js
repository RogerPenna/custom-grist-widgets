// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { content, colSchema, cellValue, isEditing, displayAs } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const isList = colSchema.type === 'ChoiceList';
    
    if (!isEditing) {
        const values = isList ? (Array.isArray(cellValue) ? cellValue.slice(1) : []) : [cellValue];
        values.forEach(val => {
            const pill = document.createElement('span');
            pill.className = 'grf-choice-pill';
            pill.textContent = val;
            content.appendChild(pill);
        });
        return;
    }

    // Editing Mode
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;
    choices.forEach(choice => {
        const option = document.createElement('option');
        option.value = choice;
        option.textContent = choice;
        if (isList) {
            if (Array.isArray(cellValue) && cellValue.includes(choice)) option.selected = true;
        } else {
            if (cellValue === choice) option.selected = true;
        }
        select.appendChild(option);
    });
    container.appendChild(select);
}