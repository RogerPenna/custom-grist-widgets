// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

async function handleAdd(options) {
    const { 
        tableId, onUpdate, dataWriter, tableLens, backRefCol, 
        parentRecId, parentTableId, parentRefListColId, 
        parentRecord // O registro pai, que é a fonte da verdade local
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
            const existingChildIds = (Array.isArray(refListValue) && refListValue[0] === 'L')
                ? refListValue.slice(1)
                : [];
            
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
    // NOVO: Adiciona isLocked às opções.
    const { container, record, colSchema, tableLens, isLocked } = options;
    const dataWriter = new GristDataWriter(grist);
    container.innerHTML = '';

    // NOVO: Adiciona estilo se o campo estiver travado
    if (isLocked) {
        // Aplica ao contêiner principal do campo, não apenas ao valor
        container.closest('.drawer-field')?.classList.add('is-locked-style');
    }
    
    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort';
    let sortDirection = 'asc';
    
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

        // NOVO: Desabilita o botão "Adicionar" se o campo estiver travado.
        if (isLocked) {
            addButton.disabled = true;
            addButton.title = "Este campo está travado e não pode ser modificado.";
        }

        header.appendChild(countSpan);
        header.appendChild(addButton);
        container.appendChild(header);
        const tableContainer = document.createElement('div');
        tableContainer.className = 'grf-reflist-table-container';
        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        const thead = table.createTHead().insertRow();
        const columnsToDisplay = relatedSchemaAsArray.filter(c => c && !c.colId.startsWith('gristHelper_'));
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
            const editBtn = document.createElement('button'); editBtn.innerHTML = '✏️'; editBtn.title = 'Editar';
            const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '🗑️'; deleteBtn.title = 'Deletar';

            // NOVO: Desabilita os botões de ação se o campo estiver travado.
            if (isLocked) {
                editBtn.disabled = true;
                deleteBtn.disabled = true;
            }

            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
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

        // Anexa o evento ao botão (mesmo que desabilitado, não causa erro).
        container.querySelector('.grf-reflist-header button').onclick = () => handleAdd({
            tableId: referencedTableId,
            onUpdate: renderContent,
            dataWriter,
            tableLens,
            backRefCol: backReferenceColId,
            parentRecId: record.id,
            parentTableId: primaryTableId,
            parentRefListColId: colSchema.colId,
            parentRecord: record
        });
        tbody.querySelectorAll('tr').forEach((tr, index) => {
            const rec = relatedRecords[index];
            const cell = tr.querySelector('.actions-cell');
            cell.querySelector('button:nth-child(1)').onclick = () => handleEdit(referencedTableId, rec.id, renderContent, dataWriter, tableLens);
            cell.querySelector('button:nth-child(2)').onclick = () => handleDelete(referencedTableId, rec.id, renderContent, dataWriter);
        });
    };
    await renderContent();
}