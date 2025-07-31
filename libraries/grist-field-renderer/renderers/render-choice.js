// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    // --- MUDANÇA 1: Extrai a nova opção styleOverride ---
    const { container, colSchema, cellValue, isEditing, isLocked, styleOverride = {} } = options;

    const wopts = colSchema.widgetOptions || {};
    const choices = wopts.choices || [];
    const choiceOptions = wopts.choiceOptions || {};
    const isList = colSchema.type === 'ChoiceList';
    const shouldApplyStyles = !styleOverride.ignoreCell; // Cria uma flag para facilitar a leitura

    // NOVO: Lógica para campos travados no modo de edição.
    // Simplesmente reutiliza a lógica do modo de visualização.
    if (isEditing && isLocked) {
        if (isList) {
            const values = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [];
            if (values.length === 0) { container.textContent = '(vazio)'; container.className = 'grf-readonly-empty'; }
            else {
                values.forEach(val => {
                    if (val) {
                        const pill = document.createElement('span'); pill.className = 'grf-choice-pill'; pill.textContent = val;
                        const style = choiceOptions[val];
                        // --- MUDANÇA 2: Verifica a flag antes de aplicar o estilo ---
                        if (shouldApplyStyles && style) { if (style.textColor) pill.style.color = style.textColor; if (style.fillColor) pill.style.backgroundColor = style.fillColor; if (style.fontBold) pill.style.fontWeight = 'bold'; }
                        container.appendChild(pill);
                    }
                });
            }
        } else {
            container.textContent = String(cellValue ?? '(vazio)');
            const style = choiceOptions[cellValue];
            // --- MUDANÇA 3: Verifica a flag antes de aplicar o estilo ---
            if (shouldApplyStyles && style) {
                if (style.textColor) container.style.color = style.textColor; if (style.fillColor) container.style.backgroundColor = style.fillColor; if (style.fontBold) container.style.fontWeight = 'bold';
                container.style.padding = style.fillColor ? '2px 8px' : ''; container.style.borderRadius = style.fillColor ? '12px' : ''; container.style.display = 'inline-block';
            }
        }
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        return;
    }

    // MODO VISUALIZAÇÃO
    if (!isEditing) {
        if (isList) {
            const values = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : [];
            if (values.length === 0) { container.textContent = '(vazio)'; container.className = 'grf-readonly-empty'; return; }
            values.forEach(val => {
                if (val) {
                    const pill = document.createElement('span'); pill.className = 'grf-choice-pill'; pill.textContent = val;
                    const style = choiceOptions[val];
                    // --- MUDANÇA 4: Verifica a flag antes de aplicar o estilo ---
                    if (shouldApplyStyles && style) { if (style.textColor) pill.style.color = style.textColor; if (style.fillColor) pill.style.backgroundColor = style.fillColor; if (style.fontBold) pill.style.fontWeight = 'bold'; }
                    container.appendChild(pill);
                }
            });
        } else {
            container.textContent = String(cellValue ?? '(vazio)');
            const style = choiceOptions[cellValue];
            // --- MUDANÇA 5: Verifica a flag antes de aplicar o estilo ---
            if (shouldApplyStyles && style) {
                if (style.textColor) container.style.color = style.textColor; if (style.fillColor) container.style.backgroundColor = style.fillColor; if (style.fontBold) container.style.fontWeight = 'bold';
                container.style.padding = style.fillColor ? '2px 8px' : ''; container.style.borderRadius = style.fillColor ? '12px' : ''; container.style.display = 'inline-block';
            }
        }
        return;
    }
    
    // MODO EDIÇÃO
    const select = document.createElement('select');
    select.className = 'grf-form-input';
    select.multiple = isList;
    select.dataset.colId = colSchema.colId;

    const applyStyle = (element, value) => {
        // --- MUDANÇA 6: A função de aplicar estilo agora respeita a flag ---
        if (!shouldApplyStyles) {
            element.style.backgroundColor = '';
            element.style.color = '';
            element.style.fontWeight = '';
            return;
        }
        const style = choiceOptions[value];
        if (element && style) {
            element.style.backgroundColor = style.fillColor || '';
            element.style.color = style.textColor || '';
            element.style.fontWeight = style.fontBold ? 'bold' : '';
        } else if (element) {
            element.style.backgroundColor = '';
            element.style.color = '';
            element.style.fontWeight = '';
        }
    };

    if (!isList) {
        select.add(new Option('-- Selecione --', ''));
        select.onchange = () => applyStyle(select, select.value);
    }

    choices.forEach(choice => {
        const option = new Option(choice, choice);
        applyStyle(option, choice);
        if (isList) {
            const currentValues = (Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.slice(1) : []).map(v => String(v));
            if (currentValues.includes(String(choice))) option.selected = true;
        } else {
            if (cellValue != null && String(cellValue) === String(choice)) option.selected = true;
        }
        select.appendChild(option);
    });

    if (!isList && cellValue) {
        applyStyle(select, cellValue);
    }

    container.appendChild(select);
}