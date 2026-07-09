// table-widget/script.js - Refatorado para usar TableRenderer
import '../libraries/grist-config-manager/editors/table-manifest.js?v=1.3.19';
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js?v=1.3.19';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js?v=1.3.19';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.3.19';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js?v=1.3.19';
import { TableRenderer } from '../libraries/grist-table-renderer/TableRenderer.js?v=1.3.19';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js?v=1.3.19';

document.addEventListener('DOMContentLoaded', async function () {
    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;
    const addRowBtn = document.getElementById('add-row-btn');
    const tableContainer = document.getElementById('table-container');
    const tableLens = new GristTableLens(grist);

    // --- SUBSCRIPÇÕES ---
    subscribe('grf-update-record', async (data) => {
        console.log("[TableWidget] Evento 'grf-update-record' recebido:", data);
        try {
            await tableLens.updateRecord(data.tableId, data.recordId, data.data);
        } catch (e) {
            console.error("[TableWidget] Erro ao atualizar registro:", e);
        }
    });

    subscribe('data-changed', async () => {
        console.log("[TableWidget] Dados ou Configurações alterados, recarregando...");
        await initializeAndUpdate(true);
    });

    grist.ready({ requiredAccess: 'full' });

    async function initializeAndUpdate(bypassCache = false) {
        const options = await grist.getOptions();
        currentConfigId = options?.configId || null;

        if (!currentConfigId) {
            tableContainer.innerHTML = '<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            addSettingsGear();
            return;
        }

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId, { bypassCache });
            if (!currentConfig) throw new Error("Configuração não encontrada.");

            const records = await tableLens.fetchTableRecords(currentConfig.tableId);
            
            tableContainer.innerHTML = '';
            
            // Apply theme to body for global background consistency
            const tableLayoutConfig = currentConfig.styling?.tableLayoutConfig || currentConfig.tableLayoutConfig || {};
            const theme = tableLayoutConfig.themeStyle || 'glassmorphism';
            document.body.className = `theme-${theme}`;
            
            await TableRenderer.renderTable({
                container: tableContainer,
                records,
                config: currentConfig,
                tableLens,
                onRowClick: async (record, mode) => {
                    const actions = currentConfig.actions || currentConfig || {};
                    const editMode = actions.editMode || 'excel';
                    const drawerId = actions.drawerId || null;
                    if (editMode === 'drawer' && drawerId) {
                        const drawerCfg = await tableLens.fetchConfig(drawerId);
                        openDrawer(currentConfig.tableId, record.id, { 
                            ...drawerCfg, 
                            tableLens, 
                            mode: mode || 'view' 
                        });
                    }
                },
                onAddRecord: async () => {
                    const actions = currentConfig.actions || currentConfig || {};
                    const editMode = actions.editMode || 'excel';
                    const drawerId = actions.drawerId || null;
                    if (editMode === 'drawer' && drawerId) {
                        const drawerCfg = await tableLens.fetchConfig(drawerId);
                        openDrawer(currentConfig.tableId, 'new', { 
                            ...drawerCfg, 
                            tableLens, 
                            mode: 'new' 
                        });
                    } else {
                        try {
                            await tableLens.addRecord(currentConfig.tableId, {});
                        } catch (e) {
                            alert("Erro ao adicionar registro: " + e.message);
                        }
                    }
                }
            });

            addSettingsGear();

        } catch (e) {
            console.error(e);
            tableContainer.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
            addSettingsGear();
        }
    }

    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
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
                await grist.setOptions({ configId: newId || null });
                currentConfigId = newId || null;
                await initializeAndUpdate();
            },
            onOpenManager: () => {
                openConfigManager(grist, { initialConfigId: currentConfigId });
            }
        });
    }

    grist.onOptions(async (options) => {
        if (options?.configId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            await initializeAndUpdate();
        }
    });

    grist.onRecords(async () => {
        if (isInitialized) await initializeAndUpdate();
    });

    await initializeAndUpdate();
});
