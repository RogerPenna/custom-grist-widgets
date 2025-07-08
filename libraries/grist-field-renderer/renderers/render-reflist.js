// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';

// These instances are now passed down, not created here. This improves testability.

// Action handlers now receive the data writer instance
async function handleAdd(tableId, onUpdate, dataWriter, tableLens, backRefCol, parentRecId) {
    const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });

    // Prepara um registro inicial com a referência ao pai já preenchida.
    // O modal pode usar isso para pré-selecionar o campo, se aplicável.
    const initialRecord = {};
    if (backRefCol && parentRecId) {
        initialRecord[backRefCol] = parentRecId;
    }

    openModal({
        title: `Adicionar em ${tableId}`, tableId, record: initialRecord, schema,
        onSave: async (newRecordFromForm) => {
            // Garante que a referência ao pai seja incluída antes de salvar.
            // Isso previne que o usuário remova acidentalmente a associação no formulário.
            const finalRecord = { ...newRecordFromForm };
            if (backRefCol && parentRecId) {
                finalRecord[backRefCol] = parentRecId;
            }
            await dataWriter.addRecord(tableId, finalRecord);
            onUpdate();
        }
    });
}
async function handleEdit(tableId, recordId, onUpdate, dataWriter, tableLens) {
    const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
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
    const { container, record, colSchema, tableLens, ruleIdToColIdMap } = options;
    const dataWriter = new GristDataWriter(grist); // Create instance here
    container.innerHTML = '';

    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort'; // Default sort
    let sortDirection = 'asc';

    const renderContent = async () => {
        container.innerHTML = '<p>Loading...</p>';
        let relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        
        // Sorting logic
        relatedRecords.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const relatedSchema = await tableLens.getTableSchema(referencedTableId, { mode: 'raw' });
        const ruleMap = new Map();
        relatedSchema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleMap.set(col.id, col.colId); } });
        container.innerHTML = '';

        // Header with Add button
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        const countSpan = document.createElement('span');
        countSpan.textContent = `(${relatedRecords.length} items)`;
        const addButton = document.createElement('button');
        addButton.textContent = `+ Adicionar`;
        header.appendChild(countSpan);
        header.appendChild(addButton);
        container.appendChild(header);

        // Table
        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        const thead = table.createTHead().insertRow();
        const columnsToDisplay = relatedSchema.filter(c => !c.colId.startsWith('gristHelper_'));
        columnsToDisplay.forEach(c => {
            const th = document.createElement('th');
            th.textContent = c.label || c.colId;
            th.style.cursor = 'pointer';
            th.onclick = () => {
                if (sortColumn === c.colId) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = c.colId;
                    sortDirection = 'asc';
                }
                renderContent(); // Re-render with new sort
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
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        }
        container.appendChild(table);

        // Attach event listeners AFTER elements are in the DOM
const primaryTableId = record.gristHelper_tableId;
const backReferenceColumn = relatedSchema.find(col => col.type === `Ref:${primaryTableId}`);
const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;

container.querySelector('.grf-reflist-header button').onclick = () => handleAdd(
    referencedTableId,
    renderContent,
    dataWriter,
    tableLens,
    backReferenceColId, // <-- Novo parâmetro
    record.id           // <-- Novo parâmetro
);

tbody.querySelectorAll('tr').forEach((tr, index) => {
            const rec = relatedRecords[index];
            tr.querySelector('.actions-cell button:nth-child(1)').onclick = () => handleEdit(referencedTableId, rec.id, renderContent, dataWriter, tableLens);
            tr.querySelector('.actions-cell button:nth-child(2)').onclick = () => handleDelete(referencedTableId, rec.id, renderContent, dataWriter);
        });
    };

    await renderContent();
}