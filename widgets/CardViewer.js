// widgets/CardViewer.js
// VERSÃO CORRETA: Importa e usa o ConfigManagerComponent como um módulo.

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
// NOVO: Importamos a função 'open' do nosso novo módulo.
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof grist === 'undefined' || typeof CardSystem === 'undefined') {
        document.body.innerHTML = `<p style="color: red; padding: 15px;">Erro Crítico: Dependências não carregadas.</p>`;
        return;
    }

    const appContainer = document.getElementById('app-container');
    const tableLens = new GristTableLens(grist);

    let currentRecords = [], currentConfig = null, configId = null;

    function render() {
        appContainer.innerHTML = '';
        if (!configId) {
            appContainer.innerHTML = `<div class="setup-placeholder">Widget não configurado. Clique na engrenagem ⚙️ para começar.</div>`;
        } else if (!currentConfig) {
            appContainer.innerHTML = `<p>Carregando configuração "${configId}"...</p>`;
        } else {
            CardSystem.renderCards(appContainer, currentRecords, currentConfig);
        }
        addSettingsGear();
    }
    
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.title = 'Configurações';
        gearBtn.onclick = openSettingsModal;
        appContainer.appendChild(gearBtn);
    }

    function openSettingsModal() {
        closeSettingsModal();
        const currentId = grist.getOptions().configId || '';
        const modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.innerHTML = `
            <div class="settings-modal-content">
                <h3>Configurações do Widget</h3>
                <div class="settings-group">
                    <label>Abra o Gerenciador para criar ou encontrar um ID de configuração.</label>
                    <button id="sm-open-configurator">Abrir Configurador</button>
                </div>
                <hr>
                <div class="settings-group">
                    <label for="sm-config-id-input">Cole o ID da configuração desejada aqui:</label>
                    <div class="input-group">
                        <input type="text" id="sm-config-id-input" value="${currentId}" placeholder="Ex: cards_projetos">
                        <button id="sm-apply-id">Aplicar</button>
                    </div>
                </div>
                 <hr>
                <div class="settings-group">
                     <label>Para limpar a configuração atual, clique aqui.</label>
                     <button id="sm-clear-config" class="btn-danger">Limpar Configuração</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#sm-open-configurator').onclick = async () => {
            closeSettingsModal();
            try {
                const configs = await tableLens.fetchTableRecords('Grf_config');
                // NOVO: Chamamos a função importada.
                openConfigManager({ configs: configs });
            } catch(e) {
                alert("Erro ao buscar configurações: " + e.message);
            }
        };

        modal.querySelector('#sm-apply-id').onclick = () => {
            const newId = modal.querySelector('#sm-config-id-input').value.trim();
            grist.setOptions({ configId: newId });
            closeSettingsModal();
        };
        
        modal.querySelector('#sm-clear-config').onclick = () => {
            grist.setOptions({ configId: null });
            closeSettingsModal();
        };

        modal.addEventListener('click', e => { if (e.target === modal) closeSettingsModal(); });
    }

    function closeSettingsModal() {
        const modal = document.getElementById('settings-modal-overlay');
        if (modal) modal.remove();
    }

    grist.ready({ requiredAccess: 'full' });
    grist.onRecords(records => { currentRecords = records; render(); });
    grist.onOptions(async options => {
        const newConfigId = options?.configId || null;
        if (newConfigId === configId) return;
        configId = newConfigId;
        currentConfig = null;
        if (configId) {
            render();
            try {
                const configRecord = await tableLens.findRecord('Grf_config', { configId: configId });
                if (!configRecord) throw new Error(`Configuração "${configId}" não encontrada.`);
                currentConfig = JSON.parse(configRecord.configJson);
            } catch (e) {
                appContainer.innerHTML = `<div class="error-msg">${e.message}</div>`;
                addSettingsGear();
                return;
            }
        }
        render();
    });
});