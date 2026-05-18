// IndicatorsWidget/script.js
console.log("IndicatorsWidget v1.0.2 loading...");
const debugEl = document.getElementById('debug-log');
if (debugEl) debugEl.textContent = "Script loading...";

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js?v=1.0.2';
import { GristDataWriter } from '../libraries/grist-data-writer.js?v=1.0.2';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js?v=1.0.2';
import { IndicatorsRenderer } from '../libraries/grist-indicators-renderer/IndicatorsRenderer.js?v=1.0.2';
import { IndicatorsEditor } from '../libraries/grist-indicators-renderer/IndicatorsEditor.js?v=1.0.2';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js?v=1.0.2';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js?v=1.0.2';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.2'; 

if (debugEl) debugEl.textContent = "Imports done.";

// Ensure GristDrawer is available globally
window.GristDrawer = { open: openDrawer };

let tableLens, dataWriter;
const indicatorsViewEl = document.getElementById('indicators-view');
const configBtn = document.getElementById('config-btn');
const grouperContainer = document.getElementById('grouper-container');
const grouperSelect = document.getElementById('grouper-select');
const detailModal = document.getElementById('detail-modal');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal');
const yearSelector = document.getElementById('year-selector');

// --- NAVIGATION STATE ---
const navigationStack = [];
let currentFilter = null;

let currentConfigId = null;
let widgetConfig = null;
let currentRecords = [];
let currentYear = new Date().getFullYear().toString();
let activeGrouper = null;
let isInitializing = false;
let initTimeout = null;

closeModalBtn.onclick = () => {
    detailModal.style.display = 'none';
    modalContent.innerHTML = '';
};

async function loadDynamicWidget(configId, filterData = null) {
    if (currentConfigId) {
        navigationStack.push({
            configId: currentConfigId,
            filter: currentFilter,
            title: widgetConfig?.widgetTitle || "Início"
        });
    }
    currentConfigId = configId;
    currentFilter = filterData;
    debouncedInitialize();
}

async function goBack() {
    if (navigationStack.length > 0) {
        const prevState = navigationStack.pop();
        currentConfigId = prevState.configId;
        currentFilter = prevState.filter;
        debouncedInitialize();
    }
}

const backButton = document.getElementById('back-button');
if (backButton) {
    backButton.onclick = (e) => {
        e.stopPropagation();
        goBack();
    };
}

function populateYearSelector() {
    if (!yearSelector) return;
    const current = new Date().getFullYear();
    yearSelector.innerHTML = '';
    for (let i = current - 5; i <= current + 1; i++) {
        const opt = document.createElement('option');
        opt.value = i.toString();
        opt.textContent = i.toString();
        yearSelector.appendChild(opt);
    }
    yearSelector.value = currentYear;
}

yearSelector.onchange = (e) => {
    currentYear = e.target.value;
    debouncedInitialize();
};

// --- Modal Helpers ---
function openIndicatorChart(record) {
    openDetailModal(record);
}

function openIndicatorEditor(record) {
    const metrics = IndicatorsRenderer.getIndicatorMetrics(record, widgetConfig, currentYear);
    IndicatorsEditor.open({
        record,
        config: widgetConfig,
        selectedYear: currentYear,
        periodicity: metrics.periodicity,
        onSave: async (newData) => {
            await handleSaveMasterData(record, newData);
        }
    });
}

