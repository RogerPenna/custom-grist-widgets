// BSCWidget/bsc-widget.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { RelationshipLines } from '../libraries/grist-relationship-lines/RelationshipLines.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("BSC Widget: DOMContentLoaded fired. Starting initialization...");

        const appContainer = document.getElementById('app-container');
        const controlsContainer = document.getElementById('controls-container');
        const mainContainer = document.getElementById('main-container');
        const statusContainer = document.getElementById('status-container');
        const modelSelector = document.getElementById('model-selector');
        const settingsIcon = document.getElementById('settings-gear-btn');

        if (!appContainer || !controlsContainer) {
            document.body.innerHTML = "<p class='error'>Fatal Error: HTML container not found.</p>";
            return;
        }

        let widgetConfig = { useColoris: false }; // Default config
        let currentConfigId = null;
        let isInitialized = false;
        let currentModelId = null;
        let showRelationships = false; // FIXED: Set to OFF by default
        let lastBscData = null;

        const toggleArrowsBtn = document.getElementById('toggle-arrows-btn');
        const bscScrollContainer = document.getElementById('main-container');

        // Inicializa o sistema de linhas
        RelationshipLines.init(bscScrollContainer);

        // Listener para o botão de Toggle de Relacionamentos
        if (toggleArrowsBtn) {
            // Initial text based on default state
            toggleArrowsBtn.textContent = showRelationships ? 'Ocultar Relacionamentos' : 'Mostrar Relacionamentos';
            
            toggleArrowsBtn.onclick = (e) => {
                e.stopPropagation();
                showRelationships = !showRelationships;
                toggleArrowsBtn.textContent = showRelationships ? 'Ocultar Relacionamentos' : 'Mostrar Relacionamentos';
                
                if (showRelationships) {
                    if (lastBscData) {
                        RelationshipLines.drawFromBscData(lastBscData);
                    }
                } else {
                    RelationshipLines.clear();
                }
            };
        }

        // Silent listener to prevent "No listeners" warning from the drawer component.
        subscribe('drawer-rendered', () => { });

        // Navigation Action Handler
        subscribe('grf-navigation-action-triggered', async (eventData) => {
            console.log("BSC Widget: Navigation action triggered.", eventData);
            await handleNavigationAction(eventData.config, eventData.sourceRecord, eventData.tableId);
        });

        // Refresh UI when data is changed in the drawer
        subscribe('data-changed', async (info) => {
            console.log("BSC Widget: Data changed event received.", info);
            if (currentModelId) {
                const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                renderBsc(fullStructure);
            }
        });

        // Helper to resolve drawer options for a specific table
        async function resolveDrawerOptions(tableId, providedOptions = {}, drawerConfigId = null) {
            console.log(`[BSC Widget] Resolving drawer options for table: ${tableId}, drawerConfigId: ${drawerConfigId}`);
            
            // 1. If we have an explicit drawerConfigId, fetch it
            if (drawerConfigId) {
                try {
                    const specializedConfig = await tableLens.fetchConfig(drawerConfigId);
                    if (specializedConfig) {
                        return { ...specializedConfig, tableLens: tableLens };
                    }
                } catch (e) {
                    console.warn(`[BSC Widget] Failed to fetch specialized drawer config ${drawerConfigId}:`, e);
                }
            }

            // 2. Fallback: Determine which of our main configs applies to this table
            let fallbackConfigId = null;
            if (tableId === 'Perspectivas') {
                fallbackConfigId = widgetConfig.perspectivesConfigId;
            } else if (tableId === 'Objetivos') {
                fallbackConfigId = widgetConfig.objectivesConfigId;
            }

            if (fallbackConfigId) {
                try {
                    const fallbackConfig = await tableLens.fetchConfig(fallbackConfigId);
                    if (fallbackConfig) {
                        return { ...fallbackConfig, tableLens: tableLens };
                    }
                } catch (e) {
                    console.warn(`[BSC Widget] Failed to fetch fallback config ${fallbackConfigId}:`, e);
                }
            }

            // 3. Last resort: Use provided options (from CardSystem) or global widgetConfig (if they match the table)
            // We check if the tableId matches to avoid passing BSC config to an Objective drawer
            if (providedOptions.tableId === tableId) {
                return { ...providedOptions, tableLens: tableLens };
            }
            
            return { tableLens: tableLens }; // Default (auto-render)
        }

        // Listen for card clicks from CardSystem
        subscribe('grf-card-clicked', async (data) => {
            console.log("BSC Widget: Card clicked event received.", data);
            if (data) {
                try {
                    // RESOLUÇÃO DE CONFIGURAÇÃO DO DRAWER:
                    const drawerConfigId = data.drawerConfigId || widgetConfig?.actions?.sidePanel?.drawerConfigId || widgetConfig?.sidePanel?.drawerConfigId;
                    
                    const drawerOptions = await resolveDrawerOptions(data.tableId, data.cardConfig, drawerConfigId);
                    
                    window.GristDrawer.open(data.tableId, data.recordId, drawerOptions);
                } catch (e) {
                    console.error("BSC Widget: Error opening drawer:", e);
                }
            }
        });

        // --- Core Grist and rendering logic ---

        console.log("BSC Widget: Calling grist.ready...");
        grist.ready({ requiredAccess: 'full' });
        console.log("BSC Widget: Initializing GristTableLens...");
        const tableLens = new GristTableLens(grist);

        // Dynamic import for CardSystem
        console.log("BSC Widget: Dynamically importing CardSystem...");
        const { CardSystem } = await import('../libraries/grist-card-system/CardSystem.js');
        console.log("BSC Widget: CardSystem imported successfully.");

        // --- Tab Handling ---
        const tabs = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                // Update Tab Buttons
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update Tab Content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-content-${target}`) {
                        content.classList.add('active');
                    }
                });

                // Redraw arrows if switching back to BSC
                if (target === 'bsc' && currentModelId) {
                    fetchFullBscStructure(currentModelId, tableLens).then(renderBsc);
                }
            });
        });

        // --- BSC Logic ---

        function lightenColor(hex, percent) {
            if (!hex || typeof hex !== 'string') return '#f0f0f0';
            let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            let p = percent / 100;
            r = Math.min(255, Math.round(r + (255 - r) * p));
            g = Math.min(255, Math.round(g + (255 - g) * p));
            b = Math.min(255, Math.round(b + (255 - b) * p));
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }

        async function fetchFullBscStructure(modelId, lens) {
            console.log(`Fetching BSC structure for Model ID: ${modelId}`);
            const [modelRecord, allPerspectives, allObjectives] = await Promise.all([
                lens.findRecord('Modelos', { id: modelId }),
                lens.fetchTableRecords('Perspectivas'),
                lens.fetchTableRecords('Objetivos'),
            ]);
            if (!modelRecord) { throw new Error(`Model with ID ${modelId} not found.`); }

            // Sort perspectives by 'Ordem' if available, otherwise by ID
            const perspectivesForModel = allPerspectives
                .filter(p => p.ref_model === modelId)
                .sort((a, b) => (a.Ordem || a.id) - (b.Ordem || b.id))
                .map(p => ({
                    ...p,
                    objectives: allObjectives.filter(o => o.ref_persp === p.id)
                }));
            return { ...modelRecord, perspectives: perspectivesForModel };
        }

        function createAddButton(position, tableId, contextInfo, specificConfigId) {
            const btn = document.createElement('button');
            btn.className = `grf-global-add-btn grf-add-${tableId} pos-${position}`;
            btn.title = "Adicionar Novo Registro";
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="currentColor"/></svg>`;
            
            btn.onclick = async (e) => {
                e.stopPropagation();
                let addConfig = widgetConfig;
                
                if (specificConfigId) {
                    const rec = await tableLens.findRecord('Grf_config', { configId: specificConfigId });
                    if (rec) addConfig = tableLens.parseConfigRecord(rec);
                }

                const initialData = {};
                if (contextInfo && contextInfo.tableId && contextInfo.recordId) {
                    // DESCOBERTA DINÂMICA DE RELAÇÃO
                    const linkField = await tableLens.findRelationField(tableId, contextInfo.tableId);
                    if (linkField) {
                        console.log(`[BSC Widget] Relação encontrada: ${tableId}.${linkField} -> ${contextInfo.tableId}`);
                        initialData[linkField] = contextInfo.recordId;
                    } else {
                        console.warn(`[BSC Widget] Nenhuma relação encontrada entre ${tableId} e ${contextInfo.tableId}`);
                    }
                }

                if (window.GristDrawer) {
                    window.GristDrawer.open(tableId, 'new', { 
                        ...addConfig, 
                        tableLens: tableLens,
                        initialData: initialData 
                    });
                }
            };
            return btn;
        }

        async function renderBsc(bscData) {
            if (!bscData) { return; }
            lastBscData = bscData;
            mainContainer.innerHTML = ""; // Clear existing content

            // Helper to patch config if Conditional Formatting is impossible but color columns exist
            function patchConfigForBSC(config, schema) {
                if (!config || !config.styling) return config;
                // If mode is 'conditional' (which fails in BSC) and we have explicit color columns, switch mode.
                if (config.styling.cardsColorMode === 'conditional') {
                    if (schema['corfundocard']) {
                        console.log("BSC Widget: Patching config to use 'corfundocard' instead of conditional formatting.");
                        const newConfig = JSON.parse(JSON.stringify(config)); // Deep copy
                        newConfig.styling.cardsColorMode = 'text-value';
                        newConfig.styling.cardsColorTextField = 'corfundocard';
                        if (schema['corfontecard']) {
                            newConfig.styling.cardsColorFontField = 'corfontecard';
                            // Ensure text application is enabled if font field is present
                            newConfig.styling.cardsColorApplyText = true;
                        }
                        return newConfig;
                    }
                }
                return config;
            }

            // Determine which Card Config to use based on Model Type
            const modelType = bscData.TipoModelo; 
            console.log(`BSC Widget: Rendering for Model Type: '${modelType}'`);

            // --- Configurações de Ações ---
            const actions = widgetConfig.actions || {};

            let targetConfigId = widgetConfig.perspectivesConfigId; // Default / Mapa Estratégico

            if (modelType === 'Objetivos Qualidade' && widgetConfig.qualityConfigId) {
                targetConfigId = widgetConfig.qualityConfigId;
            } else if (modelType === 'Requisitos Partes Interessadas' && widgetConfig.requirementsConfigId) {
                targetConfigId = widgetConfig.requirementsConfigId;
            }

            // Render Perspectives using CardSystem if configured
            if (targetConfigId) {
                try {
                    let cardConfig = await tableLens.fetchConfig(targetConfigId);
                    if (cardConfig) {
                        cardConfig.tableLens = tableLens; 
                        
                        // Determina se deve mostrar botões de Adicionar Perspectiva
                        const showAddPersp = (actions.showAddPerspective !== undefined) ? actions.showAddPerspective : (cardConfig.showAddButtonTop || cardConfig.actions?.showAddButtonTop || widgetConfig.showAddPerspective);
                        
                        if (showAddPersp) {
                            const addBtnTop = createAddButton('static-top', 'Perspectivas', { tableId: 'Modelos', recordId: bscData.id }, actions.addPerspectiveConfigId || cardConfig.addRecordConfigId || widgetConfig.addPerspectiveConfigId);
                            mainContainer.appendChild(addBtnTop);
                        }

                        // Pass BSC actions as fieldConfig overrides for nested RefLists (Objectives)
                        const fieldConfigOverrides = {};
                        if (actions.showAddObjective !== undefined) {
                            fieldConfigOverrides['Objetivos'] = {
                                showAddButton: actions.showAddObjective,
                                addRecordConfigId: actions.addObjectiveConfigId
                            };
                        }

                        // Fetch schema for Perspectives table
                        const perspectiveSchema = await tableLens.getTableSchema('Perspectivas');
                        
                        // PATCH CONFIG IF NEEDED
                        cardConfig = patchConfigForBSC(cardConfig, perspectiveSchema);

                        // Create a container for the cards
                        const cardsContainer = document.createElement('div');
                        cardsContainer.className = 'bsc-perspectives-grid';

                        // IMPORTANTE: Passamos o cardConfig completo para o CardSystem
                        await CardSystem.renderCards(cardsContainer, bscData.perspectives, { 
                            ...cardConfig, 
                            fieldConfig: { ...(cardConfig.fieldConfig || {}), ...fieldConfigOverrides }
                        }, perspectiveSchema);
                        mainContainer.appendChild(cardsContainer);

                        if (showAddPersp) {
                            const addBtnBottom = createAddButton('static-bottom', 'Perspectivas', { tableId: 'Modelos', recordId: bscData.id }, actions.addPerspectiveConfigId || cardConfig.addRecordConfigId || widgetConfig.addPerspectiveConfigId);
                            mainContainer.appendChild(addBtnBottom);
                        }
                        
                        if (showRelationships) {
                            await RelationshipLines.drawFromBscData(bscData);
                        }
                        return;
                    }
                } catch (e) {
                    console.error("Error rendering Perspectives with CardSystem:", e);
                    mainContainer.innerHTML = `<p class="error">Error rendering Perspectives: ${e.message}</p>`;
                    return;
                }
            }

            // Fallback: Legacy Hardcoded Rendering (if no config selected)
            const showAddPerspLegacy = (actions.showAddPerspective !== undefined) ? actions.showAddPerspective : widgetConfig.showAddPerspective;
            if (showAddPerspLegacy) {
                const addBtnTop = createAddButton('static-top', 'Perspectivas', { tableId: 'Modelos', recordId: bscData.id }, actions.addPerspectiveConfigId || widgetConfig.addPerspectiveConfigId);
                mainContainer.appendChild(addBtnTop);
            }

            const perspectivesContainer = document.createElement('div');
            perspectivesContainer.className = 'bsc-perspectives-container';
            perspectivesContainer.style.display = 'flex';
            perspectivesContainer.style.flexDirection = 'column';
            perspectivesContainer.style.gap = '20px';

            for (const p of bscData.perspectives) {
                const perspectiveEl = document.createElement('div');
                perspectiveEl.className = 'perspective-block';
                perspectiveEl.dataset.perspectiveId = p.id;
                perspectiveEl.style.border = `2px solid ${p.corfundocard || '#005ea8'}`;
                perspectiveEl.style.borderRadius = '8px';
                perspectiveEl.style.padding = '10px';
                perspectiveEl.style.backgroundColor = '#fff';
                perspectiveEl.style.position = 'relative'; 

                // Perspective Header
                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.marginBottom = '10px';
                header.innerHTML = `<h2 style="color: ${p.corfundocard || '#005ea8'}; margin: 0;">${p.Name}</h2>`;

                // --- BOTÃO ADICIONAR OBJETIVO (Inline) ---
                const showAddObj = (actions.showAddObjective !== undefined) ? actions.showAddObjective : widgetConfig.showAddObjective;
                if (showAddObj) {
                    const addObjBtn = createAddButton('inline', 'Objetivos', { tableId: 'Perspectivas', recordId: p.id }, actions.addObjectiveConfigId || widgetConfig.addObjectiveConfigId);
                    addObjBtn.style.position = 'static';
                    addObjBtn.style.width = '24px';
                    addObjBtn.style.height = '24px';
                    addObjBtn.style.padding = '4px';
                    header.appendChild(addObjBtn);
                }

                perspectiveEl.appendChild(header);

                // Objectives Container
                const objectivesContainer = document.createElement('div');
                objectivesContainer.className = 'objectives-list';
                perspectiveEl.appendChild(objectivesContainer);

                let cardOptions = {};
                let objSchemaToUse = {
                    Nome: { type: 'Text', label: 'Objetivo' },
                    id: { type: 'Int', label: 'ID' }
                }; 

                if (widgetConfig.objectivesConfigId) {
                    try {
                        cardOptions = await tableLens.fetchConfig(widgetConfig.objectivesConfigId);
                        if (cardOptions) {
                            cardOptions.tableLens = tableLens; 
                            objSchemaToUse = await tableLens.getTableSchema('Objetivos');
                        }
                    } catch (e) {
                        console.error("Error loading objectives card config:", e);
                    }
                }

                if (!cardOptions.layout) {
                     cardOptions = {
                        tableLens: tableLens, 
                        layout: [
                            { colId: 'Nome', row: 0, col: 0, colSpan: 10, style: { labelVisible: false, isTitleField: true } }
                        ],
                        styling: {
                            widgetPadding: '0px',
                            cardsSpacing: '5px',
                            internalCardPadding: '8px',
                            cardsColorMode: 'solid',
                            cardsColorSolidColor: lightenColor(p.corfundocard || '#005ea8', 80),
                            cardBorderThickness: 1,
                            cardBorderSolidColor: p.corfundocard || '#005ea8'
                        },
                        numRows: 1
                    };
                }

                await CardSystem.renderCards(objectivesContainer, p.objectives, cardOptions, objSchemaToUse);

                const renderedCards = objectivesContainer.querySelectorAll('.cs-card');
                p.objectives.forEach((obj, index) => {
                    if (renderedCards[index]) {
                        renderedCards[index].id = `record-${obj.id}`;
                        renderedCards[index].style.cursor = 'pointer';
                        renderedCards[index].onclick = (e) => {
                            e.stopPropagation();
                            console.log("Clicked Objective:", obj);
                        };
                    }
                });

                perspectivesContainer.appendChild(perspectiveEl);

                if (p !== bscData.perspectives[bscData.perspectives.length - 1]) {
                    const arrowDiv = document.createElement('div');
                    arrowDiv.style.textAlign = 'center';
                    arrowDiv.style.fontSize = '24px';
                    arrowDiv.style.color = '#ccc';
                    arrowDiv.innerHTML = '&#8595;'; 
                    perspectivesContainer.appendChild(arrowDiv);
                }
            }

            mainContainer.appendChild(perspectivesContainer);

            if (showAddPerspLegacy) {
                const addBtnBottom = createAddButton('static-bottom', 'Perspectivas', { tableId: 'Modelos', recordId: bscData.id }, actions.addPerspectiveConfigId || widgetConfig.addPerspectiveConfigId);
                mainContainer.appendChild(addBtnBottom);
            }

            if (showRelationships) {
                RelationshipLines.drawFromBscData(bscData);
            }
        }

        // --- Configuration Handling ---

        const getIcon = (id) => `<svg class="icon"><use href="#${id}"></use></svg>`;

        function openSettingsPopover(event) {
            event.stopPropagation();
            closeSettingsPopover(); 

            const isLinked = !!currentConfigId;

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
                        <input type="text" id="popover-config-id" value="${currentConfigId || ''}" placeholder="Paste ID here...">
                        <button id="popover-link-btn" class="config-popover-btn" title="${isLinked ? 'Unlink' : 'Link'}">
                            ${isLinked ? getIcon('icon-link') : getIcon('icon-link-broken')}
                        </button>
                    </div>
                </div>
                <button id="popover-manager-btn" class="config-popover-btn" title="Open Configuration Manager">
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
                openConfigManager(grist, { initialConfigId: currentConfigId, componentTypes: ['BSC', 'Card System', 'Drawer', 'Card Style', 'Table'] });
            };
        }

        function closeSettingsPopover() {
            const popover = document.querySelector('.config-popover');
            if (popover) popover.remove();
            const overlay = document.getElementById('config-popover-overlay');
            if (overlay) overlay.remove();
        }

        function renderStatus(message) {
            statusContainer.innerHTML = `<span class="status-message">${message}</span>`;
            if (!message.includes("Error") && !message.includes("not configured")) {
                setTimeout(() => { statusContainer.innerHTML = ""; }, 5000);
            }
        }

        async function initializeAndUpdate() {
            renderStatus("Loading configuration...");
            try {
                const options = await grist.getOptions() || {};
                currentConfigId = options.configId || null;
                if (options.lastModelId) {
                    currentModelId = options.lastModelId;
                }

                if (!currentConfigId) {
                    renderStatus("Widget not configured. Link a Config ID.");
                    return;
                }

                const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
                if (configRecord) {
                    widgetConfig = tableLens.parseConfigRecord(configRecord);
                } else {
                    widgetConfig = await tableLens.fetchConfig(currentConfigId);
                }
                console.log("Loaded widget config (unified):", widgetConfig);

                await createModelDropdown();
                renderStatus("Ready.");

            } catch (error) {
                console.error("Error during initialization:", error);
                renderStatus(`Error: ${error.message}`);
            }
        }

        async function createModelDropdown() {
            if (modelSelector.options.length > 1) {
                if (currentModelId) {
                    modelSelector.value = currentModelId;
                }
                return;
            }

            try {
                const allModels = await tableLens.fetchTableRecords('Modelos');
                if (!allModels || allModels.length === 0) {
                    renderStatus("No 'Modelos' records found.");
                    return;
                }

                modelSelector.innerHTML = `<option value="" disabled selected>Select a Model...</option>`;
                allModels.forEach(model => {
                    modelSelector.innerHTML += `<option value="${model.id}">${model.Nome || `Model ID ${model.id}`}</option>`;
                });

                modelSelector.addEventListener('change', async (event) => {
                    currentModelId = event.target.value;
                    await grist.setOptions({ ...await grist.getOptions(), lastModelId: currentModelId });
                    
                    if (currentModelId) {
                        const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                        renderBsc(fullStructure);
                    }
                });

                if (currentModelId) {
                    modelSelector.value = currentModelId;
                    if (modelSelector.value === currentModelId) {
                         const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                         renderBsc(fullStructure);
                    } else {
                        currentModelId = null; 
                    }
                }

            } catch (error) {
                console.error("Failed to create model dropdown:", error);
                renderStatus(`Failed to load Models: ${error.message}`);
            }
        }

        if (settingsIcon) {
            settingsIcon.onclick = openSettingsPopover;
        }

        grist.onOptions(async (options) => {
            if (!isInitialized) {
                isInitialized = true;
                return;
            }
            if (options && options.configId !== currentConfigId) {
                await initializeAndUpdate();
            }
        });

        grist.onRecords(async () => {
            if (currentModelId) {
                const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                renderBsc(fullStructure);
            }
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
                    if (window.GristDrawer) {
                        console.log(`[BSC Widget] Abrindo Gaveta para editar record ${record.id} na tabela ${tableId}`);
                        const drawerOptions = await resolveDrawerOptions(tableId, {}, config.drawerConfigId);
                        window.GristDrawer.open(tableId, record.id, drawerOptions);
                    } else {
                        console.error("[BSC Widget] window.GristDrawer não encontrado para editRecord");
                    }
                }
                else if (config.actionType === 'addSubRecord') {
                    const subTableId = config.subRecordTableId;
                    const refFieldId = config.subRecordRefField;

                    if (window.GristDrawer && subTableId && refFieldId) {
                        console.log(`[BSC Widget] Adicionando sub-registro na tabela ${subTableId}, vinculado via ${refFieldId} ao pai ${record.id}`);
                        
                        let addConfig = {};
                        if (config.subRecordConfigId) {
                            try {
                                addConfig = await tableLens.fetchConfig(config.subRecordConfigId);
                            } catch (e) {
                                console.warn(`[BSC Widget] Falha ao carregar config ${config.subRecordConfigId}, usando padrão.`, e);
                            }
                        }
                        
                        // Dados iniciais para vincular ao pai
                        const initialData = { [refFieldId]: record.id };
                        
                        window.GristDrawer.open(subTableId, 'new', { 
                            ...addConfig,
                            tableLens: tableLens,
                            initialData: initialData
                        });
                    } else {
                        console.error("[BSC Widget] Configuração incompleta para addSubRecord", { 
                            hasDrawer: !!window.GristDrawer, 
                            subTableId, 
                            refFieldId 
                        });
                        alert("Erro: Ação 'Add Sub-Record' não está configurada corretamente (Tabela ou Campo de Vínculo ausentes).");
                    }
                }
            } catch (e) {
                console.error("[BSC Widget] Erro ao executar handleNavigationAction:", e);
            }
        }

        await initializeAndUpdate();

    } catch (fatalError) {
        console.error("FATAL ERROR in BSC Widget:", fatalError);
        document.body.innerHTML = `<div style="color:red; padding:20px; border:2px solid red;">
            <h1>Fatal Error</h1>
            <p>${fatalError.message}</p>
            <pre>${fatalError.stack}</pre>
        </div>`;
    }
});
