// libraries/grist-field-renderer/renderers/render-bool.js
export function renderBool(options) {
    const { container, colSchema, cellValue, isEditing, isLocked } = options;
    const wopts = colSchema.widgetOptions || {};
    const displayAs = wopts.widget?.toLowerCase() || 'checkmark';

    // A condição primária: o campo é verdadeiramente editável?
    const isEditable = isEditing && !isLocked && !colSchema.isFormula;

    // Se NÃO for editável, renderizamos um estado de visualização e paramos.
    // Isso cobre modo de visualização, campos travados E campos de fórmula.
    if (!isEditable) {
        // Para consistência, o switch desabilitado é mostrado se for o widget.
        if (isEditing && displayAs === 'switch') {
             container.classList.add('grf-contains-switch');
             const label = document.createElement('label');
             label.className = 'grf-switch';
             const input = document.createElement('input');
             input.type = 'checkbox';
             input.checked = !!cellValue;
             input.disabled = true; // Desabilitado
             // NENHUM data-col-id é adicionado
             const slider = document.createElement('span');
             slider.className = 'grf-slider round';
             label.appendChild(input);
             label.appendChild(slider);
             container.appendChild(label);
        } else {
            // Para todos os outros casos não editáveis, mostrar texto.
            container.textContent = cellValue ? '✓ Sim' : '☐ Não';
            container.style.fontFamily = 'monospace';
        }
        
        // Aplica feedback visual se necessário
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
        input.dataset.colId = colSchema.colId; // OK para adicionar, pois é editável
        const slider = document.createElement('span');
        slider.className = 'grf-slider round';
        label.appendChild(input);
        label.appendChild(slider);
        container.appendChild(label);

    } else if (displayAs === 'textbox') {
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId; // OK para adicionar, pois é editável
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
        input.dataset.colId = colSchema.colId; // OK para adicionar, pois é editável
        container.appendChild(input);
    }
}