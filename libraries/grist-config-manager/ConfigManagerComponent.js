import { GristTableLens } from '../grist-table-lens/grist-table-lens.js?v=1.1.0';
import { GristDataWriter } from '../grist-data-writer.js?v=1.1.0';
import { publish } from '../grist-event-bus/grist-event-bus.js?v=1.1.0';
import { GristRestApi } from '../grist-rest-api.js';

// Import editor modules
import { CardConfigEditor } from './editors/config-cards.js?v=1.0.3';
import { DrawerConfigEditor } from './editors/config-drawer.js?v=1.0.3';
import { CardStyleConfigEditor } from './editors/config-card-style.js?v=1.0.3';
import { TableConfigEditor } from './editors/config-table.js?v=1.0.3';
import { BscConfigEditor } from './editors/config-bsc.js?v=1.0.3';
import { IndicatorsConfigEditor } from './editors/config-indicators.js?v=1.0.3';
import { ProgressBarConfigEditor } from './editors/config-progress-bar.js?v=1.0.3';
import { ColorOptionsConfigEditor } from './editors/config-color-options.js?v=1.0.3';
import { TimelineConfigEditor } from './editors/config-timeline.js';
import { GanttConfigEditor } from './editors/config-gantt.js';

let overlay = null;
let _grist = null;

const COMPONENT_TYPE_COLORS = {
    'CardSystem': '#0d6efd', // blue
    'Drawer': '#198754', // green
    'CardStyle': '#6c757d', // grey
    'Table': '#fd7e14', // orange
    'BSC': '#6f42c1', // purple
    'Indicators': '#d63384', // pink
    'ProgressBar': '#20c997', // teal
    'ColorOptions': '#adb5bd', // secondary
    'StatusIcons': '#ffc107', // warning
    'Timeline': '#0dcaf0', // cyan
    'Gantt': '#ffc107', // gold
    'default': '#6c757d' // grey
};

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.textContent;
        element.textContent = 'Copiado!';
        setTimeout(() => { element.textContent = originalText; }, 1500);
    }).catch(err => console.error('Falha ao copiar texto: ', err));
}

