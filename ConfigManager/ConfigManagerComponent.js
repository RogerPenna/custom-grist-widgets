'''// libraries/grist-config-manager/ConfigManagerComponent.js
// Este é um COMPONENTE, não um widget. Ele é chamado por outros widgets.

const ConfigManagerComponent = (() => {
    let overlay = null;
    let currentConfig = null; 
    let onSaveCallback = null;

    const typeDisplayNames = {
        'CardSystem': 'Cards',
        'Drawer': 'Drawer',
        'Table': 'Tabela'
    };
    const typeColors = {
        'CardSystem': '#4A90E2', // Azul
        'Drawer': '#F5A623',     // Laranja
        'Table': '#50E3C2'       // Verde-azulado
    };

    function copyToClipboard(text, element) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = element.textContent;
            element.textContent = 'Copiado!';
            setTimeout(() => {
                element.textContent = originalText;
            }, 1500);
        }).catch(err => {
            console.error('Falha ao copiar texto: ', err);
            alert('Falha ao copiar. Por favor, copie manualmente.');
        });
    }

    function renderSetupInstructions(container) {
        container.innerHTML = `
            <div class="grf-cm-setup-guide">
                <h2>Configuração Necessária do Framework</h2>
                <p>Para o Gerenciador de Configurações funcionar, a tabela de dados dele precisa existir neste documento.</p>
                <h4>Passo 1: Crie a Tabela</h4>
                <div class="grf-copy-box">
                    <code>Grf_config</code>
                    <button class="grf-copy-btn">Copiar</button>
                </div>
                <h4>Passo 2: Crie as Colunas</h4>
                <table class="grf-setup-table">
                    <thead><tr><th>Nome da Coluna (Clique para copiar)</th><th>Tipo de Coluna no Grist</th></tr></thead>
                    <tbody>
                        <tr><td class="grf-copy-cell">configId</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">description</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">componentType</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">configData</td><td>Text</td></tr>
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

    function open(config, onSave) {
        if (overlay) return;
        currentConfig = config;
        onSaveCallback = onSave;

        overlay = document.createElement('div');
        overlay.className = 'grf-cm-overlay';
        overlay.innerHTML = `
            <div class="grf-cm-modal">
                <div class="grf-cm-header">
                    <h1>Gerenciador de Configurações</h1>
                    <button class="grf-cm-close">×</button>
                </div>
                <div class="grf-cm-body"><p>Carregando...</p></div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.grf-cm-close').onclick = close;
        overlay.addEventListener('click', e => {
            if (e.target === overlay) close();
        });
        
        renderMainUI(overlay.querySelector('.grf-cm-body'));
    }

    function close() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        overlay = null;
        currentConfig = null;
        onSaveCallback = null;
    }

    async function renderMainUI(container) {
        try {
            const CONFIG_TABLE = 'Grf_config';
            const tableLens = new GristTableLens(grist);
            const dataWriter = new GristDataWriter(grist);
            
            await tableLens.fetchTableRecords(CONFIG_TABLE);

            container.innerHTML = `
                <div class="grf-cm-main-container">
                    <div class="grf-cm-sidebar">
                        <h2>Configurações</h2>
                        <div class="grf-cm-controls-container">
                            <div class="grf-cm-new-controls">
                                <select id="cm-new-type-selector">
                                    <option value="CardSystem">Card System</option>
                                    <option value="Drawer">Drawer</option>
                                    <option value="Table">Table</option>
                                </select>
                                <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                            </div>
                            <div class="grf-cm-filter-controls">
                                <label for="cm-type-filter">Filtrar:</label>
                                <select id="cm-type-filter">
                                    <option value="all">Todos os Tipos</option>
                                    <option value="CardSystem">Card System</option>
                                    <option value="Drawer">Drawer</option>
                                    <option value="Table">Table</option>
                                </select>
                            </div>
                        </div>
                        <div id="cm-config-list-container">
                            <ul id="cm-config-list"></ul>
                        </div>
                    </div>
                    <div class="grf-cm-editor-panel">
                        <form id="cm-config-form">
                            <input type="hidden" id="cm-record-id">
                            <div class="form-group form-group-horizontal">
                                <div class="form-group-main">
                                    <label for="cm-config-id">ID da Configuração</label>
                                    <input type="text" id="cm-config-id" required>
                                </div>
                                <div id="cm-editor-actions" class="form-group-actions">
                                    <button type="button" id="cm-duplicate-btn" class="btn btn-secondary" title="Duplicar">📄</button>
                                    <button type="button" id="cm-delete-btn" class="btn btn-danger" title="Excluir">🗑️</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="cm-description">Descrição</label>
                                <input type="text" id="cm-description">
                            </div>
                            <div id="cm-editor-content">
                                <p class="editor-placeholder">Selecione uma configuração ou crie uma nova.</p>
                            </div>
                            <div class="form-actions">
                                <button type="submit" id="cm-save-btn" class="btn btn-success">Salvar e Fechar</button>
                            </div>
                        </form>
                    </div>
                </div>`;

            const editorMap = {
                'CardSystem': window.CardConfigEditor,
                'Drawer': window.DrawerConfigEditor,
                'Table': window.TableConfigEditor,
            };

            const configListEl = container.querySelector('#cm-config-list');
            const editorContentEl = container.querySelector('#cm-editor-content');
            const configIdInputEl = container.querySelector('#cm-config-id');
            const descriptionInputEl = container.querySelector('#cm-description');
            const recordIdInputEl = container.querySelector('#cm-record-id');
            const formEl = container.querySelector('#cm-config-form');
            const typeFilterEl = container.querySelector('#cm-type-filter');
            const newTypeSelectorEl = container.querySelector('#cm-new-type-selector');
            const editorActionsEl = container.querySelector('#cm-editor-actions');
            
            let allConfigs = [];
            let selectedConfig = null;
            let currentEditorModule = null;

            const colorizeDropdown = (selectEl) => {
                const selectedType = selectEl.value;
                if (selectedType === 'all') {
                    selectEl.style.backgroundColor = '';
                    selectEl.style.color = '';
                } else {
                    const color = typeColors[selectedType] || '#ccc';
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

            const displayConfig = async (config) => {
                selectedConfig = config;
                recordIdInputEl.value = config.id || '';
                configIdInputEl.value = config.configId || '';
                descriptionInputEl.value = config.description || '';
                editorActionsEl.style.display = config.id ? 'flex' : 'none';
                
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
                const parsedConfigData = JSON.parse(config.configData || '{}');
                if (parsedConfigData.tableId) {
                    tableSelector.value = parsedConfigData.tableId;
                }

                tableSelector.onchange = () => {
                    currentEditorModule.render(specializedEditor, JSON.parse(config.configData || '{}'), tableLens, tableSelector.value);
                };

                if (tableSelector.value) {
                    tableSelector.dispatchEvent(new Event('change'));
                }
            };

            const loadList = async () => {
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                const filterValue = typeFilterEl.value;

                const filteredConfigs = filterValue === 'all' 
                    ? allConfigs 
                    : allConfigs.filter(c => c.componentType === filterValue);

                const groupedConfigs = filteredConfigs.reduce((acc, config) => {
                    const type = config.componentType || 'Outros';
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(config);
                    return acc;
                }, {});

                configListEl.innerHTML = '';
                for (const type in groupedConfigs) {
                    const groupContainer = document.createElement('div');
                    const header = document.createElement('div');
                    header.className = 'config-group-header';
                    header.innerHTML = `
                        <span class="group-arrow">▼</span>
                        <span>${typeDisplayNames[type] || type}</span>
                    `;
                    
                    const list = document.createElement('ul');
                    list.className = 'config-group-list';

                    groupedConfigs[type].forEach(c => {
                        const li = document.createElement('li');
                        li.dataset.id = c.id;
                        li.innerHTML = `
                            <div class="config-item-main">
                                <span class="config-item-type-indicator" style="background-color: ${typeColors[c.componentType] || '#ccc'};">&nbsp;</span>
                                <span class="config-item-name">${c.configId}</span>
                            </div>
                        `;
                        li.onclick = () => {
                            container.querySelectorAll('#cm-config-list li').forEach(item => item.classList.remove('is-active'));
                            li.classList.add('is-active');
                            displayConfig(c);
                        };
                        list.appendChild(li);
                    });

                    header.onclick = () => {
                        header.classList.toggle('collapsed');
                        list.style.display = header.classList.contains('collapsed') ? 'none' : 'block';
                    };

                    groupContainer.appendChild(header);
                    groupContainer.appendChild(list);
                    configListEl.appendChild(groupContainer);
                }
            };

            newTypeSelectorEl.addEventListener('change', () => colorizeDropdown(newTypeSelectorEl));
            typeFilterEl.addEventListener('change', () => {
                colorizeDropdown(typeFilterEl);
                loadList();
            });

            colorizeDropdown(newTypeSelectorEl);
            colorizeDropdown(typeFilterEl);

            container.querySelector('#cm-new-btn').onclick = () => {
                const type = newTypeSelectorEl.value;
                clearForm();
                const newConfig = {
                    id: null,
                    componentType: type,
                    configId: `Nova-Config-${type}-${Date.now()}`,
                    description: '',
                    configData: '{}'
                };
                displayConfig(newConfig);
                container.querySelectorAll('#cm-config-list li').forEach(item => item.classList.remove('is-active'));
            };

            container.querySelector('#cm-duplicate-btn').onclick = async () => {
                if (!selectedConfig) return;
                if (confirm(`Deseja duplicar a configuração "${selectedConfig.configId}"?`)) {
                    const newConfigId = `${selectedConfig.configId} (Cópia)`;
                    const newRecord = { ...selectedConfig, configId: newConfigId };
                    delete newRecord.id;
                    await dataWriter.addRecord(CONFIG_TABLE, newRecord);
                    await loadList();
                    clearForm();
                }
            };

            container.querySelector('#cm-delete-btn').onclick = async () => {
                if (!selectedConfig || !selectedConfig.id) return;
                if (confirm(`Deseja excluir permanentemente a configuração "${selectedConfig.configId}"?`)) {
                    await dataWriter.deleteRecord(CONFIG_TABLE, selectedConfig.id);
                    await loadList();
                    clearForm();
                }
            };
            
            formEl.onsubmit = async (e) => {
                e.preventDefault();
                if (!selectedConfig) return;

                const configId = configIdInputEl.value.trim();
                if (!configId) { alert('O ID da Configuração é obrigatório.'); return; }

                const specializedEditor = editorContentEl.querySelector('#cm-specialized-editor');
                const newConfigData = currentEditorModule.read(specializedEditor);
                
                const recordData = {
                    configId,
                    description: descriptionInputEl.value.trim(),
                    configData: JSON.stringify(newConfigData),
                    componentType: selectedConfig.componentType,
                };

                let savedRecordId = selectedConfig.id;
                if (selectedConfig.id) {
                    await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
                } else {
                    const newRecord = await dataWriter.addRecord(CONFIG_TABLE, recordData);
                    savedRecordId = newRecord.id;
                }
                
                if (onSaveCallback) {
                    onSaveCallback({ ...recordData, id: savedRecordId });
                }
                
                alert(`Configuração "${configId}" salva com sucesso!`);
                await loadList();
                close();
            };

            clearForm();
            await loadList();

        } catch (error) {
            console.warn("GRF_CM: Erro na inicialização, provável tabela de config ausente.", error);
            renderSetupInstructions(container);
        }
    }

    return { open, close };
})();
'''