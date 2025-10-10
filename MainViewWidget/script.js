// MainViewWidget/script.js (VERSÃO FINAL com a interface da "Engrenagem")

import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof grist === 'undefined' || typeof CardSystem === 'undefined' || typeof ConfigManagerComponent === 'undefined') {
        document.body.innerHTML = `<p style="color: red;">Erro: Uma ou mais dependências (Grist API, CardSystem, ConfigManagerComponent) não foram carregadas.</p>`;
        return;
    }

    const appContainer = document.getElementById('app-container');
    const tableLens = new GristTableLens(grist);

    let currentRecords = [];
    let currentConfig = null;
    let configId = null;

    function render() {
        // Limpa o container antes de renderizar
        appContainer.innerHTML = '';
        appContainer.style.position = 'relative'; // Garante o posicionamento da engrenagem

        if (!configId) {
            appContainer.innerHTML = `<div class="setup-placeholder">Widget não configurado.</div>`;
        } else if (!currentConfig) {
            appContainer.innerHTML = `<p>Carregando configuração "${configId}"...</p>`;
        } else {
            CardSystem.renderCards(appContainer, currentRecords, currentConfig);
        }

        // A engrenagem é sempre visível
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
        // Fecha qualquer modal de configurações anterior
        closeSettingsModal();

        const currentId = grist.getOptions().configId || '';

        const modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.innerHTML = `
            <div class="settings-modal-content">
                <h3>Configurações do Widget</h3>
                
                <div class="settings-group">
                    <label>Abrir o Gerenciador de Configurações para criar ou editar uma configuração.</label>
                    <button id="sm-open-configurator">Abrir Configurador</button>
                </div>

                <hr>

                <div class="settings-group">
                    <label for="sm-config-id-input">Cole o ID da configuração desejada aqui:</label>
                    <div class="input-group">
                        <input type="text" id="sm-config-id-input" value="${currentId}">
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

        modal.querySelector('#sm-open-configurator').onclick = () => {
            // Fecha o pequeno modal de configurações antes de abrir o grande
            closeSettingsModal();
            ConfigManagerComponent.open();
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

    grist.ready();
    grist.onRecords(records => { currentRecords = records; render(); });
    grist.onOptions(async options => {
        const newConfigId = options?.configId || null;
        if (newConfigId === configId) return;

        configId = newConfigId;
        currentConfig = null;
        if (configId) {
            render(); // Mostra "loading"
            try {
                const configRecord = await tableLens.findRecord('_grf_config', { configId: configId });
                currentConfig = configRecord ? JSON.parse(configRecord.configJson) : null;
                if (!currentConfig) throw new Error(`Configuração "${configId}" não encontrada.`);
            } catch (e) {
                appContainer.innerHTML = `<p class="error-msg">${e.message}</p>`;
                addSettingsGear(); // Garante que a engrenagem ainda apareça
                return;
            }
        }
        render();
    });
});