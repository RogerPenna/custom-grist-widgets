// libraries/grist-config-manager/editors/config-dms.js

export const DMSConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _targetTableId = null;
    let _tableLens = null;

    async function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        _targetTableId = tableId;
        _tableLens = tableLens;
        
        const options = config || {};
        const mapping = options.mapping || {};
        const styling = options.styling || {};
        const actions = options.actions || {};

        state = {
            // Tabelas
            documentsTable: mapping.documentsTable || tableId || 'DMS_Documents',
            versionsTable: mapping.versionsTable || 'DMS_Versions',

            // Mapeamentos Documentos
            titleField: mapping.titleField || 'Name',
            pathField: mapping.pathField || 'Path',
            docTypeField: mapping.docTypeField || 'DocType',
            sectorField: mapping.sectorField || 'Sector',
            numberField: mapping.numberField || 'Number',
            codeField: mapping.codeField || 'Code',

            // Mapeamentos Versões
            docRefField: mapping.docRefField || 'DocRef',
            versionMajorField: mapping.versionMajorField || 'VersionMajor',
            versionMinorField: mapping.versionMinorField || 'VersionMinor',
            versionStringField: mapping.versionStringField || 'VersionString',
            statusField: mapping.statusField || 'Status',
            sourceTypeField: mapping.sourceTypeField || 'SourceType',
            sourceFileField: mapping.sourceFileField || 'SourceFile',
            sourceMarkdownField: mapping.sourceMarkdownField || 'SourceMarkdown',
            officialFileField: mapping.officialFileField || 'OfficialFile',
            justificationField: mapping.justificationField || 'Justification',
            updatedAtField: mapping.updatedAtField || 'UpdatedAt',
            updatedByField: mapping.updatedByField || 'UpdatedBy',

            // Estilos
            sidebarWidth: styling.sidebarWidth || '280px',
            theme: styling.theme || 'glassmorphism',

            // Ações
            drawerConfigId: actions.drawerConfigId || '',

            receivedConfigs: receivedConfigs,
            allTables: []
        };

        try {
            state.allTables = await tableLens.listAllTables();
        } catch (e) {
            console.error("DMSConfigEditor: Erro ao listar tabelas", e);
        }

        await rebuildEditor();
    }

    async function rebuildEditor() {
        if (!_mainContainer) return;

        // Buscar schemas das tabelas selecionadas
        let docsSchema = {};
        let versSchema = {};
        try {
            docsSchema = await _tableLens.getTableSchema(state.documentsTable);
        } catch (e) {
            console.warn(`DMSConfigEditor: Não foi possível obter schema para tabela ${state.documentsTable}`);
        }

        try {
            versSchema = await _tableLens.getTableSchema(state.versionsTable);
        } catch (e) {
            console.warn(`DMSConfigEditor: Não foi possível obter schema para tabela ${state.versionsTable}`);
        }

        const docsCols = Object.keys(docsSchema);
        const versCols = Object.keys(versSchema);

        const createTableOptions = (selectedId) => {
            return `<option value="">-- Selecione a Tabela --</option>` + 
                state.allTables.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name} (${t.id})</option>`).join('');
        };

        const createColumnOptions = (columns, selected) => {
            return `<option value="">-- Selecione a Coluna --</option>` + 
                columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
        };

        _mainContainer.innerHTML = `
            <div class="config-tabs">
                <button type="button" class="config-tab-button active" data-tab-id="tables">Tabelas</button>
                <button type="button" class="config-tab-button" data-tab-id="doc-mapping">Mapeamento Docs</button>
                <button type="button" class="config-tab-button" data-tab-id="ver-mapping">Mapeamento Versões</button>
                <button type="button" class="config-tab-button" data-tab-id="styling-actions">Visual & Ações</button>
            </div>
            <div class="config-content">
                <!-- ABA TABELAS -->
                <div data-tab-section="tables">
                    <h3>Seleção das Tabelas do DMS</h3>
                    <div class="form-group">
                        <label>Tabela de Metadados dos Documentos (Parent):</label>
                        <select id="dms-docs-table" class="form-control">${createTableOptions(state.documentsTable)}</select>
                    </div>
                    <div class="form-group">
                        <label>Tabela de Versões e Revisões (Child):</label>
                        <select id="dms-vers-table" class="form-control">${createTableOptions(state.versionsTable)}</select>
                    </div>
                </div>

                <!-- ABA MAPEAMENTO DOCS -->
                <div data-tab-section="doc-mapping" style="display:none">
                    <h3>Mapeamento de Colunas: Documentos</h3>
                    <div class="form-group">
                        <label>Nome / Título:</label>
                        <select id="dms-doc-title" class="form-control">${createColumnOptions(docsCols, state.titleField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Caminho da Pasta Virtual (Path):</label>
                        <select id="dms-doc-path" class="form-control">${createColumnOptions(docsCols, state.pathField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Documento (Sigla, Ex: PQP):</label>
                        <select id="dms-doc-type" class="form-control">${createColumnOptions(docsCols, state.docTypeField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Setor / Processo (Sigla, Ex: RH):</label>
                        <select id="dms-doc-sector" class="form-control">${createColumnOptions(docsCols, state.sectorField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Número Sequencial (ISO):</label>
                        <select id="dms-doc-number" class="form-control">${createColumnOptions(docsCols, state.numberField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Código Único (XXX-YYY-ZZZZ):</label>
                        <select id="dms-doc-code" class="form-control">${createColumnOptions(docsCols, state.codeField)}</select>
                    </div>
                </div>

                <!-- ABA MAPEAMENTO VERSÕES -->
                <div data-tab-section="ver-mapping" style="display:none">
                    <h3>Mapeamento de Colunas: Versões (ISO Auditável)</h3>
                    <div class="form-group">
                        <label>Vínculo com Documento (Ref: Documentos):</label>
                        <select id="dms-ver-docref" class="form-control">${createColumnOptions(versCols, state.docRefField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Versão Maior (Número Inteiro):</label>
                        <select id="dms-ver-major" class="form-control">${createColumnOptions(versCols, state.versionMajorField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Revisão Menor (Número Inteiro):</label>
                        <select id="dms-ver-minor" class="form-control">${createColumnOptions(versCols, state.versionMinorField)}</select>
                    </div>
                    <div class="form-group">
                        <label>String da Versão (Ex: 1.2):</label>
                        <select id="dms-ver-string" class="form-control">${createColumnOptions(versCols, state.versionStringField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Status (Vigente, Obsoleto, Elaboração):</label>
                        <select id="dms-ver-status" class="form-control">${createColumnOptions(versCols, state.statusField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Tipo do Arquivo Fonte (File / Markdown):</label>
                        <select id="dms-ver-source-type" class="form-control">${createColumnOptions(versCols, state.sourceTypeField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Arquivo Fonte (Anexo .docx/.xlsx):</label>
                        <select id="dms-ver-source-file" class="form-control">${createColumnOptions(versCols, state.sourceFileField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Conteúdo Markdown (Texto):</label>
                        <select id="dms-ver-source-md" class="form-control">${createColumnOptions(versCols, state.sourceMarkdownField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Arquivo Oficial PDF (Anexo):</label>
                        <select id="dms-ver-official" class="form-control">${createColumnOptions(versCols, state.officialFileField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Justificativa de Alteração:</label>
                        <select id="dms-ver-just" class="form-control">${createColumnOptions(versCols, state.justificationField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Atualizado em (Data/Hora):</label>
                        <select id="dms-ver-date" class="form-control">${createColumnOptions(versCols, state.updatedAtField)}</select>
                    </div>
                    <div class="form-group">
                        <label>Atualizado por (Usuário/Assinatura):</label>
                        <select id="dms-ver-user" class="form-control">${createColumnOptions(versCols, state.updatedByField)}</select>
                    </div>
                </div>

                <!-- ABA VISUAL & AÇÕES -->
                <div data-tab-section="styling-actions" style="display:none">
                    <h3>Visualização & Estilo</h3>
                    <div class="form-group">
                        <label>Largura da Barra Lateral (Treeview):</label>
                        <input type="text" id="dms-sidebar-width" class="form-control" value="${state.sidebarWidth}" placeholder="280px">
                    </div>
                    <div class="form-group">
                        <label>Tema Estético:</label>
                        <select id="dms-theme" class="form-control">
                            <option value="glassmorphism" ${state.theme === 'glassmorphism' ? 'selected' : ''}>Glassmorphism (Premium)</option>
                            <option value="flat" ${state.theme === 'flat' ? 'selected' : ''}>Flat Design</option>
                            <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dark Mode</option>
                        </select>
                    </div>

                    <h3>Gaveta de Edição de Registro</h3>
                    <div class="form-group">
                        <label>Configuração do Drawer para Editar Metadados:</label>
                        <select id="dms-drawer-config-id" class="form-control">
                            <option value="">-- Usar Drawer Padrão --</option>
                            ${state.receivedConfigs.filter(c => c.componentType === 'Drawer').map(c => 
                                `<option value="${c.configId}" ${c.configId === state.drawerConfigId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;

        setupTabNavigation(_mainContainer);

        // Atualizar schemas se mudar as tabelas
        _mainContainer.querySelector('#dms-docs-table').addEventListener('change', async (e) => {
            state.documentsTable = e.target.value;
            await rebuildEditor();
            triggerChangeEvent();
        });

        _mainContainer.querySelector('#dms-vers-table').addEventListener('change', async (e) => {
            state.versionsTable = e.target.value;
            await rebuildEditor();
            triggerChangeEvent();
        });

        // Ouvir alterações em todos os outros inputs para emitir evento
        _mainContainer.querySelectorAll('input, select').forEach(el => {
            if (el.id !== 'dms-docs-table' && el.id !== 'dms-vers-table') {
                el.addEventListener('change', triggerChangeEvent);
            }
        });
    }

    function setupTabNavigation(container) {
        container.querySelectorAll('.config-tab-button').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.config-tab-button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                container.querySelectorAll('[data-tab-section]').forEach(s => s.style.display = 'none');
                container.querySelector(`[data-tab-section="${btn.dataset.tabId}"]`).style.display = 'block';
            };
        });
    }

    function triggerChangeEvent() {
        if (!_mainContainer) return;
        const event = new CustomEvent('cm-editor-change', { bubbles: true });
        _mainContainer.dispatchEvent(event);
    }

    function read(container) {
        const mapping = {
            documentsTable: container.querySelector('#dms-docs-table').value,
            versionsTable: container.querySelector('#dms-vers-table').value,

            // Docs
            titleField: container.querySelector('#dms-doc-title').value,
            pathField: container.querySelector('#dms-doc-path').value,
            docTypeField: container.querySelector('#dms-doc-type').value,
            sectorField: container.querySelector('#dms-doc-sector').value,
            numberField: container.querySelector('#dms-doc-number').value,
            codeField: container.querySelector('#dms-doc-code').value,

            // Vers
            docRefField: container.querySelector('#dms-ver-docref').value,
            versionMajorField: container.querySelector('#dms-ver-major').value,
            versionMinorField: container.querySelector('#dms-ver-minor').value,
            versionStringField: container.querySelector('#dms-ver-string').value,
            statusField: container.querySelector('#dms-ver-status').value,
            sourceTypeField: container.querySelector('#dms-ver-source-type').value,
            sourceFileField: container.querySelector('#dms-ver-source-file').value,
            sourceMarkdownField: container.querySelector('#dms-ver-source-md').value,
            officialFileField: container.querySelector('#dms-ver-official').value,
            justificationField: container.querySelector('#dms-ver-just').value,
            updatedAtField: container.querySelector('#dms-ver-date').value,
            updatedByField: container.querySelector('#dms-ver-user').value
        };

        // Adicionar o tableId para consistência com o ConfigManager
        mapping.tableId = mapping.documentsTable;

        const styling = {
            sidebarWidth: container.querySelector('#dms-sidebar-width').value,
            theme: container.querySelector('#dms-theme').value
        };

        const actions = {
            drawerConfigId: container.querySelector('#dms-drawer-config-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();

window.DMSConfigEditor = DMSConfigEditor;
