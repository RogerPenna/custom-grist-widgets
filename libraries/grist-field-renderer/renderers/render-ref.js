// libraries/grist-field-renderer/renderers/render-ref.js

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing } = options;

    if (!container) return;
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // --- LÓGICA PARA MODO DE EDIÇÃO (MODAL/DRAWER) ---
    if (isEditing) {
        // Para um campo de referência, vamos criar um dropdown (<select>)
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;

        // Adiciona uma opção padrão "vazia"
        select.add(new Option('-- Selecione --', ''));

        // Busca todos os registros da tabela referenciada para popular o dropdown
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId, { mode: 'raw' }),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // Encontra a coluna que deve ser usada para exibição (o "visibleCol")
        const displayColInfo = refSchema.find(c => c.id === colSchema.displayCol);
        const displayColId = displayColInfo ? displayColInfo.colId : null;

        allRefRecords.forEach(record => {
            // O texto da opção é o valor da "display column". Se não houver, usa o ID.
            const optionText = displayColId ? record[displayColId] : `ID: ${record.id}`;
            // O valor da opção é SEMPRE o ID do registro.
            const optionValue = record.id;
            
            const option = new Option(optionText, optionValue);
            
            // Se o ID deste registro corresponde ao valor atual do campo, seleciona-o.
            if (cellValue != null && String(cellValue) === String(optionValue)) {
                option.selected = true;
            }
            select.add(option);
        });

        container.appendChild(select);
        return;
    }

    // --- LÓGICA PARA MODO DE VISUALIZAÇÃO (sem alterações, mas agora confirmada) ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }

    // Busca o registro específico para obter o texto de exibição
    const [refSchema, refRecord] = await Promise.all([
        tableLens.getTableSchema(refTableId, { mode: 'raw' }),
        tableLens.fetchRecordById(refTableId, cellValue)
    ]);
    
    if (refRecord) {
        const displayColInfo = refSchema.find(c => c.id === colSchema.displayCol);
        const displayColId = displayColInfo ? displayColInfo.colId : null;
        // Mostra o texto da "display column" ou um fallback.
        container.textContent = displayColId ? refRecord[displayColId] : `[Ref: ${cellValue}]`;
    } else {
        container.textContent = `[Ref Inválido: ${cellValue}]`;
    }
}