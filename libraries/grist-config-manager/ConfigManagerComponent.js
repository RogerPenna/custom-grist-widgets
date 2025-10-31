import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';

// Import editor modules
import { CardConfigEditor } from './editors/config-cards.js';
import { DrawerConfigEditor } from './editors/config-drawer.js';
import { CardStyleConfigEditor } from './editors/config-card-style.js';
import { TableConfigEditor } from './editors/config-table.js';

let overlay = null;
let _grist = null;

const COMPONENT_TYPE_COLORS = {
    'CardSystem': '#0d6efd', // blue
    'Drawer': '#198754', // green
    'CardStyle': '#6c757d', // grey
    'Table': '#fd7e14', // orange
    'default': '#6c757d' // grey
};

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.textContent;
        element.textContent = 'Copiado!';
        setTimeout(() => { element.textContent = originalText; }, 1500);
    }).catch(err => console.error('Falha ao copiar texto: ', err));
}

function renderSetupInstructions(container) {
    container.innerHTML = `
        <div class="grf-cm-setup-guide">
            <h2>Configuração Necessária do Framework</h2>
            <p>A tabela <code>Grf_config</code> precisa existir com a estrutura correta.</p>
            <h4>Passo 1: Crie a Tabela</h4>
            <p>Crie uma nova tabela com o nome exato: <code>Grf_config</code> <button class="grf-copy-btn">Copiar</button></p>
            <h4>Passo 2: Crie as Colunas</h4>
            <table class="grf-setup-table">
                <thead><tr><th>Nome da Coluna</th><th>Tipo no Grist</th></tr></thead>
                <tbody>
                    <tr><td>configId</td><td>Text</td></tr>
                    <tr><td>widgetTitle</td><td>Text</td></tr>
                    <tr><td>description</td><td>Text</td></tr>
                    <tr><td>componentType</td><td>Text</td></tr>
                    <tr><td>configJson</td><td>Text</td></tr>
                    <tr><td>pageId</td><td>Numeric</td></tr>
                </tbody>
            </table>
            <p class="grf-setup-footer">Após criar, feche e reabra o configurador.</p>
        </div>
    `;
    container.querySelector('.grf-copy-btn').addEventListener('click', (e) => copyToClipboard('Grf_config', e.target));
}

function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
}