async function start() {
    if (debugEl) debugEl.textContent = "Grist ready. Initializing...";
    populateYearSelector();
    tableLens = new GristTableLens(window.grist);
    dataWriter = new GristDataWriter(window.grist);

    configBtn.onclick = () => GristLauncherUtils.renderSettingsPopover({
        grist: window.grist,
        tableLens,
        currentConfigId,
        currentConfig: widgetConfig,
        onLink: async (newId) => {
            const options = await window.grist.getOptions() || {};
            await window.grist.setOptions({ ...options, configId: newId });
            currentConfigId = newId;
            debouncedInitialize();
        },
        onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['CardSystem', 'Drawer', 'CardStyle', 'Table', 'BSC', 'Indicators'] })
    });

    // --- Interaction Subscriptions ---
    subscribe('grf-trigger-widget', async (data) => {
        console.log("[IndicatorsWidget] Evento 'grf-trigger-widget' recebido:", data);
        try {
            const targetType = (data.componentType || '').replace(/\s+/g, '').toLowerCase();
            if (targetType === 'cardsystem' || targetType === 'table' || targetType === 'bsc' || targetType === 'indicators') {
                await loadDynamicWidget(data.configId, {
                    value: data.filterValue,
                    column: data.filterTargetColumn,
                    sourceLabel: data.sourceRecord.Label || data.sourceRecord.label || data.sourceRecord.id
                });
            } else {
                if (window.GristDrawer) {
                    const drawerConfig = await tableLens.fetchConfig(data.configId);
                    if (!drawerConfig) return;
                    await window.GristDrawer.open(data.sourceRecord.gristHelper_tableId || widgetConfig.tableId, data.sourceRecord.id, {
                        ...drawerConfig,
                        tableLens,
                        filterValue: data.filterValue,
                        filterTargetColumn: data.filterTargetColumn,
                        isRefList: true
                    });
                }
            }
        } catch (e) { console.error("[IndicatorsWidget] Erro ao processar triggerWidget:", e); }
    });

    subscribe('grf-card-clicked', async (data) => {
        const record = currentRecords.find(r => Number(r.id) === Number(data.recordId));
        if (!record) return;
        const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.drawerConfigId;
        if (drawerConfigId) {
            let drawerOptions = { configId: drawerConfigId, tableLens };

            // Injeta largura do gatilho se existir
            const triggerSize = widgetConfig?.actions?.sidePanel?.size;
            if (triggerSize) {
                drawerOptions.actions = { sidePanel: { size: triggerSize } };
            }

            window.GristDrawer?.open(widgetConfig.tableId, record.id, drawerOptions);
        }
    });

    subscribe('grf-update-record', async (data) => {
        console.log("[IndicatorsWidget] Evento 'grf-update-record' recebido:", data);
        try {
            await tableLens.updateRecord(data.tableId, data.recordId, data.data);
        } catch (e) {
            console.error("[IndicatorsWidget] Erro ao atualizar registro:", e);
        }
    });

    subscribe('grf-action-triggered', async (data) => {
        const record = currentRecords.find(r => Number(r.id) === Number(data.recordId));
        if (!record) return;
        if (data.actionType === 'SHOW_INDICATOR_CHART') {
            openIndicatorChart(record);
        } else if (data.actionType === 'EDIT_INDICATOR_DATA') {
            openIndicatorEditor(record);
        }
    });

    /**
     * Executa ações de navegação ou atualização de dados.
     */
    async function handleNavigationAction(config, record, tableId) {
        console.log("[IndicatorsWidget] handleNavigationAction disparado:", { actionType: config.actionType, recordId: record.id, tableId });
        try {
            if (config.actionType === 'navigateToGristPage') {
                const rowId = record[config.sourceValueColumn] || record.id;
                console.log(`[IndicatorsWidget] Navegando para página ${config.targetPageId}, rowId: ${rowId}`);
                await window.grist.setCursorPos({ sectionId: parseInt(config.targetPageId), rowId: rowId });
            } 
            else if (config.actionType === 'openUrlFromColumn') {
                const url = record[config.urlColumn];
                if (url) {
                    console.log(`[IndicatorsWidget] Abrindo URL: ${url}`);
                    window.open(url, '_blank');
                } else {
                    console.warn(`[IndicatorsWidget] Coluna de URL '${config.urlColumn}' está vazia.`);
                }
            } 
            else if (config.actionType === 'updateRecord') {
                const data = { [config.updateField]: config.updateValue };
                console.log(`[IndicatorsWidget] Atualizando record ${record.id} na tabela ${tableId}:`, data);
                await window.grist.docApi.applyUserActions([
                    ['UpdateRecord', tableId, record.id, data]
                ]);
            }
            else if (config.actionType === 'deleteRecord') {
                const msg = config.confirmationMessage || 'Are you sure you want to delete this record?';
                if (confirm(msg)) {
                    console.log(`[IndicatorsWidget] Deletando record ${record.id} na tabela ${tableId}`);
                    await window.grist.docApi.applyUserActions([
                        ['RemoveRecord', tableId, record.id]
                    ]);
                }
            }
            else if (config.actionType === 'editRecord') {
                console.log(`[IndicatorsWidget] Edit Record (Drawer) acionado para record ${record.id}`);
                const drawerConfigId = config.drawerConfigId || widgetConfig?.actions?.drawerConfigId;
                
                let drawerOptions = { ...widgetConfig, tableLens: tableLens };
                if (drawerConfigId) {
                    const fetched = await tableLens.fetchConfig(drawerConfigId);
                    if (fetched) drawerOptions = { ...fetched, tableLens: tableLens };
                }
                
                // Injeta a largura vinda do widget gatilho (widgetConfig) como override
                const triggerSize = widgetConfig?.actions?.sidePanel?.size;
                if (triggerSize) {
                    drawerOptions.actions = { ...(drawerOptions.actions || {}) };
                    drawerOptions.actions.sidePanel = { ...(drawerOptions.actions.sidePanel || {}), size: triggerSize };
                }

                window.GristDrawer.open(tableId, record.id, drawerOptions);
            }
            else if (config.actionType === 'addSubRecord') {
                const targetRefField = config.subRecordRefField || config.tooltipField; // Fallback para configs antigas
                if (targetRefField || config.subRecordTableId) {
                    console.log(`[IndicatorsWidget] Adicionando sub-registro vinculado ao record ${record.id}`);
                    const subTableId = config.subRecordTableId || await tableLens.getReferencedTableId(targetRefField, tableId);
                    if (!subTableId) {
                        console.error(`[IndicatorsWidget] Não foi possível determinar a tabela vinculada ao campo ${targetRefField} na tabela ${tableId}`);
                        alert("Erro de configuração: Tabela do sub-registro não encontrada.");
                        return;
                    }
                    let addConfig = {};
                    if (config.subRecordConfigId) {
                        addConfig = await tableLens.fetchConfig(config.subRecordConfigId);
                    }
                    const initialData = {};
                    if (targetRefField) {
                        initialData[targetRefField] = record.id;
                    }
                    window.GristDrawer.open(subTableId, 'new', { 
                        ...(addConfig || {}),
                        tableLens: tableLens,
                        initialData: initialData
                    });
                } else {
                    console.error("[IndicatorsWidget] subRecordRefField ou subRecordTableId ausente para addSubRecord", config);
                }
            }
            else if (config.actionType === 'SHOW_INDICATOR_CHART') {
                openIndicatorChart(record);
            } 
            else if (config.actionType === 'EDIT_INDICATOR_DATA') {
                openIndicatorEditor(record);
            }
        } catch (e) {
            console.error("[IndicatorsWidget] Erro ao executar handleNavigationAction:", e);
        }
    }

    // Expor openDrawer globalmente
    window.GristDrawer = { open: openDrawer };

    subscribe('grf-navigation-action-triggered', async (data) => {
        const record = currentRecords.find(r => Number(r.id) === Number(data.sourceRecord?.id || data.recordId));
        if (!record) return;
        await handleNavigationAction(data.config, record, data.tableId);
    });
    window.grist.onOptions(async (options) => { if (options.configId && options.configId !== currentConfigId) debouncedInitialize(); });
    window.grist.onRecords(async () => { if (currentConfigId) debouncedInitialize(); });

    debouncedInitialize();
}

