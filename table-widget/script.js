import '../ConfigManager/editors/table-manifest.js';
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { renderField, getFieldStyle } from '../libraries/grist-field-renderer/grist-field-renderer.js';

// Assume Tabulator is globally available because it's imported in index.html
// import Tabulator from '../libraries/tabulator/tabulator.min.js'; 

document.addEventListener('DOMContentLoaded', async function () {
    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;
    let tabulatorTable = null;
    const addRowBtn = document.getElementById('add-row-btn');

    console.log('DOMContentLoaded fired.');
    const tableContainer = document.getElementById('table-container');
    const tableLens = new GristTableLens(grist);
    let cleanSchema = null;

    grist.ready({ requiredAccess: 'full' });
    console.log('grist.ready() called.');
    console.log('Grist API ready.');

    // Explicitly get options on load to ensure configId is set if persisted
    const initialOptions = await grist.getOptions();
    if (initialOptions?.configId) {
        currentConfigId = initialOptions.configId;
        isInitialized = true; // Mark as initialized if we have a configId
        console.log('DEBUG: Initialized currentConfigId from grist.getOptions():', currentConfigId);
    }

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




    // Custom Tabulator formatter for Grist-specific cell rendering
    const gristCellFormatter = (cell, formatterParams, onRendered) => {
        const colId = cell.getField();
        const record = cell.getRow().getData();
        const colSchema = cleanSchema[colId];
        const colConfig = formatterParams.colConfig;

        if (!colSchema) {
            return String(cell.getValue() ?? '');
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'width: 100%;';

        if (colConfig) {
            if (colConfig.wrapText !== false) {
                tempContainer.style.whiteSpace = 'normal';
                if (colConfig.maxTextRows > 0) {
                    const lineHeight = 1.4; // em
                    tempContainer.style.lineHeight = `${lineHeight}em`;
                    tempContainer.style.maxHeight = `${colConfig.maxTextRows * lineHeight}em`;
                    tempContainer.style.overflow = 'hidden';
                    tempContainer.style.display = '-webkit-box';
                    tempContainer.style.webkitLineClamp = colConfig.maxTextRows;
                    tempContainer.style.webkitBoxOrient = 'vertical';
                }
            } else {
                tempContainer.style.whiteSpace = 'nowrap';
                tempContainer.style.overflow = 'hidden';
                tempContainer.style.textOverflow = 'ellipsis';
            }
        }

        // onRendered callback will be called when the cell is rendered
        onRendered(async () => {
            await renderField({
                container: tempContainer,
                colSchema: colSchema,
                record: record,
                isEditing: false,
                tableLens: tableLens,
                styling: {}
            });
        });

        return tempContainer; // Return the placeholder container synchronously
    };

    function openModal(title, content) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'grf-modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.6); display: flex;
            justify-content: center; align-items: center; z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'grf-modal-content';
        modalContent.style.cssText = `
            background-color: #fff; border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3); display: flex;
            flex-direction: column; overflow: hidden;
            width: 80%; height: 80%;
        `;

        const modalHeader = document.createElement('div');
        modalHeader.className = 'grf-modal-header';
        modalHeader.style.cssText = `
            padding: 10px 15px; display: flex; justify-content: space-between;
            align-items: center; background-color: #f1f1f1;
            border-bottom: 1px solid #ddd;
        `;

        const modalTitle = document.createElement('h4');
        modalTitle.innerText = title;
        modalTitle.style.margin = '0';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'grf-modal-close';
        closeButton.style.cssText = `
            background: none; border: none; font-size: 28px;
            font-weight: bold; color: #888; cursor: pointer;
        `;
        closeButton.onclick = () => document.body.removeChild(modalOverlay);

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'grf-modal-body';
        modalBody.style.cssText = 'padding: 15px; flex-grow: 1; overflow: auto;';
        modalBody.appendChild(content);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        });
    }

    async function showRefListInModal(colSchema, cellValue) {
        const tableContainer = document.createElement('div');
        tableContainer.style.height = '100%';

        openModal(`Records from ${colSchema.label}`, tableContainer);

        try {
            const refTableId = colSchema.type.split(':')[1];
            const refIds = cellValue.slice(1);

            const [nestedSchema, allRecords] = await Promise.all([
                tableLens.getTableSchema(refTableId),
                tableLens.fetchTableRecords(refTableId)
            ]);

            const nestedData = allRecords.filter(r => refIds.includes(r.id));
            const nestedColumns = Object.values(nestedSchema).map(col => ({
                title: col.label,
                field: col.colId,
                formatter: gristCellFormatter,
            }));

            new Tabulator(tableContainer, {
                height: '100%',
                layout: 'fitColumns',
                data: nestedData,
                columns: nestedColumns,
            });
        } catch (e) {
            console.error('Error creating nested table in modal:', e);
            tableContainer.innerText = 'Error loading nested data.';
        }
    }



    // Initial call to initializeAndUpdate to ensure it runs at least once
    console.log('Initial call to initializeAndUpdate (direct call)');
    await initializeAndUpdate();

    // Helper to add the settings gear icon
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = getIcon('icon-settings'); // Assuming icon-settings is available
        gearBtn.title = 'Widget Settings';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    // Helper to open the settings popover
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
                    <input type="text" id="popover-config-id" value="${activeConfigId}" placeholder="Paste ID here...">
                    <button id="popover-link-btn" class="config-popover-btn" title="${isLinked ? 'Unlink' : 'Link'}">
                        ${isLinked ? getIcon('icon-link') : getIcon('icon-link-broken')}
                    </button>
                </div>
            </div>
            <button id="popover-manager-btn" class_="config-popover-btn" title="Open Configuration Manager">
                ${getIcon('icon-settings')}
            </button>
        `;
        document.body.appendChild(popover);

        popover.querySelector('#popover-link-btn').onclick = async () => {
            const newId = popover.querySelector('#popover-config-id').value.trim();
            console.log('DEBUG: Calling grist.setOptions with configId:', newId || null);
            grist.setOptions({ configId: newId || null });
            // Manually update currentConfigId and re-initialize as a workaround for grist.onOptions not firing reliably after setOptions
            currentConfigId = newId || null;
            isInitialized = true; // Ensure re-initialization
            await initializeAndUpdate();
            closeSettingsPopover();
        };

        popover.querySelector('#popover-manager-btn').onclick = () => {
            closeSettingsPopover();
            openConfigManager(grist, { initialConfigId: currentConfigId, componentTypes: ['Table'] });
        };
    }

    function closeSettingsPopover() {
        const popover = document.querySelector('.config-popover');
        if (popover) popover.remove();
        const overlay = document.getElementById('config-popover-overlay');
        if (overlay) overlay.remove();
    }

    // Function to render status messages or errors
    function renderStatus(message) {
        tableContainer.innerHTML = `<div class="status-placeholder">${message}</div>`;
        addSettingsGear();
    }

    async function initializeAndUpdate() {
        renderStatus("Loading...");

        // Helper to check for table and column integrity
        const checkPrerequisites = async () => {
            try {
                const allTables = await tableLens.listAllTables();
                if (!allTables.find(t => t.id === 'Grf_config')) {
                    renderStatus("Table 'Grf_config' not found. Use the ⚙️ icon to open the manager and create it.");
                    return false;
                }
                const configSchema = await tableLens.getTableSchema('Grf_config');
                console.log('Grf_config schema:', configSchema);
                const requiredCols = {
                    configId: 'Text',
                    widgetTitle: 'Text',
                    description: 'Text',
                    componentType: 'Text',
                    configJson: 'Text',
                    tableID: 'Text' // Added tableID for direct widget linkage
                };
                const missingCols = Object.keys(requiredCols).filter(col => !configSchema[col]);

                if (missingCols.length > 0) {
                    const requiredSchemaHtml = Object.entries(requiredCols).map(([name, type]) => `<li>${name} (Type: ${type})</li>`).join('');
                    renderStatus(`
                        <div class="status-placeholder-error">
                            <p><b>Configuration Error</b></p>
                            <p>The table 'Grf_config' is not configured correctly.</p>
                            <p>Please ensure it has the following columns:</p>
                            <ul>${requiredSchemaHtml}</ul>
                        </div>
                    `);
                    return false;
                }
                return true;
            } catch (e) {
                console.error('Error in checkPrerequisites:', e);
                renderStatus(`Error checking configuration prerequisites: ${e.message}`);
                return false;
            }
        };

        if (!currentConfigId) {
            console.log('No currentConfigId. Checking prerequisites...');
            const prerequisitesMet = await checkPrerequisites();
            console.log('Prerequisites met:', prerequisitesMet);
            addSettingsGear();
            if (!prerequisitesMet) return;
            renderStatus("Widget ready. Use the ⚙️ icon to create a new configuration for this Table Widget or link an existing config ID.");
            return;
        }

        try {
            console.log('Fetching config record for configId:', currentConfigId);
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            console.log('configRecord:', configRecord);
            if (!configRecord) {
                renderStatus(`Error: Configuration with ID "${currentConfigId}" not found in table 'Grf_config'. Check ID or create a new configuration.`);
                addSettingsGear();
                return;
            }

            currentConfig = JSON.parse(configRecord.configJson);
            console.log('currentConfig (parsed from configJson):', currentConfig);

            const tableId = currentConfig.tableId;
            console.log('tableId from currentConfig:', tableId);
            if (!tableId) {
                renderStatus("Configuration Error: 'tableId' not defined in the configuration JSON.");
                addSettingsGear();
                return;
            }

            console.log('Fetching records and schema for tableId:', tableId);
            const [records, schema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId)
            ]);
            cleanSchema = schema;
            console.log('Fetched records:', records);
            console.log('Fetched cleanSchema:', cleanSchema);

            // Map Grist schema to Tabulator column definitions
            const columns = (currentConfig.columns || []).map(colConfig => {
                const gristCol = cleanSchema[colConfig.colId];
                if (!gristCol) return null; // Skip if column not found in schema

                let formatter = gristCellFormatter;

                if (gristCol.type.startsWith('RefList:')) {
                    formatter = (cell) => {
                        const cellValue = cell.getValue();
                        if (!Array.isArray(cellValue) || cellValue.length <= 1) {
                            return '[0 items]';
                        }

                        const button = document.createElement('button');
                        button.className = 'grist-reflist-button';
                        button.innerText = `[${cellValue.length - 1} items]`;
                        button.onclick = () => {
                            const colSchema = cleanSchema[cell.getField()];
                            showRefListInModal(colSchema, cellValue);
                        };
                        return button;
                    };
                }

                const isEditable = currentConfig.editMode === 'excel' && !colConfig.locked;
                const validators = [];
                if (currentConfig.editMode === 'excel' && colConfig.required) {
                    validators.push('required');
                }

                return {
                    title: gristCol.label || gristCol.colId,
                    field: gristCol.colId,
                    hozAlign: colConfig.align || 'left', // Default alignment
                    headerFilter: currentConfig.headerFilter !== false, // Enable header filters based on global config
                    width: colConfig.width || undefined, // Apply custom width
                    bottomCalc: currentConfig.enableColumnCalcs ? (colConfig.bottomCalc || undefined) : undefined, // Apply column calculation only if global option is enabled
                    editable: isEditable, // Apply editability based on mode and locked status
                    validator: validators.length > 0 ? validators.join('|') : undefined, // Apply validators
                    formatter: formatter, // Use custom Grist formatter
                    formatterParams: { 
                        ...(colConfig.formatterParams || {}),
                        colConfig: colConfig,
                    },
                    tooltip: true, // Enable tooltips for overflow
                };
            }).filter(col => col !== null); // Filter out nulls from skipped columns
            console.log('Tabulator columns:', columns);

            tableContainer.innerHTML = ''; // Clear previous content
            console.log('Initializing Tabulator...');
            tabulatorTable = new Tabulator(tableContainer, {
                height: "100%",
                data: records,
                layout: currentConfig.layout || "fitColumns",
                responsiveLayout: currentConfig.responsiveLayout || false,
                responsiveLayoutCollapseUseFormatters: false, // Disable column formatters in collapsed view
                responsiveLayoutCollapseFormatter: function(data) {
                    const list = document.createElement("ul");
                    data.forEach(function(col) {
                        const item = document.createElement("li");
                        item.innerHTML = "<strong>" + col.title + "</strong>: " + col.value;
                        list.appendChild(item);
                    });
                    return Object.keys(data).length ? list : "";
                },
                resizableColumns: currentConfig.resizableColumns !== false,
                columns: columns,
                columnCalcs: currentConfig.enableColumnCalcs ? "bottom" : false,
                tooltips: true,
                history: true,
                addRowPos: "top",
                pagination: currentConfig.pagination?.enabled || false,
                paginationSize: currentConfig.pagination?.pageSize || 10,
                paginationSizeSelector: currentConfig.pagination?.enabled ? [5, 10, 20, 50, 100] : false,
                movableColumns: true, //allow column order to be changed
                resizableRows: true, //allow row height to be changed
                initialSort: currentConfig.defaultSort?.column ? [{ column: currentConfig.defaultSort.column, dir: currentConfig.defaultSort.direction }] : [],
                // initialFilter: currentConfig.initialFilter || [], // Not implemented in editor yet
            });

            // Apply styling classes
            if (currentConfig.stripedTable) {
                tableContainer.classList.add('custom-striped-enabled');
            } else {
                tableContainer.classList.remove('custom-striped-enabled');
            }
            // Tabulator handles fixed header with height:"100%" and layout:"fitColumns" generally
                        // No specific class needed for fixedHeader unless custom CSS is applied.
                        console.log('Tabulator initialized.');
            
                        // Manual event delegation for row clicks as a workaround
                        tableContainer.addEventListener('click', async (e) => {
                            const rowElement = e.target.closest('.tabulator-row');
                            if (!rowElement) return; // Click was not on a row
            
                            console.log("Manual row click detected.", { editMode: currentConfig.editMode, drawerId: currentConfig.drawerId });
            
                            if (currentConfig.editMode === 'drawer' && currentConfig.drawerId) {
                                const row = tabulatorTable.getRow(rowElement);
                                if (!row) {
                                    console.error("Could not find Tabulator row component for the clicked element.");
                                    return;
                                }
                                const rowId = row.getData().id;
                                const tableId = currentConfig.tableId;
            
                                console.log("Attempting to open drawer from manual click:", { tableId, rowId });
                                try {
                                    const drawerConfigRecord = await tableLens.findRecord('Grf_config', { configId: currentConfig.drawerId });
                                    if (drawerConfigRecord) {
                                        const drawerConfigData = JSON.parse(drawerConfigRecord.configJson);
                                        openDrawer(tableId, rowId, drawerConfigData);
                                        console.log("openDrawer call completed from manual click.");
                                    } else {
                                        console.error(`Drawer config with ID "${currentConfig.drawerId}" not found.`);
                                        alert(`Error: Drawer configuration with ID "${currentConfig.drawerId}" not found.`);
                                    }
                                } catch (error) {
                                    console.error("Error fetching or opening drawer:", error);
                                    alert("Error opening drawer: " + error.message);
                                }
                            }
                        });
            
                        // Handle Add New Button visibility and functionality
            if (currentConfig.enableAddNewBtn) {
                addRowBtn.style.display = 'block';
                addRowBtn.onclick = async () => {
                    console.log("Add New button clicked. Edit Mode:", currentConfig.editMode);
                    if (currentConfig.editMode === 'drawer' && currentConfig.drawerId) {
                        console.log("Opening drawer for new record.");
                        try {
                            const drawerConfigRecord = await tableLens.findRecord('Grf_config', { configId: currentConfig.drawerId });
                            if (drawerConfigRecord) {
                                const drawerConfigData = JSON.parse(drawerConfigRecord.configJson);
                                // Open drawer for a new record, assuming the drawer component handles 'new'
                                openDrawer(tableId, 'new', drawerConfigData);
                                console.log("openDrawer called for new record.");
                            } else {
                                console.error(`Drawer config with ID "${currentConfig.drawerId}" not found.`);
                                alert(`Error: Drawer configuration with ID "${currentConfig.drawerId}" not found.`);
                            }
                        } catch (error) {
                            console.error("Error preparing drawer for new record:", error);
                            alert("Error opening drawer for new record: " + error.message);
                        }
                    } else {
                        console.log("Adding new record directly (Excel mode).");
                        try {
                            // Fallback to default Grist action if not in drawer mode
                            await grist.docApi.applyUserActions([['AddRecord', tableId, -1, {}]]);
                        } catch (e) {
                            console.error("Error adding new record:", e);
                            alert("Error adding new record: " + e.message);
                        }
                    }
                };
            } else {
                addRowBtn.style.display = 'none';
                addRowBtn.onclick = null;
            }

            addSettingsGear();

        } catch (e) {
            console.error(`Error during linked config load/render for ID "${currentConfigId}":`, e);
            renderStatus(`Error loading widget with configuration "${currentConfigId}": ${e.message}`);
            addSettingsGear();
        }
    }

    // Grist event listeners
    grist.onOptions(async (options) => {
        const newConfigId = options?.configId || null;
        if (newConfigId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = newConfigId;
            await initializeAndUpdate();
        }
    });

    grist.onRecords(async () => {
        console.log('grist.onRecords fired.');
        if (currentConfig && tabulatorTable) {
            console.log('Calling initializeAndUpdate from onRecords');
            await initializeAndUpdate(); // Re-fetch all data and re-render the table
        }
    });
});