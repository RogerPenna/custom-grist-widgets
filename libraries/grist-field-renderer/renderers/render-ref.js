// libraries/grist-field-renderer/renderers/render-ref.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';

export async function renderRef(options) {
    // MODIFICADO: Adicionado 'isLocked' à desestruturação das opções
    const { container, colSchema, cellValue, tableLens, isEditing, isLocked, record } = options;

    if (!container || !colSchema || !colSchema.type) {
        container.textContent = `[Schema Inválido]`;
        return;
    }
    
    const refTableId = colSchema.type.split(':')[1];
    if (!refTableId) {
        container.textContent = `[Tipo Ref inválido: ${colSchema.type}]`;
        return;
    }

    // NOVO: Lógica para campos travados no modo de edição.
    // Reutiliza a lógica de visualização, que já é assíncrona.
    if (isEditing && isLocked) {
        if (cellValue == null || cellValue <= 0) {
            container.textContent = '(vazio)';
            container.className = 'grf-readonly-empty';
        } else {
            const { displayValue } = await tableLens.resolveReference(colSchema, record);
            container.textContent = displayValue;
        }
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        return;
    }

    // --- MODO DE EDIÇÃO (LÓGICA ORIGINAL PRESERVADA) ---
    if (isEditing) {
        const wrapper = document.createElement('div');
        wrapper.className = 'grf-ref-edit-wrapper';
        wrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
        `;

        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.dataset.colId = colSchema.colId;
        select.style.flex = '1';
        select.add(new Option('-- Selecione --', ''));

        // Busca o schema e os registros da tabela de destino
        const [refSchema, allRefRecords] = await Promise.all([
            tableLens.getTableSchema(refTableId),
            tableLens.fetchTableRecords(refTableId)
        ]);
        
        // --- INÍCIO DA LÓGICA DE DESCOBERTA (AGORA CORRETA) ---
        let finalDisplayColId = null;
        const displayColIdNum = colSchema.displayCol;

        if (displayColIdNum) {
            // Busca o schema da tabela de ORIGEM (onde a coluna helper está).
            const sourceTableId = record.gristHelper_tableId;
            if (sourceTableId) {
                const sourceSchema = await tableLens.getTableSchema(sourceTableId);
                const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);

                if (displayColHelperSchema) {
                    // Se for uma fórmula de referência, extrai o nome da coluna final.
                    if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                        finalDisplayColId = displayColHelperSchema.formula.split('.').pop();
                    } else {
                        // Se a displayCol não for uma fórmula de ref, assume que é o colId direto.
                        finalDisplayColId = displayColHelperSchema.colId;
                    }
                }
            }
        }
        // --- FIM DA LÓGICA DE DESCOBERTA ---
        
        // Fallback se a lógica acima falhar
        if (!finalDisplayColId) {
            const firstSensibleColumn = Object.values(refSchema).find(c => c && c.type === 'Text' && !c.isFormula);
            finalDisplayColId = firstSensibleColumn ? firstSensibleColumn.colId : 'id';
        }

        // Preenche o dropdown usando o finalDisplayColId correto
        allRefRecords.forEach(rec => {
            const optionText = rec[finalDisplayColId] || `ID: ${rec.id}`;
            const optionValue = rec.id;
            const option = new Option(optionText, optionValue);
            option.selected = cellValue != null && String(cellValue) === String(optionValue);
            select.add(option);
        });

        // Botão para criar novo registro
        const addBtn = document.createElement('button');
        addBtn.className = 'grf-ref-add-btn';
        addBtn.type = 'button';
        addBtn.title = 'Criar novo registro';
        addBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px; height:16px;"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>`;
        addBtn.style.cssText = `
            display: flex; align-items: center; justify-content: center;
            width: 28px; height: 28px; border-radius: 50%;
            border: 1px solid #cbd5e1; background: #ffffff; color: #475569;
            cursor: pointer; transition: all 0.2s; flex-shrink: 0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        `;
        addBtn.onmouseover = () => { addBtn.style.background = '#f8fafc'; addBtn.style.borderColor = '#94a3b8'; addBtn.style.color = '#1e293b'; };
        addBtn.onmouseout = () => { addBtn.style.background = '#ffffff'; addBtn.style.borderColor = '#cbd5e1'; addBtn.style.color = '#475569'; };

        addBtn.onclick = async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const dataWriter = (tableLens && tableLens.docApi) ? new GristDataWriter(tableLens.docApi) : new GristDataWriter(window.grist);
            const rSchema = await tableLens.getTableSchema(refTableId);
            
            openModal({
                title: `Criar em ${refTableId}`,
                tableId: refTableId,
                record: {},
                schema: rSchema,
                tableLens,
                onSave: async (newRecordFromForm) => {
                    const result = await dataWriter.addRecord(refTableId, newRecordFromForm);
                    const newRecordId = result.retValues[0];
                    
                    const newRecord = await tableLens.fetchRecordById(refTableId, newRecordId);
                    const optionText = (newRecord && newRecord[finalDisplayColId]) || `ID: ${newRecordId}`;
                    
                    const option = new Option(optionText, newRecordId);
                    option.selected = true;
                    select.add(option);
                    select.value = newRecordId;
                    
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        };

        wrapper.appendChild(select);
        wrapper.appendChild(addBtn);
        container.appendChild(wrapper);
        return;
    }

    // --- MODO DE VISUALIZAÇÃO (LÓGICA ORIGINAL PRESERVADA) ---
    if (cellValue == null || cellValue <= 0) {
        container.textContent = '(vazio)';
        container.className = 'grf-readonly-empty';
        return;
    }
    
    const { displayValue } = await tableLens.resolveReference(colSchema, record);
    container.textContent = displayValue;
}