async function initialize() {
    if (isInitializing) return;
    isInitializing = true;

    // Gerenciamento da Barra de Navegação
    const navBar = document.getElementById('nav-bar-container');
    const breadcrumbArea = document.getElementById('breadcrumb-area');
    if (navigationStack.length > 0) {
        if (navBar) navBar.style.display = 'flex';
        if (breadcrumbArea) {
            const breadcrumbs = navigationStack.map(s => s.title).join(' > ');
            breadcrumbArea.innerText = breadcrumbs + ' > ' + (currentFilter?.sourceLabel || 'Filtrado');
        }
    } else {
        if (navBar) navBar.style.display = 'none';
    }

    if (debugEl) debugEl.textContent = "Fetching config...";

    const options = await window.grist.getOptions() || {};
    if (!currentConfigId) currentConfigId = options.configId;

    if (!currentConfigId) {
        indicatorsViewEl.innerHTML = '<div class="status-placeholder">Widget não configurado. Use a engrenagem ⚙️.</div>';
        isInitializing = false;
        if (debugEl) debugEl.textContent = "No config ID.";
        return;
    }

    try {
        const allConfigs = await tableLens.fetchTableRecords('Grf_config');
        const configRecord = allConfigs.find(c => c.configId === currentConfigId);
        if (!configRecord) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);
        
        widgetConfig = tableLens.parseConfigRecord(configRecord);
        if (!widgetConfig.tableId) {
            indicatorsViewEl.innerHTML = '<div class="status-placeholder">Tabela de dados não selecionada.</div>';
            isInitializing = false;
            return;
        }

        const groupFields = widgetConfig.groupFields || [];
        updateGrouperUI(groupFields);

        let records = await tableLens.fetchTableRecords(widgetConfig.tableId);
        
        // Sync calculated fields for ALL fetched records before filtering
        await updateCalculatedFields(records);

        // Aplicar Filtro Externo (Drill-down)
        if (currentFilter && currentFilter.column && currentFilter.value) {
            console.log(`[IndicatorsWidget] Aplicando filtro drill-down: ${currentFilter.column} = ${currentFilter.value}`);
            records = records.filter(r => {
                const val = r[currentFilter.column];
                if (Array.isArray(val)) return val.includes(currentFilter.value);
                return val == currentFilter.value;
            });
        }
        currentRecords = records;

        await renderGrid(allConfigs);
        if (debugEl) debugEl.textContent = `Ready (${currentRecords.length} recs)`;
    } catch (e) {
        console.error("Initialization error:", e);
        indicatorsViewEl.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        if (debugEl) debugEl.textContent = "Error: " + e.message;
    } finally {
        isInitializing = false;
    }
}

