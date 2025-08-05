// widgets/CardViewer.js
// VERSÃO CORRIGIDA PARA ÍCONES E PERSISTÊNCIA DE ID

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Carrega o arquivo SVG e o injeta no DOM.
    async function loadIcons() {
        try {
            const response = await fetch('../libraries/icons/icons.svg');
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

    if (typeof grist === 'undefined' || typeof CardSystem === 'undefined') {
        document.body.innerHTML = `<p class="error-msg">Erro Crítico: Bibliotecas não carregadas.</p>`;
        return;
    }

    const appContainer = document.getElementById('app-container');
    const tableLens = new GristTableLens(grist);

    let state = {
        records: [],
        configData: null,
        configId: grist.getOptions()?.configId || null
    };

    function render() {
        appContainer.innerHTML = '';
        if (!state.configId) {
            appContainer.innerHTML = `<div class="setup-placeholder">Widget não configurado. Clique no ícone ⚙️ para configurar.</div>`;
        } else if (!state.configData) {
            if (state.configId) {
                appContainer.innerHTML = `<div class="error-msg">Configuração com ID "${state.configId}" não encontrada.</div>`;
            } else {
                 appContainer.innerHTML = `<p class="setup-placeholder">Carregando...</p>`;
            }
        } else {
            CardSystem.renderCards(appContainer, state.records, state.configData);
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
        
        // CORREÇÃO DO BUG: Usa o `state.configId` como a fonte da verdade.
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
    grist.onRecords(records => { state.records = records; render(); });

    grist.onOptions(async (options, oldOptions) => {
        const newConfigId = options?.configId || null;
        if (newConfigId === state.configId && oldOptions) return;

        state.configId = newConfigId;
        state.configData = null;
        
        if (state.configId) {
            try {
                const configRecord = await tableLens.findRecord('Grf_config', { configId: state.configId });
                state.configData = configRecord ? JSON.parse(configRecord.configJson) : null;
            } catch (e) {
                console.error("Erro ao carregar configuração:", e);
                state.configData = null;
            }
        }
        render();
    });
});