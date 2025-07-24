// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

// Estilos injetados (sem alteração)
(function() {
    if (document.getElementById('grf-reflist-styles')) return;
    const style = document.createElement('style');
    style.id = 'grf-reflist-styles';
    style.textContent = `
        .grf-reflist-table .actions-cell { position: relative; text-align: center; width: 50px; }
        .reflist-action-menu-btn { background: none; border: none; cursor: pointer; font-size: 1.2em; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        .reflist-action-menu-btn:hover { background-color: #f0f0f0; }
        .reflist-action-menu-dropdown { display: none; position: absolute; left: 100%; top: 0; background-color: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 100; min-width: 120px; }
        .reflist-action-menu-dropdown.is-open { display: block; }
        .reflist-action-menu-item { padding: 8px 12px; cursor: pointer; font-size: 0.9em; display: flex; align-items: center; gap: 8px; }
        .reflist-action-menu-item:hover { background-color: #007bff; color: white; }
    `;
    document.head.appendChild(style);
})();

// Funções de manipulação (handleEdit, handleDelete, handleAdd) permanecem as mesmas
async function handleAdd(options) {
    const { 
        tableId, onUpdate, dataWriter, tableLens, backRefCol, 
        parentRecId, parentTableId, parentRefListColId, parentRecord
    } = options;
    if (!parentRecId || typeof parentRecId !== 'number' || parentRecId <= 0) {
        alert("Ação 'Adicionar' bloqueada: O registro pai não tem um ID válido.");
        return;
    }
    const schema = await tableLens.getTableSchema(tableId);
    const initialRecord = {};
    if (backRefCol && parentRecId) { initialRecord[backRefCol] = parentRecId; }
    openModal({
        title: `Adicionar em ${tableId}`, tableId, record: initialRecord, schema,
        onSave: async (newRecordFromForm) => {
            const finalRecord = { ...newRecordFromForm };
            if (backRefCol && parentRecId) { finalRecord[backRefCol] = parentRecId; }
            const result = await dataWriter.addRecord(tableId, finalRecord);
            if (!result || !Array.isArray(result.retValues) || !result.retValues[0]) {
                throw new Error("Falha ao criar o registro filho. A API do Grist não retornou um ID válido.");
            }
            const newChildId = result.retValues[0];
            const refListValue = parentRecord[parentRefListColId];
            const existingChildIds = (Array.isArray(refListValue) && refListValue[0] === 'L') ? refListValue.slice(1) : [];
            const updatedChildIds = ['L', ...existingChildIds, newChildId];
            parentRecord[parentRefListColId] = updatedChildIds;
            dataWriter.updateRecord(parentTableId, parentRecId, { [parentRefListColId]: updatedChildIds });
            publish('data-changed', { tableId: parentTableId, recordId: parentRecId, action: 'update' });
            onUpdate();
        }
    });
}

async function handleEdit(tableId, recordId, onUpdate, dataWriter, tableLens) {
    const schema = await tableLens.getTableSchema(tableId);
    const record = await tableLens.fetchRecordById(tableId, recordId);
    openModal({
        title: `Editando Registro ${recordId}`, tableId, record, schema,
        onSave: async (changes) => {
            await dataWriter.updateRecord(tableId, recordId, changes);
            onUpdate();
        }
    });
}

async function handleDelete(tableId, recordId, onUpdate, dataWriter) {
    if (confirm(`Tem certeza?`)) {
        await dataWriter.deleteRecords(tableId, [recordId]);
        onUpdate();
    }
}