async function updateCalculatedFields(records) {
    if (!widgetConfig || !widgetConfig.tableId) return;
    const mapping = widgetConfig.mapping || widgetConfig || {};
    
    const consolidatedField = mapping.staticConsolidatedValueField;
    const performanceField = mapping.staticAchievementField;
    const statusField = mapping.staticStatusField;

    if (!consolidatedField && !performanceField && !statusField) return;

    const updates = [];
    const resultsField = mapping.resultsField || widgetConfig.resultsField;

    for (const rec of records) {
        // Find latest year with data to sync correct "Current Status" to Grist
        let yearToSync = currentYear;
        try {
            const rawResults = rec[resultsField];
            const resultsJson = (typeof rawResults === 'string' && rawResults.trim().startsWith('{')) ? JSON.parse(rawResults) : (typeof rawResults === 'object' && rawResults !== null ? rawResults : {});
            
            // Check if it's the new multi-year format
            const yearsWithData = Object.keys(resultsJson).filter(y => !isNaN(parseInt(y))).sort().reverse();
            if (yearsWithData.length > 0) {
                yearToSync = yearsWithData[0];
            }
        } catch (e) { /* fallback to currentYear */ }

        const metrics = IndicatorsRenderer.getIndicatorMetrics(rec, widgetConfig, yearToSync);
        const fieldsToUpdate = {};

        // Use unified persistence metrics (matches UI chips)
        const valToSave = metrics.persistValue;
        const perfToSave = metrics.persistPerformance;
        const statusToSave = metrics.persistStatus;

        if (consolidatedField && rec[consolidatedField] !== valToSave) {
            fieldsToUpdate[consolidatedField] = valToSave;
        }
        if (performanceField && Math.abs((rec[performanceField] || 0) - perfToSave) > 0.0001) {
            fieldsToUpdate[performanceField] = perfToSave;
        }
        if (statusField && rec[statusField] !== statusToSave) {
            fieldsToUpdate[statusField] = statusToSave;
        }

        if (Object.keys(fieldsToUpdate).length > 0) {
            updates.push({ id: rec.id, fields: fieldsToUpdate });
        }
    }

    if (updates.length > 0) {
        console.log(`Syncing ${updates.length} records with calculated metrics...`);
        try {
            await dataWriter.updateRecords(widgetConfig.tableId, updates);
        } catch (err) {
            console.warn("GGT: Error syncing calculated fields:", err);
        }
    }
}

