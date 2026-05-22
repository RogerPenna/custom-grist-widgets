
export const TableConfigEditor = (() => {
    let currentSchema = null;
    let currentTableId = null;
    let _mainContainer = null;
    let _allConfigs = [];
    let _customButtons = [];
    let _activeButtonIdx = -1;
    let _iconPickerPopup = null;

    const AVAILABLE_ICONS = [
        "icon-link", "icon-link-broken", "icon-settings", "icon-edit", "icon-save", "icon-save-alt",
        "icon-adjustments", "icon-adjustments-vert", "icon-annotation", "icon-badge-check", "icon-barcode",
        "icon-bars", "icon-bell", "icon-bell-active", "icon-bookmark", "icon-calendar-edit", "icon-chart",
        "icon-chart-mixed", "icon-chart-pie", "icon-check", "icon-check-circle", "icon-check-circle-alt",
        "icon-minus-circle", "icon-minus-circle-alt", "icon-plus-circle", "icon-plus-circle-alt", "icon-clipboard",
        "icon-clipboard-check", "icon-clipboard-list", "icon-clock-arrow", "icon-close-circle", "icon-close-sidebar",
        "icon-column", "icon-download", "icon-exclamation", "icon-expand", "icon-eye", "icon-file",
        "icon-file-chart", "icon-file-check", "icon-file-clone", "icon-file-search", "icon-filter", "icon-flag",
        "icon-folder", "icon-forward", "icon-globe", "icon-grid", "icon-hourglass", "icon-info-circle",
        "icon-lightbulb", "icon-lifesaver", "icon-lock", "icon-unlock", "icon-microscope", "icon-pen",
        "icon-printer", "icon-profile-card", "icon-rectangle-list", "icon-tools", "icon-trashbin", "icon-truck",
        "icon-zoom-in", "icon-zoom-out", "icon-chart-up", "icon-arrow-move", "icon-bar-chart", "icon-bar-chart-line",
        "icon-bullseye", "icon-card-checklist", "icon-compass", "icon-cone", "icon-cone-striped", "icon-diagram-2",
        "icon-diagram-3", "icon-exclamation-triangle", "icon-exclamation-diamond", "icon-globe-americas", "icon-lightning",
        "icon-pen-alt", "icon-speedometer", "icon-traffic-light", "icon-wrench", "icon-search", "icon-process-cogs",
        "icon-process"
    ];

    function getFieldCategory(type) {
        if (!type) return 'text';
        const t = type.toLowerCase();
        if (t === 'bool' || t === 'boolean') return 'bool';
        if (t === 'numeric' || t === 'int' || t === 'integer' || t === 'float' || t === 'double') return 'number';
        return 'text';
    }

    function updateDebugJson() {
        if (!_mainContainer) return;
        const outputEl = _mainContainer.querySelector('#config-json-output');
        if (!outputEl) return;
        try {
            const config = read(_mainContainer);
            outputEl.innerHTML = `
                <div class="debug-tri-section">
                    <div class="debug-label mapping">mappingJson (O "Onde")</div>
                    <pre><code>${JSON.stringify(config.mapping, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label styling">stylingJson (O "Como")</div>
                    <pre><code>${JSON.stringify(config.styling, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label actions">actionsJson (O "O que faz")</div>
                    <pre><code>${JSON.stringify(config.actions, null, 2)}</code></pre>
                </div>
            `;
        } catch (e) {
            outputEl.textContent = "Erro ao ler a configuração: " + e.message;
        }
    }

    async function render(container, configData, lens, tableId, allConfigs) {
        _mainContainer = container;
        currentTableId = tableId;
        _allConfigs = allConfigs || [];
        window.currentLens = lens; // Expose for sub-column rendering

        if (!tableId) {
            container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>';
            return;
        }
        currentSchema = await lens.getTableSchema(tableId);
        if (!currentSchema) {
            container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>';
            return;
        }

        // Robust reading of config sections (tripartite support)
        const mapping = configData.mapping || configData;
        const styling = configData.styling || configData;
        const actions = configData.actions || configData;

        _customButtons = actions.customButtons || [];
        _activeButtonIdx = -1;

        // Store refListFieldConfig in container for createColumnCard to access
        container._refListFieldConfig = mapping.refListFieldConfig || {};

        const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        container._allCols = allCols;

        // Add virtual columns
        allCols.push({ colId: '_actions', label: '⚙️ Ações (Virtual)', type: 'Virtual' });

        const visibleColumns = mapping.columns || allCols.filter(c => c.colId !== '_actions').map(c => ({ colId: c.colId, width: null, align: 'left' }));
        const visibleColIds = new Set(visibleColumns.map(c => c.colId));

        // Filter and format Drawer configs for the dropdown
        const drawerConfigs = _allConfigs.filter(cfg => (cfg.componentType || '').replace(/\s+/g, '').toLowerCase() === 'drawer');
        const drawerOptionsHtml = drawerConfigs.map(d => {
            const unified = lens.parseConfigRecord(d);
            const tableDisplay = unified.tableId ? ` (${unified.tableId})` : '';
            return `<option value="${d.configId}" ${actions.drawerId === d.configId ? 'selected' : ''}>${d.widgetTitle}${tableDisplay} [${d.configId}]</option>`;
        }).join('');

        const layoutConfig = styling.tableLayoutConfig || {};

        container.innerHTML = `
            <style>
                .tab-container { display: flex; border-bottom: 1px solid #ccc; }
                .tab-button { background: #f1f1f1; border: 1px solid #ccc; border-bottom: none; padding: 10px 15px; cursor: pointer; margin-bottom: -1px; }
                .tab-button.active { background: #fff; border-bottom: 1px solid #fff; }
                .tab-panel { display: none; padding: 20px; border: 1px solid #ccc; border-top: none; }
                .tab-panel.active { display: block; }
                .debug-tri-section { margin-bottom: 15px; border-left: 4px solid #ddd; padding-left: 10px; }
                .debug-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
                .debug-label.mapping { color: #0d6efd; }
                .debug-label.styling { color: #198754; }
                .debug-label.actions { color: #fd7e14; }
                .config-debugger pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; max-height: 200px; overflow: auto; }
                .help-tip { cursor: help; color: #64748b; font-size: 12px; margin-left: 4px; border: 1px solid #cbd5e1; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; }
            </style>
            <div class="tab-container">
                <button type="button" class="tab-button active" data-tab="general">Geral</button>
                <button type="button" class="tab-button" data-tab="fields">Campos</button>
                <button type="button" class="tab-button" data-tab="appearance">Aparência</button>
                <button type="button" class="tab-button" data-tab="actions">Ações</button>
            </div>
            <div id="general-tab" class="tab-panel active">
                <div class="config-section-title">Opções Globais da Tabela</div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="striped-table-checkbox" ${styling.stripedTable ? 'checked' : ''}>
                        Tabela Zebrada
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="enable-column-calcs-checkbox" ${actions.enableColumnCalcs ? 'checked' : ''}>
                        Habilitar Cálculos de Coluna
                    </label>
                </div>
                
                <div class="config-section-title" style="margin-top: 20px;">Modo de Edição</div>
                <div class="form-group">
                    <label><input type="radio" name="editMode" value="excel" ${(actions.editMode || 'excel') === 'excel' ? 'checked' : ''}> Excel Style (Edição Inline)</label>
                    
                    <div id="excel-options" style="display: ${(actions.editMode || 'excel') === 'excel' ? 'block' : 'none'}; margin-left: 25px; border-left: 2px solid #ddd; padding-left: 10px; margin-top: 5px; margin-bottom: 10px;">
                        <label class="config-toggle" title="Se marcado, as mudanças só são enviadas ao Grist após clicar em um botão 'Salvar' no topo da tabela.">
                            <input type="checkbox" id="use-save-button-checkbox" ${actions.useSaveButton ? 'checked' : ''}>
                            Usar Botão 'Salvar' (Edição em Lote) <span class="help-tip">?</span>
                        </label>
                    </div>

                    <label><input type="radio" name="editMode" value="drawer" ${actions.editMode === 'drawer' ? 'checked' : ''}> Drawer Style (Edição por Formulário)</label>
                </div>

                <div class="form-group">
                    <label for="drawer-id-select">ID do Drawer (para Modo Drawer)</label>
                    <select id="drawer-id-select">
                        <option value="">-- Selecione um Drawer --</option>
                        ${drawerOptionsHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="enable-add-new-btn-checkbox" ${actions.enableAddNewBtn ? 'checked' : ''}>
                        Habilitar Botão 'Adicionar Novo'
                    </label>
                </div>

                <div class="config-section-title" style="margin-top: 20px;">Layout & Interatividade</div>
                <div class="form-group">
                    <label for="layout-mode-select">Modo de Layout</label>
                    <select id="layout-mode-select">
                        <option value="fitColumns" ${styling.layout === 'fitColumns' ? 'selected' : ''}>Fit Columns</option>
                        <option value="fitData" ${styling.layout === 'fitData' ? 'selected' : ''}>Fit Data</option>
                        <option value="fitDataFill" ${styling.layout === 'fitDataFill' ? 'selected' : ''}>Fit Data Fill</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="responsive-layout-checkbox" ${styling.responsiveLayout ? 'checked' : ''}>
                        Layout Responsivo (Tabulator)
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="resizable-columns-checkbox" ${styling.resizableColumns !== false ? 'checked' : ''}>
                        Colunas Redimensionáveis
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" id="header-filter-checkbox" ${styling.headerFilter !== false ? 'checked' : ''}>
                        Filtros no Cabeçalho
                    </label>
                </div>

                <div class="config-section-title" style="margin-top: 20px;">Ordenação Inicial</div>
                <div class="form-group" style="display:flex; gap:10px;">
                    <select id="default-sort-column" style="flex:2;">
                        <option value="">-- Nenhuma --</option>
                        ${allCols.filter(c => c.colId !== '_actions').map(c => `<option value="${c.colId}" ${styling.defaultSort?.column === c.colId ? 'selected' : ''}>${c.label}</option>`).join('')}
                    </select>
                    <select id="default-sort-dir" style="flex:1;">
                        <option value="asc" ${styling.defaultSort?.direction === 'asc' ? 'selected' : ''}>ASC</option>
                        <option value="desc" ${styling.defaultSort?.direction === 'desc' ? 'selected' : ''}>DESC</option>
                    </select>
                </div>

                <div class="config-section-title" style="margin-top: 20px;">Paginação</div>
                <div class="form-group">
                    <label for="pagination-mode-select">Modo de Paginação</label>
                    <select id="pagination-mode-select">
                        <option value="false" ${!styling.pagination?.enabled ? 'selected' : ''}>Desativada</option>
                        <option value="local" ${styling.pagination?.enabled === 'local' ? 'selected' : ''}>Local</option>
                        <option value="remote" ${styling.pagination?.enabled === 'remote' ? 'selected' : ''}>Remota</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="pagination-size-input">Itens por Página</label>
                    <input type="number" id="pagination-size-input" value="${styling.pagination?.pageSize || 10}" min="1">
                </div>
            </div>
            <div id="fields-tab" class="tab-panel">
                <div class="column-bulk-actions">
                    <button type="button" id="select-all-cols-btn" class="btn btn-secondary btn-sm">Selecionar Todas</button>
                    <button type="button" id="deselect-all-cols-btn" class="btn btn-secondary btn-sm">Deselecionar Todas</button>
                </div>
                <ul id="column-list" class="field-order-list"></ul>
                <div class="config-section-title" style="margin-top: 20px;">Colunas Disponíveis</div>
                <ul id="available-column-list" class="field-order-list"></ul>
            </div>
            <div id="appearance-tab" class="tab-panel">
                <div class="config-section-title">Estilo e Aparência Global</div>
                <div class="col-config-grid" style="margin-top:10px;">
                    <div class="col-config-section">
                        <div class="config-label-with-help">Tema Visual</div>
                        <select id="theme-style-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                            <option value="default" ${layoutConfig.themeStyle === 'default' ? 'selected' : ''}>Padrão (Clean)</option>
                            <option value="glassmorphism" ${(layoutConfig.themeStyle || 'glassmorphism') === 'glassmorphism' ? 'selected' : ''}>Glassmorphism (Translúcido)</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Linhas de Grade</div>
                        <select id="grid-lines-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                            <option value="none" ${layoutConfig.gridLines === 'none' ? 'selected' : ''}>Sem Linhas</option>
                            <option value="horizontal" ${(layoutConfig.gridLines || 'horizontal') === 'horizontal' ? 'selected' : ''}>Apenas Horizontal</option>
                            <option value="full" ${layoutConfig.gridLines === 'full' ? 'selected' : ''}>Grade Completa</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Densidade das Linhas</div>
                        <select id="density-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                            <option value="compact" ${layoutConfig.density === 'compact' ? 'selected' : ''}>Compacto (Pequeno)</option>
                            <option value="comfortable" ${(layoutConfig.density || 'comfortable') === 'comfortable' ? 'selected' : ''}>Confortável (Médio)</option>
                            <option value="spacious" ${layoutConfig.density === 'spacious' ? 'selected' : ''}>Espaçoso (Grande)</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Estilo do Cabeçalho</div>
                        <select id="header-style-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                            <option value="minimal" ${(layoutConfig.headerStyle || 'minimal') === 'minimal' ? 'selected' : ''}>Minimalista (Translúcido)</option>
                            <option value="solid" ${layoutConfig.headerStyle === 'solid' ? 'selected' : ''}>Sólido</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Efeito Hover</div>
                        <select id="hover-effect-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1;">
                            <option value="none" ${layoutConfig.hoverEffect === 'none' ? 'selected' : ''}>Sem Destaque</option>
                            <option value="row-highlight" ${(layoutConfig.hoverEffect || 'row-highlight') === 'row-highlight' ? 'selected' : ''}>Destacar Linha</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Linhas Alternadas</div>
                        <label class="config-toggle" style="margin-top:8px;">
                            <input type="checkbox" id="striped-rows-checkbox" ${layoutConfig.stripedRows !== false ? 'checked' : ''}>
                            Zebrar Linhas (Zebra Stripes)
                        </label>
                    </div>
                </div>
            </div>
            <div id="actions-tab" class="tab-panel">
                <div class="config-section-title">Ações Customizadas (Botões na Coluna _actions)</div>
                <p style="font-size: 11px; color: #64748b; margin-bottom: 12px;">Crie botões de ação que serão exibidos na coluna virtual '_actions'.</p>
                <div class="actions-layout" style="display:flex; height:350px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                    <div class="buttons-list" style="width:200px; border-right:1px solid #cbd5e1; background:#f8fafc; display:flex; flex-direction:column;">
                        <div style="padding:10px; font-weight:700; border-bottom:1px solid #e2e8f0; font-size:11px; background:#f1f5f9; color:#475569;">BOTÕES</div>
                        <div id="btn-list-content" style="flex:1; overflow-y:auto;"></div>
                        <div style="padding:8px; border-top:1px solid #e2e8f0; background:#f1f5f9;">
                            <button type="button" id="add-btn-btn" style="width:100%; padding:6px; background:#22c55e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">+ Adicionar Botão</button>
                        </div>
                    </div>
                    <div id="btn-detail-content" style="flex:1; padding:15px; overflow-y:auto; background:#fff;">
                        <div style="color:#64748b; font-style:italic; text-align:center; margin-top:50px;">Selecione um botão para editar</div>
                    </div>
                </div>
            </div>
            <details class="config-debugger" style="margin-top: 20px;">
                <summary>Ver Tripartição JSON (Debug)</summary>
                <div id="config-json-output"></div>
            </details>
        `;

        // Tab Logic
        const tabButtons = container.querySelectorAll('.tab-button');
        const tabPanels = container.querySelectorAll('.tab-panel');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabPanels.forEach(panel => panel.classList.remove('active'));
                container.querySelector(`#${button.dataset.tab}-tab`).classList.add('active');
            });
        });

        // Adiciona listener para mostrar/ocultar opções do Excel dinamicamente
        container.querySelectorAll('input[name="editMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                container.querySelector('#excel-options').style.display = (e.target.value === 'excel') ? 'block' : 'none';
                updateDebugJson();
            });
        });

        const columnListEl = container.querySelector('#column-list');
        const availableColumnListEl = container.querySelector('#available-column-list');

        for (const colConfig of visibleColumns) {
            const col = allCols.find(c => c.colId === colConfig.colId);
            if (col) columnListEl.appendChild(createColumnCard(col, colConfig));
        }

        for (const col of allCols) {
            if (!visibleColIds.has(col.colId)) availableColumnListEl.appendChild(createColumnCard(col, null));
        }

        container.querySelector('#select-all-cols-btn').onclick = () => {
            Array.from(availableColumnListEl.querySelectorAll('.field-card')).forEach(card => {
                columnListEl.appendChild(card);
                card.querySelector('.is-visible-checkbox').checked = true;
            });
            updateDebugJson();
        };

        container.querySelector('#deselect-all-cols-btn').onclick = () => {
            Array.from(columnListEl.querySelectorAll('.field-card')).forEach(card => {
                availableColumnListEl.appendChild(card);
                card.querySelector('.is-visible-checkbox').checked = false;
            });
            updateDebugJson();
        };

        enableDragAndDrop([columnListEl, availableColumnListEl]);

        // Wire Add Button event for actions tab
        container.querySelector('#add-btn-btn').onclick = (e) => {
            e.preventDefault();
            _customButtons.push({
                id: `btn-${Date.now()}`,
                text: 'Nova Ação',
                icon: 'icon-link',
                color: '#2563eb',
                actionType: 'navigateToGristPage',
                buttonStyle: 'both'
            });
            _activeButtonIdx = _customButtons.length - 1;
            renderActionsLayout();
            updateDebugJson();
        };

        // Render actions tab layout
        renderActionsLayout();

        container.addEventListener('change', updateDebugJson);
        container.addEventListener('input', updateDebugJson);
        updateDebugJson();
    }

    function read(container) {
        if (!currentSchema) return {};

        const columnListEl = container.querySelector('#column-list');
        const visibleItems = Array.from(columnListEl.querySelectorAll('.field-card'));
        const refListFieldConfig = {};

        const fullConfig = {
            tableId: currentTableId,
            stripedTable: container.querySelector('#striped-table-checkbox')?.checked ?? false,
            enableColumnCalcs: container.querySelector('#enable-column-calcs-checkbox')?.checked ?? false,
            editMode: container.querySelector('input[name="editMode"]:checked')?.value || 'excel',
            useSaveButton: container.querySelector('#use-save-button-checkbox')?.checked || false,
            drawerId: container.querySelector('#drawer-id-select')?.value || null,
            enableAddNewBtn: container.querySelector('#enable-add-new-btn-checkbox')?.checked ?? false,
            layout: container.querySelector('#layout-mode-select')?.value || 'fitColumns',
            responsiveLayout: container.querySelector('#responsive-layout-checkbox')?.checked ?? false,
            resizableColumns: container.querySelector('#resizable-columns-checkbox')?.checked ?? true,
            headerFilter: container.querySelector('#header-filter-checkbox')?.checked ?? true,
            defaultSort: {
                column: container.querySelector('#default-sort-column')?.value || null,
                direction: container.querySelector('#default-sort-dir')?.value || 'asc'
            },
            pagination: {
                enabled: container.querySelector('#pagination-mode-select')?.value === 'false' ? false : (container.querySelector('#pagination-mode-select')?.value || 'local'),
                pageSize: parseInt(container.querySelector('#pagination-size-input')?.value, 10) || 10,
            },
            columns: visibleItems.map(item => {
                const colId = item.dataset.colId;
                const formatter = item.querySelector('.col-formatter-select')?.value || null;
                const isActions = colId === '_actions';
                
                const colBase = {
                    colId: colId,
                    width: item.querySelector('.col-width-input')?.value || null,
                    align: item.querySelector('.col-align-select')?.value || 'left',
                    wrapText: item.querySelector('.wrap-text-checkbox')?.checked ?? false,
                    maxTextRows: parseInt(item.querySelector('.max-text-rows-input')?.value, 10) || null,
                    bottomCalc: item.querySelector('.col-calc-select')?.value || null,
                    locked: item.querySelector('.is-locked-checkbox')?.checked ?? false,
                    required: item.querySelector('.is-required-checkbox')?.checked ?? false,
                    formatter: formatter,
                    formatterParams: {},
                    ignoreConditionalFormatting: item.querySelector('.ignore-conditional-formatting-checkbox')?.checked ?? false,
                    ignoreHeaderStyle: item.querySelector('.ignore-header-style-checkbox')?.checked ?? false,
                    ignoreCellStyle: item.querySelector('.ignore-cell-style-checkbox')?.checked ?? false,
                };

                if (formatter === 'progress' || formatter === 'progressRing') {
                    colBase.formatterParams = {
                        progressBarPreset: item.querySelector('.progress-preset')?.value || '',
                        progressType: formatter === 'progressRing' ? 'circular' : (item.querySelector('.progress-type')?.value || 'linear'),
                        labelPosition: item.querySelector('.progress-label-pos')?.value || 'middle',
                        min: parseFloat(item.querySelector('.progress-min')?.value) || 0,
                        max: parseFloat(item.querySelector('.progress-max')?.value) || 100,
                        legend: item.querySelector('.progress-legend')?.checked || false,
                        mainColor: item.querySelector('.progress-color')?.value || '#4caf50',
                        bgColor: item.querySelector('.progress-bgcolor')?.value || '#e0e0e0',
                        borderRadius: parseInt(item.querySelector('.progress-radius')?.value, 10) || 4,
                        striped: item.querySelector('.progress-striped')?.checked || false,
                        animated: item.querySelector('.progress-animated')?.checked || false,
                        colorMode: item.querySelector('.progress-mode')?.value || 'solid',
                        showInternalBar: item.querySelector('.progress-show-internal')?.checked || false,
                        internalBarColId: item.querySelector('.progress-internal-col')?.value || ''
                    };
                } else if (formatter === 'money') {
                    colBase.formatterParams = {
                        symbol: item.querySelector('.money-symbol')?.value || 'R$',
                        decimal: item.querySelector('.money-decimal')?.value || ',',
                        thousand: item.querySelector('.money-thousand')?.value || '.'
                    };
                } else if (formatter === 'image') {
                    colBase.formatterParams = {
                        imageSize: parseInt(item.querySelector('.image-size')?.value, 10) || 50,
                        objectFit: item.querySelector('.image-fit')?.value || 'cover',
                        borderRadius: item.querySelector('.image-radius')?.value || '4px'
                    };
                } else if (formatter === 'sparkline') {
                    colBase.formatterParams = {
                        mainColor: item.querySelector('.sparkline-color')?.value || '#10b981'
                    };
                }

                if (isActions) {
                    colBase.showView = item.querySelector('.action-btn-view-checkbox')?.checked;
                    colBase.showEdit = item.querySelector('.action-btn-edit-checkbox')?.checked;
                    colBase.showDelete = item.querySelector('.action-btn-delete-checkbox')?.checked;
                }

                // Gather RefList Config
                const reflistPanel = item.querySelector('.reflist-config-panel');
                if (reflistPanel) {
                    const refConfig = {
                        _refListConfig: {
                            displayAs: reflistPanel.querySelector('.reflist-display-as')?.value || 'none',
                            collapsible: reflistPanel.querySelector('.reflist-collapsible-checkbox')?.checked ?? false,
                            zebra: reflistPanel.querySelector('.reflist-zebra-checkbox')?.checked ?? false,
                            cardConfigId: reflistPanel.querySelector('.reflist-card-config-id')?.value.trim() || null,
                            showAddButton: reflistPanel.querySelector('.reflist-show-add-checkbox')?.checked ?? true,
                            addRecordConfigId: reflistPanel.querySelector('.reflist-add-config-id')?.value.trim() || null,
                            columns: []
                        }
                    };
                    reflistPanel.querySelectorAll('.reflist-config-table tbody tr').forEach(row => {
                        if (row.querySelector('.ref-col-show-checkbox')?.checked) {
                            refConfig._refListConfig.columns.push(row.dataset.refColId);
                        }
                    });
                    refListFieldConfig[colId] = refConfig;
                }

                return colBase;
            }),
        };

        const tableLayoutConfig = {
            themeStyle: container.querySelector('#theme-style-select')?.value || 'glassmorphism',
            gridLines: container.querySelector('#grid-lines-select')?.value || 'horizontal',
            density: container.querySelector('#density-select')?.value || 'comfortable',
            headerStyle: container.querySelector('#header-style-select')?.value || 'minimal',
            hoverEffect: container.querySelector('#hover-effect-select')?.value || 'row-highlight',
            stripedRows: container.querySelector('#striped-rows-checkbox')?.checked ?? true
        };

        return {
            mapping: { tableId: fullConfig.tableId, columns: fullConfig.columns, refListFieldConfig },
            styling: {
                stripedTable: fullConfig.stripedTable,
                layout: fullConfig.layout,
                resizableColumns: fullConfig.resizableColumns,
                headerFilter: fullConfig.headerFilter,
                pagination: fullConfig.pagination,
                tableLayoutConfig: tableLayoutConfig
            },
            actions: {
                enableColumnCalcs: fullConfig.enableColumnCalcs,
                editMode: fullConfig.editMode,
                useSaveButton: fullConfig.useSaveButton,
                drawerId: fullConfig.drawerId,
                enableAddNewBtn: fullConfig.enableAddNewBtn,
                customButtons: _customButtons
            }
        };
    }

    function createColumnCard(col, colConfig) {
        const card = document.createElement('li');
        card.className = 'field-card';
        card.dataset.colId = col.colId;
        card.draggable = true;

        const isVisible = !!colConfig;
        const align = colConfig?.align || 'left';
        const isActions = col.colId === '_actions';
        const isRefList = col.type && col.type.startsWith('RefList:');

        const category = getFieldCategory(col.type);
        let formatterOptionsHtml = `<option value="">Padrão</option>`;
        if (category === 'bool') {
            formatterOptionsHtml += `
                <option value="switch" ${colConfig?.formatter === 'switch' ? 'selected' : ''}>Interruptor (Switch)</option>
                <option value="yesno" ${colConfig?.formatter === 'yesno' ? 'selected' : ''}>Texto Sim/Não</option>
                <option value="dot" ${colConfig?.formatter === 'dot' ? 'selected' : ''}>Ponto de Status (🟢/🔴)</option>
            `;
        } else if (category === 'number') {
            formatterOptionsHtml += `
                <option value="money" ${colConfig?.formatter === 'money' ? 'selected' : ''}>Moeda</option>
                <option value="progress" ${colConfig?.formatter === 'progress' ? 'selected' : ''}>Progresso Linear</option>
                <option value="progressRing" ${colConfig?.formatter === 'progressRing' ? 'selected' : ''}>Progresso Circular (Ring)</option>
                <option value="sparkline" ${colConfig?.formatter === 'sparkline' ? 'selected' : ''}>Sparkline</option>
                <option value="hidden" ${colConfig?.formatter === 'hidden' ? 'selected' : ''}>Oculto</option>
            `;
        } else {
            formatterOptionsHtml += `
                <option value="badge" ${colConfig?.formatter === 'badge' ? 'selected' : ''}>Badge/Chip</option>
                <option value="avatar" ${colConfig?.formatter === 'avatar' ? 'selected' : ''}>Avatar Circle</option>
                <option value="dynamicui" ${colConfig?.formatter === 'dynamicui' ? 'selected' : ''}>Dynamic UI (JSON)</option>
                <option value="image" ${colConfig?.formatter === 'image' ? 'selected' : ''}>Imagem (URL/Anexo)</option>
            `;
        }

        let optionsHtml = '';
        if (isActions) {
            optionsHtml = `
                <div class="col-config-grid">
                    <div class="col-config-section full-width">
                        <div class="config-label-with-help">Configurações da Coluna de Ações</div>
                        <div style="display: flex; gap: 20px; margin-top: 5px;">
                            <label><input type="checkbox" class="action-btn-view-checkbox" ${colConfig?.showView !== false ? 'checked' : ''}> Visualizar</label>
                            <label><input type="checkbox" class="action-btn-edit-checkbox" ${colConfig?.showEdit !== false ? 'checked' : ''}> Editar</label>
                            <label><input type="checkbox" class="action-btn-delete-checkbox" ${colConfig?.showDelete ? 'checked' : ''}> Excluir</label>
                        </div>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Visual</div>
                        <div>
                            <div class="config-label-with-help" title="Largura em pixels (ex: 100).">Largura <span class="help-tip">?</span></div>
                            <input type="text" class="col-width-input" value="${colConfig?.width || '100'}" placeholder="100" style="width:100%; padding:4px;">
                        </div>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help" title="Alinhamento horizontal.">Alinhamento <span class="help-tip">?</span></div>
                        <select class="col-align-select" style="width:100%; padding:4px;">
                            <option value="center" ${align === 'center' ? 'selected' : ''}>Centro</option>
                            <option value="left" ${align === 'left' ? 'selected' : ''}>Esquerda</option>
                            <option value="right" ${align === 'right' ? 'selected' : ''}>Direita</option>
                        </select>
                    </div>
                    <div style="display:none;">
                        <input type="checkbox" class="is-locked-checkbox">
                        <input type="checkbox" class="is-required-checkbox">
                        <input type="checkbox" class="ignore-conditional-formatting-checkbox">
                        <input type="checkbox" class="wrap-text-checkbox">
                        <input type="number" class="max-text-rows-input">
                        <select class="col-calc-select"><option value=""></option></select>
                        <select class="col-formatter-select"><option value=""></option></select>
                    </div>
                </div>
            `;
        } else {
            let refListConfigHtml = '';
            if (isRefList) {
                const refConfig = (_mainContainer._refListFieldConfig?.[col.colId]?._refListConfig) || {};
                
                const cardConfigs = _allConfigs.filter(c => (c.componentType || '').replace(/\s+/g, '').toLowerCase() === 'cardsystem');
                const drawerConfigs = _allConfigs.filter(c => (c.componentType || '').replace(/\s+/g, '').toLowerCase() === 'drawer');

                const cardOptionsHtml = cardConfigs.map(c => `<option value="${c.configId}" ${refConfig.cardConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} [${c.configId}]</option>`).join('');
                const drawerOptionsHtml = drawerConfigs.map(c => `<option value="${c.configId}" ${refConfig.addRecordConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} [${c.configId}]</option>`).join('');

                refListConfigHtml = `
                    <div class="reflist-config-panel" style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px;">
                        <div class="config-label-with-help">Configuração de Sub-Tabela (RefList)</div>
                        <div class="col-config-grid" style="margin-top:8px;">
                            <div>
                                <label style="font-size:11px;">Exibir como:</label>
                                <select class="reflist-display-as" style="width:100%; padding:4px;">
                                    <option value="none" ${refConfig.displayAs === 'none' ? 'selected' : ''}>Texto (Padrão)</option>
                                    <option value="table" ${refConfig.displayAs === 'table' ? 'selected' : ''}>Tabela Simples</option>
                                    <option value="tabulator" ${refConfig.displayAs === 'tabulator' ? 'selected' : ''}>Tabulator</option>
                                    <option value="cards" ${refConfig.displayAs === 'cards' ? 'selected' : ''}>Cards</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:11px;">Comportamento:</label>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <label><input type="checkbox" class="reflist-collapsible-checkbox" ${refConfig.collapsible ? 'checked' : ''}> Retrátil</label>
                                    <label><input type="checkbox" class="reflist-zebra-checkbox" ${refConfig.zebra ? 'checked' : ''}> Zebrada</label>
                                </div>
                            </div>
                        </div>
                        <div class="reflist-card-options" style="display: ${refConfig.displayAs === 'cards' ? 'block' : 'none'}; margin-top: 8px;">
                            <label style="font-size:11px;">Config de Card:</label>
                            <select class="reflist-card-config-id" style="width:100%; padding:4px;">
                                <option value="">-- Selecione um Card --</option>
                                ${cardOptionsHtml}
                            </select>
                        </div>
                        <div style="margin-top:8px;">
                            <label style="font-size:11px;"><input type="checkbox" class="reflist-show-add-checkbox" ${refConfig.showAddButton !== false ? 'checked' : ''}> Mostrar Botão "Adicionar"</label>
                            <select class="reflist-add-config-id" style="width:100%; padding:4px; font-size:11px; margin-top:4px;">
                                <option value="">-- Drawer para Adição --</option>
                                ${drawerOptionsHtml}
                            </select>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm toggle-reflist-columns" style="margin-top:8px; width:100%;">Configurar Colunas da Sub-Tabela</button>
                        <div class="reflist-column-config" style="display:none; margin-top:8px; max-height:200px; overflow:auto; background:#fff; border:1px solid #ddd; padding:8px; border-radius:4px;">
                            <p style="font-size:11px; color:#666;">Carregando colunas...</p>
                        </div>
                    </div>
                `;
            }

            optionsHtml = `
                <div class="col-config-grid">
                    <div class="col-config-section">
                        <div class="config-label-with-help">Regras</div>
                        <label title="Impede a edição deste campo na tabela."><input type="checkbox" class="is-locked-checkbox" ${colConfig?.locked ? 'checked' : ''}> Travado <span class="help-tip">?</span></label>
                        <label title="Exige que o campo seja preenchido no modo de edição inline."><input type="checkbox" class="is-required-checkbox" ${colConfig?.required ? 'checked' : ''}> Obrigatório <span class="help-tip">?</span></label>
                        <label title="Ignora as regras de cores de formatação condicional que vêm do Grist."><input type="checkbox" class="ignore-conditional-formatting-checkbox" ${colConfig?.ignoreConditionalFormatting ? 'checked' : ''}> S/ Format. Condic. <span class="help-tip">?</span></label>
                        <label title="Ignora o estilo de cabeçalho do Grist."><input type="checkbox" class="ignore-header-style-checkbox" ${colConfig?.ignoreHeaderStyle ? 'checked' : ''}> S/ Estilo Cabecalho <span class="help-tip">?</span></label>
                        <label title="Ignora o estilo de célula do Grist."><input type="checkbox" class="ignore-cell-style-checkbox" ${colConfig?.ignoreCellStyle ? 'checked' : ''}> S/ Estilo Celula <span class="help-tip">?</span></label>
                    </div>

                    <div class="col-config-section">
                        <div class="config-label-with-help">Visual</div>
                        <label title="Permite que o texto ocupe múltiplas linhas."><input type="checkbox" class="wrap-text-checkbox" ${colConfig?.wrapText !== false ? 'checked' : ''}> Quebrar Linha <span class="help-tip">?</span></label>
                        <div>
                            <div class="config-label-with-help" title="Largura em pixels (ex: 150) ou 'auto'.">Largura <span class="help-tip">?</span></div>
                            <input type="text" class="col-width-input" value="${colConfig?.width || ''}" placeholder="auto" style="width:100%; padding:4px;">
                        </div>
                    </div>

                    <div class="col-config-section">
                        <div class="config-label-with-help" title="Alinhamento horizontal do conteúdo.">Alinhamento <span class="help-tip">?</span></div>
                        <select class="col-align-select" style="width:100%; padding:4px;">
                            <option value="left" ${align === 'left' ? 'selected' : ''}>Esquerda</option>
                            <option value="center" ${align === 'center' ? 'selected' : ''}>Centro</option>
                            <option value="right" ${align === 'right' ? 'selected' : ''}>Direita</option>
                        </select>
                    </div>

                    <div class="col-config-section">
                        <div class="config-label-with-help" title="Número máximo de linhas visíveis (se Quebrar Linha estiver ativo).">Máx. Linhas <span class="help-tip">?</span></div>
                        <input type="number" class="max-text-rows-input" value="${colConfig?.maxTextRows || ''}" min="1" style="width:100%; padding:4px;">
                    </div>

                    <div class="col-config-section full-width">
                        <div class="col-config-grid">
                            <div>
                                <div class="config-label-with-help" title="Adiciona um cálculo automático no rodapé da tabela.">Cálculo Rodapé <span class="help-tip">?</span></div>
                                <select class="col-calc-select" style="width:100%; padding:4px;">
                                    <option value="">Nenhum</option>
                                    <option value="sum" ${colConfig?.bottomCalc === 'sum' ? 'selected' : ''}>Soma</option>
                                    <option value="avg" ${colConfig?.bottomCalc === 'avg' ? 'selected' : ''}>Média</option>
                                    <option value="count" ${colConfig?.bottomCalc === 'count' ? 'selected' : ''}>Contagem</option>
                                </select>
                            </div>
                            <div>
                                <div class="config-label-with-help" title="Aplica uma visualização especial aos dados (ex: Barra de Progresso).">Formato Especial <span class="help-tip">?</span></div>
                                <select class="col-formatter-select" style="width:100%; padding:4px;">
                                    ${formatterOptionsHtml}
                                </select>
                            </div>
                        </div>
                        
                        <!-- Formatter Params (Progress) -->
                        <div class="formatter-params progress-params" style="display: ${(colConfig?.formatter === 'progress' || colConfig?.formatter === 'progressRing') ? 'block' : 'none'}; margin-top: 5px; border: 1px dashed #cbd5e1; padding: 5px; border-radius: 4px;">
                            <div class="form-group" style="margin-bottom: 5px;">
                                <label style="font-size:10px;">Preset Global:</label>
                                <select class="progress-preset" style="width:100%; font-size:10px;">
                                    <option value="">-- Manual --</option>
                                    ${_allConfigs.filter(c => c.componentType === 'Progress Bar').map(c => `<option value="${c.configId}" ${colConfig?.formatterParams?.progressBarPreset === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div class="progress-manual-options" style="display: ${colConfig?.formatterParams?.progressBarPreset ? 'none' : 'grid'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px;">
                                <div style="grid-column: span 1.5;">
                                    <label style="font-size:9px;">Tipo</label>
                                    <select class="progress-type" style="width:100%; font-size:10px;">
                                        <option value="linear" ${colConfig?.formatterParams?.progressType === 'linear' ? 'selected' : ''}>Linear</option>
                                        <option value="circular" ${colConfig?.formatterParams?.progressType === 'circular' ? 'selected' : ''}>Circular</option>
                                    </select>
                                </div>
                                <div class="progress-label-pos-container" style="display: ${colConfig?.formatterParams?.progressType === 'circular' ? 'block' : 'none'}; grid-column: span 1.5;">
                                    <label style="font-size:9px;">Pos. Valor</label>
                                    <select class="progress-label-pos" style="width:100%; font-size:10px;">
                                        <option value="middle" ${colConfig?.formatterParams?.labelPosition === 'middle' ? 'selected' : ''}>Centro</option>
                                        <option value="above" ${colConfig?.formatterParams?.labelPosition === 'above' ? 'selected' : ''}>Acima</option>
                                        <option value="left" ${colConfig?.formatterParams?.labelPosition === 'left' ? 'selected' : ''}>Esquerda</option>
                                        <option value="right" ${colConfig?.formatterParams?.labelPosition === 'right' ? 'selected' : ''}>Direita</option>
                                    </select>
                                </div>
                                <div class="progress-internal-container" style="display: ${colConfig?.formatterParams?.progressType === 'circular' ? 'block' : 'none'}; grid-column: span 3; padding: 4px; background: #f1f5f9; border-radius: 4px; margin-top: 5px;">
                                    <label style="font-size:9px; cursor: pointer;">
                                        <input type="checkbox" class="progress-show-internal" ${colConfig?.formatterParams?.showInternalBar ? 'checked' : ''}> Barra Interna
                                    </label>
                                    <select class="progress-internal-col" style="width: 100%; font-size: 10px; display: ${colConfig?.formatterParams?.showInternalBar ? 'block' : 'none'}; margin-top: 2px;">
                                        <option value="">-- Coluna Interna --</option>
                                        ${currentSchema ? Object.values(currentSchema).filter(c => ['Numeric', 'Int', 'Any'].includes(c.type)).map(c => `<option value="${c.colId}" ${colConfig?.formatterParams?.internalBarColId === c.colId ? 'selected' : ''}>${c.label}</option>`).join('') : ''}
                                    </select>
                                </div>

                                <div>
                                    <label style="font-size:9px;">Min</label>
                                    <input type="number" class="progress-min" value="${colConfig?.formatterParams?.min ?? 0}" style="width:100%; font-size:10px;">
                                </div>                                <div>
                                    <label style="font-size:9px;">Max</label>
                                    <input type="number" class="progress-max" value="${colConfig?.formatterParams?.max ?? 100}" style="width:100%; font-size:10px;">
                                </div>
                                <div>
                                    <label style="font-size:9px;">Cor Barra</label>
                                    <input type="color" class="progress-color" value="${colConfig?.formatterParams?.mainColor ?? '#4caf50'}" style="width:100%; height:20px; padding:0;">
                                </div>
                                <div>
                                    <label style="font-size:9px;">Cor Fundo</label>
                                    <input type="color" class="progress-bgcolor" value="${colConfig?.formatterParams?.bgColor ?? '#e0e0e0'}" style="width:100%; height:20px; padding:0;">
                                </div>
                                <div>
                                    <label style="font-size:9px;">Raio (px)</label>
                                    <input type="number" class="progress-radius" value="${colConfig?.formatterParams?.borderRadius ?? 4}" style="width:100%; font-size:10px;">
                                </div>
                                <div>
                                    <label style="font-size:9px;">Modo Cor</label>
                                    <select class="progress-mode" style="width:100%; font-size:10px;">
                                        <option value="solid" ${colConfig?.formatterParams?.colorMode === 'solid' ? 'selected' : ''}>Sólido</option>
                                        <option value="dynamic-gradient" ${colConfig?.formatterParams?.colorMode === 'dynamic-gradient' || colConfig?.formatterParams?.colorMode === 'gradient' ? 'selected' : ''}>Gradiente Dinâmico</option>
                                        <option value="static-gradient" ${colConfig?.formatterParams?.colorMode === 'static-gradient' ? 'selected' : ''}>Gradiente Estático</option>
                                        <option value="steps" ${colConfig?.formatterParams?.colorMode === 'steps' ? 'selected' : ''}>Degraus</option>
                                    </select>
                                </div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; align-items:flex-end; grid-column: span 3;">
                                    <label style="font-size:9px; display:flex; align-items:center; gap:2px;"><input type="checkbox" class="progress-striped" ${colConfig?.formatterParams?.striped ? 'checked' : ''}> Zebrado</label>
                                    <label style="font-size:9px; display:flex; align-items:center; gap:2px;"><input type="checkbox" class="progress-animated" ${colConfig?.formatterParams?.animated ? 'checked' : ''}> Animado</label>
                                </div>
                            </div>
                        </div>

                        <!-- Formatter Params (Money) -->
                        <div class="formatter-params money-params" style="display: ${colConfig?.formatter === 'money' ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-top: 5px; border: 1px dashed #cbd5e1; padding: 5px; border-radius: 4px;">
                            <div>
                                <label style="font-size:9px;">Símbolo</label>
                                <input type="text" class="money-symbol" value="${colConfig?.formatterParams?.symbol ?? 'R$'}" style="width:100%; font-size:10px;">
                            </div>
                            <div>
                                <label style="font-size:9px;">Decimal</label>
                                <input type="text" class="money-decimal" value="${colConfig?.formatterParams?.decimal ?? ','}" style="width:100%; font-size:10px;">
                            </div>
                            <div>
                                <label style="font-size:9px;">Milhar</label>
                                <input type="text" class="money-thousand" value="${colConfig?.formatterParams?.thousand ?? '.'}" style="width:100%; font-size:10px;">
                            </div>
                        </div>

                        <!-- Formatter Params (Image) -->
                        <div class="formatter-params image-params" style="display: ${colConfig?.formatter === 'image' ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-top: 5px; border: 1px dashed #cbd5e1; padding: 5px; border-radius: 4px;">
                            <div>
                                <label style="font-size:9px;">Tamanho (px)</label>
                                <input type="number" class="image-size" value="${colConfig?.formatterParams?.imageSize ?? 50}" style="width:100%; font-size:10px;">
                            </div>
                            <div>
                                <label style="font-size:9px;">Fit</label>
                                <select class="image-fit" style="width:100%; font-size:10px;">
                                    <option value="cover" ${colConfig?.formatterParams?.objectFit === 'cover' ? 'selected' : ''}>Cover</option>
                                    <option value="contain" ${colConfig?.formatterParams?.objectFit === 'contain' ? 'selected' : ''}>Contain</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:9px;">Raio</label>
                                <input type="text" class="image-radius" value="${colConfig?.formatterParams?.borderRadius ?? '4px'}" style="width:100%; font-size:10px;">
                            </div>
                        </div>

                        <!-- Formatter Params (Sparkline) -->
                        <div class="formatter-params sparkline-params" style="display: ${colConfig?.formatter === 'sparkline' ? 'grid' : 'none'}; grid-template-columns: 1fr; gap: 5px; margin-top: 5px; border: 1px dashed #cbd5e1; padding: 5px; border-radius: 4px;">
                            <div>
                                <label style="font-size:9px;">Cor da Linha (Trend)</label>
                                <input type="color" class="sparkline-color" value="${colConfig?.formatterParams?.mainColor ?? '#10b981'}" style="width:100%; height:20px; padding:0;">
                            </div>
                        </div>
                    </div>
                    ${refListConfigHtml}
                </div>
            `;
        }

        card.innerHTML = `
            <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span>
            <div class="field-card-controls">
                <label class="config-toggle"><input type="checkbox" class="is-visible-checkbox" ${isVisible ? 'checked' : ''}> Visível</label>
                <button type="button" class="btn btn-secondary btn-sm toggle-col-config">Opções</button>
            </div>
            <div class="col-config-panel" style="display: none; padding:15px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-top:8px;">
                <style>
                    .col-config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .col-config-section { display: flex; flex-direction: column; gap: 8px; }
                    .col-config-section.full-width { grid-column: span 2; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 5px; }
                    .config-label-with-help { display: flex; align-items: center; font-weight: 700; font-size: 11px; color: #475569; text-transform: uppercase; margin-bottom: 2px; }
                    .reflist-config-table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    .reflist-config-table th, .reflist-config-table td { padding: 4px; border: 1px solid #eee; text-align: center; }
                    .reflist-config-table th { background: #f1f5f9; }
                </style>
                ${optionsHtml}
            </div>
        `;

        card.querySelector('.toggle-col-config').onclick = () => {
            const p = card.querySelector('.col-config-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        };

        card.querySelector('.is-visible-checkbox').onchange = (e) => {
            const targetList = _mainContainer.querySelector(e.target.checked ? '#column-list' : '#available-column-list');
            targetList.appendChild(card);
            updateDebugJson();
        };

        const formatterSelect = card.querySelector('.col-formatter-select');
        if (formatterSelect) {
            formatterSelect.onchange = () => {
                const val = formatterSelect.value;
                const pParams = card.querySelector('.progress-params');
                const mParams = card.querySelector('.money-params');
                const iParams = card.querySelector('.image-params');
                const sParams = card.querySelector('.sparkline-params');
                if (pParams) pParams.style.display = (val === 'progress' || val === 'progressRing') ? 'block' : 'none';
                if (mParams) mParams.style.display = (val === 'money') ? 'grid' : 'none';
                if (iParams) iParams.style.display = (val === 'image') ? 'grid' : 'none';
                if (sParams) sParams.style.display = (val === 'sparkline') ? 'grid' : 'none';
                updateDebugJson();
            };
        }

        const progressTypeSelect = card.querySelector('.progress-type');
        if (progressTypeSelect) {
            progressTypeSelect.onchange = () => {
                const labelPosContainer = card.querySelector('.progress-label-pos-container');
                if (labelPosContainer) labelPosContainer.style.display = (progressTypeSelect.value === 'circular') ? 'block' : 'none';
                updateDebugJson();
            };
        }

        const presetSelect = card.querySelector('.progress-preset');
        if (presetSelect) {
            presetSelect.onchange = () => {
                const manualOptions = card.querySelector('.progress-manual-options');
                if (manualOptions) manualOptions.style.display = presetSelect.value ? 'none' : 'grid';
                updateDebugJson();
            };
        }

        if (isRefList) {
            const displaySelect = card.querySelector('.reflist-display-as');
            if (displaySelect) {
                displaySelect.onchange = () => {
                    card.querySelector('.reflist-card-options').style.display = displaySelect.value === 'cards' ? 'block' : 'none';
                    updateDebugJson();
                };
            }

            const toggleColsBtn = card.querySelector('.toggle-reflist-columns');
            if (toggleColsBtn) {
                toggleColsBtn.onclick = async () => {
                    const panel = card.querySelector('.reflist-column-config');
                    if (panel.style.display === 'none') {
                        const referencedTableId = col.type.split(':')[1];
                        const referencedSchema = await window.currentLens.getTableSchema(referencedTableId);
                        const fieldConfig = (_mainContainer._refListFieldConfig?.[col.colId]) || {};
                        const configCols = fieldConfig._refListConfig?.columns || [];
                        
                        if (referencedSchema) {
                            panel.innerHTML = `
                                <table class="reflist-config-table">
                                    <thead><tr><th>Campo</th><th>Exibir</th></tr></thead>
                                    <tbody>
                                        ${Object.values(referencedSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos').map(refCol => {
                                            const isShow = configCols.length === 0 || configCols.includes(refCol.colId);
                                            return `<tr data-ref-col-id="${refCol.colId}">
                                                <td style="text-align:left;">${refCol.label}</td>
                                                <td><input type="checkbox" class="ref-col-show-checkbox" ${isShow ? 'checked' : ''}></td>
                                            </tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>`;
                        }
                        panel.style.display = 'block';
                    } else {
                        panel.style.display = 'none';
                    }
                };
            }
        }

        return card;
    }

    function enableDragAndDrop(lists) {
        let draggedItem = null;
        lists.forEach(list => {
            list.addEventListener('dragstart', e => { draggedItem = e.target.closest('li'); setTimeout(() => draggedItem.classList.add('dragging'), 0); });
            list.addEventListener('dragend', () => { if (draggedItem) draggedItem.classList.remove('dragging'); });
            list.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement == null) list.appendChild(draggedItem);
                else list.insertBefore(draggedItem, afterElement);
                if (draggedItem) {
                    const cb = draggedItem.querySelector('.is-visible-checkbox');
                    if (cb) cb.checked = (list.id === 'column-list');
                }
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function renderActionsLayout() {
        const listContent = _mainContainer.querySelector('#btn-list-content');
        const detailContent = _mainContainer.querySelector('#btn-detail-content');
        if (!listContent || !detailContent) return;

        listContent.innerHTML = '';
        
        if (_customButtons.length === 0) {
            listContent.innerHTML = '<div style="color:#64748b; font-style:italic; text-align:center; padding:20px 10px; font-size:11px;">Nenhum botão criado</div>';
            detailContent.innerHTML = '<div style="color:#64748b; font-style:italic; text-align:center; margin-top:50px; font-size:12px;">Crie um botão de ação para configurá-lo</div>';
            return;
        }

        _customButtons.forEach((btn, idx) => {
            const item = document.createElement('div');
            item.style.cssText = `display:flex; align-items:center; padding:8px 10px; border-bottom:1px solid #e2e8f0; cursor:pointer; font-size:11px; justify-content:space-between; ${idx === _activeButtonIdx ? 'background:#e0f2fe; font-weight:bold;' : 'background:#fff;'}`;
            
            let iconPreview = '';
            if (btn.icon) {
                iconPreview = `<svg style="width:14px; height:14px; margin-right:6px; fill:currentColor; vertical-align:middle;"><use href="#${btn.icon}"></use></svg>`;
            }
            
            item.innerHTML = `
                <div style="display:flex; align-items:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; flex:1;">
                    ${iconPreview}
                    <span>${btn.text || 'Botão ' + (idx + 1)}</span>
                </div>
                <div style="display:flex; gap:4px; align-items:center;" class="btn-actions-ctrl">
                    <button type="button" class="btn-move-up" style="background:none; border:none; padding:2px; cursor:pointer;" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>↑</button>
                    <button type="button" class="btn-move-down" style="background:none; border:none; padding:2px; cursor:pointer;" ${idx === _customButtons.length - 1 ? 'disabled style="opacity:0.3"' : ''}>↓</button>
                    <button type="button" class="btn-delete" style="background:none; border:none; padding:2px; cursor:pointer; color:#ef4444;">✕</button>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-actions-ctrl')) return;
                _activeButtonIdx = idx;
                renderActionsLayout();
            });

            item.querySelector('.btn-move-up').onclick = (e) => {
                e.stopPropagation();
                if (idx > 0) {
                    const temp = _customButtons[idx];
                    _customButtons[idx] = _customButtons[idx - 1];
                    _customButtons[idx - 1] = temp;
                    if (_activeButtonIdx === idx) _activeButtonIdx = idx - 1;
                    else if (_activeButtonIdx === idx - 1) _activeButtonIdx = idx;
                    renderActionsLayout();
                    updateDebugJson();
                }
            };

            item.querySelector('.btn-move-down').onclick = (e) => {
                e.stopPropagation();
                if (idx < _customButtons.length - 1) {
                    const temp = _customButtons[idx];
                    _customButtons[idx] = _customButtons[idx + 1];
                    _customButtons[idx + 1] = temp;
                    if (_activeButtonIdx === idx) _activeButtonIdx = idx + 1;
                    else if (_activeButtonIdx === idx + 1) _activeButtonIdx = idx;
                    renderActionsLayout();
                    updateDebugJson();
                }
            };

            item.querySelector('.btn-delete').onclick = (e) => {
                e.stopPropagation();
                if (confirm('Deseja excluir este botão?')) {
                    _customButtons.splice(idx, 1);
                    if (_activeButtonIdx === idx) _activeButtonIdx = -1;
                    else if (_activeButtonIdx > idx) _activeButtonIdx--;
                    renderActionsLayout();
                    updateDebugJson();
                }
            };

            listContent.appendChild(item);
        });

        if (_activeButtonIdx >= 0 && _activeButtonIdx < _customButtons.length) {
            renderButtonConfigDetail(detailContent, _customButtons[_activeButtonIdx]);
        } else {
            detailContent.innerHTML = '<div style="color:#64748b; font-style:italic; text-align:center; margin-top:50px; font-size:12px;">Selecione um botão para editar</div>';
        }
    }

    async function renderButtonConfigDetail(container, btn) {
        const allGristPages = window.currentLens ? (await window.currentLens.listAllTables() || []) : [];
        const allGristColumns = (_mainContainer._allCols || []).map(f => f.colId);

        container.innerHTML = `
            <style>
                .btn-config-group { margin-bottom: 12px; }
                .btn-config-group label { display: block; font-weight: bold; font-size: 11px; margin-bottom: 4px; color: #475569; }
                .btn-config-group input[type="text"], .btn-config-group select { width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; }
                .btn-config-row { display: flex; gap: 10px; margin-bottom: 12px; }
                .btn-config-col { flex: 1; }
            </style>
            <h4 style="margin-top: 0; font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px;">Configurar Botão</h4>
            
            <div class="btn-config-row">
                <div class="btn-config-col" style="flex:2;">
                    <div class="btn-config-group">
                        <label>Rótulo (Texto)</label>
                        <input type="text" id="btn-text-input" value="${btn.text || ''}" placeholder="Texto do botão">
                    </div>
                </div>
                <div class="btn-config-col" style="flex:1;">
                    <div class="btn-config-group">
                        <label>Cor do Botão</label>
                        <input type="color" id="btn-color-input" value="${btn.color || '#2563eb'}" style="width:100%; height:28px; padding:0; cursor:pointer; border:1px solid #cbd5e1; border-radius:4px;">
                    </div>
                </div>
            </div>

            <div class="btn-config-row">
                <div class="btn-config-col">
                    <div class="btn-config-group">
                        <label>Ícone</label>
                        <div class="icon-picker-display" style="cursor:pointer; padding:6px; border:1px solid #cbd5e1; display:flex; align-items:center; gap:8px; border-radius:4px; background:#fff; font-size:11px;">
                            <span class="current-icon" style="display:flex; color:#333;">
                                ${btn.icon ? `<svg style="width:16px; height:16px; fill:currentColor;"><use href="#${btn.icon}"></use></svg>` : '<span style="color:#94a3b8;">Nenhum</span>'}
                            </span>
                            <span style="font-weight:bold; color:#64748b;">Alterar</span>
                        </div>
                    </div>
                </div>
                <div class="btn-config-col">
                    <div class="btn-config-group">
                        <label>Estilo do Botão</label>
                        <select id="btn-style-select">
                            <option value="both" ${btn.buttonStyle === 'both' || !btn.buttonStyle ? 'selected' : ''}>Ícone e Texto</option>
                            <option value="icon" ${btn.buttonStyle === 'icon' ? 'selected' : ''}>Apenas Ícone</option>
                            <option value="text" ${btn.buttonStyle === 'text' ? 'selected' : ''}>Apenas Texto</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="btn-config-group">
                <label>Tipo de Ação</label>
                <select id="btn-action-type-select">
                    <option value="navigateToGristPage" ${btn.actionType === 'navigateToGristPage' ? 'selected' : ''}>Navegar para Página Grist</option>
                    <option value="openUrlFromColumn" ${btn.actionType === 'openUrlFromColumn' ? 'selected' : ''}>Abrir URL da Coluna</option>
                    <option value="updateRecord" ${btn.actionType === 'updateRecord' ? 'selected' : ''}>Atualizar Campo do Registro</option>
                    <option value="triggerWidget" ${btn.actionType === 'triggerWidget' ? 'selected' : ''}>Disparar Outro Widget</option>
                    <option value="editRecord" ${btn.actionType === 'editRecord' ? 'selected' : ''}>Editar Registro (Gaveta/Drawer)</option>
                    <option value="deleteRecord" ${btn.actionType === 'deleteRecord' ? 'selected' : ''}>Excluir Registro</option>
                </select>
            </div>

            <div id="btn-action-specific-panel"></div>
        `;

        const specificPanel = container.querySelector('#btn-action-specific-panel');
        renderActionSpecificConfigPanel(specificPanel, btn, allGristPages, allGristColumns);

        container.querySelector('#btn-text-input').addEventListener('input', (e) => {
            btn.text = e.target.value;
            renderActionsLayout();
        });

        container.querySelector('#btn-color-input').addEventListener('change', (e) => {
            btn.color = e.target.value;
            updateDebugJson();
        });

        container.querySelector('#btn-style-select').addEventListener('change', (e) => {
            btn.buttonStyle = e.target.value;
            renderActionsLayout();
            updateDebugJson();
        });

        container.querySelector('.icon-picker-display').onclick = () => {
            const display = container.querySelector('.current-icon');
            openIconPickerLocal(display, btn);
        };

        container.querySelector('#btn-action-type-select').addEventListener('change', (e) => {
            btn.actionType = e.target.value;
            renderActionSpecificConfigPanel(specificPanel, btn, allGristPages, allGristColumns);
            updateDebugJson();
        });
    }

    function renderActionSpecificConfigPanel(container, btn, allGristPages, allGristColumns) {
        container.innerHTML = '';
        
        if (btn.actionType === 'navigateToGristPage') {
            container.innerHTML = `
                <div class="btn-config-group">
                    <label>Página de Destino (Tabela)</label>
                    <select class="action-prop-select" data-prop="targetPageId">
                        <option value="">-- Selecione a Página --</option>
                        ${allGristPages.map(p => `<option value="${p.id}" ${btn.targetPageId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="btn-config-group">
                    <label>Coluna Filtro Destino (Coluna na tabela destino)</label>
                    <input type="text" class="action-prop-input" data-prop="targetFilterColumn" value="${btn.targetFilterColumn || ''}" placeholder="Ex: id">
                </div>
                <div class="btn-config-group">
                    <label>Coluna Valor Origem (Coluna nesta tabela)</label>
                    <select class="action-prop-select" data-prop="sourceValueColumn">
                        <option value="">-- Selecione o Campo --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${btn.sourceValueColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
            `;
        } 
        else if (btn.actionType === 'openUrlFromColumn') {
            container.innerHTML = `
                <div class="btn-config-group">
                    <label>Coluna com a URL</label>
                    <select class="action-prop-select" data-prop="urlColumn">
                        <option value="">-- Selecione o Campo --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${btn.urlColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
            `;
        } 
        else if (btn.actionType === 'updateRecord') {
            container.innerHTML = `
                <div class="btn-config-group">
                    <label>Coluna a Atualizar</label>
                    <select class="action-prop-select" data-prop="updateField">
                        <option value="">-- Selecione o Campo --</option>
                        ${allGristColumns.map(col => `<option value="${col}" ${btn.updateField === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
                <div class="btn-config-group">
                    <label>Valor da Atualização</label>
                    <input type="text" class="action-prop-input" data-prop="updateValue" value="${btn.updateValue || ''}" placeholder="Ex: Confirmado ou 123">
                </div>
            `;
        } 
        else if (btn.actionType === 'triggerWidget') {
            const wConfigs = _allConfigs.filter(c => c.configId !== currentSchema?.configId);
            container.innerHTML = `
                <div class="btn-config-group">
                    <label>Widget de Destino</label>
                    <select class="action-prop-select" data-prop="targetConfigId">
                        <option value="">-- Selecione o Widget --</option>
                        ${wConfigs.map(c => `<option value="${c.configId}" ${btn.targetConfigId === c.configId ? 'selected' : ''} data-type="${c.componentType || ''}">${c.widgetTitle || c.configId} [${c.configId}]</option>`).join('')}
                    </select>
                </div>
                <div class="btn-config-group">
                    <label>Coluna Filtro no Destino</label>
                    <input type="text" class="action-prop-input" data-prop="filterTargetColumn" value="${btn.filterTargetColumn || ''}" placeholder="Ex: ref_parent">
                </div>
                <div class="btn-config-group" style="margin-top:8px;">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:normal;">
                        <input type="checkbox" class="action-prop-checkbox" data-prop="disableFiltering" ${btn.disableFiltering ? 'checked' : ''}>
                        Sem filtrar pelo registro atual (chamar limpo)
                    </label>
                </div>
            `;
            
            const targetSelect = container.querySelector('.action-prop-select[data-prop="targetConfigId"]');
            if (targetSelect) {
                targetSelect.addEventListener('change', (e) => {
                    const opt = e.target.options[e.target.selectedIndex];
                    btn.targetComponentType = opt ? (opt.dataset.type || '') : '';
                });
            }
        } 
        else if (btn.actionType === 'deleteRecord') {
            container.innerHTML = `
                <div class="btn-config-group">
                    <label>Mensagem de Confirmação</label>
                    <input type="text" class="action-prop-input" data-prop="confirmationMessage" value="${btn.confirmationMessage || 'Deseja excluir este registro?'}" placeholder="Mensagem de confirmação">
                </div>
            `;
        }
        
        container.querySelectorAll('.action-prop-select, .action-prop-input, .action-prop-checkbox').forEach(input => {
            input.addEventListener('change', (e) => {
                const prop = e.target.dataset.prop;
                if (prop) {
                    if (e.target.type === 'checkbox') {
                        btn[prop] = e.target.checked;
                    } else {
                        btn[prop] = e.target.value;
                    }
                    updateDebugJson();
                }
            });
            input.addEventListener('input', (e) => {
                const prop = e.target.dataset.prop;
                if (prop && e.target.type === 'text') {
                    btn[prop] = e.target.value;
                    updateDebugJson();
                }
            });
        });
    }

    function openIconPickerLocal(displayElement, btn) {
        if (_iconPickerPopup && _iconPickerPopup.parentNode) {
            _iconPickerPopup.parentNode.removeChild(_iconPickerPopup);
        }
        
        _iconPickerPopup = document.createElement("div");
        _iconPickerPopup.className = 'icon-picker-popup';
        _iconPickerPopup.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1080; padding:15px; background:white; border:1px solid #ccc; box-shadow:0 4px 10px rgba(0,0,0,0.15); max-width:600px; max-height:500px; overflow-y:auto; border-radius:5px;`;
        
        _iconPickerPopup.innerHTML = `
            <style>
                .icon-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
                .icon-option { width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #eee; border-radius: 4px; cursor: pointer; transition: all 0.2s; color: #000; padding: 5px; overflow: hidden; }
                .icon-option:hover { background: #e6f7ff; border-color: #1890ff; transform: scale(1.05); }
                .icon-option svg { width: 32px; height: 32px; flex-shrink: 0; fill: currentColor; }
                .icon-id-label { font-size: 9px; margin-top: 5px; text-align: center; word-break: break-all; color: #666; max-height: 24px; overflow: hidden; }
            </style>
            <h4 style="margin-top:0; font-size:14px; margin-bottom:12px;">Selecione um Ícone</h4>
            <div class="icon-grid">
                ${AVAILABLE_ICONS.map(id => `
                    <div class="icon-option" data-id="${id}" title="${id}">
                        <svg><use href="#${id}"></use></svg>
                        <div class="icon-id-label">${id.replace('icon-', '')}</div>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: right; margin-top: 15px;">
                <button id="icon-picker-cancel" type="button" class="btn btn-secondary">Cancelar</button>
            </div>
        `;
        
        _mainContainer.appendChild(_iconPickerPopup);
        
        _iconPickerPopup.querySelectorAll('.icon-option').forEach(iconEl => {
            iconEl.addEventListener('click', () => {
                const selectedIcon = iconEl.dataset.id;
                btn.icon = selectedIcon;
                if (displayElement) {
                    displayElement.innerHTML = `<svg style="width:16px; height:16px; fill:currentColor;"><use href="#${selectedIcon}"></use></svg>`;
                }
                _iconPickerPopup.parentNode.removeChild(_iconPickerPopup);
                _iconPickerPopup = null;
                renderActionsLayout();
                updateDebugJson();
            });
        });
        
        _iconPickerPopup.querySelector('#icon-picker-cancel').addEventListener('click', () => {
            _iconPickerPopup.parentNode.removeChild(_iconPickerPopup);
            _iconPickerPopup = null;
        });
    }

    return { render, read };
})();
window.TableConfigEditor = TableConfigEditor;
