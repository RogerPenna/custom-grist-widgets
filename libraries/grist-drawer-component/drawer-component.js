// libraries/grist-drawer-component/drawer-component.js

// This assumes your Grist widget can import modules.
// If not, you'd include these scripts with <script> tags and use global objects.
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

// Initialize a single instance of the Lens for the drawer to use.
const tableLens = new GristTableLens(grist);

let drawerPanel, drawerOverlay, drawerContent, drawerTitle;

/**
 * Creates the drawer's HTML structure and appends it to the body.
 * This should only be called once.
 */
function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return; // Already initialized

    // Add CSS link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-drawer-component/drawer-style.css'; // Adjust path if needed
    document.head.appendChild(link);

    // Create overlay
    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    
    // Create panel
    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';
    drawerPanel.innerHTML = `
        <div class="drawer-header">
            <h2 id="drawer-title">Record Details</h2>
            <button class="drawer-close-btn">×</button>
        </div>
        <div class="drawer-content">
            <p>Loading...</p>
        </div>
    `;

    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);
    
    // Get references to dynamic parts
    drawerContent = drawerPanel.querySelector('.drawer-content');
    drawerTitle = drawerPanel.querySelector('#drawer-title');

    // Add close events
    drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
}

/**
 * Opens the drawer to display a specific record.
 * This is the main public function.
 * @param {string} tableId - The ID of the table.
 * @param {number} recordId - The ID of the record to display.
 */
export async function openDrawer(tableId, recordId) {
    if (!drawerPanel) _initializeDrawerDOM();

    drawerPanel.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawerContent.innerHTML = '<p>Loading...</p>';
    drawerTitle.textContent = `Record ${recordId}`;

    try {
        const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
        const record = await tableLens.fetchRecordById(tableId, recordId);

        if (!record) {
            drawerContent.innerHTML = `<p style="color: red;">Error: Record with ID ${recordId} not found in table ${tableId}.</p>`;
            return;
        }

        const ruleIdToColIdMap = new Map();
        schema.forEach(col => {
            if (col.colId?.startsWith('gristHelper_')) {
                ruleIdToColIdMap.set(col.id, col.colId);
            }
        });

        drawerContent.innerHTML = ''; // Clear "Loading..."

        // Render only user-visible columns
        schema
            .filter(col => col.visibleCol > 0 && !col.colId.startsWith('gristHelper_'))
            .forEach(colSchema => {
                // Create the layout for a field row
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

                // Ask the Field Renderer to do the heavy lifting
                renderField({
                    container: valueContainer,
                    colSchema,
                    record,
                    tableLens,
                    ruleIdToColIdMap
                });
            });

    } catch (error) {
        console.error("Error opening drawer:", error);
        drawerContent.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
    }
}

/**
 * Closes the drawer.
 */
export function closeDrawer() {
    if (!drawerPanel) return;
    drawerPanel.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
}

// Expose the drawer API to the global window object so other widgets can call it.
window.GristDrawer = {
    open: openDrawer,
    close: closeDrawer
};