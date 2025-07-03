// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';

// These instances are now passed down, not created here. This improves testability.

// Action handlers now receive the data writer instance
async function handleAdd(tableId, onUpdate, dataWriter, tableLens) {
    const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
    openModal({
        title: `Adicionar em ${tableId}`, tableId, record: {}, schema,
        onSave: async (newRecord) => {
            await dataWriter.addRecord(tableId, newRecord);
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
    const dataWriter = new GristDataWriter(grist);
    container.innerHTML = '';

    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort';
    let sortDirection = 'asc';
    let filterText = '';
    const PAGE_SIZE = 10; // How many records to show at once
    let visibleRecordsCount = PAGE_SIZE;

    const renderContent = async () => {
        container.innerHTML = '<p>Loading...</p>';
        const allRelatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        
        // Filter and Sort logic
        let filteredRecords = allRelatedRecords;
        if (filterText) { /* ... filtering logic ... */ }
        filteredRecords.sort((a, b) => { /* ... sorting logic ... */ });

        container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        const filterInput = document.createElement('input'); /* ... filter input setup ... */
        const addButton = document.createElement('button'); /* ... add button setup ... */
        header.appendChild(filterInput); header.appendChild(addButton);
        container.appendChild(header);

        // Table container with horizontal scroll
        const tableContainer = document.createElement('div');
        tableContainer.style.overflowX = 'auto';
        
        const table = document.createElement('table'); /* ... table setup ... */
        const tbody = table.createTBody();
        
        // Pagination: only render the visible slice of records
        const recordsToDisplay = filteredRecords.slice(0, visibleRecordsCount);

        for (const relRec of recordsToDisplay) { /* ... render rows and buttons ... */ }
        tableContainer.appendChild(table);
        container.appendChild(tableContainer);

        // Footer with pagination "View More" button
        if (filteredRecords.length > visibleRecordsCount) {
            const footer = document.createElement('div');
            footer.style.textAlign = 'center';
            footer.style.padding = '10px';
            const viewMoreBtn = document.createElement('button');
            viewMoreBtn.textContent = `Ver mais ${filteredRecords.length - visibleRecordsCount} registros`;
            viewMoreBtn.onclick = () => {
                visibleRecordsCount += PAGE_SIZE;
                renderContent();
            };
            footer.appendChild(viewMoreBtn);
            container.appendChild(footer);
        }
    };

    await renderContent();
}