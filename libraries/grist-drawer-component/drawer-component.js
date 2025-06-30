// libraries/grist-drawer-component/drawer-component.js

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

// ... (all the code inside is correct) ...
const tableLens = new GristTableLens(grist);
let drawerPanel, drawerOverlay, drawerContent, drawerTitle;
function _initializeDrawerDOM() { if (document.getElementById('grist-drawer-panel')) return; const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../libraries/grist-drawer-component/drawer-style.css'; document.head.appendChild(link); drawerOverlay = document.createElement('div'); drawerOverlay.id = 'grist-drawer-overlay'; drawerPanel = document.createElement('div'); drawerPanel.id = 'grist-drawer-panel'; drawerPanel.innerHTML = `<div class="drawer-header"><h2 id="drawer-title">Record Details</h2><button class="drawer-close-btn">×</button></div><div class="drawer-content"><p>Loading...</p></div>`; document.body.appendChild(drawerOverlay); document.body.appendChild(drawerPanel); drawerContent = drawerPanel.querySelector('.drawer-content'); drawerTitle = drawerPanel.querySelector('#drawer-title'); drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer); drawerOverlay.addEventListener('click', closeDrawer); }
export async function openDrawer(tableId, recordId) { if (!drawerPanel) _initializeDrawerDOM(); drawerPanel.classList.add('is-open'); drawerOverlay.classList.add('is-open'); drawerContent.innerHTML = '<p>Loading...</p>'; drawerTitle.textContent = `Record ${recordId}`; try { const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' }); const record = await tableLens.fetchRecordById(tableId, recordId); if (!record) { drawerContent.innerHTML = `<p style="color: red;">Error: Record with ID ${recordId} not found in table ${tableId}.</p>`; return; } const ruleIdToColIdMap = new Map(); schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } }); drawerContent.innerHTML = ''; schema.filter(col => col.visibleCol > 0 && !col.colId.startsWith('gristHelper_')).forEach(colSchema => { const row = document.createElement('div'); row.className = 'drawer-field-row'; const label = document.createElement('label'); label.className = 'drawer-field-label'; label.textContent = colSchema.label || colSchema.colId; const valueContainer = document.createElement('div'); valueContainer.className = 'drawer-field-value'; row.appendChild(label); row.appendChild(valueContainer); drawerContent.appendChild(row); renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap }); }); } catch (error) { console.error("Error opening drawer:", error); drawerContent.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`; } }
export function closeDrawer() { if (!drawerPanel) return; drawerPanel.classList.remove('is-open'); drawerOverlay.classList.remove('is-open'); }


// =================================================================
// ============== CRITICAL FIX: Remove window assignment ===========
// =================================================================
// This is no longer needed because widgets will import openDrawer directly.
// window.GristDrawer = {
//     open: openDrawer,
//     close: closeDrawer
// };