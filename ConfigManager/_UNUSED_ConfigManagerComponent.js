// libraries/grist-config-manager/ConfigManagerComponent.js
// Este é um COMPONENTE, não um widget. Ele é chamado por outros widgets.

const ConfigManagerComponent = (() => {
    let overlay = null;

    // --- MODIFICAÇÃO ---: Adicionada função auxiliar para copiar texto.
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

    // --- MODIFICAÇÃO ---: Nova função para renderizar as instruções de setup.
    function renderSetupInstructions(container) {
        container.innerHTML = `
            <div class="grf-cm-setup-guide">
                <h2>Configuração Necessária do Framework</h2>
                <p>Para o Gerenciador de Configurações funcionar, a tabela de dados dele precisa existir neste documento.</p>
                
                <h4>Passo 1: Crie a Tabela</h4>
                <p>Crie uma nova tabela com o nome exato:</p>
                <div class="grf-copy-box">
                    <code>_grf_config</code>
                    <button class="grf-copy-btn">Copiar</button>
                </div>

                <h4>Passo 2: Crie as Colunas</h4>
                <p>Adicione as seguintes colunas à tabela <code>_grf_config</code>:</p>
                <table class="grf-setup-table">
                    <thead>
                        <tr>
                            <th>Nome da Coluna (Clique para copiar)</th>
                            <th>Tipo de Coluna no Grist</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td class="grf-copy-cell">name</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">description</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">componentType</td><td>Text</td></tr>
                        <tr><td class="grf-copy-cell">configData</td><td>Text</td></tr>
                    </tbody>
                </table>
                <p class="grf-setup-footer">Após criar a tabela e as colunas, feche esta janela e abra o configurador novamente.</p>
            </div>
        `;
        
        // Adiciona eventos de clique para os botões e células
        container.querySelector('.grf-copy-btn').addEventListener('click', (e) => {
            copyToClipboard('_grf_config', e.target);
        });

        container.querySelectorAll('.grf-copy-cell').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', (e) => {
                copyToClipboard(e.target.textContent, e.target);
            });
        });
    }

    function open({ componentTypes = [] } = {}) {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'grf-cm-overlay';
        overlay.innerHTML = `
            <div class="grf-cm-modal">
                <div class="grf-cm-header">
                    <h1>Gerenciador de Configurações</h1>
                    <button class="grf-cm-close">×</button>
                </div>
                <div class="grf-cm-body">
                    <!-- O conteúdo será renderizado aqui -->
                    <p>Carregando...</p> 
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.grf-cm-close').onclick = close;
        overlay.addEventListener('click', e => {
            if (e.target === overlay) close();
        });
        
        renderMainUI(overlay.querySelector('.grf-cm-body'), componentTypes);
    }

    function close() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        overlay = null;
    }

    async function renderMainUI(container, componentTypes) {
        // --- MODIFICAÇÃO ---: Envolvemos toda a lógica em um try...catch para detectar falhas de inicialização.
        try {
            // --- MODIFICAÇÃO ---: O nome da tabela está correto e agora é uma constante.
            const CONFIG_TABLE = '_grf_config';

            // Instâncias das bibliotecas de dados
            const tableLens = new GristTableLens(grist);
            const dataWriter = new GristDataWriter(grist);
            
            // --- MODIFICAÇÃO ---: Primeira chamada para buscar dados. Se a tabela não existir, isso vai falhar e o catch será executado.
            const allConfigsInitial = await tableLens.fetchTableRecords(CONFIG_TABLE);

            const newTypeOptions = componentTypes.map(type => `<option value="${type}">${type}</option>`).join('');

            container.innerHTML = `
                <div class="grf-cm-main-container">
                    <div class="grf-cm-sidebar">
                        <h2>Configurações</h2>
                        <div class="grf-cm-new-controls">
                            <select id="cm-new-type-selector">
                                ${newTypeOptions}
                            </select>
                            <button id="cm-new-btn" class="btn btn-primary">+ Nova</button>
                        </div>
                        <ul id="cm-config-list"></ul>
                    </div>
                    <div class="grf-cm-editor-panel">
                        <form id="cm-config-form">
                            <input type="hidden" id="cm-record-id">
                            <!-- --- MODIFICAÇÃO ---: Alterado de 'ID da Configuração' para 'Nome' e o ID do input mudou. -->
                            <div class="form-group">
                                <label for="cm-name">Nome da Configuração (Usado para identificar na lista)</label>
                                <input type="text" id="cm-name" required>
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

            const editorMap = {
                'CardSystem': window.CardConfigEditor,
                'Drawer': window.DrawerConfigEditor,
            };

            const configListEl = container.querySelector('#cm-config-list');
            const editorContentEl = container.querySelector('#cm-editor-content');
            const nameInputEl = container.querySelector('#cm-name'); // --- MODIFICAÇÃO ---: De configIdInputEl para nameInputEl
            const descriptionInputEl = container.querySelector('#cm-description');
            const recordIdInputEl = container.querySelector('#cm-record-id');
            const formEl = container.querySelector('#cm-config-form');
            
            let allConfigs = [];
            let selectedConfig = null;
            let currentEditorModule = null;

            const clearForm = () => {
                selectedConfig = null;
                formEl.reset();
                editorContentEl.innerHTML = '<p class="editor-placeholder">Selecione uma configuração ou crie uma nova.</p>';
            };

            const displayConfig = async (config) => {
                selectedConfig = config;
                recordIdInputEl.value = config.id || '';
                // --- MODIFICAÇÃO ---: Usando 'name' e 'configData' em vez de 'configId' e 'configJson'
                nameInputEl.value = config.name || '';
                descriptionInputEl.value = config.description || '';
                
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

                // Adicionado para pré-selecionar a tabela e renderizar o editor
                const parsedConfigData = JSON.parse(config.configData || '{}');
                if (parsedConfigData.tableId) {
                    tableSelector.value = parsedConfigData.tableId;
                }

                tableSelector.onchange = () => {
                    currentEditorModule.render(specializedEditor, JSON.parse(config.configData || '{}'), tableLens, tableSelector.value);
                };

                // Dispara o evento se a tabela já estiver selecionada
                if (tableSelector.value) {
                    tableSelector.dispatchEvent(new Event('change'));
                }
            };

            const loadList = async () => {
                allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE);
                configListEl.innerHTML = '';
                allConfigs.forEach(c => {
                    const li = document.createElement('li');
                    li.textContent = c.name; // --- MODIFICAÇÃO ---: Exibindo o 'name'
                    li.dataset.id = c.id; // Guardando o id para referência
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
                clearForm();
                selectedConfig = {
                    id: null,
                    componentType: type,
                    name: `Nova Config - ${type}`,
                    configData: '{}' // --- MODIFICAÇÃO ---
                };
                displayConfig(selectedConfig);
            };
            
            formEl.onsubmit = async (e) => {
                e.preventDefault();
                if (!selectedConfig) return;

                const name = nameInputEl.value.trim();
                if (!name) { alert('O Nome da Configuração é obrigatório.'); return; }

                const newConfigData = currentEditorModule.read(editorContentEl.querySelector('#cm-specialized-editor'));
                // --- MODIFICAÇÃO ---: Montando o objeto de registro com os nomes de coluna corretos.
                const recordData = {
                    name,
                    description: descriptionInputEl.value.trim(),
                    configData: JSON.stringify(newConfigData),
                    componentType: selectedConfig.componentType,
                };

                if (selectedConfig.id) {
                    await dataWriter.updateRecord(CONFIG_TABLE, selectedConfig.id, recordData);
                } else {
                    await dataWriter.addRecord(CONFIG_TABLE, recordData);
                }

                alert(`Configuração "${name}" salva com sucesso!`);
                await loadList();
            };

            await loadList();

        } catch (error) {
            console.warn("GRF_CM: Erro na inicialização, provável tabela de config ausente.", error);
            // --- MODIFICAÇÃO ---: Se algo der errado (provavelmente a tabela não existe), renderizamos o guia.
            renderSetupInstructions(container);
        }
    }

    return { open };
})();