export async function renderRefList(options) {
    // NOVO: `fieldConfig` é extraído das opções. 
    // Ele será passado pelo despachante `grist-field-renderer`.
    const { container, record, colSchema, tableLens, isLocked, fieldConfig } = options;
    const dataWriter = new GristDataWriter(grist);
    container.innerHTML = '';
    if (isLocked) {
        container.closest('.drawer-field')?.classList.add('is-locked-style');
    }
    
    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort';
    let sortDirection = 'asc';
    
    const closeAllMenus = () => {
        document.querySelectorAll('.reflist-action-menu-dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
        });
    };

    const renderContent = async () => {
        container.innerHTML = '<p>Carregando...</p>';
        let relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        
        relatedRecords.sort((a, b) => {
            const valA = a[sortColumn]; const valB = b[sortColumn];
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const relatedSchema = await tableLens.getTableSchema(referencedTableId);
        const relatedSchemaAsArray = Object.values(relatedSchema);
        const ruleMap = new Map();
        relatedSchemaAsArray.forEach(col => { if (col && col.colId?.startsWith('gristHelper_')) { ruleMap.set(col.id, col.colId); } });
        
        container.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        const countSpan = document.createElement('span');
        countSpan.textContent = `(${relatedRecords.length} itens)`;
        const addButton = document.createElement('button');
        addButton.textContent = `+ Adicionar`;
        if (isLocked) { addButton.disabled = true; addButton.title = "Este campo está travado..."; }
        header.appendChild(countSpan);
        header.appendChild(addButton);
        container.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'grf-reflist-table-container';
        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        const thead = table.createTHead().insertRow();

        // --- INÍCIO DA LÓGICA DE SELEÇÃO DE COLUNAS ---
        const allPossibleCols = relatedSchemaAsArray.filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        let columnsToDisplay;

        if (fieldConfig && fieldConfig.length > 0) {
            // Se a configuração foi fornecida, use-a.
            const schemaMap = new Map(allPossibleCols.map(c => [c.colId, c]));
            columnsToDisplay = fieldConfig.map(colId => schemaMap.get(colId)).filter(Boolean); // .filter(Boolean) remove colunas que não existem mais
        } else {
            // Fallback: mostra todas as colunas se nenhuma configuração for encontrada.
            columnsToDisplay = allPossibleCols;
        }
        // --- FIM DA LÓGICA DE SELEÇÃO DE COLUNAS ---

        const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thead.appendChild(thActions);
        
        columnsToDisplay.forEach(c => {
            const th = document.createElement('th');
            th.textContent = c.label || c.colId;
            th.style.cursor = 'pointer';
            th.onclick = () => {
                sortColumn = c.colId;
                sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc';
                renderContent();
            };
            thead.appendChild(th);
        });
        
        const tbody = table.createTBody();
        for (const relRec of relatedRecords) {
            const tr = tbody.insertRow();
            const actionsCell = tr.insertCell();
            actionsCell.className = 'actions-cell';
            
            const menuBtn = document.createElement('button');
            menuBtn.className = 'reflist-action-menu-btn';
            menuBtn.innerHTML = '☰'; 
            menuBtn.disabled = isLocked;
            
            const dropdown = document.createElement('div');
            dropdown.className = 'reflist-action-menu-dropdown';
            dropdown.innerHTML = `
                <div class="reflist-action-menu-item" data-action="edit">✏️ Editar</div>
                <div class="reflist-action-menu-item" data-action="delete">🗑️ Deletar</div>
            `;
            
            actionsCell.appendChild(menuBtn);
            actionsCell.appendChild(dropdown);

            // O loop agora usa `columnsToDisplay`, que pode ser a lista filtrada ou a lista completa.
            for (const c of columnsToDisplay) {
                const td = tr.insertCell();
                renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleMap });
            }
        }
        tableContainer.appendChild(table);
        container.appendChild(tableContainer);

        const primaryTableId = record.gristHelper_tableId;
        const backReferenceColumn = relatedSchemaAsArray.find(col => col && col.type === `Ref:${primaryTableId}`);
        const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;

        container.querySelector('.grf-reflist-header button').onclick = () => handleAdd({
            tableId: referencedTableId, onUpdate: renderContent, dataWriter, tableLens,
            backRefCol: backReferenceColId, parentRecId: record.id, parentTableId: primaryTableId,
            parentRefListColId: colSchema.colId, parentRecord: record
        });

        tbody.querySelectorAll('tr').forEach((tr, index) => {
            const rec = relatedRecords[index];
            const menuBtn = tr.querySelector('.reflist-action-menu-btn');
            const dropdown = tr.querySelector('.reflist-action-menu-dropdown');
            
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isAlreadyOpen = dropdown.classList.contains('is-open');
                closeAllMenus();
                if (!isAlreadyOpen) { dropdown.classList.add('is-open'); }
            });

            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.closest('.reflist-action-menu-item')?.dataset.action;
                if (action === 'edit') handleEdit(referencedTableId, rec.id, renderContent, dataWriter, tableLens);
                else if (action === 'delete') handleDelete(referencedTableId, rec.id, renderContent, dataWriter);
                closeAllMenus();
            });
        });
    };

    document.addEventListener('click', closeAllMenus);
    container.addEventListener('remove', () => document.removeEventListener('click', closeAllMenus));

    await renderContent();
}