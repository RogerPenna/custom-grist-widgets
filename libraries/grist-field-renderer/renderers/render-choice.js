// libraries/grist-field-renderer/renderers/render-choice.js

export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing, record, ruleIdToColIdMap } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const isList = colSchema.type === 'ChoiceList';

    if (!isEditing) {
        // Read-only mode
        if (isList) {
            const values = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [];
            if (values.length === 0) { container.textContent = '(vazio)'; return; }
            values.forEach(val => {
                if (val) {
                    const pill = document.createElement('span');
                    pill.className = 'grf-choice-pill';
                    pill.textContent = val;
                    // Apply choice-specific styling
                    const choiceOpt = wopts.choiceOptions?.[val];
                    if (choiceOpt?.fillColor) pill.style.backgroundColor = choiceOpt.fillColor;
                    if (choiceOpt?.textColor) pill.style.color = choiceOpt.textColor;
                    container.appendChild(pill);
                }
            });
        } else {
            // Plain text for single Choice, but now we apply styles
            container.textContent = String(cellValue);
            // Apply choice-specific styling
            const choiceOpt = wopts.choiceOptions?.[cellValue];
            if (choiceOpt) {
                if (choiceOpt.fillColor) container.style.backgroundColor = choiceOpt.fillColor;
                if (choiceOpt.textColor) container.style.color = choiceOpt.textColor;
            }
        }
        return;
    }
    
    // Editing Mode
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;
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