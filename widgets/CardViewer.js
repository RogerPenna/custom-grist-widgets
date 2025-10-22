// --- START OF 100% COMPLETE CardViewer.js WITH DEBUG LOGS ---

// widgets/CardViewer.js
// VERSÃO CORRIGIDA PARA ÍCONES E PERSISTÊNCIA DE ID

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { CardSystem } from '../libraries/grist-card-system/CardSystem.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { GristDataWriter } from '../libraries/grist-data-writer.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Carrega o arquivo SVG e o injeta no DOM.
    async function loadIcons() {
        try {
            const response = await fetch('/libraries/icons/icons.svg');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none'; // Garante que o container do SVG não seja visível
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {
            console.error('Falha ao carregar o arquivo de ícones:', error);
        }
    }
    await loadIcons();

    const getIcon = (id) => `<svg class="icon"><use href="#${id}"></use></svg>`;

    if (typeof grist === 'undefined') {
        document.body.innerHTML = `<p class="error-msg">Erro Crítico: Grist API não carregada.</p>`;
        return;
    }

    const appContainer = document.getElementById('app-container');
    const tableLens = new GristTableLens(grist);

    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;

    async function initializeAndUpdate() {
        console.log(`[DEBUG] Entering initializeAndUpdate. Current configId: ${currentConfigId}`);
        renderStatus("Carregando...");

        // Helper to check for table and column integrity
        const checkPrerequisites = async () => {
            try {
                const allTables = await tableLens.listAllTables();
                if (!allTables.find(t => t.id === 'Grf_config')) {
                    renderStatus("Tabela 'Grf_config' não encontrada. Use o ícone ⚙️ para abrir o gerenciador e criá-la.");
                    return false;
                }
                const configSchema = await tableLens.getTableSchema('Grf_config');
                const requiredCols = {
                    configId: 'Text',
                    widgetTitle: 'Text',
                    description: 'Text',
                    componentType: 'Text',
                    configJson: 'Text',
                    pageId: 'Numeric'
                };
                const missingCols = Object.keys(requiredCols).filter(col => !configSchema[col]);

                if (missingCols.length > 0) {
                    const requiredSchemaHtml = Object.entries(requiredCols).map(([name, type]) => `<li>${name} (Tipo: ${type})</li>`).join('');
                    renderStatus(`
                        <div class="status-placeholder-error">
                            <p><b>Erro de Configuração</b></p>
                            <p>A tabela 'Grf_config' não está configurada corretamente.</p>
                            <p>Por favor, garanta que ela tenha as seguintes colunas:</p>
                            <ul>${requiredSchemaHtml}</ul>
                        </div>
                    `);
                    return false;
                }
                return true;
            } catch (e) {
                renderStatus(`Erro ao verificar pré-requisitos da configuração: ${e.message}`);
                return false;
            }
        };

        // If no configId is linked, the widget's behavior depends on the state of Grf_config
        if (!currentConfigId) {
            console.log("[DEBUG] No configId linked. Checking prerequisites...");
            const prerequisitesMet = await checkPrerequisites();
            addSettingsGear(); // Always add gear
            
            if (!prerequisitesMet) {
                console.log("[DEBUG] Prerequisites not met. Halting.");
                return; // The message is already set by checkPrerequisites
            }
            
            // If prerequisites are met, but still no ID, it means no config is linked.
            console.log("[DEBUG] Prerequisites met, but no config linked.");
            renderStatus("Widget pronto. Use o ícone ⚙️ para criar uma nova configuração para este CardViewer ou para vincular um ID de configuração existente.");
            return;
        }

        // --- Proceed with a linked configId ---
        console.log(`[DEBUG] Proceeding with linked configId: ${currentConfigId}`);
        
        // Load config, then data...
        try {
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            if (!configRecord) {
                renderStatus(`Erro: A configuração com ID "${currentConfigId}" não foi encontrada na tabela 'Grf_config'. Verifique o ID ou crie uma nova configuração.`);
                addSettingsGear();
                return;
            }

            currentConfig = JSON.parse(configRecord.configJson);
            const tableId = currentConfig.tableId;
            if (!tableId) {
                renderStatus("Erro de Configuração: 'tableId' não definido no JSON da configuração.");
                addSettingsGear();
                return;
            }

            const [records, cleanSchema, rawSchema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId),
                tableLens.getTableSchema(tableId, { mode: 'raw' })
            ]);
            
            Object.keys(cleanSchema).forEach(colId => { 
                if (rawSchema[colId] && rawSchema[colId].description) { 
                    cleanSchema[colId].description = rawSchema[colId].description; 
                }
            });

            appContainer.innerHTML = '';
            CardSystem.renderCards(appContainer, records, { ...currentConfig, tableLens: tableLens }, cleanSchema);
            addSettingsGear();
            console.log("[DEBUG] Card rendering complete.");

        } catch (e) {
            console.error(`[DEBUG] Error during linked config load/render for ID "${currentConfigId}":`, e);
            renderStatus(`Erro ao carregar o widget com a configuração "${currentConfigId}": ${e.message}`);
            addSettingsGear();
        }
    }
    
    function renderStatus(message) {
        appContainer.innerHTML = `<div class="status-placeholder">${message}</div>`;
        // The gear button will be added by addSettingsGear() after the content is set.
    }
    
    async function handleNavigationAction(config, sourceRecord, currentTableId) {
        console.log("Executando a\u00e7\u00e3o de navega\u00e7\u00e3o:", config, sourceRecord);
        if (!config || !config.actionType || !sourceRecord) {
            console.error("Configura\u00e7\u00e3o de a\u00e7\u00e3o inv\u00e1lida ou registro de origem ausente.");
            return;
        }

        if (config.actionType === 'navigateToGristPage') {
            const filterValue = sourceRecord[config.sourceValueColumn];
            if (!config.targetPageId || !config.targetFilterColumn || !filterValue) {
                alert("Configura\u00e7\u00e3o de navega\u00e7\u00e3o para p\u00e1gina Grist incompleta.");
                return;
            }
            // Grist API does not directly support navigating to a specific page by ID with a filter.
            // The best we can do for now is to inform the user about the intended action.
            alert(`A\u00e7\u00e3o: Navegar para a p\u00e1gina '${config.targetPageId}' e aplicar filtro '${config.targetFilterColumn}' = '${filterValue}'.\n\nPor favor, navegue manualmente para a p\u00e1gina desejada e aplique o filtro.`);

        } else if (config.actionType === 'openUrlFromColumn') {
            const url = sourceRecord[config.urlColumn];
            if (url) {
                window.open(url, '_blank');
            } else {
                alert(`A coluna '${config.urlColumn}' do card n\u00e3o cont\u00e9m uma URL.`);
            }
        } else if (config.actionType === 'updateRecord') {
            const dataWriter = new GristDataWriter(grist);
            if (!config.updateField || config.updateValue === undefined) {
                alert("Configura\u00e7\u00e3o de atualiza\u00e7\u00e3o de registro incompleta.");
                return;
            }
            try {
                await dataWriter.updateRecord(currentTableId, sourceRecord.id, {
                    [config.updateField]: config.updateValue
                });
                alert(`Registro atualizado: Campo '${config.updateField}' definido como '${config.updateValue}'.`);
            } catch (e) {
                console.error("Erro ao atualizar registro:", e);
                alert("Erro ao tentar atualizar o registro.");
            }
        }
    }
    
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = getIcon('icon-settings');
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn); // <--- CHANGED TO document.body
    }

    function openSettingsPopover(event) {
        event.stopPropagation();
        closeSettingsPopover();
        
        const activeConfigId = currentConfigId || '';
        const isLinked = !!activeConfigId && !!currentConfig;

        const overlay = document.createElement('div');
        overlay.id = 'config-popover-overlay';
        overlay.onclick = closeSettingsPopover;
        document.body.appendChild(overlay);

        const popover = document.createElement('div');
        popover.className = 'config-popover';
        popover.onclick = e => e.stopPropagation();
        
        popover.innerHTML = `
            <div>
                <label for="popover-config-id">Config ID</label>
                <div class="input-group">
                    <input type="text" id="popover-config-id" value="${activeConfigId}" placeholder="Cole o ID aqui...">
                    <button id="popover-link-btn" class="config-popover-btn" title="${isLinked ? 'Desvincular' : 'Vincular'}">
                        ${isLinked ? getIcon('icon-link') : getIcon('icon-link-broken')}
                    </button>
                </div>
            </div>
            <button id="popover-manager-btn" class="config-popover-btn" title="Abrir Gerenciador de Configurações">
                ${getIcon('icon-settings')}
            </button>
        `;
        document.body.appendChild(popover);

        popover.querySelector('#popover-link-btn').onclick = () => {
            const newId = popover.querySelector('#popover-config-id').value.trim();
            grist.setOptions({ configId: newId || null });
            closeSettingsPopover();
        };
        
        popover.querySelector('#popover-manager-btn').onclick = () => {
            closeSettingsPopover();
            openConfigManager(grist, { initialConfigId: currentConfigId });
        };
    }

    function closeSettingsPopover() {
        const popover = document.querySelector('.config-popover');
        if (popover) popover.remove();
        const overlay = document.getElementById('config-popover-overlay');
        if (overlay) overlay.remove();
    }

    // --- LÓGICA DE INICIALIZAÇÃO E EVENTOS ---

    grist.ready({ requiredAccess: 'full' });

    // grist.onRecords agora apenas dispara a atualização.
    grist.onRecords(() => {
        console.log("Evento onRecords disparado. Disparando atualização se a config estiver carregada.");
        if (currentConfig) {
            initializeAndUpdate();
        }
    });

	// onOptions é o gatilho principal.
    grist.onOptions(async (options) => {
        console.log("Evento onOptions disparado. Opções recebidas:", options);
        const newConfigId = options?.configId || null;
        if (newConfigId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = newConfigId;
            await initializeAndUpdate();
        }
    });

    // Lógica para o clique do card
    subscribe('grf-card-clicked', async (eventData) => {
        if (!eventData.drawerConfigId) return;
        console.log("Card clicado! Tentando abrir drawer com config:", eventData.drawerConfigId);
        try {
            const drawerConfigRecord = await tableLens.findRecord('Grf_config', { configId: eventData.drawerConfigId });
            if (drawerConfigRecord) {
                const drawerConfigData = JSON.parse(drawerConfigRecord.configJson);
                openDrawer(eventData.tableId, eventData.recordId, drawerConfigData);
            } else {
                console.error(`Configura\u00e7\u00e3o de Drawer com ID "${eventData.drawerConfigId}" n\u00e3o encontrada.`);
                alert(`Erro: A configura\u00e7\u00e3o para o painel de detalhes n\u00e3o foi encontrada.`);
            }
        } catch(e) {
            console.error("Erro ao buscar ou abrir o Drawer:", e);
        }
    });

    subscribe('grf-trigger-widget', async ({ configId, sourceRecord, rowIds, componentType }) => {
        console.log(`[DEBUG] grf-trigger-widget received: configId=${configId}, componentType=${componentType}`);
        if (!configId) {
            console.error("grf-trigger-widget: configId is missing.");
            return;
        }

        try {
            const targetWidgetConfigRecord = await tableLens.findRecord('Grf_config', { configId: configId });
            if (!targetWidgetConfigRecord) {
                alert(`Error: Configuration with ID "${configId}" not found.`);
                return;
            }
            const targetWidgetConfigData = JSON.parse(targetWidgetConfigRecord.configJson);
            
            // The componentType from the event is preferred, but fallback to the one in the config
            const targetComponentType = componentType || targetWidgetConfigData.componentType;

            await loadDynamicWidget(targetWidgetConfigData, sourceRecord, rowIds, targetComponentType);

        } catch (e) {
            console.error(`Error handling grf-trigger-widget:`, e);
            alert(`Error loading widget for config "${configId}": ${e.message}`);
        }
    });

    async function loadDynamicWidget(targetWidgetConfigData, sourceRecord, rowIdsToSelect, targetComponentType) {
        console.log(`[DEBUG] loadDynamicWidget: Loading componentType='${targetComponentType}'`);
        
        appContainer.innerHTML = ''; // Clear current content

        // Normalize component type for comparison
        const normalizedComponentType = targetComponentType ? targetComponentType.trim() : '';

        if (normalizedComponentType === 'CardSystem') {
            const tableId = targetWidgetConfigData.tableId;
            if (!tableId) {
                renderStatus("Configuration Error: 'tableId' is not defined for the triggered widget.");
                return;
            }
            
            try {
                const [records, schema] = await Promise.all([
                    tableLens.fetchTableRecords(tableId),
                    tableLens.getTableSchema(tableId)
                ]);

                let recordsToRender = records;
                if (rowIdsToSelect && Array.isArray(rowIdsToSelect) && rowIdsToSelect.length > 0) {
                    const numericRowIds = rowIdsToSelect.map(id => Number(id));
                    recordsToRender = records.filter(record => numericRowIds.includes(Number(record.id)));
                }

                CardSystem.renderCards(appContainer, recordsToRender, { ...targetWidgetConfigData, tableLens: tableLens }, schema);
                
            } catch (e) {
                renderStatus(`Error loading CardSystem widget: ${e.message}`);
            }
        } else {
            renderStatus(`Widget loaded. Component Type: '${targetComponentType}'. Data can be accessed.`);
            // Here you would add logic for other component types, like 'Drawer', 'Table', etc.
            console.log('[DEBUG] Data available for custom rendering:', {
                config: targetWidgetConfigData,
                record: sourceRecord,
                selectedIds: rowIdsToSelect
            });
        }
        
        // We might need a back button or other navigation here
        // For now, the settings gear is added as a way to get back or change config
        addSettingsGear();
    }

    // L\u00f3gica para a\u00e7\u00f5es de navega\u00e7\u00e3o (bot\u00f5es de a\u00e7\u00e3o secund\u00e1ria)
    subscribe('grf-navigation-action-triggered', async (eventData) => {
        console.log("A\u00e7\u00e3o de navega\u00e7\u00e3o disparada:", eventData);
        await handleNavigationAction(eventData.config, eventData.sourceRecord, eventData.tableId);
    });
});

// --- END OF 100% COMPLETE CardViewer.js WITH DEBUG LOGS ---