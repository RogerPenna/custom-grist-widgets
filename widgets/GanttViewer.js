// widgets/GanttViewer.js
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js?v=1.0.4';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js?v=1.0.4';
import { GanttRenderer } from '../libraries/grist-gantt-renderer/GanttRenderer.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js?v=1.0.4';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.4';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js?v=1.0.4';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[GanttViewer] DOMContentLoaded - Inicializando...");
    const contentArea = document.getElementById('gantt-content-area');
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfigId = urlParams.get('configId');

    let tableLens = new GristTableLens(window.grist);
    let currentConfig = null;
    let currentConfigId = urlConfigId || null;
    let isInitialized = false;

    // NAVIGATION STATE FOR DRILL DOWN
    const navigationStack = [];
    let currentFilter = null;

    // Expose openDrawer globally
    window.GristDrawer = { open: openDrawer };

    async function initializeAndUpdate() {
        console.log(`[GanttViewer] initializeAndUpdate. ConfigId: ${currentConfigId}`);
        contentArea.innerHTML = `<div class="status-placeholder">Carregando...</div>`;

        // Update nav bar UI for drill-down
        const navBar = document.getElementById('nav-bar-container');
        const breadcrumbArea = document.getElementById('breadcrumb-area');
        if (navigationStack.length > 0) {
            if (navBar) navBar.style.display = 'flex';
            if (breadcrumbArea) {
                const breadcrumbs = navigationStack.map(s => s.title).join(' > ');
                breadcrumbArea.innerText = breadcrumbs + ' > ' + (currentFilter?.sourceLabel || 'Filtrado');
            }
        } else {
            if (navBar) navBar.style.display = 'none';
        }

        if (!currentConfigId) {
            contentArea.innerHTML = `<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular uma configuração.</div>`;
            addSettingsGear();
            return;
        }

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId);
            if (!currentConfig) throw new Error(`Configuração "${currentConfigId}" não encontrada.`);

            const tableId = currentConfig.tableId;
            let records = await tableLens.fetchTableRecords(tableId);

            // Apply Drill-down Filter
            if (currentFilter && currentFilter.column && currentFilter.value && !currentFilter.disableFiltering) {
                console.log(`[GanttViewer] Aplicando filtro drill-down: ${currentFilter.column} = ${currentFilter.value}`);
                records = records.filter(r => {
                    const val = r[currentFilter.column];
                    if (Array.isArray(val)) return val.includes(currentFilter.value);
                    return val == currentFilter.value;
                });
            }

            contentArea.innerHTML = '';
            await GanttRenderer.renderGantt({
                container: contentArea,
                records,
                config: currentConfig,
                tableLens
            });
            addSettingsGear();
        } catch (e) {
            console.error(e);
            contentArea.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
            addSettingsGear();
        }
    }

    async function loadDynamicWidget(configId, filterData = null) {
        if (currentConfigId) {
            navigationStack.push({
                configId: currentConfigId,
                filter: currentFilter,
                title: currentConfig?.widgetTitle || "Início"
            });
        }
        currentConfigId = configId;
        currentFilter = filterData;
        await initializeAndUpdate();
    }

    async function goBack() {
        if (navigationStack.length > 0) {
            const prevState = navigationStack.pop();
            currentConfigId = prevState.configId;
            currentFilter = prevState.filter;
            await initializeAndUpdate();
        }
    }

    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.onclick = (e) => {
            e.stopPropagation();
            goBack();
        };
    }

    // Settings Gear configuration
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    async function openSettingsPopover(event) {
        event.stopPropagation();
        await GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig,
            onLink: async (newId) => {
                const options = await window.grist.getOptions() || {};
                await window.grist.setOptions({ ...options, configId: newId });
                currentConfigId = newId;
                await initializeAndUpdate();
            },
            onOpenManager: () => openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['Gantt'] })
        });
    }

    // --- EVENT BUS SUBSCRIPTIONS ---
    
    // Drill down event from other widgets
    subscribe('grf-trigger-widget', async (data) => {
        if (data.configId && data.componentType?.toLowerCase().replace(/\s+/g, '') === 'gantt') {
            await loadDynamicWidget(data.configId, {
                value: data.filterValue,
                column: data.filterTargetColumn,
                sourceLabel: data.sourceRecord?.Label || data.sourceRecord?.label || data.sourceRecord?.id || 'Filtrado',
                disableFiltering: data.disableFiltering
            });
        }
    });

    // Drawer click subscription
    subscribe('grf-card-clicked', async (data) => {
        const drawerConfigId = data.drawerConfigId || currentConfig?.actions?.sidePanel?.drawerConfigId;
        let drawerOptions = { ...currentConfig, tableLens };
        if (drawerConfigId) {
            const fetched = await tableLens.fetchConfig(drawerConfigId);
            if (fetched) drawerOptions = { ...fetched, tableLens };
        }
        openDrawer(data.tableId, data.recordId, drawerOptions);
    });

    window.grist.ready({ requiredAccess: 'full' });

    window.grist.onOptions(async (options) => {
        const newId = options?.configId;
        if (!isInitialized || (newId && newId !== currentConfigId)) {
            isInitialized = true;
            currentConfigId = newId;
            await initializeAndUpdate();
        }
    });

    window.grist.onRecords(async () => {
        if (isInitialized && currentConfig) {
            await initializeAndUpdate();
        }
    });
});
