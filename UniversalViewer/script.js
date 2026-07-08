// UniversalViewer/script.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js?v=1.0.9';
import { HeadlessTableLens } from '../libraries/headless-table-lens.js?v=1.0.9';
import { GristRestAdapter } from '../libraries/headless-rest-adapter.js?v=1.0.9';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js?v=1.0.9';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js?v=1.0.9';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js?v=1.0.9';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.9';
import { GristFilterBar } from '../libraries/grist-filter-bar/grist-filter-bar.js?v=1.0.9';

document.addEventListener('DOMContentLoaded', async () => {
    const rendererContainer = document.getElementById('renderer-container');
    const filterBarContainer = document.getElementById('filter-bar-container');
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfigId = urlParams.get('configId');
    const urlDocId = urlParams.get('docId');

    let tableLens;
    let currentConfig = null;
    let currentConfigId = urlConfigId || null;
    let isInitialized = false;

    // --- NAVIGATION STATE ---
    const navigationStack = [];
    let currentFilter = null;

    // --- 0. CARREGAMENTO DE ÍCONES ---
    async function loadIcons() {
        try {
            const response = await fetch('../libraries/icons/icons.svg');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {
            console.error('Falha ao carregar o arquivo de ícones:', error);
        }
    }
    await loadIcons();

    // --- 0.1 AMBIENTE (GRIST vs HEADLESS) ---
    if (urlConfigId && urlDocId) {
        console.log("[UniversalViewer] Modo Headless Ativo.");
        const restAdapter = new GristRestAdapter({
            gristUrl: window.location.origin + '/grist-proxy',
            docId: urlDocId,
            apiKey: 'none'
        });
        tableLens = new HeadlessTableLens(restAdapter);
    } else {
        console.log("[UniversalViewer] Modo Grist Standard.");
        tableLens = new GristTableLens(window.grist);
    }

    // Expor openDrawer globalmente
    window.GristDrawer = { open: openDrawer };

    // --- 1. SUBSCRIPÇÕES GLOBAIS ---
    subscribe('data-changed', async () => {
        console.log("[UniversalViewer] Dados alterados, atualizando...");
        await initializeAndUpdate();
    });

    subscribe('grf-navigation-action-triggered', async (data) => {
        await handleNavigationAction(data.config, data.sourceRecord, data.tableId);
    });

    subscribe('grf-trigger-widget', async (data) => {
        console.log("[UniversalViewer] Evento 'grf-trigger-widget' recebido:", data);
        try {
            let targetType = (data.componentType || '').replace(/\s+/g, '').toLowerCase();
            
            // If targetType is empty, resolve it dynamically from targetConfigId
            if (!targetType && data.configId) {
                try {
                    const targetConfig = await tableLens.fetchConfig(data.configId);
                    if (targetConfig) {
                        targetType = (targetConfig.componentType || targetConfig.mapping?.componentType || '').replace(/\s+/g, '').toLowerCase();
                    }
                } catch (err) {
                    console.warn("[UniversalViewer] Falha ao resolver tipo do widget alvo:", err);
                }
            }

            if (targetType === 'cardsystem' || targetType === 'table' || targetType === 'bsc' || targetType === 'indicators' || targetType === 'timeline' || targetType === 'gantt') {
                console.log("[UniversalViewer] Carregando widget dinamicamente:", data.configId);
                await loadDynamicWidget(data.configId, {
                    value: data.filterValue,
                    column: data.filterTargetColumn,
                    sourceLabel: data.sourceRecord?.Label || data.sourceRecord?.label || data.sourceRecord?.id || 'Filtrado',
                    disableFiltering: data.disableFiltering
                });
            } else {
                if (window.GristDrawer) {
                    const drawerConfig = await tableLens.fetchConfig(data.configId);
                    if (!drawerConfig) return;
                    await window.GristDrawer.open(data.sourceRecord?.gristHelper_tableId || currentConfig.tableId, data.sourceRecord?.id, {
                        ...drawerConfig,
                        tableLens,
                        filterValue: data.filterValue,
                        filterTargetColumn: data.filterTargetColumn,
                        isRefList: true
                    });
                }
            }
        } catch (e) { console.error("[UniversalViewer] Erro ao processar triggerWidget:", e); }
    });

    subscribe('grf-update-record', async (data) => {
        console.log("[UniversalViewer] Evento 'grf-update-record' recebido:", data);
        try {
            await tableLens.updateRecord(data.tableId, data.recordId, data.data);
        } catch (e) {
            console.error("[UniversalViewer] Erro ao atualizar registro:", e);
        }
    });

    async function loadDynamicWidget(configId, filterData = null) {
        if (currentConfigId) {
            navigationStack.push({
                configId: currentConfigId,
                filter: currentFilter,
                title: currentConfig?.widgetTitle || "Início"
            });
        }
        currentConfigId = configId;
        currentFilter = filterData;
        await initializeAndUpdate();
    }

    async function goBack() {
        if (navigationStack.length > 0) {
            const prevState = navigationStack.pop();
            currentConfigId = prevState.configId;
            currentFilter = prevState.filter;
            await initializeAndUpdate();
        }
    }

    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.onclick = (e) => {
            e.stopPropagation();
            goBack();
        };
    }

    subscribe('grf-card-clicked', async (data) => {
        // Lógica unificada para abrir Gaveta a partir de clique em card
        let drawerConfig = {};
        if (data.drawerConfigId) drawerConfig = await tableLens.fetchConfig(data.drawerConfigId);
        else drawerConfig = currentConfig;
        
        // Injeta a largura vinda do widget gatilho (data.cardConfig) como override
        const triggerSize = data.cardConfig?.actions?.sidePanel?.size;
        if (triggerSize) {
            drawerConfig = { ...drawerConfig };
            drawerConfig.actions = { ...(drawerConfig.actions || {}) };
            drawerConfig.actions.sidePanel = { ...(drawerConfig.actions.sidePanel || {}), size: triggerSize };
        }

        if (window.GristDrawer) {
            await window.GristDrawer.open(data.tableId, data.recordId, { ...drawerConfig, tableLens });
        }
    });

    // --- 2. LÓGICA PRINCIPAL ---

    async function initializeAndUpdate() {
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

        if (!currentConfigId) {
            rendererContainer.innerHTML = `<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular uma configuração.</div>`;
            addSettingsGear();
            return;
        }

        rendererContainer.innerHTML = `<div class="status-placeholder">Carregando configuração...</div>`;
        addSettingsGear();

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId);
            if (!currentConfig) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);

            const tableId = currentConfig.tableId;

            // Tenta pegar o tipo de múltiplas fontes (Raiz, Mapping, ou da própria linha da tabela se disponível)
            let type = currentConfig.componentType || currentConfig.mapping?.componentType;
            
            // Se ainda for undefined, tenta buscar o registro bruto para garantir
            if (!type) {
                const rawRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
                type = rawRecord?.componentType;
            }

            type = (type || '').replace(/\s+/g, '').toLowerCase();
            console.log(`[UniversalViewer] Identificado tipo: "${type}" para a config: ${currentConfigId}`);

            if (type === 'cardsystem') {
                const { CardSystem } = await import('../libraries/grist-card-system/CardSystem.js?v=1.0.9');
                let [records, schema] = await Promise.all([
                    tableLens.fetchTableRecords(tableId),
                    tableLens.getTableSchema(tableId)
                ]);

                // Aplicar Filtro Externo (Drill-down)
                if (currentFilter && currentFilter.column && currentFilter.value && !currentFilter.disableFiltering) {
                    console.log(`[UniversalViewer] Aplicando filtro drill-down: ${currentFilter.column} = ${currentFilter.value}`);
                    records = records.filter(r => {
                        const val = r[currentFilter.column];
                        if (Array.isArray(val)) return val.includes(currentFilter.value);
                        return val == currentFilter.value;
                    });
                }

                rendererContainer.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'cards-wrapper';
                await CardSystem.renderCards(wrapper, records, { ...currentConfig, tableLens }, schema);
                rendererContainer.appendChild(wrapper);
            } 
            else if (type === 'table') {
                const { TableRenderer } = await import('../libraries/grist-table-renderer/TableRenderer.js?v=1.0.9');
                let [records, schema] = await Promise.all([
                    tableLens.fetchTableRecords(tableId),
                    tableLens.getTableSchema(tableId)
                ]);

                // Aplicar Filtro Externo (Drill-down)
                if (currentFilter && currentFilter.column && currentFilter.value && !currentFilter.disableFiltering) {
                    records = records.filter(r => {
                        const val = r[currentFilter.column];
                        if (Array.isArray(val)) return val.includes(currentFilter.value);
                        return val == currentFilter.value;
                    });
                }

                // Post data to parent window (Dashboard) to render Kanban board
                if (window.parent && window.parent !== window) {
                    const stageCol = schema['METROLOGICAL_STAGE'];
                    const choices = stageCol?.widgetOptions ? (
                        typeof stageCol.widgetOptions === 'string' ? JSON.parse(stageCol.widgetOptions).choices : stageCol.widgetOptions.choices
                    ) : [];
                    window.parent.postMessage({
                        action: 'instruments-data-loaded',
                        records: records,
                        choices: choices
                    }, '*');
                }

                rendererContainer.innerHTML = '';
                const tableDiv = document.createElement('div');
                tableDiv.style.height = '100%';
                rendererContainer.appendChild(tableDiv);
                await TableRenderer.renderTable({
                    container: tableDiv,
                    records,
                    config: currentConfig,
                    tableLens,
                    onRowClick: async (record, mode) => {
                        const actions = currentConfig.actions || {};
                        const drawerId = currentConfig.drawerId || actions.drawerId;
                        if (drawerId) {
                            const drawerCfg = await tableLens.fetchConfig(drawerId);
                            window.GristDrawer.open(currentConfig.tableId, record.id, { 
                                ...drawerCfg, 
                                tableLens,
                                mode: mode || 'view'
                            });
                        }
                    },
                    onColumnOrderChanged: async (newColumnsOrder) => {
                        try {
                            const configTableName = 'Grf_config';
                            const allConfigs = await tableLens.fetchTableRecords(configTableName);
                            const configRecord = allConfigs.find(c => c.configId === currentConfigId);
                            if (!configRecord) return;
                            
                            const currentMapping = JSON.parse(configRecord.mappingJson || '{}');
                            const columns = currentMapping.columns || [];
                            
                            const currentOrderMap = {};
                            columns.forEach(col => {
                                currentOrderMap[col.colId] = col;
                            });
                            
                            const updatedColumns = newColumnsOrder
                                .map(colId => currentOrderMap[colId])
                                .filter(Boolean);
                            
                            const returnedIds = new Set(newColumnsOrder);
                            columns.forEach(col => {
                                if (!returnedIds.has(col.colId)) {
                                    updatedColumns.push(col);
                                }
                            });
                            
                            currentMapping.columns = updatedColumns;
                            
                            const { GristDataWriter } = await import('../libraries/grist-data-writer.js?v=1.0.9');
                            const dataWriter = new GristDataWriter(window.grist);
                            await dataWriter.updateRecord(configTableName, configRecord.id, {
                                mappingJson: JSON.stringify(currentMapping)
                            });
                            
                            console.log("Auto-saved column order to Grist!");
                            tableLens.clearConfigCache(currentConfigId);
                        } catch (err) {
                            console.error("Error auto-saving column order:", err);
                        }
                    }
                });
            }
            else if (type === 'bsc') {
                const { BSCRenderer } = await import('../libraries/grist-bsc-renderer/BSCRenderer.js?v=1.0.9');
                const mapping = currentConfig.mapping || currentConfig || {};
                const tableNames = {
                    modelsTable: mapping.modelsTable || 'Modelos',
                    perspectivesTable: mapping.perspectivesTable || 'Perspectivas',
                    objectivesTable: mapping.objectivesTable || 'Objetivos',
                    refModelCol: mapping.refModelCol || 'ref_model',
                    refPerspCol: mapping.refPerspCol || 'ref_persp',
                    relationshipField: mapping.relationshipField || 'ref_obj'
                };

                let currentModelId = null;
                if (currentFilter && currentFilter.value) {
                    currentModelId = Number(currentFilter.value);
                } else {
                    const allModels = await tableLens.fetchTableRecords(tableNames.modelsTable);
                    if (allModels && allModels.length > 0) {
                        currentModelId = allModels[0].id;
                    }
                }

                if (!currentModelId) {
                    rendererContainer.innerHTML = '<div class="status-placeholder">Nenhum modelo encontrado para exibir o BSC.</div>';
                    return;
                }

                const bscData = await BSCRenderer.fetchFullBscStructure(currentModelId, tableLens, tableNames);
                rendererContainer.innerHTML = '';
                await BSCRenderer.renderBsc({
                    container: rendererContainer,
                    bscData: bscData,
                    config: currentConfig,
                    tableLens: tableLens,
                    showRelationships: true
                });
            }
            else if (type === 'indicators') {
                const { IndicatorsRenderer } = await import('../libraries/grist-indicators-renderer/IndicatorsRenderer.js?v=1.0.9');
                const [records, configs] = await Promise.all([
                    tableLens.fetchTableRecords(tableId),
                    tableLens.fetchTableRecords('Grf_config')
                ]);
                rendererContainer.innerHTML = '';
                const currentYear = new Date().getFullYear().toString();
                const styling = currentConfig.styling || {};
                
                const wrapper = document.createElement('div');
                wrapper.className = 'indicators-wrapper';
                rendererContainer.appendChild(wrapper);
                
                for (const rec of records) {
                    await IndicatorsRenderer.renderIndicatorRow(wrapper, rec, currentConfig, currentYear, styling, configs, tableLens);
                }
            }
            else if (type === 'timeline') {
                const { TimelineRenderer } = await import('../libraries/grist-timeline-renderer/TimelineRenderer.js');
                let records = await tableLens.fetchTableRecords(tableId);

                if (currentFilter && currentFilter.column && currentFilter.value && !currentFilter.disableFiltering) {
                    records = records.filter(r => {
                        const val = r[currentFilter.column];
                        if (Array.isArray(val)) return val.includes(currentFilter.value);
                        return val == currentFilter.value;
                    });
                }

                rendererContainer.innerHTML = '';
                await TimelineRenderer.renderTimeline({
                    container: rendererContainer,
                    records,
                    config: currentConfig,
                    tableLens
                });
            }
            else if (type === 'gantt') {
                const { GanttRenderer } = await import('../libraries/grist-gantt-renderer/GanttRenderer.js');
                let records = await tableLens.fetchTableRecords(tableId);

                if (currentFilter && currentFilter.column && currentFilter.value && !currentFilter.disableFiltering) {
                    records = records.filter(r => {
                        const val = r[currentFilter.column];
                        if (Array.isArray(val)) return val.includes(currentFilter.value);
                        return val == currentFilter.value;
                    });
                }

                rendererContainer.innerHTML = '';
                await GanttRenderer.renderGantt({
                    container: rendererContainer,
                    records,
                    config: currentConfig,
                    tableLens
                });
            }
            else {
                rendererContainer.innerHTML = `<div class="status-placeholder">Tipo de componente "${currentConfig.componentType}" não suportado pelo Visualizador Universal. Por favor, use o widget específico ou uma configuração de Cards/Tabela.</div>`;
            }

        } catch (e) {
            console.error(e);
            rendererContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        }
    }

    // --- 3. UI E CONFIGURAÇÃO ---

    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    async function openSettingsPopover(event) {
        event.stopPropagation();
        await GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig,
            onLink: async (newId) => {
                await window.grist.setOptions({ configId: newId || null });
                currentConfigId = newId || null;
                await initializeAndUpdate();
            },
            onOpenManager: () => {
                openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['CardSystem', 'Drawer', 'CardStyle', 'Table', 'BSC', 'Indicators'] });
            }
        });
    }

    async function handleNavigationAction(config, record, tableId) {
        console.log("[UniversalViewer] handleNavigationAction disparado:", { actionType: config.actionType, recordId: record.id, tableId });
        try {
            if (config.actionType === 'navigateToGristPage') {
                const rowId = record[config.sourceValueColumn] || record.id;
                await window.grist.setCursorPos({ sectionId: parseInt(config.targetPageId), rowId: rowId });
            } 
            else if (config.actionType === 'openUrlFromColumn') {
                const url = record[config.urlColumn];
                if (url) window.open(url, '_blank');
            }
            else if (config.actionType === 'updateRecord') {
                await window.grist.docApi.applyUserActions([['UpdateRecord', tableId, record.id, { [config.updateField]: config.updateValue }]]);
            }
            else if (config.actionType === 'deleteRecord') {
                const msg = config.confirmationMessage || 'Are you sure you want to delete this record?';
                if (confirm(msg)) {
                    await window.grist.docApi.applyUserActions([['RemoveRecord', tableId, record.id]]);
                }
            }
            else if (config.actionType === 'editRecord' || config.actionType === 'viewRecord') {
                const drawerConfigId = config.drawerConfigId || currentConfig?.actions?.sidePanel?.drawerConfigId;
                let drawerOptions = { ...currentConfig, tableLens };
                if (drawerConfigId) {
                    const fetched = await tableLens.fetchConfig(drawerConfigId);
                    if (fetched) drawerOptions = { ...fetched, tableLens };
                }
                
                drawerOptions.mode = config.actionType === 'editRecord' ? 'edit' : 'view';
                
                // Injeta a largura vinda do widget gatilho (currentConfig) como override
                const triggerSize = currentConfig?.actions?.sidePanel?.size;
                if (triggerSize) {
                    drawerOptions.actions = { ...(drawerOptions.actions || {}) };
                    drawerOptions.actions.sidePanel = { ...(drawerOptions.actions.sidePanel || {}), size: triggerSize };
                }

                window.GristDrawer.open(tableId, record.id, drawerOptions);
            }
            else if (config.actionType === 'addSubRecord') {
                const targetRefField = config.subRecordRefField || config.tooltipField; // Fallback para configs antigas
                if (window.GristDrawer && (targetRefField || config.subRecordTableId)) {
                    const subTableId = config.subRecordTableId || await tableLens.getReferencedTableId(targetRefField, tableId);
                    if (!subTableId) return;
                    let addConfig = {};
                    if (config.subRecordConfigId) addConfig = await tableLens.fetchConfig(config.subRecordConfigId);
                    const initialData = {};
                    if (targetRefField) {
                        initialData[targetRefField] = record.id;
                    }
                    window.GristDrawer.open(subTableId, 'new', { ...(addConfig || {}), tableLens, initialData });
                }
            }
        } catch (e) { console.error("Navigation Action Error:", e); }
    }

    // --- 4. INICIALIZAÇÃO GRIST ---
    if (!urlConfigId || !urlDocId) {
        console.log("[UniversalViewer] Inicializando Grist Plugin API...");
        window.grist.ready({ requiredAccess: 'full' });

        window.grist.onOptions(async (options) => {
            const newId = urlConfigId || options?.configId || null;
            if (newId !== currentConfigId || !isInitialized) {
                isInitialized = true;
                currentConfigId = newId;
                await initializeAndUpdate();
            }
        });

        window.grist.onRecords(async () => {
            if (isInitialized) await initializeAndUpdate();
        });
    } else {
        // MODO HEADLESS: Inicializa diretamente sem esperar pelo Grist
        console.log("[UniversalViewer] Pulando Grist API (Modo Headless)");
        isInitialized = true;
        await initializeAndUpdate();
    }

    // Listen for events from parent window (Kanban card click) to open details drawer!
    window.addEventListener('message', async (event) => {
        if (!event.data) return;
        
        if (event.data.action === 'open-instrument-drawer') {
            const recordId = event.data.recordId;
            try {
                const drawerId = "drawerinstruments";
                const drawerCfg = await tableLens.fetchConfig(drawerId);
                window.GristDrawer.open('INSTRUMENTS', recordId, { 
                    ...drawerCfg, 
                    tableLens,
                    mode: 'view'
                });
            } catch (err) {
                console.error("[UniversalViewer] Error opening drawer from parent message:", err);
            }
        } else if (event.data.action === 'update-instrument-stage') {
            const { recordId, updates, occurrenceData } = event.data;
            try {
                const { GristDataWriter } = await import('../libraries/grist-data-writer.js?v=1.0.9');
                const dataWriter = new GristDataWriter(window.grist);
                await dataWriter.updateRecord('INSTRUMENTS', recordId, updates);
                if (occurrenceData) {
                    await dataWriter.addRecord('INSTRUMENTS_OCCURRENCES', occurrenceData);
                }
            } catch (err) {
                console.error("[UniversalViewer] Error updating stage from parent message:", err);
            }
        } else if (event.data.action === 'reload-records') {
            if (isInitialized) await initializeAndUpdate();
        } else if (event.data.action === 'table-lens-request') {
            const { method, args, transactionId } = event.data;
            try {
                let result;
                if (tableLens && typeof tableLens[method] === 'function') {
                    result = await tableLens[method](...args);
                } else if (dataWriter && typeof dataWriter[method] === 'function') {
                    result = await dataWriter[method](...args);
                } else {
                    throw new Error(`Method ${method} not found on tableLens or dataWriter`);
                }
                
                event.source.postMessage({
                    action: 'table-lens-response',
                    transactionId,
                    result
                }, '*');
            } catch (err) {
                event.source.postMessage({
                    action: 'table-lens-response',
                    transactionId,
                    error: err.message
                }, '*');
            }
        }
    });
});
