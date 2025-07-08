// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing } = options;

    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const choiceOptions = wopts.choiceOptions || {};
    const isList = colSchema.type === 'ChoiceList';

    // MODO VISUALIZAÇÃO (Já está correto, sem alterações)
    if (!isEditing) {
        if (isList) {
            const values = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [];
            if (values.length === 0) { container.textContent = '(vazio)'; container.className = 'grf-readonly-empty'; return; }
            values.forEach(val => {
                if (val) {
                    const pill = document.createElement('span'); pill.className = 'grf-choice-pill'; pill.textContent = val;
                    const style = choiceOptions[val];
                    if (style) { if (style.textColor) pill.style.color = style.textColor; if (style.fillColor) pill.style.backgroundColor = style.fillColor; if (style.fontBold) pill.style.fontWeight = 'bold'; }
                    container.appendChild(pill);
                }
            });
        } else {
            container.textContent = String(cellValue ?? '(vazio)');
            const style = choiceOptions[cellValue];
            if (style) {
                if (style.textColor) container.style.color = style.textColor; if (style.fillColor) container.style.backgroundColor = style.fillColor; if (style.fontBold) container.style.fontWeight = 'bold';
                container.style.padding = style.fillColor ? '2px 8px' : ''; container.style.borderRadius = style.fillColor ? '12px' : ''; container.style.display = 'inline-block';
            }
        }
        return;
    }
    
    // MODO EDIÇÃO (LÓGICA FINAL E COMPLETA)
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;

    // Função auxiliar para aplicar estilo ao <select> ou <option>
    const applyStyle = (element, value) => {
        const style = choiceOptions[value];
        if (element && style) {
            element.style.backgroundColor = style.fillColor || '';
            element.style.color = style.textColor || '';
            element.style.fontWeight = style.fontBold ? 'bold' : '';
        } else if (element) {
            // Limpa o estilo se não houver um definido
            element.style.backgroundColor = '';
            element.style.color = '';
            element.style.fontWeight = '';
        }
    };

    if (!isList) {
        select.add(new Option('-- Selecione --', ''));
        // Evento onchange para atualizar a cor do select
        select.onchange = () => applyStyle(select, select.value);
    }

    choices.forEach(choice => {
        const option = new Option(choice, choice);
        
        // Aplica estilo a cada <option> individual (melhor prática)
        applyStyle(option, choice);

        if (isList) {
            const currentValues = (Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : []).map(v => String(v));
            if (currentValues.includes(String(choice))) option.selected = true;
        } else {
            if (cellValue != null && String(cellValue) === String(choice)) {
                option.selected = true;
            }
        }
        select.appendChild(option);
    });

    // Aplica o estilo inicial ao select com base no valor atual
    if (!isList && cellValue) {
        applyStyle(select, cellValue);
    }

    container.appendChild(select);
}