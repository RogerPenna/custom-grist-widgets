// libraries/grist-drawer-component/drawer-component.js

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

const tableLens = new GristTableLens(grist);
let drawerPanel, drawerOverlay, drawerContent, drawerTitle;

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-drawer-component/drawer-style.css';
    document.head.appendChild(link);
    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';
    drawerPanel.innerHTML = `<div class="drawer-header"><h2 id="drawer-title">Record Details</h2><button class="drawer-close-btn">×</button></div><div class="drawer-content"><p>Loading...</p></div>`;
    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);
    drawerContent = drawerPanel.querySelector('.drawer-content');
    drawerTitle = drawerPanel.querySelector('#drawer-title');
    drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
}

/**
 * Opens the drawer to display a specific record.
 * @param {string} tableId - The ID of the table.
 * @param {number} recordId - The ID of the record to display.
 * @param {object} [options] - Optional settings.
 * @param {string[]} [options.columnsToShow] - Optional array of colIds to display. If omitted, all non-helper columns are shown.
 */
export async function openDrawer(tableId, recordId, options = {}) {
    if (!drawerPanel) _initializeDrawerDOM();
    const { columnsToShow } = options; // Get the new option

    drawerPanel.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawerContent.innerHTML = '<p>Loading...</p>';
    drawerTitle.textContent = `Record ${recordId} from ${tableId}`;

    try {
        const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
        const record = await tableLens.fetchRecordById(tableId, recordId);

        if (!record) {
            drawerContent.innerHTML = `<p style="color: red;">Error: Record with ID ${recordId} not found.</p>`;
            return;
        }

        const ruleIdToColIdMap = new Map();
        schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

        drawerContent.innerHTML = '';

        // =========================================================
        // ============= THE NEW, MORE ROBUST LOGIC ================
        // =========================================================
        let columnsToRender = schema.filter(col => !col.colId.startsWith('gristHelper_'));

        // If the caller provided a specific list of columns, filter by that list.
        if (Array.isArray(columnsToShow) && columnsToShow.length > 0) {
            // Create a Set for fast lookups
            const showSet = new Set(columnsToShow);
            columnsToRender = columnsToRender.filter(col => showSet.has(col.colId));
        }
        
        // Now, render whatever is in the final list.
        columnsToRender.forEach(colSchema => {
            const row = document.createElement('div');
            row.className = 'drawer-field-row';
            const label = document.createElement('label');
            label.className = 'drawer-field-label';
            label.textContent = colSchema.label || colSchema.colId;
            const valueContainer = document.createElement('div');
            valueContainer.className = 'drawer-field-value';
            row.appendChild(label);
            row.appendChild(valueContainer);
            drawerContent.appendChild(row);

            renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap });
        });

    } catch (error) {
        console.error("Error opening drawer:", error);
        drawerContent.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
    }
}

export function closeDrawer() {
    if (!drawerPanel) return;
    drawerPanel.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
}