// libraries/grist-drawer-component/drawer-component.js

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

const tableLens = new GristTableLens(grist);
let drawerPanel, drawerOverlay, drawerContent, drawerTitle, drawerHeader;

function _initializeDrawerDOM() {
    if (document.getElementById('grist-drawer-panel')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-drawer-component/drawer-style.css'; // Adjust path if needed
    document.head.appendChild(link);
    
    // Add extra CSS for switches and tabs
    const style = document.createElement('style');
    style.textContent = `
        .switch{position:relative;display:inline-block;width:34px;height:20px}.switch input{opacity:0;width:0;height:0}
        .slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#ccc;transition:.4s}
        .slider:before{position:absolute;content:"";height:12px;width:12px;left:4px;bottom:4px;background-color:white;transition:.4s}
        input:checked+.slider{background-color:#2196F3}input:focus+.slider{box-shadow:0 0 1px #2196F3}
        input:checked+.slider:before{transform:translateX(14px)}.slider.round{border-radius:20px}.slider.round:before{border-radius:50%}
        .drawer-tabs{display:flex;border-bottom:1px solid #e0e0e0;flex-shrink:0;}
        .drawer-tab{padding:10px 15px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
        .drawer-tab.is-active{font-weight:bold;color:#007bff;border-bottom-color:#007bff;}
        .drawer-tab-content{display:none;padding:20px;}.drawer-tab-content.is-active{display:block;}
    `;
    document.head.appendChild(style);

    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';
    // Updated HTML structure for buttons and tabs
    drawerPanel.innerHTML = `
        <div class="drawer-header">
            <h2 id="drawer-title">Record Details</h2>
            <div>
                <button class="drawer-edit-btn">Edit</button>
                <button class="drawer-save-btn" style="display:none;">Save</button>
                <button class="drawer-close-btn">×</button>
            </div>
        </div>
        <div class="drawer-body">
            <div class="drawer-tabs"></div>
            <div class="drawer-tab-panels"></div>
        </div>
    `;
    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);
    drawerHeader = drawerPanel.querySelector('.drawer-header');
    drawerTitle = drawerPanel.querySelector('#drawer-title');
    drawerPanel.querySelector('.drawer-close-btn').addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
}

function _switchToTab(tabElement, panelElement) {
    drawerPanel.querySelectorAll('.drawer-tab.is-active').forEach(t => t.classList.remove('is-active'));
    drawerPanel.querySelectorAll('.drawer-tab-content.is-active').forEach(p => p.classList.remove('is-active'));
    tabElement.classList.add('is-active');
    panelElement.classList.add('is-active');
}

export async function openDrawer(tableId, recordId, options = {}) {
    if (!drawerPanel) _initializeDrawerDOM();
    document.body.classList.add('grist-drawer-is-open');
	drawerPanel.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawerHeader.nextElementSibling.querySelector('.drawer-tabs').innerHTML = '<div class="drawer-tab is-active">Loading...</div>';
    drawerHeader.nextElementSibling.querySelector('.drawer-tab-panels').innerHTML = '';
    drawerTitle.textContent = `Record ${recordId}`;

    try {
        const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
        const record = await tableLens.fetchRecordById(tableId, recordId);
        if (!record) throw new Error(`Record ${recordId} not found.`);

        const ruleIdToColIdMap = new Map();
        schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

        // Clear loading state
        const tabsContainer = drawerHeader.nextElementSibling.querySelector('.drawer-tabs');
        const panelsContainer = drawerHeader.nextElementSibling.querySelector('.drawer-tab-panels');
        tabsContainer.innerHTML = '';
        panelsContainer.innerHTML = '';

        // TODO: This grouping logic should be driven by a configuration object in the future.
        // For now, we create one default tab.
        const tabs = { "Main": schema.filter(col => !col.colId.startsWith('gristHelper_')) };

        Object.entries(tabs).forEach(([tabName, cols], index) => {
            const tabEl = document.createElement('div');
            tabEl.className = 'drawer-tab';
            tabEl.textContent = tabName;
            
            const panelEl = document.createElement('div');
            panelEl.className = 'drawer-tab-content';
            
            tabsContainer.appendChild(tabEl);
            panelsContainer.appendChild(panelEl);

            if (index === 0) {
                tabEl.classList.add('is-active');
                panelEl.classList.add('is-active');
            }
            tabEl.onclick = () => _switchToTab(tabEl, panelEl);

            cols.forEach(colSchema => {
                const row = document.createElement('div');
                row.className = 'drawer-field-row';
                const label = document.createElement('label');
                label.className = 'drawer-field-label';
                label.textContent = colSchema.label || colSchema.colId;
                const valueContainer = document.createElement('div');
                valueContainer.className = 'drawer-field-value';
                row.appendChild(label);
                row.appendChild(valueContainer);
                panelEl.appendChild(row);

                renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap });
            });
        });

    } catch (error) {
        console.error("Error opening drawer:", error);
        panelsContainer.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
    }
}

export function closeDrawer() {
    if (!drawerPanel) return;
    document.body.classList.remove('grist-drawer-is-open');
	drawerPanel.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
}