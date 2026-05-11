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
        console.log("[BSC Widget] Iniciando initializeAndUpdate...");
        if (!tableLens) {
            try { 
                tableLens = new GristTableLens(window.grist); 
                console.log("[BSC Widget] TableLens instanciado.");
            } catch (e) { 
                console.error("[BSC Widget] Falha ao instanciar TableLens:", e);
                mainContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro TableLens: ${e.message}</div>`;
                return; 
            }
        }
        
        const options = await window.grist.getOptions() || {};
        console.log("[BSC Widget] Opções do Grist:", options);
        
        if (options.configId) currentConfigId = options.configId;
        if (options.lastModelId) currentModelId = parseInt(options.lastModelId, 10);

        if (!currentConfigId) {
            console.warn("[BSC Widget] Nenhum configId encontrado nas opções.");
            mainContainer.innerHTML = '<div class="status-placeholder">Widget BSC não configurado. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        try {
            console.log("[BSC Widget] Buscando configuração:", currentConfigId);
            tableLens.clearConfigCache(currentConfigId);
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            
            if (!configRecord) {
                console.error("[BSC Widget] Registro de configuração não encontrado na Grf_config.");
                throw new Error(`Configuração "${currentConfigId}" não encontrada na tabela Grf_config.`);
            }
            
            widgetConfig = tableLens.parseConfigRecord(configRecord);
            console.log("[BSC Widget] Configuração processada:", widgetConfig);

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
                console.log("[BSC Widget] Renderizando modelo:", currentModelId);
                const bscData = await BSCRenderer.fetchFullBscStructure(currentModelId, tableLens, tableNames);
                console.log("[BSC Widget] Dados do BSC carregados:", bscData);
                
                await BSCRenderer.renderBsc({
                    container: mainContainer,
                    bscData: bscData,
                    config: widgetConfig,
                    tableLens: tableLens,
                    showRelationships: showRelationships
                });
                console.log("[BSC Widget] Renderização concluída.");
            } else {
                console.log("[BSC Widget] Aguardando seleção de modelo.");
                mainContainer.innerHTML = '<div class="status-placeholder">Configuração vinculada com sucesso. <br><br> Agora selecione um <b>Modelo</b> no menu superior para visualizar o Mapa Estratégico.</div>';
            }
        } catch (e) {
            console.error("[BSC Widget] Erro FATAL na renderização:", e);
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
