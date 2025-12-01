// BSCWidget/bsc-widget.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
// import { CardSystem } from '../libraries/grist-card-system/CardSystem.js'; // REMOVED to avoid static import issues

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("BSC Widget: DOMContentLoaded fired. Starting initialization...");

        const appContainer = document.getElementById('app-container');
        const controlsContainer = document.getElementById('controls-container');
        const mainContainer = document.getElementById('main-container');
        const statusContainer = document.getElementById('status-container');
        const modelSelector = document.getElementById('model-selector');
        const settingsIcon = document.getElementById('settings-icon');

        if (!appContainer || !controlsContainer) {
            document.body.innerHTML = "<p class='error'>Fatal Error: HTML container not found.</p>";
            return;
        }

        let activeLines = [];
        let widgetConfig = { useColoris: false }; // Default config
        let currentConfigId = null;
        let isInitialized = false;
        let currentModelId = null;

        // Silent listener to prevent "No listeners" warning from the drawer component.
        subscribe('drawer-rendered', () => { });

        // Listen for card clicks from CardSystem
        subscribe('grf-card-clicked', async (data) => {
            console.log("BSC Widget: Card clicked event received.", data);
            if (data && data.drawerConfigId) {
                try {
                    // Fetch the Drawer Configuration first
                    const drawerConfigRecord = await tableLens.findRecord('Grf_config', { configId: data.drawerConfigId });
                    if (!drawerConfigRecord) {
                        console.error(`BSC Widget: Drawer config '${data.drawerConfigId}' not found.`);
                        return;
                    }
                    const drawerConfig = JSON.parse(drawerConfigRecord.configJson);
                    
                    // Call openDrawer with correct signature: (tableId, recordId, options)
                    openDrawer(data.tableId, data.recordId, drawerConfig);
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
                    // We need to redraw arrows because their positions might have changed or they were hidden
                    // Re-fetching structure might be overkill, but ensures consistency.
                    // For now, let's just trigger a re-render if we have data.
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

        function drawObjectiveArrows(bscData) {
            activeLines.forEach(line => line.remove());
            activeLines = [];
            if (!bscData || !bscData.perspectives) return;

            // Wait for DOM update
            setTimeout(() => {
                bscData.perspectives.forEach(p => {
                    p.objectives.forEach(o => {
                        if (o.ref_obj > 0) {
                            // CardSystem uses id="record-{id}"
                            const startElem = document.getElementById(`record-${o.ref_obj}`);
                            const endElem = document.getElementById(`record-${o.id}`);
                            
                            if (startElem && endElem) {
                                try {
                                    activeLines.push(new LeaderLine(startElem, endElem, {
                                        color: 'rgba(0, 86, 168, 0.6)',
                                        size: 3,
                                        path: 'fluid',
                                        endPlug: 'arrow1',
                                        startSocket: 'bottom',
                                        endSocket: 'top'
                                    }));
                                } catch (e) { console.error("LeaderLine error:", e); }
                            }
                        }
                    });
                });
            }, 500); // Increased timeout slightly
        }

        async function renderBsc(bscData) {
            if (!bscData) { return; }
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

            // We will render each Perspective as a "Container" and Objectives as "Cards" inside it.
            // However, CardSystem renders a list of cards. 
            // So we can use CardSystem to render the Objectives list for EACH Perspective.

            // Render Perspectives using CardSystem if configured
            if (widgetConfig.perspectivesConfigId) {
                try {
                    const cardConfigRecord = await tableLens.findRecord('Grf_config', { configId: widgetConfig.perspectivesConfigId });
                    if (cardConfigRecord) {
                        let cardConfig = JSON.parse(cardConfigRecord.configJson);
                        cardConfig.tableLens = tableLens; // Inject tableLens
                        
                        // Fetch schema for Perspectives table (where bscData.perspectives comes from)
                        const perspectiveSchema = await tableLens.getTableSchema('Perspectivas');
                        
                        // PATCH CONFIG IF NEEDED
                        cardConfig = patchConfigForBSC(cardConfig, perspectiveSchema);

                        // Create a container for the cards
                        const cardsContainer = document.createElement('div');
                        cardsContainer.className = 'bsc-perspectives-grid';
                        // We let CardSystem handle the grid layout if configured there, 
                        // or we can enforce a specific layout here if the BSC requirement demands it (e.g. 1 column).
                        // For now, let's trust the Card Config to define the layout (e.g. 1 column for standard BSC).

                        await CardSystem.renderCards(cardsContainer, bscData.perspectives, cardConfig, perspectiveSchema);
                        mainContainer.appendChild(cardsContainer);
                        
                        // Arrow drawing needs to happen after rendering
                        // We need to ensure CardSystem renders IDs for objectives. 
                        // Assumption: The "Perspective Card" contains a RefList field for Objectives, 
                        // and THAT RefList is configured to show as Cards.
                        // We need to find the Objective DOM elements.
                        // Currently CardSystem doesn't guarantee IDs. We might need to patch CardSystem.
                        drawObjectiveArrows(bscData);
                        return;
                    }
                } catch (e) {
                    console.error("Error rendering Perspectives with CardSystem:", e);
                    mainContainer.innerHTML = `<p class="error">Error rendering Perspectives: ${e.message}</p>`;
                    return;
                }
            }

            // Fallback: Legacy Hardcoded Rendering (if no config selected)
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

                // Perspective Header
                const header = document.createElement('div');
                header.innerHTML = `<h2 style="color: ${p.corfundocard || '#005ea8'}; margin: 0 0 10px 0;">${p.Name}</h2>`;
                perspectiveEl.appendChild(header);

                // Objectives Container
                const objectivesContainer = document.createElement('div');
                objectivesContainer.className = 'objectives-list';
                perspectiveEl.appendChild(objectivesContainer);

                // Use CardSystem to render objectives
                // Fetch configured card options or use default
                let cardOptions = {};
                let objSchemaToUse = {
                    Nome: { type: 'Text', label: 'Objetivo' },
                    id: { type: 'Int', label: 'ID' }
                }; // Default minimal schema

                if (widgetConfig.objectivesConfigId) {
                    try {
                        const cardConfigRecord = await tableLens.findRecord('Grf_config', { configId: widgetConfig.objectivesConfigId });
                        if (cardConfigRecord) {
                            cardOptions = JSON.parse(cardConfigRecord.configJson);
                            cardOptions.tableLens = tableLens; // Inject tableLens
                            // We should also fetch the full schema for the table defined in the card config
                            // But here we are rendering p.objectives which is already data.
                            // We need the schema for the renderField logic.
                            // Assuming p.objectives comes from 'Objetivos' table.
                            objSchemaToUse = await tableLens.getTableSchema('Objetivos');
                        }
                    } catch (e) {
                        console.error("Error loading objectives card config:", e);
                        // Fallback will be used
                    }
                }

                // Default Fallback if no config or error
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

                // We need to manually add IDs to the rendered cards for arrows to work
                // CardSystem doesn't natively support custom IDs on the card element easily without modifying it.
                // BUT, we can wrap the CardSystem output or modify it after rendering.
                // Let's render first.
                await CardSystem.renderCards(objectivesContainer, p.objectives, cardOptions, objSchemaToUse);

                // Post-process to add IDs for arrows
                // We assume the order is preserved.
                const renderedCards = objectivesContainer.querySelectorAll('.cs-card');
                p.objectives.forEach((obj, index) => {
                    if (renderedCards[index]) {
                        renderedCards[index].id = `objective-${obj.id}`;
                        // Make it look like a card
                        renderedCards[index].style.cursor = 'pointer';
                        renderedCards[index].onclick = (e) => {
                            e.stopPropagation();
                            // Open Objective Drawer? Or Perspective?
                            // User requirement: "The BSC Widget will act as an intermediary... connecting arrows to the Objectives cards inside the perspective cards."
                            // Clicking an objective usually opens its details.
                            console.log("Clicked Objective:", obj);
                        };
                    }
                });

                perspectivesContainer.appendChild(perspectiveEl);

                // Add arrow down between perspectives (visual only)
                if (p !== bscData.perspectives[bscData.perspectives.length - 1]) {
                    const arrowDiv = document.createElement('div');
                    arrowDiv.style.textAlign = 'center';
                    arrowDiv.style.fontSize = '24px';
                    arrowDiv.style.color = '#ccc';
                    arrowDiv.innerHTML = '&#8595;'; // Down arrow entity
                    perspectivesContainer.appendChild(arrowDiv);
                }
            }

            mainContainer.appendChild(perspectivesContainer);
            drawObjectiveArrows(bscData);
        }

        // --- Configuration Handling ---

        const getIcon = (id) => `<svg class="icon"><use href="#${id}"></use></svg>`;

        function openSettingsPopover(event) {
            event.stopPropagation();
            closeSettingsPopover(); // Close any existing popover

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
                openConfigManager(grist, { initialConfigId: currentConfigId, componentTypes: ['BSC'] });
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
            // Auto-clear after 5 seconds if it's not an error
            if (!message.includes("Error") && !message.includes("not configured")) {
                setTimeout(() => { statusContainer.innerHTML = ""; }, 5000);
            }
        }

        async function initializeAndUpdate() {
            renderStatus("Loading configuration...");
            try {
                const options = await grist.getOptions() || {};
                currentConfigId = options.configId || null;

                if (!currentConfigId) {
                    renderStatus("Widget not configured. Link a Config ID.");
                    return;
                }

                const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
                if (configRecord && configRecord.configJson) {
                    widgetConfig = JSON.parse(configRecord.configJson);
                    console.log("Loaded widget config:", widgetConfig);
                } else {
                    renderStatus(`Error: Config "${currentConfigId}" not found.`);
                    return;
                }

                await createModelDropdown();
                renderStatus("Ready.");

            } catch (error) {
                console.error("Error during initialization:", error);
                renderStatus(`Error: ${error.message}`);
            }
        }

        async function createModelDropdown() {
            // Only recreate if empty or needed
            if (modelSelector.options.length > 1) return;

            try {
                console.log("Attempting to fetch records from 'Modelos' table...");
                const allModels = await tableLens.fetchTableRecords('Modelos');
                console.log("Fetched models:", allModels);

                if (!allModels || allModels.length === 0) {
                    console.warn("No 'Modelos' records found or table is empty.");
                    renderStatus("No 'Modelos' records found.");
                    return;
                }

                modelSelector.innerHTML = `<option value="" disabled selected>Select a Model...</option>`;
                allModels.forEach(model => {
                    console.log("Adding model option:", model);
                    modelSelector.innerHTML += `<option value="${model.id}">${model.Nome || `Model ID ${model.id}`}</option>`;
                });

                modelSelector.addEventListener('change', async (event) => {
                    currentModelId = event.target.value;
                    if (currentModelId) {
                        const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                        renderBsc(fullStructure);
                    }
                });

            } catch (error) {
                console.error("Failed to create model dropdown:", error);
                renderStatus(`Failed to load Models: ${error.message}`);
            }
        }

        // --- Event Listeners ---

        if (settingsIcon) {
            settingsIcon.onclick = openSettingsPopover;
        }

        grist.onOptions(async (options) => {
            if (!isInitialized) {
                isInitialized = true;
                return;
            }
            if (options && options.configId !== currentConfigId) {
                console.log(`Config ID changed. Re-initializing.`);
                await initializeAndUpdate();
            }
        });

        grist.onRecords(async () => {
            // Only re-render if we have a selected model
            if (currentModelId) {
                const fullStructure = await fetchFullBscStructure(parseInt(currentModelId, 10), tableLens);
                renderBsc(fullStructure);
            }
        });

        // --- Initial Load ---
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