async function renderMainUI(container, initialConfigId, componentTypes) {
    const CONFIG_TABLE = 'Grf_config';
    const tableLens = new GristTableLens(_grist);
    const dataWriter = new GristDataWriter(_grist);

    try {
        const allTableIds = await _grist.docApi.listTables();
        if (!allTableIds.includes(CONFIG_TABLE)) {
            renderSetupInstructions(container);
            return;
        }

        let allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);

        const createTypeOption = (type) => {
            const color = COMPONENT_TYPE_COLORS[type.replace(/\s+/g, '')] || COMPONENT_TYPE_COLORS['default'];
            const brightness = (parseInt(color.replace('#', ''), 16) > 0xffffff / 2) ? 'black' : 'white';
            return `<option value="${type}" style="background-color: ${color}; color: ${brightness};">${type}</option>`;
        };

        const typeOptions = componentTypes.map(createTypeOption).join('');
        const filterOptions = componentTypes.map(createTypeOption).join('');

        container.innerHTML = `
            <div class="grf-cm-main-container">
                <div class="grf-cm-sidebar">
                    <h2>Configurações</h2>
                    <div class="grf-cm-controls-container">
                        <div class="grf-cm-filter-controls">
                            <label for="cm-filter-type-selector">Filtrar por tipo:</label>
                            <select id="cm-filter-type-selector"><option value="">-- Todos --</option>${filterOptions}</select>
                        </div>
                        <div class="grf-cm-new-controls">
                            <select id="cm-new-type-selector">${typeOptions}</select>
                            <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                        </div>
                    </div>
                    <div id="cm-config-list-container">
                        <ul id="cm-config-list"></ul>
                    </div>
                </div>
                <div class="grf-cm-editor-panel">
                    <form id="cm-config-form">
                        <input type="hidden" id="cm-record-id">
                        <div id="cm-editor-actions">
                            <button type="button" id="cm-duplicate-btn" class="btn btn-secondary">Duplicar</button>
                            <button type="button" id="cm-delete-btn" class="btn btn-danger">Excluir</button>
                        </div>
                        <div class="form-group"><label for="cm-widget-title">Título do Widget (Nome na lista)</label><input type="text" id="cm-widget-title" required></div>
                        <div class="form-group"><label for="cm-config-id">ID da Configuração (Identificador único)</label><input type="text" id="cm-config-id" required></div>
                        <div class="form-group"><label for="cm-description">Descrição</label><input type="text" id="cm-description"></div>
                        <div id="cm-editor-content"><p class="editor-placeholder">Selecione uma config ou crie uma nova.</p></div>
                        <div class="form-actions"><button type="submit" id="cm-save-btn" class="btn btn-success">Salvar e Fechar</button></div>
                    </form>
                </div>
            </div>`;

        const editorMap = { 'CardSystem': CardConfigEditor, 'Drawer': DrawerConfigEditor, 'CardStyle': CardStyleConfigEditor, 'Table': TableConfigEditor };
        const configListEl = container.querySelector('#cm-config-list');
        const editorContentEl = container.querySelector('#cm-editor-content');
        const formEl = container.querySelector('#cm-config-form');
        const editorActionsEl = container.querySelector('#cm-editor-actions');
        const newTypeSelectorEl = container.querySelector('#cm-new-type-selector');
        const filterTypeSelectorEl = container.querySelector('#cm-filter-type-selector');

        let selectedConfig = null;
        let currentEditorModule = null;

        const colorizeDropdown = (selectEl) => {
            const selectedType = selectEl.value;
            if (!selectedType || selectedType === '') {
                selectEl.style.backgroundColor = '';
                selectEl.style.color = '';
            } else {
                const color = COMPONENT_TYPE_COLORS[selectedType.replace(/\s+/g, '')] || COMPONENT_TYPE_COLORS['default'];
                selectEl.style.backgroundColor = color;
                const brightness = (parseInt(color.replace('#', ''), 16) > 0xffffff / 2) ? 'black' : 'white';
                selectEl.style.color = brightness;
            }
        };

        const clearForm = () => {
            selectedConfig = null;
            formEl.reset();
            editorContentEl.innerHTML = '<p class="editor-placeholder">Selecione uma configuração ou crie uma nova.</p>';
            editorActionsEl.style.display = 'none';
        };

        const duplicateConfig = async (configToDuplicate) => {
            const newTitle = `${configToDuplicate.widgetTitle} (Cópia)`;
            const newConfigId = `${configToDuplicate.configId}_copy_${Date.now()}`;
            const newRecord = { ...configToDuplicate, widgetTitle: newTitle, configId: newConfigId };
            delete newRecord.id;
            try {
                await dataWriter.addRecord(CONFIG_TABLE, newRecord);
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                loadList(filterTypeSelectorEl.value);
                alert(`Configuração "${configToDuplicate.widgetTitle}" duplicada com sucesso como "${newTitle}".`);
                clearForm();
            } catch (err) {
                alert(`Erro ao duplicar: ${err.message}`);
            }
        };

        const deleteConfig = async (configToDelete) => {
            if (confirm(`Excluir permanentemente a configuração "${configToDelete.widgetTitle}"?`)) {
                try {
                    await dataWriter.deleteRecord(CONFIG_TABLE, configToDelete.id);
                    allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                    loadList(filterTypeSelectorEl.value);
                    clearForm();
                    alert(`Configuração "${configToDelete.widgetTitle}" excluída.`);
                } catch (err) {
                    alert(`Erro ao excluir: ${err.message}`);
                }
            }
        };

        const loadList = (filterType = '') => {
            const configsToDisplay = filterType ? allConfigs.filter(c => c.componentType === filterType) : allConfigs;
            configListEl.innerHTML = '';
            const groupedConfigs = configsToDisplay.reduce((acc, config) => {
                const description = config.description || '';
                const match = description.match(/^\[(.*?)\]/);
                const group = match ? match[1] : (config.componentType || 'Outros');
                if (!acc[group]) { acc[group] = []; }
                acc[group].push(config);
                return acc;
            }, {});

            Object.keys(groupedConfigs).sort().forEach(type => {
                const groupHeader = document.createElement('h4');
                groupHeader.textContent = type;
                groupHeader.className = 'cm-group-header';
                configListEl.appendChild(groupHeader);
                const groupItemList = document.createElement('ul');
                groupItemList.className = 'cm-group-items';
                configListEl.appendChild(groupItemList);
                groupHeader.addEventListener('click', () => {
                    groupItemList.style.display = groupItemList.style.display === 'none' ? '' : 'none';
                    groupHeader.classList.toggle('collapsed');
                });
                groupedConfigs[type].forEach(c => {
                    const li = document.createElement('li');
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = c.widgetTitle;
                    const typeCircle = document.createElement('span');
                    typeCircle.className = 'cm-type-circle';
                    typeCircle.style.backgroundColor = COMPONENT_TYPE_COLORS[c.componentType.replace(/\s+/g, '')] || COMPONENT_TYPE_COLORS['default'];
                    typeCircle.innerHTML = '&nbsp;';
                    li.appendChild(typeCircle);
                    li.appendChild(nameSpan);
                    li.dataset.id = c.id;
                    li.onclick = () => {
                        container.querySelectorAll('#cm-config-list li').forEach(item => item.classList.remove('is-active'));
                        li.classList.add('is-active');
                        displayConfig(c);
                    };
                    groupItemList.appendChild(li);
                });
            });
            if (initialConfigId) {
                const configToSelect = allConfigs.find(c => c.configId === initialConfigId);
                if (configToSelect) {
                    const liToSelect = configListEl.querySelector(`[data-id='${configToSelect.id}']`);
                    if (liToSelect) { liToSelect.click(); }
                }
            }
        };

        filterTypeSelectorEl.addEventListener('change', () => {
            loadList(filterTypeSelectorEl.value);
            colorizeDropdown(filterTypeSelectorEl);
        });
        newTypeSelectorEl.addEventListener('change', () => colorizeDropdown(newTypeSelectorEl));

        const displayConfig = async (config) => {
            selectedConfig = config;
            formEl.querySelector('#cm-record-id').value = config.id || '';
            formEl.querySelector('#cm-widget-title').value = config.widgetTitle || '';
            formEl.querySelector('#cm-config-id').value = config.configId || '';
            formEl.querySelector('#cm-description').value = config.description || '';
            editorActionsEl.style.display = config.id ? 'flex' : 'none';
            const editorKey = (config.componentType || '').replace(/\s+/g, '');
            currentEditorModule = editorMap[editorKey];
            if (!currentEditorModule) {
                editorContentEl.innerHTML = `<p class="editor-error">Editor para "${config.componentType}" não encontrado.</p>`;
                return;
            }
            const tables = await tableLens.listAllTables();
            const configData = JSON.parse(config.configJson || '{}');
            const targetTableId = configData.tableId || '';
            editorContentEl.innerHTML = `
                <div class="form-group" id="cm-table-selector-container">
                    <label for="cm-table-selector">Tabela de Dados Alvo:</label>
                    <select id="cm-table-selector"><option value="">-- Selecione --</option>${tables.map(t => `<option value="${t.id}" ${t.id === targetTableId ? 'selected' : ''}>${t.id}</option>`).join('')}</select>
                </div>
                <div id="cm-specialized-editor"></div>`;
            const tableSelector = editorContentEl.querySelector('#cm-table-selector');
            const specializedEditorContainer = editorContentEl.querySelector('#cm-specialized-editor');
            const renderSpecializedEditor = (tableId, configsToPass) => {
                if (tableId) { currentEditorModule.render(specializedEditorContainer, configData, tableLens, tableId, configsToPass); }
                else { specializedEditorContainer.innerHTML = ''; }
            };
            tableSelector.onchange = () => { renderSpecializedEditor(tableSelector.value, allConfigs); };
            if (targetTableId) { renderSpecializedEditor(targetTableId, allConfigs); }
        };

        container.querySelector('#cm-new-btn').onclick = () => {
            const type = newTypeSelectorEl.value;
            clearForm();
            displayConfig({ id: null, componentType: type, widgetTitle: `Nova Config - ${type}`, configId: `nova_${type.replace(/\s+/g, '').toLowerCase()}_${Date.now()}`, configJson: '{}' });
        };

        container.querySelector('#cm-duplicate-btn').onclick = () => { if (selectedConfig) { duplicateConfig(selectedConfig); } };
        container.querySelector('#cm-delete-btn').onclick = () => { if (selectedConfig) { deleteConfig(selectedConfig); } };
            
        formEl.onsubmit = async (e) => {
            e.preventDefault();
            if (!selectedConfig || !currentEditorModule) return;
            const specializedEditorContainer = editorContentEl.querySelector('#cm-specialized-editor');
            const newConfigData = currentEditorModule.read(specializedEditorContainer);
            const recordData = {
                widgetTitle: formEl.querySelector('#cm-widget-title').value.trim(),
                configId: formEl.querySelector('#cm-config-id').value.trim(),
                description: formEl.querySelector('#cm-description').value.trim(),
                componentType: selectedConfig.componentType,
                configJson: JSON.stringify(newConfigData)
            };
            try {
                if (selectedConfig.id) {
                    await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
                } else {
                    await dataWriter.addRecord(CONFIG_TABLE, recordData);
                }
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                loadList(filterTypeSelectorEl.value);
                alert(`Configuração "${recordData.widgetTitle}" salva!`);
                if (_grist) { _grist.setOptions({ configId: recordData.configId }); }
                close();
            } catch(err) {
                 alert(`Erro ao salvar: ${err.message}`);
            }
        };

        clearForm();
        loadList();
        colorizeDropdown(newTypeSelectorEl);
        colorizeDropdown(filterTypeSelectorEl);

    } catch (error) {
        console.error("Erro inesperado no ConfigManager:", error);
        container.innerHTML = `<div class="editor-error">Erro inesperado: ${error.message}.</div>`;
    }
}

export function open(grist, options = {}) {
    if (overlay) return;
    _grist = grist;
    const { initialConfigId = null, componentTypes = ['Card System', 'Drawer', 'Card Style', 'Table'] } = options;
    overlay = document.createElement('div');
    overlay.className = 'grf-cm-overlay';
    overlay.innerHTML = `<div class="grf-cm-modal"><div class="grf-cm-header"><h1>Gerenciador de Configurações</h1><button class="grf-cm-close">×</button></div><div class="grf-cm-body"><p>Carregando...</p></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.grf-cm-close').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    renderMainUI(overlay.querySelector('.grf-cm-body'), initialConfigId, componentTypes);
}