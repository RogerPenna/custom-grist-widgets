// widgets/CardViewer.js - VERSÃO UNIVERSAL FINAL (RESTORED + HEADLESS)

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { CardSystem } from '../libraries/grist-card-system/CardSystem.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { GristRestAdapter } from '../libraries/headless-rest-adapter.js';
import { HeadlessTableLens } from '../libraries/headless-table-lens.js';

document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfigId = urlParams.get('configId');
    const urlDocId = urlParams.get('docId') || 'qiVPiRA3ULcU';

    let tableLens;
    let currentConfig = null;
    let currentConfigId = urlConfigId || null;
    let isInitialized = false;

    // --- DETECÇÃO DE AMBIENTE ---
    if (urlConfigId) {
        console.log("[CardViewer] Modo Headless Ativo.");
        const restAdapter = new GristRestAdapter({
            gristUrl: window.location.origin + '/grist-proxy',
            docId: urlDocId,
            apiKey: 'none'
        });
        tableLens = new HeadlessTableLens(restAdapter);
    } else {
        console.log("[CardViewer] Modo Grist Standard.");
        tableLens = new GristTableLens(grist);
    }

    // --- CARREGAMENTO DE ASSETS ---
    async function loadIcons() {
        try {
            const response = await fetch('/libraries/icons/icons.svg');
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (e) { console.error('Falha ao carregar ícones:', e); }
    }
    await loadIcons();

    // --- RENDERIZAÇÃO ---
    async function initializeAndUpdate() {
        if (!currentConfigId) {
            appContainer.innerHTML = '<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            addSettingsGear();
            return;
        }

        appContainer.innerHTML = '<div class="status-placeholder">Carregando dados...</div>';

        try {
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            if (!configRecord) {
                appContainer.innerHTML = `<div class="status-placeholder">Erro: Configuração "${currentConfigId}" não encontrada.</div>`;
                addSettingsGear();
                return;
            }

            currentConfig = JSON.parse(configRecord.configJson);
            const tableId = currentConfig.tableId;

            const [records, cleanSchema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId)
            ]);
            
            appContainer.innerHTML = '';
            CardSystem.renderCards(appContainer, records, { ...currentConfig, tableLens }, cleanSchema);
            addSettingsGear();

        } catch (e) {
            console.error(e);
            appContainer.innerHTML = `<div class="status-placeholder">Erro: ${e.message}</div>`;
            addSettingsGear();
        }
    }

    // --- UI DE CONFIGURAÇÃO (ENGRENAGEM) ---
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    function openSettingsPopover(event) {
        event.stopPropagation();
        closeSettingsPopover();
        const popover = document.createElement('div');
        popover.className = 'config-popover';
        popover.innerHTML = `
            <div class="popover-section">
                <label>Vincular ID de Configuração</label>
                <input type="text" id="popover-config-id" value="${currentConfigId || ''}" placeholder="Ex: GestMud_123">
            </div>
            <button id="popover-link-btn" class="config-popover-btn">Salvar Vínculo</button>
            <button id="popover-mgr-btn" class="config-popover-btn" style="background:#666;">Abrir Configurador</button>
        `;
        document.body.appendChild(popover);

        popover.querySelector('#popover-link-btn').onclick = () => {
            const newId = document.getElementById('popover-config-id').value.trim();
            if (urlConfigId) {
                // No portal admin, não salvamos no grist.setOptions, apenas avisamos
                alert("No Portal Admin, altere o ID no menu de configurações do Dashboard.");
            } else {
                grist.setOptions({ configId: newId });
            }
            closeSettingsPopover();
        };

        popover.querySelector('#popover-mgr-btn').onclick = () => {
            closeSettingsPopover();
            openConfigManager(grist, { initialConfigId: currentConfigId, componentTypes: ['Card System'] });
        };
    }

    function closeSettingsPopover() {
        const p = document.querySelector('.config-popover');
        if (p) p.remove();
    }

    // --- INICIALIZAÇÃO E EVENTOS ---
    grist.ready({ requiredAccess: 'full' });

    // Se estiver no Dashboard (Headless), inicia imediatamente
    if (urlConfigId) {
        isInitialized = true;
        await initializeAndUpdate();
    }

    // No Grist, espera pelas opções
    grist.onOptions(async (options) => {
        const newId = options?.configId || null;
        if (newId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = newId;
            await initializeAndUpdate();
        }
    });

    // Subscrição do clique no card
    subscribe('grf-card-clicked', async (data) => {
        const rec = await tableLens.findRecord('Grf_config', { configId: data.drawerConfigId });
        if (rec) openDrawer(data.tableId, data.recordId, JSON.parse(rec.configJson));
    });
});
