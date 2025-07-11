// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

async function handleAdd(options) {
    const { tableId, onUpdate, dataWriter, tableLens, backRefCol, parentRecId, parentTableId, parentRefListColId } = options;

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
            
            // Etapa 1: Adiciona o novo registro filho
            const result = await dataWriter.addRecord(tableId, finalRecord);

            // =========================================================================
            // A CORREÇÃO FINAL ESTÁ AQUI
            // O ID não vem de result.id, mas de result.retValues[0]
            // =========================================================================
            if (!result || !result.retValues || !result.retValues[0]) {
                throw new Error("Falha ao criar o registro filho. A API do Grist não retornou um ID válido.");
            }
            const newChildId = result.retValues[0];
            
            // Etapa 2: Atualiza o registro PAI
            const parentRecord = await tableLens.fetchRecordById(parentTableId, parentRecId);
            const refListValue = parentRecord[parentRefListColId];
            const existingChildIds = (Array.isArray(refListValue) && refListValue[0] === 'L')
                ? refListValue.slice(1)
                : [];
            
            const updatedChildIds = ['L', ...existingChildIds, newChildId];
            
            await dataWriter.updateRecord(parentTableId, parentRecId, { [parentRefListColId]: updatedChildIds });
            
            publish('data-changed', { tableId: parentTableId, recordId: parentRecId, action: 'update' });
            onUpdate();
        }
    });
}

// O resto do arquivo (handleEdit, handleDelete, renderRefList) permanece o mesmo.
// Se precisar do código completo, eu posso fornecer, mas a única mudança necessária é na função handleAdd.
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
    const { container, record, colSchema, tableLens } = options;
    const dataWriter = new GristDataWriter(grist);
    container.innerHTML = '';
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
        container.querySelector('.grf-reflist-header button').onclick = () => handleAdd({
            tableId: referencedTableId,
            onUpdate: renderContent,
            dataWriter,
            tableLens,
            backRefCol: backReferenceColId,
            parentRecId: record.id,
            parentTableId: primaryTableId,
            parentRefListColId: colSchema.colId,
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