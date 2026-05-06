// IndicatorsWidget/script.js
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../libraries/grist-data-writer.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { IndicatorsRenderer } from '../libraries/grist-indicators-renderer/IndicatorsRenderer.js';
import { IndicatorsEditor } from '../libraries/grist-indicators-renderer/IndicatorsEditor.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableLens = new GristTableLens(window.grist);
    const dataWriter = new GristDataWriter(window.grist);
    const yearSelector = document.getElementById('year-selector');
    const indicatorListEl = document.getElementById('indicator-list');
    const indicatorDetailEl = document.getElementById('indicator-detail');
    const configBtn = document.getElementById('config-btn');

    let currentConfigId = null;
    let widgetConfig = null;
    let currentRecords = [];
    let selectedRecordId = null;
    let currentYear = new Date().getFullYear().toString();

    // Populate year selector
    for (let y = 2020; y <= 2030; y++) {
        const opt = document.createElement('option');
        opt.value = y.toString();
        opt.textContent = y.toString();
        if (y.toString() === currentYear) opt.selected = true;
        yearSelector.appendChild(opt);
    }

    yearSelector.onchange = (e) => {
        currentYear = e.target.value;
        renderList();
        if (selectedRecordId) renderDetail(selectedRecordId);
    };

    configBtn.onclick = () => GristLauncherUtils.renderSettingsPopover({
        grist: window.grist,
        tableLens,
        currentConfigId,
        currentConfig: widgetConfig,
        onLink: async (newId) => {
            const options = await window.grist.getOptions() || {};
            await window.grist.setOptions({ ...options, configId: newId });
            currentConfigId = newId;
            initialize();
        },
        onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['CardSystem', 'Drawer', 'CardStyle', 'Table', 'BSC', 'Indicators'] })
    });

    async function initialize() {
        const options = await window.grist.getOptions() || {};
        currentConfigId = options.configId;

        if (!currentConfigId) {
            indicatorDetailEl.innerHTML = '<div class="status-placeholder">Widget não configurado. Use a engrenagem ⚙️ para configurar.</div>';
            return;
        }

        try {
            const allTables = await window.grist.docApi.listTables();
            if (!allTables.includes('Grf_config')) {
                indicatorDetailEl.innerHTML = `
                    <div class="status-placeholder" style="color:#856404; background:#fff3cd; padding:20px; border-radius:8px;">
                        <b>Tabela "Grf_config" não encontrada.</b><br><br>
                        Este widget faz parte de um framework modular. Você precisa criar a tabela de configuração para que ele funcione.
                    </div>`;
                return;
            }

            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            if (!configRecord) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);
            widgetConfig = tableLens.parseConfigRecord(configRecord);
            
            if (!widgetConfig.tableId) {
                indicatorDetailEl.innerHTML = '<div class="status-placeholder">Tabela de dados não selecionada na configuração. Use a engrenagem ⚙️ para editar a config.</div>';
                return;
            }

            currentRecords = await tableLens.fetchTableRecords(widgetConfig.tableId);
            renderList();
            syncStaticValues();
        } catch (e) {
            console.error("Initialization error:", e);
            indicatorDetailEl.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        }
    }

    function renderList() {
        indicatorListEl.innerHTML = '';
        currentRecords.forEach(rec => {
            const metrics = IndicatorsRenderer.getIndicatorMetrics(rec, widgetConfig, currentYear);
            const item = document.createElement('div');
            item.className = `indicator-item ${rec.id === selectedRecordId ? 'active' : ''}`;
            item.innerHTML = `
                <span class="name">${rec.Nome || 'Sem Nome'}</span>
                <span class="status">${metrics.status}</span>
            `;
            item.onclick = () => {
                selectedRecordId = rec.id;
                renderList();
                renderDetail(rec.id);
            };
            indicatorListEl.appendChild(item);
        });
    }

    async function renderDetail(recordId) {
        const record = currentRecords.find(r => r.id === recordId);
        if (!record) return;
        
        await IndicatorsRenderer.renderIndicatorDetails(indicatorDetailEl, record, widgetConfig, currentYear);
        
        // Add Edit Button to Header
        const header = indicatorDetailEl.querySelector('.indicator-header');
        if (header) {
            const editBtn = document.createElement('button');
            editBtn.className = 'icon-btn edit-data-btn';
            editBtn.title = 'Editar Resultados e Metas';
            editBtn.innerHTML = `<svg class="icon" style="width:20px; height:20px;"><use href="#icon-edit"></use></svg>`;
            editBtn.onclick = () => {
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
            };
            header.appendChild(editBtn);
        }

        // Add double click to open drawer
        indicatorDetailEl.ondblclick = (e) => {
            if (e.target.closest('.edit-data-btn')) return;
            if (widgetConfig.actions?.drawerConfigId) {
                window.GristDrawer?.open(widgetConfig.tableId, record.id, { configId: widgetConfig.actions.drawerConfigId });
            }
        };
    }

    async function handleSaveMasterData(record, newData) {
        const mapping = widgetConfig.mapping || widgetConfig || {};
        const resultsField = mapping.resultsField || widgetConfig.resultsField;
        
        let masterData = {};
        try {
            masterData = typeof record[resultsField] === 'string' ? JSON.parse(record[resultsField]) : (record[resultsField] || {});
        } catch (e) {}

        const rawPeriodicity = record[mapping.periodicityField || widgetConfig.periodicityField];
        const periodicityKey = mapping.periodicityMap?.[rawPeriodicity] || 'MONTHLY';

        // Update year node
        masterData[currentYear] = {
            periodicity: periodicityKey,
            results: newData.results,
            targets: newData.targets
        };

        const updates = [{
            id: record.id,
            fields: { [resultsField]: JSON.stringify(masterData) }
        }];

        try {
            await dataWriter.updateRecords(widgetConfig.tableId, updates);
            // The onRecords listener will trigger re-initialization
        } catch (err) {
            alert("Erro ao salvar dados: " + err.message);
        }
    }

    async function syncStaticValues() {
        const mapping = widgetConfig.mapping || widgetConfig || {};
        if (!mapping.staticAchievementField && !mapping.staticStatusField && !mapping.staticConsolidatedValueField) return;

        const updates = [];
        for (const rec of currentRecords) {
            const metrics = IndicatorsRenderer.getIndicatorMetrics(rec, widgetConfig, currentYear);
            const update = {};
            let needsUpdate = false;

            if (mapping.staticConsolidatedValueField) {
                const currentVal = rec[mapping.staticConsolidatedValueField];
                if (Math.abs((currentVal || 0) - metrics.consolidatedValue) > 0.001) {
                    update[mapping.staticConsolidatedValueField] = metrics.consolidatedValue;
                    needsUpdate = true;
                }
            }

            if (mapping.staticAchievementField) {
                const currentVal = rec[mapping.staticAchievementField];
                if (Math.abs((currentVal || 0) - metrics.performance) > 0.001) {
                    update[mapping.staticAchievementField] = metrics.performance;
                    needsUpdate = true;
                }
            }

            if (mapping.staticStatusField) {
                const currentStatus = rec[mapping.staticStatusField];
                if (currentStatus !== metrics.status) {
                    update[mapping.staticStatusField] = metrics.status;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                updates.push({ id: rec.id, fields: update });
            }
        }

        if (updates.length > 0) {
            console.log(`[Indicators] Syncing ${updates.length} records back to Grist...`);
            await dataWriter.updateRecords(widgetConfig.tableId, updates);
        }
    }

    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        if (options.configId && options.configId !== currentConfigId) {
            initialize();
        }
    });

    window.grist.onRecords(async () => {
        if (currentConfigId) initialize();
    });

    initialize();
});