function renderSetupInstructions(container, missingColumns = []) {
    const isUpdate = missingColumns.length > 0;
    const title = isUpdate ? "Atualização Necessária no Banco" : "Bem-vindo ao Setup Inicial";
    const desc = isUpdate 
        ? `<p>A sua tabela <code>Grf_config</code> é de uma versão antiga e precisa de novas colunas.</p>`
        : `<p>A tabela de sistema <code>Grf_config</code> não foi encontrada neste documento.</p>`;

    container.innerHTML = `
        <div class="grf-cm-setup-guide" style="padding: 30px; text-align: center; max-width: 500px; margin: 0 auto; margin-top: 50px;">
            <h2 style="font-size: 22px; color: #1e293b; margin-bottom: 10px;">✨ ${title}</h2>
            ${desc}
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">
                    O widget pode criar e configurar tudo automaticamente para você usando a API do Grist.
                </p>
                <button id="grf-auto-setup-btn" class="btn btn-primary" style="font-size: 14px; padding: 12px 24px; font-weight: bold;">
                    🚀 Fazer Setup Automático Agora
                </button>
            </div>
            <p style="font-size: 12px; color: #94a3b8;">
                Ao clicar, solicitaremos sua API Key temporariamente para realizar as alterações estruturais.
            </p>
            
            <details style="margin-top: 30px; text-align: left; font-size: 12px; color: #64748b;">
                <summary style="cursor: pointer; padding: 5px;">Preferir criar manualmente?</summary>
                <div style="margin-top: 10px; padding-left: 15px; border-left: 2px solid #cbd5e1;">
                    <p>Crie uma tabela chamada <code>Grf_config</code> com as colunas Text/Numeric exatas:</p>
                    <p><code>configId, widgetTitle, description, componentType, mappingJson, stylingJson, actionsJson, configJson, pageId</code></p>
                </div>
            </details>
        </div>
    `;

    container.querySelector('#grf-auto-setup-btn').onclick = async (e) => {
        const btn = e.target;
        btn.textContent = "⏳ Autorizando...";
        btn.disabled = true;

        try {
            await GristRestApi.init(window.grist);
            const apiKey = await GristRestApi.requireApiKey(); // Will prompt if not in memory
            
            btn.textContent = "⚙️ Construindo Banco...";
            
            // The required schema for Grf_config
            const requiredSchema = [
                { id: "configId", fields: { type: "Text" } },
                { id: "widgetTitle", fields: { type: "Text" } },
                { id: "description", fields: { type: "Text" } },
                { id: "componentType", fields: { type: "Text" } },
                { id: "mappingJson", fields: { type: "Text" } },
                { id: "stylingJson", fields: { type: "Text" } },
                { id: "actionsJson", fields: { type: "Text" } },
                { id: "configJson", fields: { type: "Text" } },
                { id: "pageId", fields: { type: "Numeric" } }
            ];

            if (isUpdate) {
                // We just need to add the missing columns
                const columnsToAdd = requiredSchema.filter(col => missingColumns.includes(col.id));
                await GristRestApi.request(`/tables/Grf_config/columns`, {
                    method: 'POST',
                    body: JSON.stringify({ columns: columnsToAdd })
                });
            } else {
                // We need to create the whole table
                await GristRestApi.request(`/tables`, {
                    method: 'POST',
                    body: JSON.stringify({
                        tables: [{
                            id: "Grf_config",
                            columns: requiredSchema
                        }]
                    })
                });
            }

            btn.textContent = "✅ Sucesso! Recarregando...";
            btn.style.background = "#10b981";
            
            // Reload the widget to load the new schema
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (err) {
            alert(`Erro no Setup Automático: ${err.message}`);
            btn.textContent = "❌ Tentar Novamente";
            btn.disabled = false;
            btn.style.background = "#ef4444";
        }
    };
}

function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
}

