// BSCWidget/bsc-widget.js - Restaurado e funcional usando BSCRenderer
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

    // Inicializa o sistema de linhas no container de scroll
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
        
        // Atualiza IDs locais a partir das opções do Grist
        if (options.configId) currentConfigId = options.configId;
        if (options.lastModelId) currentModelId = parseInt(options.lastModelId, 10);

        console.log("[BSC Widget] Verificando estado:", { currentConfigId, currentModelId });

        if (!currentConfigId) {
            mainContainer.innerHTML = '<div class="status-placeholder">Widget BSC não configurado. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        try {
            // Busca a configuração se ainda não tiver ou se mudou
            if (!widgetConfig || widgetConfig.configId !== currentConfigId) {
                const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
                if (!configRecord) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);
                widgetConfig = tableLens.parseConfigRecord(configRecord);
            }

            // Sempre tenta popular/atualizar o dropdown de Modelos
            await createModelDropdown();

            // Se houver um modelo selecionado, renderiza o Mapa
            if (currentModelId) {
                const bscData = await BSCRenderer.fetchFullBscStructure(currentModelId, tableLens);
                await BSCRenderer.renderBsc({
                    container: mainContainer,
                    bscData: bscData,
                    config: widgetConfig,
                    tableLens: tableLens,
                    showRelationships: showRelationships
                });
            } else {
                mainContainer.innerHTML = '<div class="status-placeholder">Configuração vinculada com sucesso. <br><br> Agora selecione um <b>Modelo</b> no menu superior para visualizar o Mapa Estratégico.</div>';
            }
        } catch (e) {
            console.error("[BSC Widget] Erro na renderização:", e);
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
        modelSelector.onchange = async (e) => {
            currentModelId = parseInt(e.target.value, 10);
            // Pega as opções atuais para não sobrescrever o configId
            const options = await window.grist.getOptions() || {};
            await window.grist.setOptions({ ...options, lastModelId: currentModelId });
            initializeAndUpdate();
        };
    }

    // Configuração da Engrenagem (Launcher unificado)
    const settingsIcon = document.getElementById('settings-gear-btn');
    if (settingsIcon) {
        settingsIcon.onclick = () => GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig: widgetConfig,
            onLink: async (newId) => {
                console.log("[BSC Widget] Vinculando novo ID:", newId);
                const options = await window.grist.getOptions() || {};
                await window.grist.setOptions({ ...options, configId: newId });
                currentConfigId = newId;
                isInitialized = true;
                await initializeAndUpdate();
            },
            onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['BSC'] })
        });
    }

    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        console.log("[BSC Widget] onOptions recebido:", options);
        const newId = options?.configId;
        
        // Só atualiza se o ID realmente mudou ou se é a primeira vez
        if (!isInitialized || (newId && newId !== currentConfigId)) {
            isInitialized = true;
            currentConfigId = newId;
            await initializeAndUpdate();
        }
    });

    window.grist.onRecords(async () => {
        if (isInitialized) await initializeAndUpdate();
    });

    // Subscrições globais do framework
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