function debouncedInitialize() {
    if (initTimeout) clearTimeout(initTimeout);
    initTimeout = setTimeout(() => { initialize(); }, 100);
}

function updateGrouperUI(groupFields) {
    if (!groupFields || groupFields.length === 0) {
        grouperContainer.style.display = 'none';
        activeGrouper = null;
        return;
    }
    grouperContainer.style.display = 'flex';
    const previousValue = grouperSelect.value;
    grouperSelect.innerHTML = '<option value="">(Nenhum)</option>' + groupFields.map(f => `<option value="${f}">${f}</option>`).join('');
    if (previousValue && groupFields.includes(previousValue)) { grouperSelect.value = previousValue; }
    else if (groupFields.length > 0) { grouperSelect.value = groupFields[0]; }
    activeGrouper = grouperSelect.value;
}

grouperSelect.onchange = () => { activeGrouper = grouperSelect.value; renderGrid([]); };

async function groupRecords(records, groupField) {
    if (!groupField) return { 'Geral': records };
    const grouped = {};
    let isRef = false;
    let colSchema = null;
    try {
        const schema = await tableLens.getTableSchema(widgetConfig.tableId);
        colSchema = schema[groupField];
        isRef = colSchema && (colSchema.type.startsWith('Ref:') || colSchema.type.startsWith('RefList:'));
    } catch (e) {}
    
    const labelMap = {};
    if (isRef && colSchema) {
        const uniqueIds = [...new Set(records.map(r => {
            const val = r[groupField];
            if (Array.isArray(val) && val[0] === 'L') return val.slice(1);
            return val;
        }).flat())].filter(id => typeof id === 'number' && id > 0);
        
        await Promise.all(uniqueIds.map(async (id) => {
            try {
                const displayColOverride = widgetConfig.groupDisplayFields?.[groupField];
                if (displayColOverride) {
                    const refTableId = colSchema.type.split(':')[1];
                    const refRecord = await tableLens.fetchRecordById(refTableId, id);
                    labelMap[id] = refRecord ? refRecord[displayColOverride] : id;
                } else {
                    const resolved = await tableLens.resolveReference(colSchema, { [groupField]: id, gristHelper_tableId: widgetConfig.tableId });
                    labelMap[id] = resolved.displayValue;
                }
            } catch (e) { labelMap[id] = id; }
        }));
    }

    records.forEach(rec => {
        const val = rec[groupField];
        let groupLabel = val;
        if (isRef) {
            if (Array.isArray(val) && val[0] === 'L') { groupLabel = val.slice(1).map(id => labelMap[id] || id).join(' - '); }
            else { groupLabel = labelMap[val] || val; }
        }
        const groupKey = (groupLabel !== null && groupLabel !== undefined && groupLabel !== "") ? String(groupLabel) : 'Sem Grupo';
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(rec);
    });
    return grouped;
}

async function renderGrid(receivedConfigs = []) {
    let configs = receivedConfigs;
    if (configs.length === 0) configs = await tableLens.fetchTableRecords('Grf_config');
    indicatorsViewEl.innerHTML = '';
    const styling = widgetConfig.styling || {};
    const yearsCount = styling.yearsCount !== undefined ? styling.yearsCount : 3;
    const previousYears = Array.from({ length: yearsCount }, (_, i) => (parseInt(currentYear) - (i + 1)).toString()).reverse();
    indicatorsViewEl.style.setProperty('--card-area-width', `${styling.cardWidthPercent || 25}%`);
    indicatorsViewEl.style.setProperty('--years-count', yearsCount);

    const gridHeader = document.createElement('div');
    gridHeader.className = 'grid-header-row';
    gridHeader.innerHTML = `
        <div class="header-card-placeholder sticky-col-left">INDICADOR</div>
        <div class="months-wrapper scrollable-area">
            <div class="months-header-title">LANÇAMENTOS MENSAIS</div>
            <div class="months-grid">${['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'].map(m => `<div class="month-label">${m}</div>`).join('')}</div>
        </div>
        <div class="years-container sticky-col-right">${previousYears.map(y => `<div class="year-label">${y}</div>`).join('')}</div>`;
    indicatorsViewEl.appendChild(gridHeader);

    const grouped = await groupRecords(currentRecords, activeGrouper);
    for (const [groupName, records] of Object.entries(grouped)) {
        const groupSection = document.createElement('div');
        groupSection.className = 'group-section';
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.textContent = groupName;
        groupSection.appendChild(groupHeader);
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';
        groupSection.appendChild(groupContainer);
        indicatorsViewEl.appendChild(groupSection);

        for (const rec of records) {
            const rowEl = await IndicatorsRenderer.renderIndicatorRow(groupContainer, rec, widgetConfig, currentYear, styling, configs, tableLens);
            attachRowEvents(rowEl, rec);
        }
    }

    const scrollableAreas = indicatorsViewEl.querySelectorAll('.scrollable-area');
    scrollableAreas.forEach(area => {
        area.onscroll = () => { scrollableAreas.forEach(other => { if (other !== area) other.scrollLeft = area.scrollLeft; }); };
    });
}

