// libraries/grist-config-manager/ConfigManagerComponent.js
// VERSÃO FINAL CORRIGIDA - Alinhada com o esquema de dados de produção.

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';

let overlay = null;

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.textContent;
        element.textContent = 'Copiado!';
        setTimeout(() => {
            element.textContent = originalText;
        }, 1500);
    }).catch(err => console.error('Falha ao copiar texto: ', err));
}

// CORREÇÃO TOTAL: O tutorial agora ensina o esquema de colunas de produção.
function renderSetupInstructions(container) {
    container.innerHTML = `
        <div class="grf-cm-setup-guide">
            <h2>Configuração Necessária do Framework</h2>
            <p>A tabela <code>Grf_config</code> precisa existir com a estrutura correta.</p>
            
            <h4>Passo 1: Crie a Tabela</h4>
            <p>Crie uma nova tabela com o nome exato:</p>
            <div class="grf-copy-box" title="Clique para copiar">
                <code>Grf_config</code>
                <button class="grf-copy-btn">Copiar</button>
            </div>

            <h4>Passo 2: Crie as Colunas</h4>
            <p>Adicione estas colunas (clique nos nomes para copiar):</p>
            <table class="grf-setup-table">
                <thead><tr><th>Nome da Coluna</th><th>Tipo no Grist</th></tr></thead>
                <tbody>
                    <tr><td class="grf-copy-cell">configId</td><td>Text</td></tr>
                    <tr><td class="grf-copy-cell">widgetTitle</td><td>Text</td></tr>
                    <tr><td class="grf-copy-cell">description</td><td>Text</td></tr>
                    <tr><td class="grf-copy-cell">componentType</td><td>Text</td></tr>
                    <tr><td class="grf-copy-cell">configJson</td><td>Text</td></tr>
                    <tr><td class="grf-copy-cell">pageId</td><td>Numeric</td></tr>
                </tbody>
            </table>
            <p class="grf-setup-footer">Após criar a tabela e as colunas, feche esta janela e abra o configurador novamente.</p>
        </div>
    `;
    container.querySelector('.grf-copy-btn').addEventListener('click', (e) => copyToClipboard('Grf_config', e.target));
    container.querySelectorAll('.grf-copy-cell').forEach(cell => {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', (e) => copyToClipboard(e.target.textContent, e.target));
    });
}

function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
}

