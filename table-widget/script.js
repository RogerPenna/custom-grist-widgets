// table-widget/script.js - Refatorado para usar TableRenderer
import '../ConfigManager/editors/table-manifest.js';
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js';
import { TableRenderer } from '../libraries/grist-table-renderer/TableRenderer.js';

document.addEventListener('DOMContentLoaded', async function () {
    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;
    const addRowBtn = document.getElementById('add-row-btn');
    const tableContainer = document.getElementById('table-container');
    const tableLens = new GristTableLens(grist);

    grist.ready({ requiredAccess: 'full' });

    async function initializeAndUpdate() {
        const options = await grist.getOptions();
        currentConfigId = options?.configId || null;

        if (!currentConfigId) {
            tableContainer.innerHTML = '<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            addSettingsGear();
            return;
        }

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId);
            if (!currentConfig) throw new Error("Configuração não encontrada.");

            const records = await tableLens.fetchTableRecords(currentConfig.tableId);
            
            tableContainer.innerHTML = '';
            await TableRenderer.renderTable({
                container: tableContainer,
                records,
                config: currentConfig,
                tableLens,
                onRowClick: async (record) => {
                    if (currentConfig.editMode === 'drawer' && currentConfig.drawerId) {
                        const drawerCfg = await tableLens.fetchConfig(currentConfig.drawerId);
                        openDrawer(currentConfig.tableId, record.id, { ...drawerCfg, tableLens });
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
