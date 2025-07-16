// custom-grist-widgets/TesteDebug/debug-widget-main.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', function () {
    // 1. Get references to all the HTML elements
    const loadingMessageEl = document.getElementById('loadingMessage');
    const tableInfoContainerEl = document.getElementById('tableInfoContainer');
    const tableNameEl = document.getElementById('tableName');
    const columnCountEl = document.getElementById('columnCount');
    const schemaTableEl = document.getElementById('schemaTable');
    const schemaTableHeadEl = schemaTableEl.querySelector('thead tr');
    const schemaTableBodyEl = schemaTableEl.querySelector('tbody');
    const fieldControlsContainerEl = document.getElementById('fieldControlsContainer');
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableEl = document.getElementById('recordsTable');
    const recordsTableHeadEl = recordsTableEl.querySelector('thead tr');
    const recordsTableBodyEl = recordsTableEl.querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');
    const tableSelectorEl = document.getElementById('tableSelector');
    // NOVO: Referência para o novo contêiner de controles globais
    const globalControlsContainerEl = document.getElementById('globalControlsContainer');


    // 2. Initialize state variables
    const tableLens = new GristTableLens(grist);
    let currentTableId;
    let isRendering = false;
    let debounceTimer;

    // Estados para as opções do drawer
    let fieldsToLock = [];
    let fieldsToHide = [];
    let styleOverrides = {};
    let selectedDrawerWidth = '50%'; // NOVO: Estado para a largura do drawer

    // 3. Define helper functions
    function applyGristCellStyles(cellElement, rawColumnSchema, record, ruleIdToColIdMap) {
        cellElement.style.color = ''; cellElement.style.backgroundColor = ''; cellElement.style.fontWeight = '';
        cellElement.style.fontStyle = ''; cellElement.style.textAlign = '';
        if(rawColumnSchema.widgetOptions) { try { const wopts = JSON.parse(rawColumnSchema.widgetOptions); if (wopts.alignment) { cellElement.style.textAlign = wopts.alignment; } } catch(e) {} }
        if (rawColumnSchema.rules && Array.isArray(rawColumnSchema.rules) && rawColumnSchema.rules[0] === 'L') {
            const ruleOptions = JSON.parse(rawColumnSchema.widgetOptions || '{}').rulesOptions || [];
            const ruleIdList = rawColumnSchema.rules.slice(1);
            for (let i = 0; i < ruleIdList.length; i++) {
                const ruleNumId = ruleIdList[i];
                const helperColId = ruleIdToColIdMap.get(ruleNumId);
                if (helperColId && record[helperColId] === true) {
                    const style = ruleOptions[i];
                    if (style) {
                         if (style.textColor) cellElement.style.color = style.textColor;
                         if (style.fillColor) cellElement.style.backgroundColor = style.fillColor;
                         if (style.fontBold) cellElement.style.fontWeight = 'bold';
                         if (style.fontItalic) cellElement.style.fontStyle = 'italic';
                    }
                    return;
                }
            }
        }
    }
    
    // NOVO: Função para renderizar controles globais (como a largura do drawer)
    function renderGlobalControls() {
        if (!globalControlsContainerEl) return;
        globalControlsContainerEl.innerHTML = ''; // Limpa para evitar duplicatas
        const widthContainer = document.createElement('div');
        widthContainer.style.marginBottom = '15px';
        widthContainer.style.padding = '10px';
        widthContainer.style.backgroundColor = '#f0f8ff';
        widthContainer.style.border = '1px solid #cce5ff';
        widthContainer.style.borderRadius = '4px';

        const label = document.createElement('label');
        label.htmlFor = 'drawerWidthSelector';
        label.textContent = 'Largura do Drawer:';
        label.style.fontWeight = 'bold';
        label.style.marginRight = '10px';

        const select = document.createElement('select');
        select.id = 'drawerWidthSelector';
        select.style.padding = '5px';

        const widths = ['25%', '40%', '50%', '60%', '75%'];
        widths.forEach(width => {
            const option = new Option(width, width);
            option.selected = (width === selectedDrawerWidth);
            select.add(option);
        });

        select.addEventListener('change', (e) => {
            selectedDrawerWidth = e.target.value;
        });

        widthContainer.appendChild(label);
        widthContainer.appendChild(select);
        globalControlsContainerEl.appendChild(widthContainer);
    }
    
    function renderFieldControls(schemaAsArray) {
        fieldControlsContainerEl.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = 'Controles de Campo do Drawer';
        title.style.marginTop = '20px';
        fieldControlsContainerEl.appendChild(title);

        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        gridContainer.style.gap = '12px';
        
        const visibleCols = schemaAsArray.filter(c => c && c.colId && !c.colId.startsWith('gristHelper_'));

        visibleCols.forEach(col => {
            const controlDiv = document.createElement('div');
            controlDiv.style.border = '1px solid #ccc';
            controlDiv.style.padding = '8px 12px';
            controlDiv.style.borderRadius = '4px';

            const colLabel = document.createElement('strong');
            colLabel.textContent = col.label || col.colId;
            controlDiv.appendChild(colLabel);
            
            const createCheckbox = (label, checked, onChange) => {
                const lbl = document.createElement('label');
                lbl.style.display = 'block'; lbl.style.marginTop = '6px'; lbl.style.fontWeight = 'normal';
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = checked; cb.onchange = onChange;
                lbl.appendChild(cb);
                lbl.appendChild(document.createTextNode(` ${label}`));
                return lbl;
            };

            controlDiv.appendChild(createCheckbox('Ocultar no Drawer', fieldsToHide.includes(col.colId), (e) => {
                if (e.target.checked) fieldsToHide.push(col.colId); else fieldsToHide = fieldsToHide.filter(id => id !== col.colId);
            }));

            controlDiv.appendChild(createCheckbox('Travar no Drawer', fieldsToLock.includes(col.colId), (e) => {
                if (e.target.checked) fieldsToLock.push(col.colId); else fieldsToLock = fieldsToLock.filter(id => id !== col.colId);
            }));

            const separator = document.createElement('hr');
            separator.style.margin = '8px 0'; separator.style.border = 'none'; separator.style.borderTop = '1px solid #eee';
            controlDiv.appendChild(separator);

            const currentOverrides = styleOverrides[col.colId] || {};
            const updateStyleOverride = (key, isChecked) => {
                if (!styleOverrides[col.colId]) styleOverrides[col.colId] = {};
                styleOverrides[col.colId][key] = isChecked;
                if (!styleOverrides[col.colId].ignoreField && !styleOverrides[col.colId].ignoreHeader) {
                    delete styleOverrides[col.colId];
                }
            };

            controlDiv.appendChild(createCheckbox('Ignorar Estilo do Campo', currentOverrides.ignoreField || false, (e) => updateStyleOverride('ignoreField', e.target.checked)));
            controlDiv.appendChild(createCheckbox('Ignorar Estilo do Cabeçalho', currentOverrides.ignoreHeader || false, (e) => updateStyleOverride('ignoreHeader', e.target.checked)));
            
            gridContainer.appendChild(controlDiv);
        });

        fieldControlsContainerEl.appendChild(gridContainer);
    }

    // 4. The main function to draw everything on the screen
    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        
        if (currentTableId !== tableId) {
            fieldsToLock = [];
            fieldsToHide = [];
            styleOverrides = {};
        }

        currentTableId = tableId;
        errorMessageEl.textContent = "";
        loadingMessageEl.style.display = 'block';
        tableInfoContainerEl.style.display = 'none';

        try {
            const schema = await tableLens.getTableSchema(tableId, { mode: 'raw' });
            const records = await tableLens.fetchTableRecords(tableId);
            const schemaAsArray = Object.values(schema); 
            const ruleIdToColIdMap = new Map();
            schemaAsArray.forEach(col => { if (col.colId?.startsWith('gristHelper_ConditionalRule')) { ruleIdToColIdMap.set(col.id, col.colId); } });

            tableNameEl.textContent = `Tabela: ${tableId}`;
            tableInfoContainerEl.style.display = 'block';

            schemaTableHeadEl.innerHTML = '';
            schemaTableBodyEl.innerHTML = '';
            recordsTableHeadEl.innerHTML = '';
            recordsTableBodyEl.innerHTML = '';

            // Render Schema Table
            columnCountEl.textContent = schemaAsArray.length;
            if (schemaAsArray.length > 0) {
                const allKeys = new Set();
                schemaAsArray.forEach(col => Object.keys(col).forEach(key => allKeys.add(key)));
                const sortedKeys = Array.from(allKeys).sort();
                sortedKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    schemaTableHeadEl.appendChild(th);
                });
                schemaAsArray.forEach(col => {
                    const row = schemaTableBodyEl.insertRow();
                    sortedKeys.forEach(key => {
                        const cell = row.insertCell();
                        const value = col[key];
                        if (value === null || value === undefined) { cell.textContent = ''; } 
                        else if (typeof value === 'object') { cell.innerHTML = `<pre>${JSON.stringify(value, null, 2)}</pre>`; } 
                        else { cell.textContent = String(value); }
                    });
                });
            }

            renderFieldControls(schemaAsArray);

            // Render Records Table
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort();
                recordHeaderKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    recordsTableHeadEl.appendChild(th);
                });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.style.cursor = 'pointer';
                    
                    row.onclick = () => openDrawer(tableId, record.id, {
                        lockedFields: fieldsToLock,
                        hiddenFields: fieldsToHide,
                        styleOverrides: styleOverrides,
                        width: selectedDrawerWidth
                    });

                    for (const key of recordHeaderKeys) {
                        const cell = row.insertCell();
                        const colSchema = schema[key];
                        const cellValue = record[key];
                        cell.textContent = (cellValue === null || cellValue === undefined) ? '(vazio)' : String(cellValue);
                        if (colSchema) {
                            applyGristCellStyles(cell, colSchema, record, ruleIdToColIdMap);
                        }
                    }
                }
            } else {
                recordsTableBodyEl.innerHTML = `<tr><td colspan="1">Nenhum registro.</td></tr>`;
            }
        } catch (error) {
            console.error(`Erro em initializeDebugWidget para tabela ${tableId}:`, error);
            errorMessageEl.textContent = `ERRO: ${error.message}. Veja o console.`;
        } finally {
            loadingMessageEl.style.display = 'none';
            isRendering = false;
        }
    }
    
    // 5. Setup functions that run once on page load
    async function populateTableSelectorAndRenderInitial() {
        try {
            renderGlobalControls();
            
            const allTables = await tableLens.listAllTables();
            const selectedTableId = await grist.selectedTable.getTableId() || (allTables.length > 0 ? allTables[0].id : null);
            tableSelectorEl.innerHTML = '';
            allTables.forEach(table => {
                const option = new Option(table.id, table.name);
                if (table.id === selectedTableId) { option.selected = true; }
                tableSelectorEl.appendChild(option);
            });
            await initializeDebugWidget(selectedTableId);
        } catch (error) {
            console.error("Erro ao inicializar:", error);
            errorMessageEl.textContent = `ERRO: ${error.message}.`;
        }
    }
    
    // 6. Set up all event listeners
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => {
        if (!tableId || isRendering || tableSelectorEl.value === tableId) return;
        tableSelectorEl.value = tableId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150);
    });
    subscribe('data-changed', (event) => {
        if (event.detail.tableId === currentTableId || event.detail.referencedTableId === currentTableId) {
            initializeDebugWidget(currentTableId);
        }
    });

    // 7. Start the application
    populateTableSelectorAndRenderInitial();
});