export async function renderMainUI(grist, container, initialConfigId, componentTypes) {
    console.log("ConfigManager: renderMainUI inicializado com grist:", grist);
    const activeGrist = grist || window.grist;
    if (!activeGrist) {
        console.error("ConfigManager: Objeto grist não encontrado!");
        throw new Error("ConfigManager: Instância do Grist não fornecida.");
    }
    const CONFIG_TABLE = 'Grf_config';
    const tableLens = new GristTableLens(activeGrist);
    const dataWriter = new GristDataWriter(activeGrist);

    try {
        const allTableIds = await activeGrist.docApi.listTables();
        if (!allTableIds.includes(CONFIG_TABLE)) {
            renderSetupInstructions(container);
            return;
        }

        // --- MASTER LISTS ---
        const MASTER_WIDGET_TYPES = ['Card System', 'Drawer', 'Table', 'BSC', 'Indicators', 'Timeline', 'Gantt'];
        const MASTER_COMPONENT_TYPES = ['Progress Bar', 'Color Options', 'Card Style', 'Status Icons'];

        // --- NOVA VERIFICAÇÃO DE COLUNAS (TRIPARTIÇÃO) ---
        const tableSchema = await tableLens.getTableSchema(CONFIG_TABLE, { mode: 'raw' });
        const requiredColumns = ['mappingJson', 'stylingJson', 'actionsJson'];
        const missingColumns = requiredColumns.filter(col => !tableSchema[col]);

        if (missingColumns.length > 0) {
            console.warn("ConfigManager: Colunas de tripartição ausentes:", missingColumns);
            renderSetupInstructions(container, missingColumns);
            return;
        }

        // --- Event Listener for Saving Card Styles ---
        container.addEventListener('grf-save-card-style', async (e) => {
            console.log("ConfigManager: Caught grf-save-card-style event", e.detail);
            const { configJson, componentType, description } = e.detail;
            
            const styleName = prompt("Insira um nome para este novo Estilo de Card:", "Meu Novo Estilo");
            if (!styleName) return;

            const newRecord = {
                widgetTitle: styleName,
                configId: `style_${Date.now()}`,
                description: description || '[STYLE]',
                componentType: componentType,
                configJson: configJson // Legado
            };

            // Adiciona tripartição se as colunas existirem
            const parsed = JSON.parse(configJson);
            
            if (tableSchema['stylingJson']) {
                newRecord.stylingJson = JSON.stringify(parsed.styling || parsed);
            }
            if (tableSchema['actionsJson'] && parsed.actions) {
                newRecord.actionsJson = JSON.stringify(parsed.actions);
            }

            try {
                await dataWriter.addRecord(CONFIG_TABLE, newRecord);
                alert(`Estilo "${styleName}" salvo com sucesso!`);
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                loadList(filterTypeSelectorEl.value);
                if (selectedConfig) displayConfig(selectedConfig);
            } catch (err) {
                console.error("Error saving style record:", err);
                alert(`Falha ao salvar estilo: ${err.message}`);
            }
        });

        let allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
        let activeTab = 'instances'; // 'instances' or 'components'

        const colorizeDropdown = (selectEl) => {
            if (!selectEl) return;
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

        const createTypeOption = (type) => {
            const color = COMPONENT_TYPE_COLORS[type.replace(/\s+/g, '')] || COMPONENT_TYPE_COLORS['default'];
            const brightness = (parseInt(color.replace('#', ''), 16) > 0xffffff / 2) ? 'black' : 'white';
            return `<option value="${type}" style="background-color: ${color}; color: ${brightness};">${type}</option>`;
        };

        const updateSelectors = () => {
            const types = activeTab === 'instances' ? MASTER_WIDGET_TYPES : MASTER_COMPONENT_TYPES;
            const optionsHtml = types.map(createTypeOption).join('');
            
            const filterSelector = container.querySelector('#cm-filter-type-selector');
            const newSelector = container.querySelector('#cm-new-type-selector');
            
            if (filterSelector && newSelector) {
                const currentFilter = filterSelector.value;
                filterSelector.innerHTML = `<option value="">-- Todos --</option>` + optionsHtml;
                newSelector.innerHTML = optionsHtml;
                
                // Try to keep filter if valid for new tab
                if (types.includes(currentFilter)) {
                    filterSelector.value = currentFilter;
                } else {
                    filterSelector.value = "";
                }
                
                colorizeDropdown(filterSelector);
                colorizeDropdown(newSelector);
            }
        };

        container.innerHTML = `
            <div class="grf-cm-tabs">
                <button class="grf-cm-tab-btn active" data-tab="instances">Instâncias de Widgets</button>
                <button class="grf-cm-tab-btn" data-tab="components">Componentes Globais (Design System)</button>
            </div>
            <div class="grf-cm-main-container">
                <div class="grf-cm-sidebar">
                    <div class="cm-sidebar-header" style="padding: 10px 15px; border-bottom: 1px solid #eee;">
                        <div class="cm-group-toggle" style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                            <label style="font-weight: bold; color: #666; white-space: nowrap;">Agrupar por:</label>
                            <select id="cm-group-mode" class="cm-mini-select" style="flex: 1; padding: 2px; border-radius: 4px; border: 1px solid #ddd;">
                                <option value="type">Tipo</option>
                                <option value="table">Tabela</option>
                                <option value="tag">Pasta [TAG]</option>
                            </select>
                        </div>
                    </div>
                    <div class="grf-cm-controls-container" style="padding: 10px 15px;">
                        <div class="grf-cm-filter-controls">
                            <label for="cm-filter-type-selector">Filtro:</label>
                            <select id="cm-filter-type-selector">
                                <option value="">-- Todos --</option>
                            </select>
                        </div>
                        <div class="grf-cm-new-controls">
                            <select id="cm-new-type-selector"></select>
                            <button id="cm-new-btn" class="btn btn-primary" title="Criar Nova Configuração">+</button>
                        </div>
                    </div>
                    <div id="cm-config-list-container" style="flex: 1; overflow-y: auto; padding: 0 15px;">
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
                        <div class="form-group"><label for="cm-widget-title">Título (Ex: Nome do Preset)</label><input type="text" id="cm-widget-title" required></div>
                        <div class="form-group"><label for="cm-config-id">ID Único (Prefixado com @GLOBAL para padrões)</label><input type="text" id="cm-config-id" required></div>
                        <div class="form-group"><label for="cm-description">Descrição</label><input type="text" id="cm-description"></div>
                        <div id="cm-editor-content"><p class="editor-placeholder">Selecione uma config ou crie uma nova.</p></div>
                        <div class="form-actions"><button type="button" id="cm-save-btn" class="btn btn-success">Salvar e Fechar</button></div>
                    </form>
                </div>
            </div>`;

        const formEl = container.querySelector('#cm-config-form');
        formEl.onsubmit = (e) => e.preventDefault();

        const editorMap = { 
            'CardSystem': CardConfigEditor, 
            'Drawer': DrawerConfigEditor, 
            'CardStyle': CardStyleConfigEditor, 
            'Table': TableConfigEditor, 
            'BSC': BscConfigEditor, 
            'StrategicPlanning': BscConfigEditor,
            'Indicators': IndicatorsConfigEditor,
            'Timeline': TimelineConfigEditor,
            'Gantt': GanttConfigEditor,
            // Design System Components
            'ProgressBar': ProgressBarConfigEditor,
            'ColorOptions': ColorOptionsConfigEditor,
            'StatusIcons': IndicatorsConfigEditor
        };
        const configListEl = container.querySelector('#cm-config-list');
        const editorContentEl = container.querySelector('#cm-editor-content');
        const editorActionsEl = container.querySelector('#cm-editor-actions');
        const newTypeSelectorEl = container.querySelector('#cm-new-type-selector');
        const filterTypeSelectorEl = container.querySelector('#cm-filter-type-selector');
        const groupModeEl = container.querySelector('#cm-group-mode');

        // Initial selector setup
        updateSelectors();

        // Tab logic
        container.querySelectorAll('.grf-cm-tab-btn').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.grf-cm-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                updateSelectors();
                clearForm();
                loadList(filterTypeSelectorEl.value);
            };
        });

        let selectedConfig = null;
        let currentEditorModule = null;

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
            let configsToDisplay = allConfigs;
            
            // Apply tab filtering
            if (activeTab === 'instances') {
                configsToDisplay = configsToDisplay.filter(c => !c.configId.startsWith('@GLOBAL:'));
            } else {
                configsToDisplay = configsToDisplay.filter(c => c.configId.startsWith('@GLOBAL:'));
            }

            // Apply type filter
            if (filterType) {
                configsToDisplay = configsToDisplay.filter(c => c.componentType === filterType);
            }

            configListEl.innerHTML = '';
            const groupMode = groupModeEl.value;

            const groupedConfigs = configsToDisplay.reduce((acc, config) => {
                let group = 'Outros';
                
                if (groupMode === 'tag') {
                    const match = (config.description || '').match(/^\[(.*?)\]/);
                    group = match ? match[1] : (config.componentType || 'Outros');
                } else if (groupMode === 'table') {
                    const unified = tableLens.parseConfigRecord(config);
                    group = unified.tableId || unified.mapping?.modelsTable || 'Sem Tabela';
                } else {
                    group = config.componentType || 'Outros';
                }

                if (!acc[group]) acc[group] = [];
                acc[group].push(config);
                return acc;
            }, {});

            Object.keys(groupedConfigs).sort().forEach(groupName => {
                const groupHeader = document.createElement('h4');
                groupHeader.textContent = groupName;
                groupHeader.className = 'cm-group-header';
                configListEl.appendChild(groupHeader);
                const groupItemList = document.createElement('ul');
                groupItemList.className = 'cm-group-items';
                configListEl.appendChild(groupItemList);
                groupHeader.addEventListener('click', () => {
                    groupItemList.style.display = groupItemList.style.display === 'none' ? '' : 'none';
                    groupHeader.classList.toggle('collapsed');
                });
                groupedConfigs[groupName].forEach(c => {
                    const li = document.createElement('li');
                    const nameSpan = document.createElement('span');
                    
                    const unified = tableLens.parseConfigRecord(c);
                    const tableDisplay = unified.tableId ? ` [${unified.tableId}]` : '';
                    const typeDisplay = groupMode !== 'type' ? ` (${c.componentType})` : '';
                    
                    nameSpan.innerHTML = `<b>${c.widgetTitle}</b> <small style="color:#666">${tableDisplay}${typeDisplay}</small>`;
                    const typeCircle = document.createElement('span');
                    typeCircle.className = 'cm-type-circle';
                    typeCircle.style.backgroundColor = COMPONENT_TYPE_COLORS[c.componentType.replace(/\s+/g, '')] || COMPONENT_TYPE_COLORS['default'];
                    
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
        groupModeEl.addEventListener('change', () => loadList(filterTypeSelectorEl.value));

        const displayConfig = async (config) => {
            // Unifica a configuração (Tripartição) antes de passar para o editor
            const unifiedConfig = tableLens.parseConfigRecord(config);
            const isGlobal = (config.configId || '').startsWith('@GLOBAL:');
            
            selectedConfig = { ...config, ...unifiedConfig }; // Mantém IDs e campos extras
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

            const tables = isGlobal ? [] : await tableLens.listAllTables();
            const targetTableId = unifiedConfig.tableId || '';
            
            editorContentEl.innerHTML = `
                ${isGlobal ? '' : `
                    <div class="form-group" id="cm-table-selector-container">
                        <label for="cm-table-selector">Tabela de Dados Alvo:</label>
                        <select id="cm-table-selector"><option value="">-- Selecione --</option>${tables.map(t => `<option value="${t.id}" ${t.id === targetTableId ? 'selected' : ''}>${t.id}</option>`).join('')}</select>
                    </div>
                `}
                <div id="cm-specialized-editor"></div>`;
            
            const tableSelector = editorContentEl.querySelector('#cm-table-selector');
            const specializedEditorContainer = editorContentEl.querySelector('#cm-specialized-editor');
            
            const renderSpecializedEditor = (tableId, configsToPass) => {
                if (isGlobal || tableId) { 
                    currentEditorModule.render(specializedEditorContainer, unifiedConfig, tableLens, tableId, configsToPass); 
                } else { 
                    specializedEditorContainer.innerHTML = ''; 
                }
            };

            if (tableSelector) {
                tableSelector.onchange = () => { renderSpecializedEditor(tableSelector.value, allConfigs); };
            }
            
            if (isGlobal || targetTableId) { 
                renderSpecializedEditor(targetTableId, allConfigs); 
            }
        };

        container.querySelector('#cm-new-btn').onclick = () => {
            const type = newTypeSelectorEl.value;
            let configId = `nova_${type.replace(/\s+/g, '').toLowerCase()}_${Date.now()}`;
            if (activeTab === 'components') {
                configId = `@GLOBAL:${type.replace(/\s+/g, '').toUpperCase()}:${Date.now()}`;
            }
            clearForm();
            displayConfig({ id: null, componentType: type, widgetTitle: `Nova Config - ${type}`, configId: configId, configJson: '{}' });
        };

        container.querySelector('#cm-duplicate-btn').onclick = () => { if (selectedConfig) { duplicateConfig(selectedConfig); } };
        container.querySelector('#cm-delete-btn').onclick = () => { if (selectedConfig) { deleteConfig(selectedConfig); } };
            
        console.log("Attaching onsubmit handler");
        container.querySelector('#cm-save-btn').onclick = async () => {
            if (!selectedConfig || !currentEditorModule) return;
            const specializedEditorContainer = editorContentEl.querySelector('#cm-specialized-editor');
            const newConfigData = currentEditorModule.read(specializedEditorContainer);
            const tableSelector = editorContentEl.querySelector('#cm-table-selector');
            if (tableSelector && tableSelector.value) {
                if (newConfigData.mapping) {
                    newConfigData.mapping.tableId = tableSelector.value;
                } else {
                    newConfigData.tableId = tableSelector.value;
                }
            }

            // --- Lógica de Tripartição no Salvamento ---
            let mappingJson = "";
            let stylingJson = "";
            let actionsJson = "";
            let unifiedConfig = {};

            if (newConfigData.mapping && newConfigData.styling && newConfigData.actions) {
                // O editor já retornou tripartido
                mappingJson = JSON.stringify(newConfigData.mapping);
                stylingJson = JSON.stringify(newConfigData.styling);
                actionsJson = JSON.stringify(newConfigData.actions);
                // Unifica para o configJson (legado e fallback)
                // IMPORTANTE: O styling deve ser uma propriedade 'styling' dentro do objeto raiz
                unifiedConfig = { 
                    ...newConfigData.mapping, 
                    ...newConfigData.actions,
                    styling: newConfigData.styling 
                };
            } else {
                // Editor legado: salvamos tudo no mapping e mantemos configJson
                mappingJson = JSON.stringify(newConfigData);
                unifiedConfig = newConfigData;
            }

            const recordData = {
                componentType: selectedConfig.componentType
            };

            const fieldMap = {
                'widgetTitle': formEl.querySelector('#cm-widget-title').value.trim(),
                'configId': formEl.querySelector('#cm-config-id').value.trim(),
                'description': formEl.querySelector('#cm-description').value.trim(),
                'mappingJson': mappingJson,
                'stylingJson': stylingJson,
                'actionsJson': actionsJson,
                'configJson': JSON.stringify(unifiedConfig)
            };

            // Somente inclui os campos se as colunas existirem na tabela Grist
            for (const [col, val] of Object.entries(fieldMap)) {
                if (tableSchema[col]) recordData[col] = val;
            }

            try {
                if (selectedConfig.id) {
                    await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
                } else {
                    await dataWriter.addRecord(CONFIG_TABLE, recordData);
                }
                
                // Limpa o cache global da configuração para que o widget a recarregue imediatamente
                if (typeof tableLens.clearConfigCache === 'function') {
                    tableLens.clearConfigCache(recordData.configId || selectedConfig.configId);
                }
                
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                loadList(filterTypeSelectorEl.value);
                alert(`Configuração \"${recordData.widgetTitle}\" salva!`);
                if (_grist && initialConfigId === recordData.configId) {
                    _grist.setOptions({ configId: recordData.configId });
                }
                
                // Notifica o barramento de eventos sobre a mudança da configuração
                publish('data-changed', { tableId: CONFIG_TABLE, action: 'update' });
                
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
    const { initialConfigId = null, componentTypes = ['Card System', 'Drawer', 'Card Style', 'Table', 'BSC', 'Indicators'] } = options;
    overlay = document.createElement('div');
    overlay.className = 'grf-cm-overlay';
    overlay.innerHTML = `<div class="grf-cm-modal"><div class="grf-cm-header"><h1>Gerenciador de Configurações</h1><button class="grf-cm-close">×</button></div><div class="grf-cm-body"><p>Carregando...</p></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.grf-cm-close').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    renderMainUI(grist, overlay.querySelector('.grf-cm-body'), initialConfigId, componentTypes);
    }
