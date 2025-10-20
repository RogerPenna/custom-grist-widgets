import { GristTableLens } from '/libraries/grist-table-lens/grist-table-lens.js';
import { publish } from '/libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', async function () {
    const tableContainer = document.getElementById('table-container');
    let config = {};

    grist.ready({ requiredAccess: 'full' });

    const configId = window.grfConfig?.configId;

    const configureBtn = document.createElement('button');
    configureBtn.textContent = 'Configure';
    configureBtn.style.position = 'absolute';
    configureBtn.style.top = '10px';
    configureBtn.style.right = '10px';
    configureBtn.onclick = () => {
        const configManagerUrl = new URL('/ConfigManager/index.html', window.location.origin);
        if (configId) {
            configManagerUrl.searchParams.set('configId', configId);
        }
        window.open(configManagerUrl, '_blank');
    };
    document.body.appendChild(configureBtn);

    if (configId) {
        const tableLens = new GristTableLens(grist);
        config = await tableLens.getConfig(configId);
    }

    grist.onRecords(function (records) {
        if (records.length === 0) {
            tableContainer.innerHTML = '<p>No records to display.</p>';
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        const columns = config.columns && config.columns.length > 0 ? config.columns : Object.keys(records[0]);

        // Create table headers
        const headerRow = document.createElement('tr');
        columns.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Create table rows
        records.forEach(record => {
            const row = document.createElement('tr');
            row.dataset.recordId = record.id;
            columns.forEach(header => {
                const cell = document.createElement('td');
                cell.textContent = record[header];
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);

        if (config.onRowClickAction) {
            tbody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('click', () => {
                    const recordId = row.dataset.recordId;
                    publish('grf-open-drawer', { drawerId: config.onRowClickAction, recordId: recordId });
                });
            });
        }
    });
});