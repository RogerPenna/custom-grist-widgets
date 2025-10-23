import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

// Assume Tabulator is globally available because it's imported in index.html
// import Tabulator from '../libraries/tabulator/tabulator.min.js'; 

document.addEventListener('DOMContentLoaded', async function () {
    console.log('DOMContentLoaded fired.');
    const tableContainer = document.getElementById('table-container');
    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;
    let tabulatorTable = null;

    grist.ready({ requiredAccess: 'full' });
    console.log('grist.ready() called.');
    console.log('Grist API ready.');

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
        console.log('initializeAndUpdate called.');
        renderStatus("Loading...");

        const tableLens = new GristTableLens(grist);

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
                    pageId: 'Numeric',
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

            const tableID = currentConfig.tableID;
            console.log('tableID from currentConfig:', tableID);
            if (!tableID) {
                renderStatus("Configuration Error: 'tableId' not defined in the configuration JSON.");
                addSettingsGear();
                return;
            }

            console.log('Fetching records and schema for tableID:', tableID);
            const [records, cleanSchema] = await Promise.all([
                tableLens.fetchTableRecords(tableID),
                tableLens.getTableSchema(tableID)
            ]);
            console.log('Fetched records:', records);
            console.log('Fetched cleanSchema:', cleanSchema);

            // Map Grist schema to Tabulator column definitions
            const columns = Object.keys(cleanSchema).map(colId => {
                const gristCol = cleanSchema[colId];
                return {
                    title: gristCol.label || gristCol.colId,
                    field: gristCol.colId,
                    hozAlign: 'left', // Default alignment
                    headerFilter: true, // Enable header filters
                    // Potentially add more type-specific formatters/editors here
                };
            });
            console.log('Tabulator columns:', columns);

            tableContainer.innerHTML = ''; // Clear previous content
            console.log('Initializing Tabulator...');
            tabulatorTable = new Tabulator(tableContainer, {
                height: "100%", //set height of table (in CSS or here), this enables the Virtual DOM and improves performance with large tables
                data: records, //assign data to table
                layout: "fitColumns", //fit columns to width of table (optional)
                columns: columns, //define table columns
                // Additional Tabulator options
                tooltips: true, //show tool tips on cells
                addRowPos: "top", //when adding a new row, add it to the top of the table
                history: true, //allow undo and redo actions on the table
                pagination: "local", //paginate the data
                paginationSize: 10, //allow 7 rows to be displayed at a time
                paginationSizeSelector: [5, 10, 20, 50, 100],
                movableColumns: true, //allow column order to be changed
                resizableRows: true, //allow row height to be changed
                initialSort: currentConfig.initialSort || [], // e.g., [{column:"name", dir:"asc"}]
                initialFilter: currentConfig.initialFilter || [], // e.g., [{field:"age", type:">", value:18}]
            });
            console.log('Tabulator initialized.');
            addSettingsGear();

        } catch (e) {
            console.error(`Error during linked config load/render for ID "${currentConfigId}":`, e);
            renderStatus(`Error loading widget with configuration "${currentConfigId}": ${e.message}`);
            addSettingsGear();
        }
    }

    // Grist event listeners
    grist.onOptions(async (options) => {
        console.log('grist.onOptions fired. Options:', options);
        const newConfigId = options?.configId || null;
        if (newConfigId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = newConfigId;
            console.log('Calling initializeAndUpdate from onOptions');
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