// CORREÇÃO TOTAL: Toda a lógica interna foi atualizada para usar o esquema de colunas correto.
async function renderMainUI(container) {
    const CONFIG_TABLE = 'Grf_config';
    const tableLens = new GristTableLens(grist);

    try {
        const allTableIds = await grist.docApi.listTables();
        if (!allTableIds.includes(CONFIG_TABLE)) {
            renderSetupInstructions(container);
            return;
        }

        const allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
        const dataWriter = new GristDataWriter(grist);
        
        // CORREÇÃO: HTML do formulário alinhado com o novo esquema.
        container.innerHTML = `
            <div class="grf-cm-main-container">
                <div class="grf-cm-sidebar">
                    <h2>Configurações</h2>
                    <div class="grf-cm-new-controls">
                        <select id="cm-new-type-selector"><option value="Card System">Card System</option><option value="Drawer">Drawer</option></select>
                        <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                    </div>
                    <ul id="cm-config-list"></ul>
                </div>
                <div class="grf-cm-editor-panel">
                    <form id="cm-config-form">
                        <input type="hidden" id="cm-record-id">
                        <div class="form-group"><label for="cm-widget-title">Título do Widget (Nome na lista)</label><input type="text" id="cm-widget-title" required></div>
                        <div class="form-group"><label for="cm-config-id">ID da Configuração (Identificador único, ex: 'cards_clientes')</label><input type="text" id="cm-config-id" required></div>
                        <div class="form-group"><label for="cm-description">Descrição</label><input type="text" id="cm-description"></div>
                        <div id="cm-editor-content"><p class="editor-placeholder">Selecione uma config ou crie uma nova.</p></div>
                        <div class="form-actions"><button type="submit" id="cm-save-btn" class="btn btn-success">Salvar e Fechar</button></div>
                    </form>
                </div>
            </div>`;
        
        const editorMap = { 'Card System': window.CardConfigEditor, 'Drawer': window.DrawerConfigEditor };
        const configListEl = container.querySelector('#cm-config-list');
        const editorContentEl = container.querySelector('#cm-editor-content');
        const formEl = container.querySelector('#cm-config-form');
        let selectedConfig = null;
        let currentEditorModule = null;

        const loadList = (configs) => {
            configListEl.innerHTML = '';
            configs.forEach(c => {
                const li = document.createElement('li');
                li.textContent = c.widgetTitle || c.configId; // Usa widgetTitle como nome na lista
                li.dataset.id = c.id;
                li.onclick = () => {
                    document.querySelectorAll('#cm-config-list li').forEach(item => item.classList.remove('is-active'));
                    li.classList.add('is-active');
                    displayConfig(c);
                };
                configListEl.appendChild(li);
            });
        };

        // CORREÇÃO: Lógica para popular o formulário com os dados corretos.
        const displayConfig = (config) => {
            selectedConfig = config;
            formEl.querySelector('#cm-record-id').value = config.id || '';
            formEl.querySelector('#cm-widget-title').value = config.widgetTitle || '';
            formEl.querySelector('#cm-config-id').value = config.configId || '';
            formEl.querySelector('#cm-description').value = config.description || '';
            
            const editorKey = (config.componentType || '').replace(/\s+/g, '');
            currentEditorModule = editorMap[editorKey] || editorMap[config.componentType];

            if (currentEditorModule) {
                const configData = JSON.parse(config.configJson || '{}');
                currentEditorModule.render(editorContentEl, configData, tableLens);
            } else {
                editorContentEl.innerHTML = `<p class="editor-error">Editor para "${config.componentType}" não encontrado.</p>`;
            }
        };

        container.querySelector('#cm-new-btn').onclick = () => {
            const type = container.querySelector('#cm-new-type-selector').value;
            displayConfig({ id: null, componentType: type, widgetTitle: `Nova Config - ${type}`, configId: `nova_config_${Date.now()}`, configJson: '{}' });
        };
            
        // CORREÇÃO: Lógica de salvamento para montar o objeto de registro correto.
        formEl.onsubmit = async (e) => {
            e.preventDefault();
            if (!selectedConfig) return;

            const configJson = currentEditorModule ? currentEditorModule.read(editorContentEl) : {};
            const recordData = {
                widgetTitle: formEl.querySelector('#cm-widget-title').value.trim(),
                configId: formEl.querySelector('#cm-config-id').value.trim(),
                description: formEl.querySelector('#cm-description').value.trim(),
                componentType: selectedConfig.componentType,
                configJson: JSON.stringify(configJson)
                // pageId não está no formulário, então não é salvo aqui.
            };

            if (!recordData.widgetTitle || !recordData.configId) {
                alert("Título do Widget e ID da Configuração são obrigatórios.");
                return;
            }

            try {
                if (selectedConfig.id) {
                    await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
                } else {
                    await dataWriter.addRecord(CONFIG_TABLE, recordData);
                }
                alert(`Configuração "${recordData.widgetTitle}" salva com sucesso!`);
                close();
            } catch (err) {
                alert(`Erro ao salvar: ${err.message}`);
                console.error("Erro ao salvar configuração:", err);
            }
        };

        loadList(allConfigs);

    } catch (error) {
        console.error("Erro inesperado no ConfigManager:", error);
        container.innerHTML = `<div class="editor-error">Erro inesperado: ${error.message}. Verifique o console.</div>`;
    }
}

export function open() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'grf-cm-overlay';
    overlay.innerHTML = `<div class="grf-cm-modal"><div class="grf-cm-header"><h1>Gerenciador de Configurações</h1><button class="grf-cm-close">×</button></div><div class="grf-cm-body"><p>Carregando...</p></div></div>`;
    document.body.appendChild(overlay);
        
    overlay.querySelector('.grf-cm-close').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    
    renderMainUI(overlay.querySelector('.grf-cm-body'));
}