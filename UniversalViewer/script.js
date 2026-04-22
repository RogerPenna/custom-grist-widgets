// UniversalViewer/script.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { HeadlessTableLens } from '../libraries/headless-table-lens.js';
import { GristRestAdapter } from '../libraries/headless-rest-adapter.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { GristFilterBar } from '../libraries/grist-filter-bar/grist-filter-bar.js';

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

    // --- 1. SUBSCRIPÇÕES GLOBAIS ---
    subscribe('data-changed', async () => {
        console.log("[UniversalViewer] Dados alterados, atualizando...");
        await initializeAndUpdate();
    });

    subscribe('grf-navigation-action-triggered', async (data) => {
        await handleNavigationAction(data.config, data.sourceRecord, data.tableId);
    });

    subscribe('grf-card-clicked', async (data) => {
        // Lógica unificada para abrir Gaveta a partir de clique em card
        let drawerConfig = {};
        if (data.drawerConfigId) drawerConfig = await tableLens.fetchConfig(data.drawerConfigId);
        else drawerConfig = currentConfig;
        
        if (window.GristDrawer) {
            await window.GristDrawer.open(data.tableId, data.recordId, { ...drawerConfig, tableLens });
        }
    });

    // --- 2. LÓGICA PRINCIPAL ---

    async function initializeAndUpdate() {
        if (!currentConfigId) {
            rendererContainer.innerHTML = `<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular uma configuração.</div>`;
            if (!urlConfigId) addSettingsGear();
            return;
        }

        rendererContainer.innerHTML = `<div class="status-placeholder">Carregando configuração...</div>`;
        if (!urlConfigId) addSettingsGear();

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId);
            if (!currentConfig) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);

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
                const { CardSystem } = await import('../libraries/grist-card-system/CardSystem.js');
                const [records, schema] = await Promise.all([
                    tableLens.fetchTableRecords(currentConfig.tableId),
                    tableLens.getTableSchema(currentConfig.tableId)
                ]);
                rendererContainer.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'cards-wrapper';
                await CardSystem.renderCards(wrapper, records, { ...currentConfig, tableLens }, schema);
                rendererContainer.appendChild(wrapper);
            } 
            else if (type === 'table') {
                const { TableRenderer } = await import('../libraries/grist-table-renderer/TableRenderer.js');
                const records = await tableLens.fetchTableRecords(currentConfig.tableId);
                rendererContainer.innerHTML = '';
                const tableDiv = document.createElement('div');
                tableDiv.style.height = '100%';
                rendererContainer.appendChild(tableDiv);
                await TableRenderer.renderTable({
                    container: tableDiv,
                    records,
                    config: currentConfig,
                    tableLens,
                    onRowClick: async (record) => {
                        if (currentConfig.editMode === 'drawer' && currentConfig.drawerId) {
                            const drawerCfg = await tableLens.fetchConfig(currentConfig.drawerId);
                            window.GristDrawer.open(currentConfig.tableId, record.id, { ...drawerCfg, tableLens });
                        }
                    }
                });
            }
            else if (type === 'bsc') {
                const { BSCRenderer } = await import('../libraries/grist-bsc-renderer/BSCRenderer.js');
                // O BSC precisa de um modelo selecionado. Vamos usar o lastModelId dos options do Grist ou o primeiro disponível.
                const options = await window.grist.getOptions() || {};
                let modelId = options.lastModelId;
                
                if (!modelId) {
                    const models = await tableLens.fetchTableRecords('Modelos');
                    if (models.length > 0) modelId = models[0].id;
                }

                if (modelId) {
                    const bscData = await BSCRenderer.fetchFullBscStructure(modelId, tableLens);
                    rendererContainer.innerHTML = '';
                    const bscDiv = document.createElement('div');
                    rendererContainer.appendChild(bscDiv);
                    await BSCRenderer.renderBsc({
                        container: bscDiv,
                        bscData,
                        config: currentConfig,
                        tableLens,
                        showRelationships: false
                    });
                } else {
                    rendererContainer.innerHTML = `<div class="status-placeholder">Nenhum Modelo de BSC encontrado na tabela 'Modelos'.</div>`;
                }
            }
            else {
                rendererContainer.innerHTML = `<div class="status-placeholder">Tipo de componente desconhecido: ${currentConfig.componentType}</div>`;
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
                openConfigManager(window.grist, { initialConfigId: currentConfigId });
            }
        });
    }

    async function handleNavigationAction(config, record, tableId) {
        // Replicar a lógica de navegação centralizada (mesma do CardViewer/DrawerViewer)
        try {
            if (config.actionType === 'navigateToGristPage') {
                const rowId = record[config.sourceValueColumn] || record.id;
                await window.grist.setCursorPos({ sectionId: parseInt(config.targetPageId), rowId: rowId });
            } 
            else if (config.actionType === 'updateRecord') {
                await window.grist.docApi.applyUserActions([['UpdateRecord', tableId, record.id, { [config.updateField]: config.updateValue }]]);
            }
            else if (config.actionType === 'editRecord') {
                const drawerConfigId = config.drawerConfigId || currentConfig?.actions?.sidePanel?.drawerConfigId;
                let drawerOptions = { ...currentConfig, tableLens };
                if (drawerConfigId) {
                    const fetched = await tableLens.fetchConfig(drawerConfigId);
                    if (fetched) drawerOptions = { ...fetched, tableLens };
                }
                window.GristDrawer.open(tableId, record.id, drawerOptions);
            }
        } catch (e) { console.error("Navigation Action Error:", e); }
    }

    // --- 4. INICIALIZAÇÃO GRIST ---
    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        const newId = options?.configId || null;
        if (newId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = newId;
            await initializeAndUpdate();
        }
    });

    window.grist.onRecords(async () => {
        if (isInitialized) await initializeAndUpdate();
    });

    if (urlConfigId) {
        isInitialized = true;
        await initializeAndUpdate();
    }
});
