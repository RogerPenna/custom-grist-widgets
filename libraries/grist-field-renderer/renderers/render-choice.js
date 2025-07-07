// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing } = options;

    // =================================================================
    // ========= CORREÇÃO: JSON.parse() é restaurado aqui também =======
    // =================================================================
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const choiceOptions = wopts.choiceOptions || {}; // Para as cores
    const isList = colSchema.type === 'ChoiceList';

    if (!isEditing) {
        if (isList) {
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
                    const style = choiceOptions[val];
                    if (style) {
                        if (style.textColor) pill.style.color = style.textColor;
                        if (style.fillColor) pill.style.backgroundColor = style.fillColor;
                        if (style.fontBold) pill.style.fontWeight = 'bold';
                    }
                    container.appendChild(pill);
                }
            });
        } else {
            container.textContent = String(cellValue ?? '(vazio)');
            const style = choiceOptions[cellValue];
            if (style) {
                if (style.textColor) container.style.color = style.textColor;
                if (style.fillColor) container.style.backgroundColor = style.fillColor;
                if (style.fontBold) container.style.fontWeight = 'bold';
                container.style.padding = style.fillColor ? '2px 8px' : '';
                container.style.borderRadius = style.fillColor ? '12px' : '';
                container.style.display = 'inline-block';
            }
        }
        return;
    }
    
    // O modo de edição permanece o mesmo, pois já está funcionando
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
            const currentValues = (Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [])
                .map(v => String(v));
            if (currentValues.includes(String(choice))) {
                option.selected = true;
            }
        } else {
            if (cellValue != null && String(cellValue) === String(choice)) {
                option.selected = true;
            }
        }
        select.appendChild(option);
    });
    container.appendChild(select);
}