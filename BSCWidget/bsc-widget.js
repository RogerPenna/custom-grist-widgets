// BSCWidget/bsc-widget.js

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("BSC Widget script loaded.");

    const appContainer = document.getElementById('app');
    const controlsContainer = document.getElementById('controls-container');
    if (!appContainer || !controlsContainer) {
        document.body.innerHTML = "<p class='error'>Fatal Error: HTML container not found.</p>";
        return;
    }

    let activeLines = [];

    // Hardcoded configuration for the Perspective drawer.
    // This avoids needing a record in the Grf_config table.
    // The format uses a `tabs` array, as expected by the drawer component.
    const PERSPECTIVE_DRAWER_CONFIG = {
        title: "Edit Perspective",
        tabs: [
            {
                title: "Properties",
                fields: [
                    "Name",
                    "corfundocard",
                    "corfontecard"
                ]
            }
        ]
        // NOTE: We do NOT include "ref_model" here. The drawer's save function
        // has been improved to be non-destructive, so it will preserve the
        // original value of any field not rendered in the form.
    };

    // 1. Initialize Grist and the Table Lens
    grist.ready({ requiredAccess: 'full' });
    const tableLens = new GristTableLens(grist);

    // 2. Helper function for color manipulation
    function lightenColor(hex, percent) {
        if (!hex || typeof hex !== 'string') return '#f0f0f0';
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        let p = percent / 100;
        r = Math.min(255, Math.round(r + (255 - r) * p));
        g = Math.min(255, Math.round(g + (255 - g) * p));
        b = Math.min(255, Math.round(b + (255 - b) * p));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // 3. Core data-fetching function
    async function fetchFullBscStructure(modelId, lens) {
        console.log(`Fetching BSC structure for Model ID: ${modelId}`);
        appContainer.innerHTML = `<p>Loading structure for Model ${modelId}...</p>`;
        try {
            const [modelRecord, allPerspectives, allObjectives, allStrategies, allIndicators] = await Promise.all([
                lens.findRecord('Modelos', { id: modelId }),
                lens.fetchTableRecords('Perspectivas'),
                lens.fetchTableRecords('Objetivos'),
                lens.fetchTableRecords('Estrategias'),
                lens.fetchTableRecords('Indicadores')
            ]);
            if (!modelRecord) { throw new Error(`Model with ID ${modelId} not found.`); }
            const perspectivesForModel = allPerspectives.filter(p => p.ref_model === modelId).map(p => ({
                ...p,
                objectives: allObjectives.filter(o => o.ref_persp === p.id).map(o => ({
                    ...o,
                    strategies: allStrategies.filter(s => s.ref_obj === o.id).map(s => ({
                        ...s,
                        indicators: allIndicators.filter(i => i.ref_strategy === s.id)
                    })),
                    indicators: allIndicators.filter(i => (i.ref_objective || []).includes(o.id))
                }))
            }));
            return { ...modelRecord, perspectives: perspectivesForModel };
        } catch (error) {
            console.error("Error fetching BSC structure:", error);
            appContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            return null;
        }
    }

    // 4. Rendering and arrow-drawing functions
    function drawObjectiveArrows(bscData) {
        activeLines.forEach(line => line.remove());
        activeLines = [];
        if (!bscData || !bscData.perspectives) return;
        setTimeout(() => {
            bscData.perspectives.forEach(p => {
                p.objectives.forEach(o => {
                    if (o.ref_obj > 0) {
                        const startElem = document.getElementById(`objective-${o.ref_obj}`);
                        const endElem = document.getElementById(`objective-${o.id}`);
                        if (startElem && endElem) {
                            try {
                                activeLines.push(new LeaderLine(startElem, endElem, {
                                    color: 'rgba(0, 86, 168, 0.6)', size: 3, path: 'fluid', endPlug: 'arrow1'
                                }));
                            } catch (e) { console.error("LeaderLine error:", e); }
                        }
                    }
                });
            });
        }, 100);
    }

    function renderBsc(bscData) {
        if (!bscData) { return; }
        let html = `<div class="bsc-container"><h1>Model: ${bscData.Nome}</h1>`;
        bscData.perspectives.forEach((p, index) => {
            const bgColor = p.corfundocard || '#005ea8';
            const fontColor = p.corfontecard || '#ffffff';
            const lighterBg = lightenColor(bgColor, 60);
            // Add data-perspective-id to the perspective div
            html += `<div class="perspective" data-perspective-id="${p.id}" style="background-color: ${bgColor}; color: ${fontColor};"><h2>${p.Name}</h2><div class="objectives-container">`;
            p.objectives.forEach(o => {
                html += `<div class="objective" id="objective-${o.id}" style="background-color: ${lighterBg};"><h3>${o.Nome}</h3>`;
                if (o.strategies.length > 0) {
                    html += `<h4>Strategies:</h4>`;
                    o.strategies.forEach(s => {
                        // No longer needs a data-id for clicks
                        html += `<div class="strategy" style="background-color: ${lightenColor(bgColor, 80)};"><h5>${s.Name}</h5></div>`;
                    });
                }
                html += `</div>`;
            });
            html += `</div></div>`;
            if (index < bscData.perspectives.length - 1) { html += `<div class="arrow-down"></div>`; }
        });
        html += `</div>`;
        appContainer.innerHTML = html;
        drawObjectiveArrows(bscData);
    }

    // 5. Dropdown creation
    async function createModelDropdown() {
        controlsContainer.innerHTML = "<p>Loading models...</p>";
        try {
            // Get previously saved options first
            const savedOptions = await grist.getOptions();

            const allModels = await tableLens.fetchTableRecords('Modelos');
            if (!allModels || allModels.length === 0) {
                controlsContainer.innerHTML = "<p class='error'>No 'Modelos' records found.</p>";
                return;
            }
            const selectEl = document.createElement('select');
            selectEl.id = 'model-selector';
            selectEl.innerHTML = `<option value="" disabled selected>Select a Model...</option>`;
            allModels.forEach(model => {
                selectEl.innerHTML += `<option value="${model.id}">${model.Nome || `Model ID ${model.id}`}</option>`;
            });

            selectEl.addEventListener('change', async (event) => {
                const selectedModelId = event.target.value;
                if (selectedModelId) {
                    // Save the selection
                    await grist.setOptions({ selectedModelId: selectedModelId });
                    const fullStructure = await fetchFullBscStructure(parseInt(selectedModelId, 10), tableLens);
                    renderBsc(fullStructure);
                }
            });

            controlsContainer.innerHTML = '';
            const label = document.createElement('label');
            label.htmlFor = 'model-selector';
            label.textContent = 'BSC Model: ';
            controlsContainer.appendChild(label);
            controlsContainer.appendChild(selectEl);
            
            // If a model was previously selected, restore it
            if (savedOptions && savedOptions.selectedModelId) {
                selectEl.value = savedOptions.selectedModelId;
                // Manually trigger the change event to load the data
                selectEl.dispatchEvent(new Event('change'));
            } else {
                appContainer.innerHTML = '<p>Please select a model from the dropdown above.</p>';
            }

        } catch (error) {
            console.error("Failed to create model dropdown:", error);
            controlsContainer.innerHTML = `<p class="error">Failed to load 'Modelos': ${error.message}</p>`;
        }
    }

    // 6. NEW: Isolated function to enhance the drawer for colors
    function enhanceDrawerForColors() {
        // Use a timeout to wait for the drawer to be rendered in the DOM
        setTimeout(() => {
            const drawer = document.getElementById('grist-drawer-panel');
            if (!drawer) return;

            ['corfundocard', 'corfontecard'].forEach(colId => {
                const fieldRow = drawer.querySelector(`.drawer-field-row[data-col-id="${colId}"]`);
                if (!fieldRow) return;

                const input = fieldRow.querySelector('input, textarea');
                if (input) { // We are in EDIT mode
                    // Add a class to target with Coloris
                    input.classList.add('bsc-color-picker');
                } else { // We are in VIEW mode
                    const valueContainer = fieldRow.querySelector('.drawer-field-value');
                    const colorValue = valueContainer.textContent;
                    if (colorValue) {
                        valueContainer.innerHTML = `
                            <div class="grf-color-swatch-container">
                                <span class="grf-color-swatch" style="background-color: ${colorValue};"></span>
                                <span class="grf-color-value">${colorValue}</span>
                            </div>
                        `;
                    }
                }
            });

            // Initialize Coloris on all elements with our specific class
            if (window.Coloris) {
                Coloris({
                    el: '.bsc-color-picker',
                    themeMode: 'dark', // Optional: a nice theme
                    alpha: false
                });
            }
        }, 150); // A small delay
    }


    // 7. Event Listeners
    appContainer.addEventListener('click', async (event) => {
        const perspectiveCard = event.target.closest('.perspective');
        if (perspectiveCard) {
            const perspectiveId = parseInt(perspectiveCard.dataset.perspectiveId, 10);
            console.log(`Perspective card clicked. ID: ${perspectiveId}. Opening drawer...`);
            // Open the drawer. The 'drawer-rendered' event will handle the enhancement.
            openDrawer('Perspectivas', perspectiveId, PERSPECTIVE_DRAWER_CONFIG);
        }
    });

    // Listen for the drawer to finish rendering, then enhance it.
    subscribe('drawer-rendered', (data) => {
        // We only care about the drawer for the 'Perspectivas' table.
        if (data.tableId === 'Perspectivas') {
            console.log("Drawer was rendered. Enhancing for colors...");
            enhanceDrawerForColors();
        }
    });

    grist.on('records', () => {
        console.log("Data changed in Grist, re-creating model dropdown...");
        activeLines.forEach(line => line.remove());
        activeLines = [];
        createModelDropdown();
    });

    // Initial Load
    createModelDropdown();
});

