// --- START OF 100% COMPLETE DrawerViewer.js WITH DEBUG LOGS ---

console.log("DrawerViewer.js script started.");

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    console.log("[DrawerViewer] DOMContentLoaded event fired.");

    async function loadIcons() {
        try {
            const response = await fetch('/libraries/icons/icons.svg');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
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

    let state = {
        configData: null,
        configId: grist.getOptions()?.configId || null,
    };

    function renderAdminView() {
        console.log("[DrawerViewer] renderAdminView called. State:", state);
        appContainer.innerHTML = '';
        if (state.configId && state.configData) {
            appContainer.innerHTML = `<div class="admin-placeholder">✔️ DrawerViewer vinculado à config: <strong>${state.configId}</strong>. Pronto para receber eventos.</div>`;
        } else if (state.configId && !state.configData) {
            appContainer.innerHTML = `<div class="admin-placeholder">⚠️ Configuração "${state.configId}" não encontrada. Verifique o ID.</div>`;
        } else {
            appContainer.innerHTML = `<div class="admin-placeholder">⚠️ DrawerViewer não configurado. Clique na engrenagem.</div>`;
        }
        addSettingsGear();
    }

    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = getIcon('icon-settings');
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        appContainer.appendChild(gearBtn);
    }

    function openSettingsPopover(event) {
        event.stopPropagation();
        closeSettingsPopover();
        
        const activeConfigId = state.configId || '';
        const isLinked = !!activeConfigId && !!state.configData;

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
            openConfigManager();
        };
    }

    function closeSettingsPopover() {
        const popover = document.querySelector('.config-popover');
        if (popover) popover.remove();
        const overlay = document.getElementById('config-popover-overlay');
        if (overlay) overlay.remove();
    }

    grist.ready({ requiredAccess: 'full' });
    console.log("[DrawerViewer] Grist is ready.");

subscribe('grf-card-clicked', (eventData) => {
    console.log(`[DrawerViewer] Evento 'grf-card-clicked' detectado!`, {
        eventoRecebido: eventData,
        meuConfigId: state.configId
    });

    if (eventData.drawerConfigId === state.configId) {
        console.log(`[DrawerViewer] CONDIÇÃO ATENDIDA! Os configIds correspondem. Tentando abrir o drawer...`);
        openDrawer(eventData.tableId, eventData.recordId, state.configData);
    } else {
        console.log(`[DrawerViewer] Condição não atendida. O evento era para '${eventData.drawerConfigId}', mas eu sou '${state.configId}'. Ignorando.`);
    }
});
    console.log("[DrawerViewer] Inscrito no evento 'grf-card-clicked'.");

    grist.onOptions(async (options) => {
        console.log("[DrawerViewer] onOptions event fired with:", options);
        const newConfigId = options?.configId || null;
        if (newConfigId === state.configId && state.configData) return;

        state.configId = newConfigId;
        state.configData = null;

        if (state.configId) {
            try {
                const configRecord = await tableLens.findRecord('Grf_config', { configId: state.configId });
                state.configData = configRecord ? JSON.parse(configRecord.configJson) : null;
            } catch (e) {
                console.error("Erro ao carregar config do Drawer:", e);
            }
        }
        renderAdminView();
    });
});

// --- END OF 100% COMPLETE DrawerViewer.js WITH DEBUG LOGS ---