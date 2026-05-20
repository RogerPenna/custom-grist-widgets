// cards-widget/script.js - Versão Universal baseada no CardViewer
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { CardSystem } from '../libraries/grist-card-system/CardSystem.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { GristFilterBar } from '../libraries/grist-filter-bar/grist-filter-bar.js';

document.addEventListener('DOMContentLoaded', async () => {
    const cardContainer = document.getElementById('card-container');
    const tableLens = new GristTableLens(window.grist);
    
    let currentConfigId = null;
    let widgetConfig = null;
    let currentRecords = [];
    let isInitialized = false;

    // Expor openDrawer globalmente para o CardSystem
    window.GristDrawer = { open: openDrawer };

    async function initializeAndUpdate() {
        if (!tableLens) {
            try { tableLens = new GristTableLens(window.grist); } catch (e) { console.warn("[Cards Widget] Grist not ready yet"); return; }
        }
        const options = await window.grist.getOptions() || {};
        const newConfigId = options.configId;

        if (!newConfigId) {
            cardContainer.innerHTML = '<div class="status-placeholder">Widget de Cards não configurado. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        try {
            // Busca a configuração se mudou
            if (!widgetConfig || currentConfigId !== newConfigId) {
                currentConfigId = newConfigId;
                const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
                if (!configRecord) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);
                widgetConfig = tableLens.parseConfigRecord(configRecord);
            }

            // Renderiza os cards
            if (currentRecords && currentRecords.length > 0) {
                const schema = await tableLens.getTableSchema(widgetConfig.tableId);
                await CardSystem.renderCards(cardContainer, currentRecords, {
                    ...widgetConfig,
                    tableLens: tableLens
                }, schema);
            } else {
                cardContainer.innerHTML = '<div class="status-placeholder">Nenhum dado encontrado para exibir.</div>';
            }
        } catch (e) {
            console.error("[Cards Widget] Erro:", e);
            cardContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        }
    }

    // --- INICIALIZAÇÃO DA BARRA DE FILTROS ---
    const filterBarContainer = document.getElementById('filter-bar-container');
    if (filterBarContainer) {
        try {
            const response = await fetch('../libraries/grist-filter-bar/grist-filter-bar.html');
            if (response.ok) {
                filterBarContainer.innerHTML = await response.text();
                new GristFilterBar({
                    onFilter: (searchTerm) => CardSystem.filterRecords(cardContainer, searchTerm)
                });
            }
        } catch (e) { console.error('Erro ao carregar barra de filtros:', e); }
    }

    // Configuração da Engrenagem
    const settingsIcon = document.createElement('div');
    settingsIcon.id = 'settings-gear-btn';
    settingsIcon.innerHTML = '⚙️';
    settingsIcon.style.cssText = "position:fixed; top:10px; right:10px; font-size:24px; cursor:pointer; z-index:1000; background:rgba(255,255,255,0.8); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.2);";
    document.body.appendChild(settingsIcon);

    settingsIcon.onclick = () => GristLauncherUtils.renderSettingsPopover({
        grist: window.grist,
        tableLens,
        currentConfigId,
        currentConfig: widgetConfig,
        onLink: async (newId) => {
            const options = await window.grist.getOptions() || {};
            await window.grist.setOptions({ ...options, configId: newId });
            currentConfigId = newId;
            await initializeAndUpdate();
        },
        onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['Card System'] })
    });

    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        const newId = options?.configId;
        if (!isInitialized || (newId && newId !== currentConfigId)) {
            isInitialized = true;
            currentConfigId = newId;
            await initializeAndUpdate();
        }
    });

    window.grist.onRecords(async (records) => {
        currentRecords = records;
        if (isInitialized) await initializeAndUpdate();
    });

    // Subscrição para clique no card (abrir drawer)
    subscribe('grf-card-clicked', async (data) => {
        const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.sidePanel?.drawerConfigId;
        let drawerOptions = { ...widgetConfig, tableLens };
        if (drawerConfigId) {
            const fetched = await tableLens.fetchConfig(drawerConfigId);
            if (fetched) drawerOptions = { ...fetched, tableLens };
        }
        openDrawer(data.tableId, data.recordId, drawerOptions);
    });
});
