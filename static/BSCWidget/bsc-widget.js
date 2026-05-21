// BSCWidget/bsc-widget.js - Restaurado e funcional usando BSCRenderer
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { RelationshipLines } from '../libraries/grist-relationship-lines/RelationshipLines.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { BSCRenderer } from '../libraries/grist-bsc-renderer/BSCRenderer.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[BSC Widget] DOMContentLoaded - Inicializando...");
    
    const mainContainer = document.getElementById('main-container');
    const modelSelector = document.getElementById('model-selector');
    const toggleArrowsBtn = document.getElementById('toggle-arrows-btn');
    let tableLens;
    
    try {
        tableLens = new GristTableLens(window.grist);
    } catch (e) {
        console.warn("[BSC Widget] TableLens delayed initialization", e);
    }

    let currentConfigId = null;
    let widgetConfig = null;
    let currentModelId = null;
    let showRelationships = false;
    let isInitialized = false;
    let initTimeout = null;

    // Inicializa o sistema de linhas no container de scroll
    RelationshipLines.init(mainContainer);

    // Setup Tab Switching logic
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.dataset.tab;
            
            // Update buttons
            tabButtons.forEach(b => b.classList.toggle('active', b === btn));
            
            // Update contents
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === `tab-content-${tabId}`);
            });

            // Reposition arrows if switching back to BSC tab
            if (tabId === 'bsc') {
                setTimeout(() => RelationshipLines.reposition(), 10);
            }
        };
    });

    if (toggleArrowsBtn) {
        toggleArrowsBtn.textContent = showRelationships ? 'Ocultar Relacionamentos' : 'Mostrar Relacionamentos';
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
        }, 150); // Aumentado ligeiramente o delay
    }

    async function initializeAndUpdate() {
        console.log("[BSC Widget] Executando initializeAndUpdate...");
        
        // Verifica se o Grist está pronto e temos acesso
        try {
            if (!tableLens) {
                tableLens = new GristTableLens(window.grist);
            }
        } catch (e) {
            console.error("[BSC Widget] Erro ao instanciar TableLens:", e);
            return;
        }
        
        const options = await window.grist.getOptions().catch(e => {
            console.warn("[BSC Widget] Falha ao obter opções (pode ser falta de acesso):", e);
            return {};
        }) || {};
        
        if (options.configId) currentConfigId = options.configId;
        if (options.lastModelId) currentModelId = parseInt(options.lastModelId, 10);

        if (!currentConfigId) {
            console.warn("[BSC Widget] Nenhum configId encontrado nas opções.");
            mainContainer.innerHTML = '<div class="status-placeholder">Widget BSC não configurado. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        try {
            tableLens.clearConfigCache(currentConfigId);
            const allConfigs = await tableLens.fetchTableRecordsOrThrow('Grf_config');
            const configRecord = allConfigs.find(c => c.configId === currentConfigId);
            
            if (!configRecord) {
                throw new Error(`Configuração "${currentConfigId}" não encontrada na tabela Grf_config.`);
            }
            
            widgetConfig = tableLens.parseConfigRecord(configRecord);
            const styling = widgetConfig.styling || {};

            // Handle Tab Visibility
            const swotBtn = document.querySelector('.tab-btn[data-tab="swot"]');
            const pestalBtn = document.querySelector('.tab-btn[data-tab="pestal"]');
            if (swotBtn) swotBtn.style.display = (styling.showSwotTab !== false) ? 'block' : 'none';
            if (pestalBtn) pestalBtn.style.display = (styling.showPestalTab !== false) ? 'block' : 'none';

            // If active tab was hidden, switch to bsc
            const activeTabBtn = document.querySelector('.tab-btn.active');
            if (activeTabBtn && activeTabBtn.style.display === 'none') {
                const bscBtn = document.querySelector('.tab-btn[data-tab="bsc"]');
                if (bscBtn) bscBtn.click();
            }

            const mapping = widgetConfig.mapping || widgetConfig || {};
            const tableNames = {
                modelsTable: mapping.modelsTable || 'Modelos',
                perspectivesTable: mapping.perspectivesTable || 'Perspectivas',
                objectivesTable: mapping.objectivesTable || 'Objetivos',
                refModelCol: mapping.refModelCol || 'ref_model',
                refPerspCol: mapping.refPerspCol || 'ref_persp',
                relationshipField: mapping.relationshipField || 'ref_obj',
                relTable: mapping.relTable || '',
                relCauseCol: mapping.relCauseCol || '',
                relEffectCol: mapping.relEffectCol || '',
                relWeightCol: mapping.relWeightCol || ''
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
        let allModels = [];
        try {
            allModels = await tableLens.fetchTableRecordsOrThrow(modelsTable);
        } catch (e) {
            console.error(`[BSC Widget] Erro ao carregar modelos da tabela "${modelsTable}":`, e);
            const availableTables = await tableLens.listAllTables();
            console.log("[BSC Widget] Tabelas disponíveis no documento:", availableTables.map(t => `${t.name} (${t.id})`).join(', '));
            throw new Error(`Não foi possível encontrar a tabela de modelos "${modelsTable}". Verifique se o nome está correto na configuração.`);
        }
        
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

    /**
     * Executa ações de navegação ou atualização de dados.
     */
    async function handleNavigationAction(config, record, tableId) {
        console.log("[BSC Widget] handleNavigationAction disparado:", { actionType: config.actionType, recordId: record.id, tableId });
        try {
            if (config.actionType === 'navigateToGristPage') {
                const rowId = record[config.sourceValueColumn] || record.id;
                console.log(`[BSC Widget] Navegando para página ${config.targetPageId}, rowId: ${rowId}`);
                await window.grist.setCursorPos({ sectionId: parseInt(config.targetPageId), rowId: rowId });
            } 
            else if (config.actionType === 'openUrlFromColumn') {
                const url = record[config.urlColumn];
                if (url) {
                    console.log(`[BSC Widget] Abrindo URL: ${url}`);
                    window.open(url, '_blank');
                } else {
                    console.warn(`[BSC Widget] Coluna de URL '${config.urlColumn}' está vazia.`);
                }
            } 
            else if (config.actionType === 'updateRecord') {
                const data = { [config.updateField]: config.updateValue };
                console.log(`[BSC Widget] Atualizando record ${record.id} na tabela ${tableId}:`, data);
                await window.grist.docApi.applyUserActions([
                    ['UpdateRecord', tableId, record.id, data]
                ]);
            }
            else if (config.actionType === 'deleteRecord') {
                const msg = config.confirmationMessage || 'Are you sure you want to delete this record?';
                if (confirm(msg)) {
                    console.log(`[BSC Widget] Deletando record ${record.id} na tabela ${tableId}`);
                    await window.grist.docApi.applyUserActions([
                        ['RemoveRecord', tableId, record.id]
                    ]);
                }
            }
            else if (config.actionType === 'editRecord') {
                console.log(`[BSC Widget] Edit Record (Drawer) acionado para record ${record.id}`);
                const drawerConfigId = widgetConfig?.actions?.sidePanel?.drawerConfigId || widgetConfig?.sidePanel?.drawerConfigId;
                let drawerOptions = { ...widgetConfig, tableLens: tableLens };
                if (drawerConfigId) {
                    const fetched = await tableLens.fetchConfig(drawerConfigId);
                    if (fetched) drawerOptions = { ...fetched, tableLens: tableLens };
                }
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
                    console.log(`[BSC Widget] Adicionando sub-registro vinculado ao record ${record.id}`);
                    const subTableId = config.subRecordTableId || await tableLens.getReferencedTableId(targetRefField, tableId);
                    if (!subTableId) {
                        console.error(`[BSC Widget] Não foi possível determinar a tabela vinculada ao campo ${targetRefField} na tabela ${tableId}`);
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
                    console.error("[BSC Widget] subRecordRefField ou subRecordTableId ausente para addSubRecord", config);
                }
            }
        } catch (e) {
            console.error("[BSC Widget] Erro ao executar handleNavigationAction:", e);
        }
    }

    // Expor openDrawer globalmente
    window.GristDrawer = { open: openDrawer };

    // Subscrições globais do framework
    subscribe('grf-update-record', async (data) => {
        console.log("[BSC Widget] Evento 'grf-update-record' recebido:", data);
        try {
            await tableLens.updateRecord(data.tableId, data.recordId, data.data);
        } catch (e) {
            console.error("[BSC Widget] Erro ao atualizar registro:", e);
        }
    });

    subscribe('grf-cards-drag-start', () => {
        RelationshipLines.reposition();
    });

    subscribe('grf-cards-drag-move', () => {
        RelationshipLines.reposition();
    });

    subscribe('grf-cards-drag-end', () => {
        RelationshipLines.reposition();
        setTimeout(() => RelationshipLines.reposition(), 50);
        setTimeout(() => RelationshipLines.reposition(), 150);
        setTimeout(() => RelationshipLines.reposition(), 300);
    });

    subscribe('grf-reposition-lines', () => {
        RelationshipLines.reposition();
    });

    subscribe('grf-navigation-action-triggered', async (eventData) => {
        console.log("[BSC Widget] Evento 'grf-navigation-action-triggered' recebido:", eventData);
        await handleNavigationAction(eventData.config, eventData.sourceRecord, eventData.tableId);
    });

    subscribe('grf-card-clicked', async (data) => {
        const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.sidePanel?.drawerConfigId;
        let drawerOptions = { ...widgetConfig, tableLens };
        if (drawerConfigId) {
            const fetched = await tableLens.fetchConfig(drawerConfigId);
            if (fetched) drawerOptions = { ...fetched, tableLens };
        }
        
        // Injeta a largura vinda do widget gatilho (widgetConfig) como override
        const triggerSize = widgetConfig?.actions?.sidePanel?.size;
        if (triggerSize) {
            drawerOptions.actions = drawerOptions.actions || {};
            drawerOptions.actions.sidePanel = { ...(drawerOptions.actions.sidePanel || {}), size: triggerSize };
        }

        window.GristDrawer.open(data.tableId, data.recordId, drawerOptions);
    });

    // FINALIZAÇÃO: Notifica o Grist que estamos prontos e pedimos acesso total
    console.log("[BSC Widget] Chamando grist.ready...");
    window.grist.ready({ requiredAccess: 'full' });
});
