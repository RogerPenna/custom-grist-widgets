// widgets/CardViewer.js
// VERSÃO COMPLETA E CORRIGIDA - Importa todas as suas dependências de módulo.

// PASSO 1: Importamos as classes/funções que precisamos de outros arquivos de módulo.
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';

// NOTA: CardSystem e os editores são carregados como scripts globais no HTML, por isso não os importamos aqui.

document.addEventListener('DOMContentLoaded', () => {
    // PASSO 2: A verificação de dependências agora só checa os scripts globais.
    // Se os imports acima falharem, o script inteiro não roda, então não precisamos testá-los aqui.
    if (typeof grist === 'undefined' || typeof CardSystem === 'undefined') {
        const errorMsg = "Erro Crítico: Bibliotecas globais essenciais (grist, CardSystem) não foram carregadas. Verifique as tags <script> no arquivo .html.";
        document.body.innerHTML = `<p class="error-msg">${errorMsg}</p>`;
        console.error(errorMsg, { grist: typeof grist, CardSystem: typeof CardSystem });
        return;
    }

    console.log("CardViewer.js: Dependências globais OK. Iniciando o widget.");

    const appContainer = document.getElementById('app-container');
    
    // PASSO 3: Instanciamos a classe que foi IMPORTADA. Não dependemos mais de um objeto global.
    const tableLens = new GristTableLens(grist);

    // Declaração das variáveis de estado do widget
    let currentRecords = [];
    let currentConfigData = null;
    let configRecordId = null;

    function render() {
        appContainer.innerHTML = '';
        if (!configRecordId) {
            appContainer.innerHTML = `<div class="setup-placeholder">Widget não configurado. Clique na engrenagem ⚙️ para começar.</div>`;
        } else if (!currentConfigData) {
            appContainer.innerHTML = `<p class="setup-placeholder">Carregando configuração do registro ID: ${configRecordId}...</p>`;
        } else {
            // A biblioteca CardSystem renderiza os cards
            CardSystem.renderCards(appContainer, currentRecords, currentConfigData);
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
        const currentId = grist.getOptions().configRecordId || ''; 
        const modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.innerHTML = `
            <div class="settings-modal-content">
                <h3>Configurações do Widget</h3>
                <div class="settings-group">
                    <label>Abra o Gerenciador para criar ou encontrar um ID de registro de configuração.</label>
                    <button id="sm-open-configurator">Abrir Gerenciador de Configurações</button>
                </div>
                <hr>
                <div class="settings-group">
                    <label for="sm-config-id-input">Cole o ID do Registro da configuração aqui:</label>
                    <div class="input-group">
                        <input type="text" id="sm-config-id-input" value="${currentId}" placeholder="Ex: 5">
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
             // Chama a função 'open' que importamos e renomeamos para 'openConfigManager'
             openConfigManager();
        };

        modal.querySelector('#sm-apply-id').onclick = () => {
            const newId = modal.querySelector('#sm-config-id-input').value.trim();
            grist.setOptions({ configRecordId: newId ? parseInt(newId, 10) : null });
            closeSettingsModal();
        };
        
        modal.querySelector('#sm-clear-config').onclick = () => {
            grist.setOptions({ configRecordId: null });
            closeSettingsModal();
        };

        modal.addEventListener('click', e => { if (e.target === modal) closeSettingsModal(); });
    }

    function closeSettingsModal() {
        const modal = document.getElementById('settings-modal-overlay');
        if (modal) modal.remove();
    }

    // Eventos do Grist que controlam o ciclo de vida do widget
    grist.ready({ requiredAccess: 'full' });

    grist.onRecords(records => {
        currentRecords = records;
        render();
    });

    grist.onOptions(async (options) => {
        const newConfigRecordId = options?.configRecordId || null;
        if (newConfigRecordId === configRecordId) {
            return; // Nada mudou, não faz nada
        }

        configRecordId = newConfigRecordId;
        currentConfigData = null; // Reseta a configuração antiga
        render(); // Mostra a mensagem de "Carregando..."

        if (configRecordId) {
            try {
                // ANOTAÇÃO FUTURA: Esta função 'findRecord' ainda precisa ser implementada no GristTableLens.
                // Por enquanto, ela vai falhar, mas a estrutura está pronta.
                const configRecord = await tableLens.findRecord('_grf_config', { id: configRecordId });
                
                if (!configRecord) {
                    throw new Error(`Registro de configuração com ID "${configRecordId}" não foi encontrado na tabela "_grf_config".`);
                }
                
                // O JSON de configuração está na coluna 'configData'
                currentConfigData = JSON.parse(configRecord.configData);
            } catch (e) {
                console.error("Erro ao carregar a configuração:", e);
                appContainer.innerHTML = `<div class="error-msg">${e.message}</div>`;
                addSettingsGear();
                return;
            }
        }
        
        render(); // Renderiza com os dados carregados ou limpa a tela se o ID for nulo
    });
});