function attachRowEvents(rowEl, record) {
    const viewChartBtn = rowEl.querySelector('.view-chart');
    const editDataBtn = rowEl.querySelector('.edit-data');
    if (viewChartBtn) viewChartBtn.onclick = () => openDetailModal(record);
    if (editDataBtn) editDataBtn.onclick = () => {
        const metrics = IndicatorsRenderer.getIndicatorMetrics(record, widgetConfig, currentYear);
        IndicatorsEditor.open({ record, config: widgetConfig, selectedYear: currentYear, periodicity: metrics.periodicity, onSave: async (newData) => { await handleSaveMasterData(record, newData); } });
    };
    rowEl.ondblclick = (e) => {
        if (e.target.closest('.action-btn')) return;
        if (widgetConfig.actions?.drawerConfigId) { 
            let drawerOptions = { configId: widgetConfig.actions.drawerConfigId, tableLens };
            const triggerSize = widgetConfig?.actions?.sidePanel?.size;
            if (triggerSize) {
                drawerOptions.actions = { sidePanel: { size: triggerSize } };
            }
            window.GristDrawer?.open(widgetConfig.tableId, record.id, drawerOptions); 
        }
    };
}

async function openDetailModal(record) {
    modalTitle.textContent = record.Nome || 'Detalhes do Indicador';
    modalContent.innerHTML = '<div class="loading" style="padding:40px; text-align:center; color:#666;">Carregando gráfico...</div>';
    detailModal.style.display = 'flex';
    await IndicatorsRenderer.renderIndicatorDetails(modalContent, record, widgetConfig, currentYear, tableLens);
}

async function handleSaveMasterData(record, newData) {
    const mapping = widgetConfig.mapping || widgetConfig || {};
    const resultsField = mapping.resultsField || widgetConfig.resultsField;
    const targetField = mapping.targetField || widgetConfig.targetField;
    let resultsMaster = {};
    try {
        const val = record[resultsField];
        resultsMaster = (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
    } catch (e) {}
    const rawPeriodicity = record[mapping.periodicityField || widgetConfig.periodicityField];
    const periodicityKey = mapping.periodicityMap?.[rawPeriodicity] || 'MONTHLY';
    resultsMaster[currentYear] = { periodicity: periodicityKey, results: newData.results, targets: {} };
    let targetsMaster = {};
    try {
        const val = record[targetField];
        targetsMaster = (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
    } catch (e) {}
    targetsMaster[currentYear] = newData.targets;
    const updates = [{ id: record.id, fields: { [resultsField]: JSON.stringify(resultsMaster), [targetField]: JSON.stringify(targetsMaster) } }];
    try { 
        await dataWriter.updateRecords(widgetConfig.tableId, updates); 
        // Force immediate recalculation of summary fields for this record
        const updatedRecord = await tableLens.fetchRecordById(widgetConfig.tableId, record.id);
        if (updatedRecord) await updateCalculatedFields([updatedRecord]);
    } catch (err) { alert("Erro ao salvar: " + err.message); }
}

window.grist.ready({ requiredAccess: 'full' });
start();
