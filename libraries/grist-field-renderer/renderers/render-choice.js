// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing, displayAs = 'dropdown' } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const isList = colSchema.type === 'ChoiceList';

    if (!isEditing) {
        if (isList) {
            // Pills for ChoiceList
            const values = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [];
            if (values.length === 0) {
                container.textContent = '(vazio)';
                container.className = 'grf-readonly-empty';
                return;
            }
            values.forEach(val => {
                if (val) {
                    const pill = document.createElement('span');
                    pill.className = 'grf-choice-pill';
                    pill.textContent = val;
                    container.appendChild(pill);
                }
            });
        } else {
            // Plain text for single Choice
            container.textContent = String(cellValue);
        }
        return;
    }
    
    // ... Edit mode logic remains the same ...
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;
    // Add a blank option for single-choice fields
    if (!isList) {
        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = '-- Selecione --';
        select.appendChild(blankOption);
    }
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