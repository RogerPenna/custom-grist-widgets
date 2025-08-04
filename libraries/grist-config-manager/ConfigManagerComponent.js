// libraries/grist-config-manager/ConfigManagerComponent.js
// VERSÃO CORRETA: Agora é um módulo JavaScript moderno.

import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';

let overlay = null;

// A função open é agora exportada diretamente.
export async function open(options = {}) {
    if (overlay) return;

    const allConfigs = options.configs || [];

    overlay = document.createElement('div');
    overlay.className = 'grf-cm-overlay';
    overlay.innerHTML = `
        <div class="grf-cm-modal">
            <div class="grf-cm-header">
                <h1>Gerenciador de Configurações</h1>
                <button class="grf-cm-close">×</button>
            </div>
            <div class="grf-cm-body"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.grf-cm-close').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    await renderMainUI(overlay.querySelector('.grf-cm-body'), allConfigs);
}

function close() {
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
}

// Esta função agora é interna ao módulo e pode usar GristTableLens.
async function renderMainUI(container, allConfigs) {
    container.innerHTML = `
        <div class="grf-cm-main-container">
            <div class="grf-cm-sidebar">
                <h2>Configurações</h2>
                <div class="grf-cm-new-controls">
                    <select id="cm-new-type-selector"><option value="Drawer">Drawer</option><option value="CardSystem">Card System</option></select>
                    <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                </div>
                <ul id="cm-config-list"></ul>
            </div>
            <div class="grf-cm-editor-panel">
                <form id="cm-config-form" onsubmit="return false;">
                    <input type="hidden" id="cm-record-id">
                    <div class="form-group">
                        <label for="cm-config-id">ID da Configuração (Copie este valor)</label>
                        <input type="text" id="cm-config-id" required>
                    </div>
                    <div class="form-group">
                        <label for="cm-description">Descrição</label>
                        <input type="text" id="cm-description">
                    </div>
                    <div id="cm-editor-content"><p class="editor-placeholder">Selecione uma config. à esquerda ou crie uma nova.</p></div>
                    <div class="form-actions"><button type="submit" id="cm-save-btn" class="btn btn-success">Salvar</button></div>
                </form>
            </div>
        </div>`;

    // CORREÇÃO 2: Garante que os nomes dos editores estão corretos.
    const editorMap = { 'Drawer': window.DrawerConfigEditor, 'CardSystem': window.CardConfigEditor };
    
    const configListEl = container.querySelector('#cm-config-list');
    const editorContentEl = container.querySelector('#cm-editor-content');
    const configIdInputEl = container.querySelector('#cm-config-id');
    const descriptionInputEl = container.querySelector('#cm-description');
    const recordIdInputEl = container.querySelector('#cm-record-id');
    const formEl = container.querySelector('#cm-config-form');
    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist);
    const CONFIG_TABLE = 'Grf_config';
    
    let selectedConfig = null;
    let currentEditorModule = null;

    // CORREÇÃO 1: A lógica de 'displayConfig' foi corrigida.
    const displayConfig = async (config) => {
        selectedConfig = config;
        recordIdInputEl.value = config.id || '';
        configIdInputEl.value = config.configId || '';
        descriptionInputEl.value = config.description || '';
        configIdInputEl.readOnly = !!config.id;

        currentEditorModule = editorMap[config.componentType];
        if (!currentEditorModule) {
            editorContentEl.innerHTML = `<p style="color:red;">Editor para o tipo "${config.componentType}" não foi encontrado. Verifique se o script do editor está sendo carregado e o nome no mapa está correto.</p>`;
            return;
        }

        editorContentEl.innerHTML = `
            <div class="form-group" id="cm-table-selector-container"></div>
            <div id="cm-specialized-editor"></div>`;
        
        const specializedEditor = editorContentEl.querySelector('#cm-specialized-editor');
        const tableSelectorContainer = editorContentEl.querySelector('#cm-table-selector-container');
        
        const tables = await tableLens.listAllTables();
        tableSelectorContainer.innerHTML = `<label for="cm-table-selector">Tabela de Dados:</label>
            <select id="cm-table-selector"><option value="">-- Selecione --</option>
            ${tables.map(t => `<option value="${t.id}">${t.id}</option>`).join('')}
            </select>`;
        
        const tableSelector = editorContentEl.querySelector('#cm-table-selector');
        
        tableSelector.onchange = () => {
            specializedEditor.innerHTML = '';
            currentEditorModule.render(specializedEditor, JSON.parse(config.configJson || '{}'), tableLens, tableSelector.value);
        };
    };

    const renderList = (configs) => {
        configListEl.innerHTML = '';
        configs.forEach(c => {
            const li = document.createElement('li');
            li.textContent = c.configId;
            li.onclick = () => {
                container.querySelectorAll('#cm-config-list li').forEach(item => item.classList.remove('is-active'));
                li.classList.add('is-active');
                displayConfig(c);
            };
            configListEl.appendChild(li);
        });
    };

    container.querySelector('#cm-new-btn').onclick = () => {
        const type = container.querySelector('#cm-new-type-selector').value;
        const newId = `${type.toLowerCase()}_${Date.now()}`;
        const newConfig = { id: null, componentType: type, configId: newId, configJson: '{}', description: '' };
        displayConfig(newConfig);
    };
    
    formEl.onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedConfig || !currentEditorModule) return;
        const configId = configIdInputEl.value.trim();
        if (!configId) { alert('O ID da Configuração é obrigatório.'); return; }
        const specializedEditor = editorContentEl.querySelector('#cm-specialized-editor');
        const newConfigData = currentEditorModule.read(specializedEditor);
        const recordData = { configId, description: descriptionInputEl.value.trim(), configJson: JSON.stringify(newConfigData), componentType: selectedConfig.componentType };
        if (selectedConfig.id) {
            await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
        } else {
            await dataWriter.addRecord(CONFIG_TABLE, recordData);
        }
        alert(`Configuração "${configId}" salva com sucesso! Você já pode copiar o ID e fechar esta janela.`);
        const updatedConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
        renderList(updatedConfigs);
    };

    renderList(allConfigs);
}