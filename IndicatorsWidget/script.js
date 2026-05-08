// IndicatorsWidget/script.js
const debugEl = document.getElementById('debug-log');
if (debugEl) debugEl.textContent = "Script loading...";

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../libraries/grist-data-writer.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { IndicatorsRenderer } from '../libraries/grist-indicators-renderer/IndicatorsRenderer.js';
import { IndicatorsEditor } from '../libraries/grist-indicators-renderer/IndicatorsEditor.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js'; 

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
    subscribe('grf-card-clicked', async (data) => {
        const record = currentRecords.find(r => Number(r.id) === Number(data.recordId));
        if (!record) return;
        const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.drawerConfigId;
        if (drawerConfigId) {
            window.GristDrawer?.open(widgetConfig.tableId, record.id, { configId: drawerConfigId, tableLens });
        }
    });

    subscribe('grf-action-triggered', async (data) => {
        const record = currentRecords.find(r => Number(r.id) === Number(data.recordId));
        if (!record) return;
        if (data.actionType === 'SHOW_INDICATOR_CHART') {
            openDetailModal(record);
        }
    });

    window.grist.onOptions(async (options) => { if (options.configId && options.configId !== currentConfigId) debouncedInitialize(); });
    window.grist.onRecords(async () => { if (currentConfigId) debouncedInitialize(); });

    debouncedInitialize();
}

async function initialize() {
    if (isInitializing) return;
    isInitializing = true;
    if (debugEl) debugEl.textContent = "Fetching config...";

    const options = await window.grist.getOptions() || {};
    currentConfigId = options.configId;

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

        currentRecords = await tableLens.fetchTableRecords(widgetConfig.tableId);
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
        <div class="months-wrapper scrollable-area"><div class="months-grid">${['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'].map(m => `<div class="month-label">${m}</div>`).join('')}</div></div>
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
        if (widgetConfig.actions?.drawerConfigId) { window.GristDrawer?.open(widgetConfig.tableId, record.id, { configId: widgetConfig.actions.drawerConfigId, tableLens }); }
    };
}

async function openDetailModal(record) {
    modalTitle.textContent = record.Nome || 'Detalhes do Indicador';
    modalContent.innerHTML = '<div class="loading" style="padding:40px; text-align:center; color:#666;">Carregando gráfico...</div>';
    detailModal.style.display = 'flex';
    await IndicatorsRenderer.renderIndicatorDetails(modalContent, record, widgetConfig, currentYear);
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
    try { await dataWriter.updateRecords(widgetConfig.tableId, updates); } catch (err) { alert("Erro ao salvar: " + err.message); }
}

window.grist.ready({ requiredAccess: 'full' });
start();
