// libraries/grist-field-renderer/renderers/render-bool.js
export function renderBool(options) {
    const { container, colSchema, cellValue, isEditing, isLocked } = options;
    const wopts = colSchema.widgetOptions || {};
    const displayAs = wopts.widget?.toLowerCase() || 'checkmark';

    // A condição primária: o campo é verdadeiramente editável?
    const isEditable = isEditing && !isLocked && !colSchema.isFormula;

    // Se NÃO for editável (visualização, travado, ou FÓRMULA), renderiza e para.
    if (!isEditable) {
        // Para consistência visual no modo de edição, mostramos o switch desabilitado.
        if (isEditing && displayAs === 'switch') {
             container.classList.add('grf-contains-switch');
             const label = document.createElement('label');
             label.className = 'grf-switch';
             const input = document.createElement('input');
             input.type = 'checkbox';
             input.checked = !!cellValue;
             input.disabled = true;
             // **A CORREÇÃO CRUCIAL: NENHUM 'data-col-id' é adicionado aqui.**
             const slider = document.createElement('span');
             slider.className = 'grf-slider round';
             label.appendChild(input);
             label.appendChild(slider);
             container.appendChild(label);
        } else {
            // Para todos os outros casos não editáveis, mostrar texto simples.
            container.textContent = cellValue ? '✓ Sim' : '☐ Não';
            container.style.fontFamily = 'monospace';
        }
        
        // Aplica feedback visual se necessário.
        if (isLocked) container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        if (colSchema.isFormula && isEditing) container.closest('.drawer-field-value')?.classList.add('is-disabled');
        
        return; // Fim da execução para campos não editáveis.
    }

    // A partir daqui, o campo é 100% editável.
    
    if (displayAs === 'switch') {
        container.classList.add('grf-contains-switch');
        const label = document.createElement('label');
        label.className = 'grf-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!cellValue;
        input.dataset.colId = colSchema.colId; // OK para adicionar, pois é editável.
        const slider = document.createElement('span');
        slider.className = 'grf-slider round';
        label.appendChild(input);
        label.appendChild(slider);
        container.appendChild(label);
    } else if (displayAs === 'textbox') {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId; // OK para adicionar.
        const optionDefault = new Option('-- Selecione --', '');
        const optionYes = new Option('Sim', 'true');
        const optionNo = new Option('Não', 'false');
        select.add(optionDefault);
        select.add(optionYes);
        select.add(optionNo);
        if (cellValue === true) select.value = 'true';
        else if (cellValue === false) select.value = 'false';
        container.appendChild(select);
    } else { // Padrão: 'checkmark' (Checkbox)
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!cellValue;
        input.dataset.colId = colSchema.colId; // OK para adicionar.
        container.appendChild(input);
    }
}