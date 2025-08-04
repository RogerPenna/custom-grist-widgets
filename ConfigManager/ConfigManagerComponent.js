// libraries/grist-config-manager/ConfigManagerComponent.js
// Este é um COMPONENTE, não um widget. Ele é chamado por outros widgets.

const ConfigManagerComponent = (() => {
    let overlay = null;

    // A API pública do componente é uma única função: open().
    function open() {
        if (overlay) return; // Previne abrir múltiplos

        // 1. Cria a estrutura do modal a partir do zero
        overlay = document.createElement('div');
        overlay.className = 'grf-cm-overlay';
        overlay.innerHTML = `
            <div class="grf-cm-modal">
                <div class="grf-cm-header">
                    <h1>Gerenciador de Configurações</h1>
                    <button class="grf-cm-close">×</button>
                </div>
                <div class="grf-cm-body">
                    <!-- O conteúdo do ConfigManager será renderizado aqui -->
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 2. Adiciona eventos para fechar o modal
        overlay.querySelector('.grf-cm-close').onclick = close;
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                close();
            }
        });

        // 3. Renderiza a UI principal do configurador dentro do corpo do modal
        renderMainUI(overlay.querySelector('.grf-cm-body'));
    }

    function close() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        overlay = null;
    }

    // Esta função contém a lógica do antigo config-manager-widget.js
    async function renderMainUI(container) {
        container.innerHTML = `
            <div class="grf-cm-main-container">
                <div class="grf-cm-sidebar">
                    <h2>Configurações</h2>
                    <div class="grf-cm-new-controls">
                        <select id="cm-new-type-selector">
                            <option value="Drawer">Drawer</option>
                            <option value="CardSystem">Card System</option>
                        </select>
                        <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                    </div>
                    <ul id="cm-config-list"></ul>
                </div>
                <div class="grf-cm-editor-panel">
                    <form id="cm-config-form">
                        <input type="hidden" id="cm-record-id">
                        <div class="form-group">
                            <label for="cm-config-id">ID da Configuração (Copie este valor)</label>
                            <input type="text" id="cm-config-id" required readonly>
                        </div>
                        <div class="form-group">
                            <label for="cm-description">Descrição</label>
                            <input type="text" id="cm-description">
                        </div>
                        <div id="cm-editor-content"></div>
                        <div class="form-actions">
                            <button type="submit" id="cm-save-btn" class="btn btn-success">Salvar e Fechar</button>
                        </div>
                    </form>
                </div>
            </div>`;

        // Mapeamento dos editores especialistas
        const editorMap = {
            'Drawer': window.DrawerConfigEditor,
            'CardSystem': window.CardConfigEditor,
        };

        // Referências aos elementos do DOM, escopadas ao container
        const configListEl = container.querySelector('#cm-config-list');
        const editorContentEl = container.querySelector('#cm-editor-content');
        const configIdInputEl = container.querySelector('#cm-config-id');
        const descriptionInputEl = container.querySelector('#cm-description');
        const recordIdInputEl = container.querySelector('#cm-record-id');
        const formEl = container.querySelector('#cm-config-form');

        // Instâncias das bibliotecas de dados
        const tableLens = new GristTableLens(grist);
        const dataWriter = new GristDataWriter(grist);
        const CONFIG_TABLE = 'Grf_config';
        
        let allConfigs = [];
        let selectedConfig = null;
        let currentEditorModule = null;

        const clearForm = () => {
            selectedConfig = null;
            formEl.reset();
            editorContentEl.innerHTML = '<p class="editor-placeholder">Selecione uma configuração ou crie uma nova.</p>';
            configIdInputEl.readOnly = false;
        };

        const displayConfig = async (config) => {
            selectedConfig = config;
            recordIdInputEl.value = config.id || '';
            configIdInputEl.value = config.configId || '';
            descriptionInputEl.value = config.description || '';
            configIdInputEl.readOnly = true;

            currentEditorModule = editorMap[config.componentType];
            if (!currentEditorModule) {
                editorContentEl.innerHTML = `<p style="color:red;">Editor para o tipo "${config.componentType}" não encontrado.</p>`;
                return;
            }

            editorContentEl.innerHTML = `
                <div class="form-group" id="cm-table-selector-container"></div>
                <div id="cm-specialized-editor"></div>`;
            
            const tableSelectorContainer = editorContentEl.querySelector('#cm-table-selector-container');
            const specializedEditor = editorContentEl.querySelector('#cm-specialized-editor');
            
            const tables = await tableLens.listAllTables();
            tableSelectorContainer.innerHTML = `<label for="cm-table-selector">Tabela de Dados:</label>
                <select id="cm-table-selector"><option value="">-- Selecione --</option>
                ${tables.map(t => `<option value="${t.id}">${t.id}</option>`).join('')}
                </select>`;
            
            const tableSelector = editorContentEl.querySelector('#cm-table-selector');
            tableSelector.onchange = () => {
                currentEditorModule.render(specializedEditor, JSON.parse(config.configJson || '{}'), tableLens, tableSelector.value);
            };
        };

        const loadList = async () => {
            allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
            configListEl.innerHTML = '';
            allConfigs.forEach(c => {
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
            const newId = `${type}_${Date.now()}`;
            clearForm();
            selectedConfig = {
                id: null,
                componentType: type,
                configId: newId,
                configJson: '{}'
            };
            configIdInputEl.readOnly = false; // Permitir edição do ID para novas configs
            displayConfig(selectedConfig);
        };
        
        formEl.onsubmit = async (e) => {
            e.preventDefault();
            if (!selectedConfig) return;

            const configId = configIdInputEl.value.trim();
            if (!configId) { alert('O ID da Configuração é obrigatório.'); return; }

            const newConfigData = currentEditorModule.read(editorContentEl.querySelector('#cm-specialized-editor'));
            const recordData = {
                configId,
                description: descriptionInputEl.value.trim(),
                configJson: JSON.stringify(newConfigData),
                componentType: selectedConfig.componentType,
            };

            if (selectedConfig.id) {
                await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
            } else {
                await dataWriter.addRecord(CONFIG_TABLE, recordData);
            }

            alert(`Configuração "${configId}" salva com sucesso! Você já pode copiar o ID e fechar esta janela.`);
            await loadList(); // Recarrega a lista para mostrar a nova config
        };

        await loadList();
    }

    // Expõe apenas a função `open` publicamente.
    return { open };
})();