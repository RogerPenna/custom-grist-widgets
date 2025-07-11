// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';

async function handleAdd(tableId, onUpdate, dataWriter, tableLens, backRefCol, parentRecId) {
    // MUDANÇA: Usa 'clean' para passar para o modal.
    const schema = await tableLens.getTableSchema(tableId, { mode: 'clean' });
    const initialRecord = {};
    if (backRefCol && parentRecId) { initialRecord[backRefCol] = parentRecId; }
    openModal({
        title: `Adicionar em ${tableId}`, tableId, record: initialRecord, schema,
        onSave: async (newRecordFromForm) => {
            const finalRecord = { ...newRecordFromForm };
            if (backRefCol && parentRecId) { finalRecord[backRefCol] = parentRecId; }
            await dataWriter.addRecord(tableId, finalRecord);
            setTimeout(() => onUpdate(), 250);
        }
    });
}
async function handleEdit(tableId, recordId, onUpdate, dataWriter, tableLens) {
    // MUDANÇA: Usa 'clean' para passar para o modal.
    const schema = await tableLens.getTableSchema(tableId, { mode: 'clean' });
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

        // MUDANÇA: Usa 'clean' e converte para array para iterar.
        const relatedSchema = await tableLens.getTableSchema(referencedTableId, { mode: 'clean' });
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

        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        const thead = table.createTHead().insertRow();
        // MUDANÇA: Filtra a partir do array.
        const columnsToDisplay = relatedSchemaAsArray.filter(c => c && !c.colId.startsWith('gristHelper_'));
        columnsToDisplay.forEach(c => {
            const th = document.createElement('th');
            th.textContent = c.label || c.colId;
            th.style.cursor = 'pointer';
            th.onclick = () => {
                sortColumn = c.colId;
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                renderContent();
            };
            thead.appendChild(th);
        });
        const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thead.appendChild(thActions);
        
        const tbody = table.createTBody();
        for (const relRec of relatedRecords) {
            const tr = tbody.insertRow();
            for (const c of columnsToDisplay) {
                const td = tr.insertCell();
                renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleMap });
            }
            const actionsCell = tr.insertCell();
            actionsCell.className = 'actions-cell';
            const editBtn = document.createElement('button'); editBtn.innerHTML = '✏️';
            const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '🗑️';
            actionsCell.appendChild(editBtn); actionsCell.appendChild(deleteBtn);
        }
        container.appendChild(table);

        const primaryTableId = record.gristHelper_tableId;
        // MUDANÇA: Busca a coluna de referência no array.
        const backReferenceColumn = relatedSchemaAsArray.find(col => col && col.type === `Ref:${primaryTableId}`);
        const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;

        container.querySelector('.grf-reflist-header button').onclick = () => handleAdd(referencedTableId, renderContent, dataWriter, tableLens, backReferenceColId, record.id);
        tbody.querySelectorAll('tr').forEach((tr, index) => {
            const rec = relatedRecords[index];
            tr.querySelector('.actions-cell button:nth-child(1)').onclick = () => handleEdit(referencedTableId, rec.id, renderContent, dataWriter, tableLens);
            tr.querySelector('.actions-cell button:nth-child(2)').onclick = () => handleDelete(referencedTableId, rec.id, renderContent, dataWriter);
        });
    };
    await renderContent();
}