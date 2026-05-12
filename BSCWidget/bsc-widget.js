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
    let tableLens;
    try {
        tableLens = new GristTableLens(window.grist);
    } catch (e) {
        console.warn("[BSC Widget] TableLens delayed initialization");
    }

    let currentConfigId = null;
    let widgetConfig = null;
    let currentModelId = null;
    let showRelationships = false;
    let isInitialized = false;
    let initTimeout = null;

    // Inicializa o sistema de linhas no container de scroll
    RelationshipLines.init(mainContainer);

    if (toggleArrowsBtn) {
        toggleArrowsBtn.onclick = () => {
            showRelationships = !showRelationships;
            toggleArrowsBtn.textContent = showRelationships ? 'Ocultar Relacionamentos' : 'Mostrar Relacionamentos';
            debouncedUpdate();
        };
    }

    function debouncedUpdate() {
        if (initTimeout) clearTimeout(initTimeout);
        initTimeout = setTimeout(() => {
            initializeAndUpdate();
        }, 100);
    }

    async function initializeAndUpdate() {
        console.log("[BSC Widget] Executando initializeAndUpdate...");
        if (!tableLens) {
            try { 
                tableLens = new GristTableLens(window.grist); 
            } catch (e) { 
                console.error("[BSC Widget] Falha ao instanciar TableLens:", e);
                mainContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro TableLens: ${e.message}</div>`;
                return; 
            }
        }
        
        const options = await window.grist.getOptions() || {};
        
        if (options.configId) currentConfigId = options.configId;
        if (options.lastModelId) currentModelId = parseInt(options.lastModelId, 10);

        if (!currentConfigId) {
            console.warn("[BSC Widget] Nenhum configId encontrado nas opções.");
            mainContainer.innerHTML = '<div class="status-placeholder">Widget BSC não configurado. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        try {
            tableLens.clearConfigCache(currentConfigId);
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            
            if (!configRecord) {
                throw new Error(`Configuração "${currentConfigId}" não encontrada na tabela Grf_config.`);
            }
            
            widgetConfig = tableLens.parseConfigRecord(configRecord);

            const mapping = widgetConfig.mapping || widgetConfig || {};
            const tableNames = {
                modelsTable: mapping.modelsTable || 'Modelos',
                perspectivesTable: mapping.perspectivesTable || 'Perspectivas',
                objectivesTable: mapping.objectivesTable || 'Objetivos',
                refModelCol: mapping.refModelCol || 'ref_model',
                refPerspCol: mapping.refPerspCol || 'ref_persp',
                relationshipField: mapping.relationshipField || 'ref_obj'
            };

            await createModelDropdown(tableNames.modelsTable);

            if (currentModelId) {
                const bscData = await BSCRenderer.fetchFullBscStructure(currentModelId, tableLens, tableNames);
                
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
            mainContainer.innerHTML = `<div class="status-placeholder" style="color:red"><b>Erro na inicialização:</b><br>${e.message}</div>`;
        }
    }

    async function createModelDropdown(modelsTable = 'Modelos') {
        if (modelSelector.options.length > 1 && modelSelector.dataset.table === modelsTable) return;
        const allModels = await tableLens.fetchTableRecords(modelsTable);
        modelSelector.dataset.table = modelsTable;
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
            const options = await window.grist.getOptions() || {};
            await window.grist.setOptions({ ...options, lastModelId: currentModelId });
            debouncedUpdate();
        };
    }

    // Configuração da Engrenagem
    const settingsIcon = document.getElementById('settings-gear-btn');
    if (settingsIcon) {
        settingsIcon.onclick = () => GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig: widgetConfig,
            onLink: async (newId) => {
                const options = await window.grist.getOptions() || {};
                await window.grist.setOptions({ ...options, configId: newId });
                currentConfigId = newId;
                debouncedUpdate();
            },
            onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['BSC'] })
        });
    }

    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        console.log("[BSC Widget] onOptions recebido");
        const newId = options?.configId;
        if (!isInitialized || (newId && newId !== currentConfigId)) {
            isInitialized = true;
            currentConfigId = newId;
            debouncedUpdate();
        }
    });

    window.grist.onRecords(async () => {
        if (isInitialized) debouncedUpdate();
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
});
