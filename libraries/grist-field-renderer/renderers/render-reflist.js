// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';

const dataWriter = new GristDataWriter(grist);

async function handleAdd(tableId, onUpdate) {
    const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
    openModal({
        title: `Adicionar em ${tableId}`,
        tableId: tableId,
        record: {},
        schema,
        onSave: async (newRecord) => {
            await dataWriter.addRecord(tableId, newRecord);
            onUpdate(); // This triggers the refresh
        }
    });
}

async function handleEdit(tableId, recordId, onUpdate) {
    const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
    const record = await tableLens.fetchRecordById(tableId, recordId);
    openModal({
        title: `Editando Registro ${recordId}`,
        tableId, record, schema,
        onSave: async (changes) => {
            await dataWriter.updateRecord(tableId, recordId, changes);
            onUpdate(); // This triggers the refresh
        }
    });
}

async function handleDelete(tableId, recordId, onUpdate) {
    if (confirm(`Tem certeza que deseja deletar o registro ${recordId}?`)) {
        await dataWriter.deleteRecords(tableId, [recordId]);
        onUpdate(); // This triggers the refresh
    }
}

export async function renderRefList(options) {
    const { container, record, colSchema, tableLens, ruleIdToColIdMap } = options;
    container.innerHTML = ''; // Start clean

    const referencedTableId = colSchema.type.split(':')[1];
    
    const renderContent = async () => {
        container.innerHTML = '<p>Loading child records...</p>';
        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        const relatedSchema = await tableLens.getTableSchema(referencedTableId, { mode: 'raw' });
        const ruleMap = new Map();
        relatedSchema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleMap.set(col.id, col.colId); } });

        container.innerHTML = ''; // Clear loading message

        // Create Header
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        const countSpan = document.createElement('span');
        countSpan.textContent = `(${relatedRecords.length} items)`;
        const addButton = document.createElement('button');
        addButton.textContent = `+ Adicionar`;
        addButton.onclick = () => handleAdd(referencedTableId, renderContent);
        header.appendChild(countSpan);
        header.appendChild(addButton);
        container.appendChild(header);

        // Create Table
        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        const thead = table.createTHead().insertRow();
        const columnsToDisplay = relatedSchema.filter(c => !c.colId.startsWith('gristHelper_'));
        columnsToDisplay.forEach(c => { const th = document.createElement('th'); th.textContent = c.label || c.colId; thead.appendChild(th); });
        const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thead.appendChild(thActions);
        
        const tbody = table.createTBody();
        for (const relRec of relatedRecords) {
            const tr = tbody.insertRow();
            for (const c of columnsToDisplay) {
                const td = tr.insertCell();
                // Recursively call main renderer for each cell
                renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleMap });
            }
            const actionsCell = tr.insertCell();
            actionsCell.className = 'actions-cell';
            const editBtn = document.createElement('button'); editBtn.innerHTML = '✏️';
            editBtn.onclick = () => handleEdit(referencedTableId, relRec.id, renderContent);
            const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '🗑️';
            deleteBtn.onclick = () => handleDelete(referencedTableId, relRec.id, renderContent);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        }
        container.appendChild(table);
    };

    await renderContent();
}