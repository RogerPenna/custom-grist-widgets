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
    const configSelectorContainerEl = document.getElementById('configSelectorContainer'); 
    const recordCountEl = document.getElementById('recordCount');
    const recordsTableEl = document.getElementById('recordsTable');
    const recordsTableHeadEl = recordsTableEl.querySelector('thead tr');
    const recordsTableBodyEl = recordsTableEl.querySelector('tbody');
    const errorMessageEl = document.getElementById('errorMessage');
    const tableSelectorEl = document.getElementById('tableSelector');

    // 2. Initialize state variables
    const tableLens = new GristTableLens(grist);
    let currentTableId;
    let isRendering = false;
    let debounceTimer;
    let testConfigId = 'test_drawer_com_ordem'; // Valor padrão

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
    
    function renderConfigSelector() {
        if (!configSelectorContainerEl) return;
        configSelectorContainerEl.innerHTML = '';
        const container = document.createElement('div');
        container.style.marginBottom = '15px';
        container.style.padding = '10px';
        container.style.backgroundColor = '#fffbe6';
        container.style.border = '1px solid #ffe58f';
        container.style.borderRadius = '4px';

        const label = document.createElement('label');
        label.htmlFor = 'configIdInput';
        label.textContent = 'ID da Configuração a ser Testada:';
        label.style.fontWeight = 'bold';
        label.style.marginRight = '10px';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'configIdInput';
        input.value = testConfigId;
        input.style.padding = '5px';
        input.style.width = '300px';

        input.addEventListener('change', (e) => {
            testConfigId = e.target.value.trim();
        });

        container.appendChild(label);
        container.appendChild(input);
        configSelectorContainerEl.appendChild(container);
    }

    // 4. The main function to draw everything on the screen
    async function initializeDebugWidget(tableId) {
        if (!tableId || isRendering) return;
        isRendering = true;
        
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

            // Render Schema Table (para debug)
            columnCountEl.textContent = schemaAsArray.length;
            if (schemaAsArray.length > 0) {
                const allKeys = new Set(['colId', 'label', 'type', 'isFormula', 'widgetOptions']);
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

            // Render Records Table
            recordCountEl.textContent = records.length;
            if (records.length > 0) {
                const recordHeaderKeys = Object.keys(records[0]).sort((a, b) => a.localeCompare(b)).filter(k => k !== 'gristHelper_tableId');
                recordHeaderKeys.unshift('id'); 

                recordHeaderKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    recordsTableHeadEl.appendChild(th);
                });

                for (const record of records) {
                    const row = recordsTableBodyEl.insertRow();
                    row.className = 'record-row';
                    row.style.cursor = 'pointer';
                    
                    row.onclick = async () => {
                        if (!testConfigId) {
                            alert("Por favor, insira um ID de configuração para testar.");
                            return;
                        }
                        try {
                            const drawerOptions = await tableLens.fetchConfig(testConfigId);
                            console.log(`Abrindo drawer para o registro ${record.id} com a configuração:`, drawerOptions);
                            openDrawer(tableId, record.id, drawerOptions);
                        } catch (error) {
                            console.error(`Falha ao abrir o drawer para a configuração '${testConfigId}':`, error);
                            errorMessageEl.textContent = `ERRO: Não foi possível carregar a configuração '${testConfigId}'. Verifique o console.`;
                        }
                    };

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
            renderConfigSelector();
            
            const allTables = await tableLens.listAllTables();
            const grfConfigRecords = await tableLens.fetchTableRecords('Grf_config');
            console.log('Grf_config records:', grfConfigRecords);

            const selectedTableId = await grist.selectedTable.getTableId() || (allTables.length > 0 ? allTables[0].id : null);
            tableSelectorEl.innerHTML = '';
            allTables.forEach(table => {
                const option = new Option(table.id, table.id);
                if (table.id === selectedTableId) { option.selected = true; }
                tableSelectorEl.appendChild(option);
            });
            await initializeDebugWidget(selectedTableId);
        } catch (error) {
            console.error("Erro ao inicializar:", error);
            errorMessageEl.textContent = `ERRO: ${error.message}.`;
        }
    }
    
// ...
    // 6. Set up all event listeners
    tableSelectorEl.addEventListener('change', (event) => initializeDebugWidget(event.target.value));
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords((records, tableId) => {
        if (!tableId || isRendering || tableSelectorEl.value === tableId) return;
        tableSelectorEl.value = tableId;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initializeDebugWidget(tableId), 150);
    });

    // LOG DE DEBUG 3: Confirma que o ouvinte está sendo configurado
    console.log("[DebugWidget] Configurando listeners de eventos...");

    subscribe('data-changed', (event) => {
        if (event.detail.tableId === currentTableId || event.detail.tableId === 'Grf_config') {
            initializeDebugWidget(currentTableId);
        }
    });

    // Modificado para ouvir TUDO que chega pelo EventBus
    subscribe('config-changed', (event) => {
        // LOG DE DEBUG 4: Loga o evento bruto que foi recebido
        console.log("[DebugWidget] Evento 'config-changed' recebido!", event);

        const changedConfigId = event.detail.configId;
        console.log(`[DebugWidget] Extraído configId: ${changedConfigId}. Limpando o cache.`);
        tableLens.clearConfigCache(changedConfigId);
    });

    // 7. Start the application
    populateTableSelectorAndRenderInitial();
});