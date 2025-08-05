// widgets/CardViewer.js
// VERSÃO CORRIGIDA PARA ÍCONES E PERSISTÊNCIA DE ID

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // CORREÇÃO DE ÍCONES: Carrega o SVG dinamicamente
    async function loadIcons() {
        try {
            const response = await fetch('../libraries/icons/icons.svg');
            if (!response.ok) throw new Error('Network response was not ok');
            const svgText = await response.text();
            const div = document.createElement('div');
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {
            console.error('Failed to load icons:', error);
        }
    }
    await loadIcons(); // Espera os ícones carregarem antes de continuar

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
        configId: grist.getOptions()?.configId || null // Inicializa com o valor salvo
    };

    function render() {
        appContainer.innerHTML = '';
        if (!state.configId) {
            appContainer.innerHTML = `<div class="setup-placeholder">Widget não configurado. Clique no ícone ⚙️ para configurar.</div>`;
        } else if (!state.configData) {
            appContainer.innerHTML = `<p class="setup-placeholder">Carregando configuração ID: "${state.configId}"...</p>`;
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
        
        // CORREÇÃO DE PERSISTÊNCIA: Sempre lê o valor mais recente das opções
        const activeConfigId = grist.getOptions().configId || '';
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

    // --- Ciclo de Vida do Widget ---
    grist.ready({ requiredAccess: 'full' });
    grist.onRecords(records => { state.records = records; render(); });

    grist.onOptions(async (options) => {
        const newConfigId = options?.configId || null;
        if (newConfigId === state.configId) return;

        state.configId = newConfigId;
        state.configData = null;
        
        if (state.configId) {
            try {
                const configRecord = await tableLens.findRecord('Grf_config', { configId: state.configId });
                state.configData = configRecord ? JSON.parse(configRecord.configJson) : null;
                if (!configRecord) {
                    // Adiciona um placeholder na UI se o ID for inválido
                    appContainer.innerHTML = `<div class="error-msg">Configuração com ID "${state.configId}" não encontrada.</div>`;
                    addSettingsGear();
                }
            } catch (e) {
                console.error("Erro ao carregar configuração:", e);
                state.configData = null;
            }
        }
        render();
    });
});