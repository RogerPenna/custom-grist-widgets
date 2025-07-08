// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing } = options;

    // CORREÇÃO CRÍTICA: Analisa a string widgetOptions para um objeto JS
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const choiceOptions = wopts.choiceOptions || {}; // Objeto com as cores
    const isList = colSchema.type === 'ChoiceList';

    // MODO VISUALIZAÇÃO
    if (!isEditing) {
        if (isList) {
            // Lógica para renderizar pílulas de ChoiceList
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
                    // Aplica cores da pílula baseadas no choiceOptions
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
            // Lógica para formatar Choice único
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
    
    // MODO EDIÇÃO (Esta parte já funciona, sem alterações)
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;

    if (!isList) {
        select.add(new Option('-- Selecione --', ''));
    }

    choices.forEach(choice => {
        const option = new Option(choice, choice);
        if (isList) {
            const currentValues = (Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [])
                .map(v => String(v));
            if (currentValues.includes(String(choice))) option.selected = true;
        } else {
            if (cellValue != null && String(cellValue) === String(choice)) option.selected = true;
        }
        select.appendChild(option);
    });
    container.appendChild(select);
}