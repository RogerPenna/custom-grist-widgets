// BSCWidget/bsc-widget.js - Refatorado para usar BSCRenderer
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { RelationshipLines } from '../libraries/grist-relationship-lines/RelationshipLines.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { BSCRenderer } from '../libraries/grist-bsc-renderer/BSCRenderer.js';

document.addEventListener('DOMContentLoaded', async () => {
    const mainContainer = document.getElementById('main-container');
    const modelSelector = document.getElementById('model-selector');
    const toggleArrowsBtn = document.getElementById('toggle-arrows-btn');
    const tableLens = new GristTableLens(window.grist);

    let currentConfigId = null;
    let widgetConfig = null;
    let currentModelId = null;
    let showRelationships = false;
    let isInitialized = false;

    RelationshipLines.init(mainContainer);

    if (toggleArrowsBtn) {
        toggleArrowsBtn.onclick = () => {
            showRelationships = !showRelationships;
            toggleArrowsBtn.textContent = showRelationships ? 'Ocultar Relacionamentos' : 'Mostrar Relacionamentos';
            initializeAndUpdate();
        };
    }

    async function initializeAndUpdate() {
        const options = await window.grist.getOptions() || {};
        currentConfigId = options.configId;
        currentModelId = options.lastModelId;

        if (!currentConfigId) {
            mainContainer.innerHTML = '<div class="status-placeholder">Widget não configurado.</div>';
            return;
        }

        try {
            widgetConfig = await tableLens.fetchConfig(currentConfigId);
            await createModelDropdown();

            if (currentModelId) {
                const bscData = await BSCRenderer.fetchFullBscStructure(currentModelId, tableLens);
                await BSCRenderer.renderBsc({
                    container: mainContainer,
                    bscData,
                    config: widgetConfig,
                    tableLens,
                    showRelationships
                });
            } else {
                mainContainer.innerHTML = '<div class="status-placeholder">Selecione um Modelo no menu acima.</div>';
            }
        } catch (e) {
            console.error(e);
            mainContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        }
    }

    async function createModelDropdown() {
        if (modelSelector.options.length > 1) return;
        const allModels = await tableLens.fetchTableRecords('Modelos');
        modelSelector.innerHTML = '<option value="" disabled selected>Selecionar Modelo...</option>';
        allModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.Nome || `ID ${m.id}`;
            modelSelector.appendChild(opt);
        });
        modelSelector.value = currentModelId || "";
        modelSelector.onchange = (e) => {
            currentModelId = e.target.value;
            window.grist.setOptions({ lastModelId: currentModelId });
            initializeAndUpdate();
        };
    }

    const settingsIcon = document.getElementById('settings-gear-btn');
    if (settingsIcon) {
        settingsIcon.onclick = () => GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig: widgetConfig,
            onLink: async (newId) => {
                await window.grist.setOptions({ configId: newId });
                initializeAndUpdate();
            },
            onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId })
        });
    }

    window.grist.ready({ requiredAccess: 'full' });
    window.grist.onOptions(async (options) => {
        if (!isInitialized || options.configId !== currentConfigId) {
            isInitialized = true;
            await initializeAndUpdate();
        }
    });
    window.grist.onRecords(async () => {
        if (isInitialized) await initializeAndUpdate();
    });

    // Subscrições globais
    subscribe('grf-card-clicked', async (data) => {
        const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.sidePanel?.drawerConfigId;
        let drawerOptions = { ...widgetConfig, tableLens };
        if (drawerConfigId) {
            const fetched = await tableLens.fetchConfig(drawerConfigId);
            if (fetched) drawerOptions = { ...fetched, tableLens };
        }
        window.GristDrawer.open(data.tableId, data.recordId, drawerOptions);
    });

    await initializeAndUpdate();
});
