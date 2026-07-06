export const TableConfigEditor = (() => {
    let _mainContainer = null;
    let _allCols = [];
    let _activeButtonIdx = -1;
    let _customButtons = [];
    let _iconPickerPopup = null;
    let _allConfigs = [];
    let _currentTableId = null;

    const AVAILABLE_ICONS = [
        "icon-CompassRose",
        "icon-activity-icon",
        "icon-adjustments",
        "icon-adjustments-vert",
        "icon-annotation",
        "icon-arrow-down-icon",
        "icon-arrow-down-left-icon",
        "icon-arrow-down-right-icon",
        "icon-arrow-left-icon",
        "icon-arrow-move",
        "icon-arrow-right-icon",
        "icon-arrow-up-icon",
        "icon-arrow-up-left-icon",
        "icon-arrow-up-right-icon",
        "icon-backhoe",
        "icon-badge-check",
        "icon-bar-chart",
        "icon-bar-chart-line",
        "icon-barcode",
        "icon-bars",
        "icon-bell",
        "icon-bell-active",
        "icon-bookmark",
        "icon-bulldozer",
        "icon-bullseye",
        "icon-calculator-icon",
        "icon-calendar",
        "icon-calendar-edit",
        "icon-card-checklist",
        "icon-chart",
        "icon-chart-gantt-icon",
        "icon-chart-mixed",
        "icon-chart-pie",
        "icon-chart-up",
        "icon-check",
        "icon-check-circle",
        "icon-check-circle-alt",
        "icon-checklist",
        "icon-chess-knight-icon",
        "icon-chess-pawn-icon",
        "icon-chess-rook-icon",
        "icon-clipboard",
        "icon-clipboard-check",
        "icon-clipboard-list",
        "icon-clock-arrow",
        "icon-close-circle",
        "icon-close-sidebar",
        "icon-column",
        "icon-compass",
        "icon-cone",
        "icon-cone-striped",
        "icon-crosshair-icon",
        "icon-diagram-2",
        "icon-diagram-3",
        "icon-download",
        "icon-edit",
        "icon-exclamation",
        "icon-exclamation-diamond",
        "icon-exclamation-triangle",
        "icon-expand",
        "icon-eye",
        "icon-file",
        "icon-file-chart",
        "icon-file-check",
        "icon-file-clone",
        "icon-file-search",
        "icon-filter",
        "icon-flag",
        "icon-flag-icon",
        "icon-folder",
        "icon-forward",
        "icon-globe",
        "icon-globe-americas",
        "icon-grid",
        "icon-hard-hat",
        "icon-hourglass",
        "icon-info-circle",
        "icon-kanban",
        "icon-land-plot-icon",
        "icon-landmark-icon",
        "icon-life-buoy-icon",
        "icon-lifesaver",
        "icon-lightbulb",
        "icon-lightning",
        "icon-link",
        "icon-link-broken",
        "icon-lock",
        "icon-microscope",
        "icon-minus-circle",
        "icon-minus-circle-alt",
        "icon-pen",
        "icon-pen-alt",
        "icon-plus-circle",
        "icon-plus-circle-alt",
        "icon-pocket-knife-icon",
        "icon-printer",
        "icon-printer-icon",
        "icon-process",
        "icon-process-cogs",
        "icon-profile-card",
        "icon-rectangle-list",
        "icon-risk",
        "icon-save",
        "icon-save-alt",
        "icon-search",
        "icon-settings",
        "icon-sheet-icon",
        "icon-shield-alert-icon",
        "icon-shovel-icon",
        "icon-speedometer",
        "icon-strategy",
        "icon-target-arrow",
        "icon-tool-case-icon",
        "icon-tools",
        "icon-tools2",
        "icon-traffic-cone-icon",
        "icon-traffic-light",
        "icon-trashbin",
        "icon-trophy-icon",
        "icon-truck",
        "icon-unlock",
        "icon-user-round-icon",
        "icon-wrench",
        "icon-zoom-in",
        "icon-zoom-out"
    ];

    async function render(container, config, lens, tableId, allConfigs = []) {
        _mainContainer = container;
        _allConfigs = allConfigs;
        _currentTableId = tableId;
        if (!tableId) {
            container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima.</p>';
            return;
        }

        const schema = await lens.getTableSchema(tableId);
        if (!schema) {
            container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela.</p>';
            return;
        }

        const fullConfig = config || {};
        const mapping = fullConfig.mapping || fullConfig;
        const styling = fullConfig.styling || fullConfig;
        const actions = fullConfig.actions || fullConfig;

        _customButtons = Array.isArray(actions.customButtons) ? actions.customButtons : [];
        _activeButtonIdx = -1;

        const cols = Object.values(schema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        _allCols = cols;
        const currentCols = mapping.columns || [];

        container.innerHTML = `
            <style>
                .config-section { margin-bottom: 25px; padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
                .config-section h3 { margin-top: 0; font-size: 15px; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px; }
                .field-list { list-style: none; padding: 0; margin: 0; min-height: 50px; }
                .field-card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px; cursor: grab; transition: all 0.2s; position: relative; }
                .field-card:hover { border-color: #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .field-card.dragging { opacity: 0.5; border-style: dashed; }
                .field-card-label { font-weight: 600; font-size: 13px; color: #334155; }
                .field-card-type { font-weight: normal; font-size: 11px; color: #94a3b8; margin-left: 5px; }
                .field-card-controls { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
                .config-toggle { display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; }
                .config-tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
                .config-tab-btn { padding: 8px 16px; border: none; background: none; cursor: pointer; font-size: 13px; color: #64748b; border-bottom: 2px solid transparent; }
                .config-tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
                .available-cols-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px dashed #cbd5e1; }
                .custom-btn-layout { display: flex; height: 350px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-top: 10px; }
                .btn-list-side { width: 180px; border-right: 1px solid #e2e8f0; background: #f8fafc; display: flex; flex-direction: column; }
                .btn-detail-side { flex: 1; padding: 15px; overflow-y: auto; background: #fff; }
                .btn-list-header { padding: 8px 12px; font-weight: bold; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
            </style>
            <div class="config-tabs">
                <button class="config-tab-btn active" data-tab="mapping">Mapeamento e Colunas</button>
                <button class="config-tab-btn" data-tab="styling">Visual da Tabela</button>
                <button class="config-tab-btn" data-tab="actions">Ações e Botões</button>
            </div>
            <div id="table-config-content">
                <div class="tab-pane active" id="pane-mapping">
                    <div class="config-section">
                        <h3>Colunas Visíveis</h3>
                        <p class="help-text">Arraste para reordenar as colunas exibidas na tabela.</p>
                        <ul id="column-list" class="field-list"></ul>
                    </div>
                    <div class="available-cols-container">
                        <h3>Colunas Disponíveis</h3>
                        <p class="help-text">Marque "Visível" ou arraste para cima para incluir na tabela.</p>
                        <ul id="available-column-list" class="field-list"></ul>
                    </div>
                </div>
                <div class="tab-pane" id="pane-styling" style="display:none;">
                    <div class="config-section">
                        <h3>Layout e Estilo</h3>
                        <div class="col-config-grid">
                            <div class="col-config-section">
                                <label class="config-toggle"><input type="checkbox" id="striped-rows-checkbox" ${styling.tableLayoutConfig?.stripedRows !== false ? 'checked' : ''}> Linhas Zebradas</label>
                                <label class="config-toggle"><input type="checkbox" id="resizable-cols-checkbox" ${styling.resizableColumns !== false ? 'checked' : ''}> Colunas Redimensionáveis</label>
                                <label class="config-toggle"><input type="checkbox" id="header-filter-checkbox" ${styling.headerFilter ? 'checked' : ''}> Filtros no Cabeçalho</label>
                                <label class="config-toggle"><input type="checkbox" id="hide-empty-placeholder-checkbox" ${styling.hideEmptyPlaceholder ? 'checked' : ''}> Ocultar "(vazio)" em células em branco</label>
                                <label class="config-toggle"><input type="checkbox" id="row-selection-checkbox" ${styling.rowSelection ? 'checked' : ''}> Habilitar Seleção de Linhas (Checkboxes)</label>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Paginação</div>
                                    <select id="pagination-enabled-select" style="width:100%; padding:4px;">
                                        <option value="local" ${styling.pagination?.enabled !== false && styling.pagination?.enabled !== 'false' ? 'selected' : ''}>Ativada (Local)</option>
                                        <option value="false" ${styling.pagination?.enabled === false || styling.pagination?.enabled === 'false' ? 'selected' : ''}>Desativada (Scroll)</option>
                                    </select>
                                </div>
                                <div id="page-size-container" style="margin-top:8px; display: ${styling.pagination?.enabled !== false && styling.pagination?.enabled !== 'false' ? 'block' : 'none'};">
                                    <div class="config-label-with-help">Tamanho da Página</div>
                                    <input type="number" id="pagination-size-input" value="${styling.pagination?.pageSize || 10}" style="width:calc(100% - 10px); padding:4px;" min="1" max="500">
                                </div>
                            </div>
                            <div class="col-config-section">
                                <div>
                                    <div class="config-label-with-help">Tema Visual</div>
                                    <select id="theme-style-select" style="width:100%; padding:4px;">
                                        <option value="glassmorphism" ${styling.tableLayoutConfig?.themeStyle === 'glassmorphism' ? 'selected' : ''}>Glassmorphism (Moderno)</option>
                                        <option value="minimal" ${styling.tableLayoutConfig?.themeStyle === 'minimal' ? 'selected' : ''}>Minimalista (Limpo)</option>
                                        <option value="corporate" ${styling.tableLayoutConfig?.themeStyle === 'corporate' ? 'selected' : ''}>Corporativo (Grist Style)</option>
                                        <option value="night" ${styling.tableLayoutConfig?.themeStyle === 'night' ? 'selected' : ''}>Night Mode</option>
                                    </select>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Densidade</div>
                                    <select id="density-select" style="width:100%; padding:4px;">
                                        <option value="compact" ${styling.tableLayoutConfig?.density === 'compact' ? 'selected' : ''}>Compacto</option>
                                        <option value="comfortable" ${styling.tableLayoutConfig?.density === 'comfortable' ? 'selected' : ''}>Confortável</option>
                                        <option value="spacious" ${styling.tableLayoutConfig?.density === 'spacious' ? 'selected' : ''}>Espaçoso</option>
                                    </select>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Linhas de Grade / Bordas</div>
                                    <select id="grid-lines-select" style="width:100%; padding:4px;">
                                        <option value="horizontal" ${styling.tableLayoutConfig?.gridLines === 'horizontal' ? 'selected' : ''}>Apenas Horizontais (Padrão)</option>
                                        <option value="full" ${styling.tableLayoutConfig?.gridLines === 'full' ? 'selected' : ''}>Todas as Bordas (Grade Completa)</option>
                                        <option value="none" ${styling.tableLayoutConfig?.gridLines === 'none' ? 'selected' : ''}>Sem Bordas</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="config-section">
                        <h3>Customização de Cores e Fontes</h3>
                        <div class="col-config-grid">
                            <div class="col-config-section">
                                <div>
                                    <div class="config-label-with-help">Fonte da Tabela</div>
                                    <select id="custom-font-family-select" style="width:100%; padding:4px;">
                                        <option value="" ${!styling.customStyles?.fontFamily ? 'selected' : ''}>-- Padrão do Tema --</option>
                                        <option value="system-ui" ${styling.customStyles?.fontFamily === 'system-ui' ? 'selected' : ''}>System UI (Padrão)</option>
                                        <option value="'Outfit', sans-serif" ${styling.customStyles?.fontFamily === "'Outfit', sans-serif" ? 'selected' : ''}>Outfit (BSC Style)</option>
                                        <option value="'Inter', sans-serif" ${styling.customStyles?.fontFamily === "'Inter', sans-serif" ? 'selected' : ''}>Inter</option>
                                        <option value="'Roboto', sans-serif" ${styling.customStyles?.fontFamily === "'Roboto', sans-serif" ? 'selected' : ''}>Roboto</option>
                                        <option value="monospace" ${styling.customStyles?.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                                    </select>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Tamanho da Fonte</div>
                                    <input type="text" id="custom-font-size-input" value="${styling.customStyles?.fontSize || ''}" placeholder="Ex: 13px, 0.9rem" style="width:calc(100% - 10px); padding:4px;">
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Altura da Linha (Mínima px)</div>
                                    <input type="number" id="custom-line-height-input" value="${styling.customStyles?.lineHeight || ''}" placeholder="Ex: 38" style="width:calc(100% - 10px); padding:4px;">
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Espaçamento Interno (Cell Padding px)</div>
                                    <input type="number" id="custom-cell-padding-input" value="${styling.customStyles?.cellPadding || ''}" placeholder="Ex: 8" style="width:calc(100% - 10px); padding:4px;">
                                </div>
                            </div>
                            <div class="col-config-section">
                                <div>
                                    <div class="config-label-with-help">Fundo do Cabeçalho</div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="color" id="custom-header-bg-input" value="${styling.customStyles?.headerBgColor || '#f8fafc'}" style="width:50px; height:24px; padding:0;">
                                        <label class="config-toggle" style="margin-top:0;"><input type="checkbox" id="custom-header-bg-enabled" ${styling.customStyles?.headerBgColor ? 'checked' : ''}> Usar</label>
                                    </div>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Texto do Cabeçalho</div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="color" id="custom-header-text-input" value="${styling.customStyles?.headerTextColor || '#1e293b'}" style="width:50px; height:24px; padding:0;">
                                        <label class="config-toggle" style="margin-top:0;"><input type="checkbox" id="custom-header-text-enabled" ${styling.customStyles?.headerTextColor ? 'checked' : ''}> Usar</label>
                                    </div>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Fundo das Linhas</div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="color" id="custom-row-bg-input" value="${styling.customStyles?.rowBgColor || '#ffffff'}" style="width:50px; height:24px; padding:0;">
                                        <label class="config-toggle" style="margin-top:0;"><input type="checkbox" id="custom-row-bg-enabled" ${styling.customStyles?.rowBgColor ? 'checked' : ''}> Usar</label>
                                    </div>
                                </div>
                                <div style="margin-top:8px;">
                                    <div class="config-label-with-help">Fundo Zebrado (Ímpar)</div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="color" id="custom-row-alt-bg-input" value="${styling.customStyles?.rowAltBgColor || '#f8fafc'}" style="width:50px; height:24px; padding:0;">
                                        <label class="config-toggle" style="margin-top:0;"><input type="checkbox" id="custom-row-alt-bg-enabled" ${styling.customStyles?.rowAltBgColor ? 'checked' : ''}> Usar</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tab-pane" id="pane-actions" style="display:none;">
                    <div class="config-section">
                        <h3>Comportamento</h3>
                        <div class="col-config-grid">
                            <div>
                                <label class="config-toggle"><input type="checkbox" id="edit-mode-checkbox" ${actions.editMode ? 'checked' : ''}> Habilitar Edição Direta</label>
                                <label class="config-toggle"><input type="checkbox" id="use-save-btn-checkbox" ${actions.useSaveButton ? 'checked' : ''}> Usar Botão "Salvar Alterações"</label>
                                <label class="config-toggle"><input type="checkbox" id="enable-add-btn-checkbox" ${actions.enableAddNewBtn ? 'checked' : ''}> Mostrar Botão "Novo Registro"</label>
                            </div>
                            <div>
                                <div class="config-label-with-help">Gaveta de Edição (Drawer)</div>
                                <select id="drawer-config-select" style="width:100%; padding:4px;">
                                    <option value="">-- Sem Gaveta --</option>
                                    ${allConfigs.filter(c => c.componentType === 'Drawer').map(c => `<option value="${c.configId}" ${actions.drawerId === c.configId ? 'selected' : ''}>${c.widgetTitle || c.configId}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="config-section">
                        <h3>Botões de Ação Customizados</h3>
                        <p class="help-text">Estes botões aparecerão na coluna de Ações.</p>
                        <div class="custom-btn-layout">
                            <div class="btn-list-side">
                                <div class="btn-list-header">Lista de Botões</div>
                                <div id="btn-list-content" style="flex:1; overflow-y:auto;"></div>
                                <button type="button" id="add-custom-btn" class="btn btn-primary btn-sm" style="margin:8px;">+ Adicionar Botão</button>
                            </div>
                            <div class="btn-detail-side" id="btn-detail-content"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const visibleList = container.querySelector('#column-list');
        const availableList = container.querySelector('#available-column-list');

        const paginationEnabledSelect = container.querySelector('#pagination-enabled-select');
        const pageSizeContainer = container.querySelector('#page-size-container');
        if (paginationEnabledSelect && pageSizeContainer) {
            paginationEnabledSelect.onchange = () => {
                const val = paginationEnabledSelect.value;
                pageSizeContainer.style.display = (val !== 'false') ? 'block' : 'none';
            };
        }

        // Adiciona coluna especial de Ações se não existir
        if (!cols.find(c => c.colId === '_actions')) {
            cols.unshift({ colId: '_actions', label: '⚡ Ações', type: 'Actions' });
        }

        cols.forEach(col => {
            const config = currentCols.find(c => c.colId === col.colId);
            const card = createColumnCard(col, config);
            if (config) visibleList.appendChild(card);
            else availableList.appendChild(card);
        });

        enableDragAndDrop([visibleList, availableList]);

        container.querySelectorAll('.config-tab-btn').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.config-tab-btn').forEach(b => b.classList.remove('active'));
                container.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
                btn.classList.add('active');
                container.querySelector(`#pane-${btn.dataset.tab}`).style.display = 'block';
            };
        });

        container.querySelector('#add-custom-btn').onclick = () => {
            _customButtons.push({ text: 'Nova Ação', icon: 'icon-star', color: '#2563eb', actionType: 'navigateToGristPage' });
            _activeButtonIdx = _customButtons.length - 1;
            renderActionsLayout();
            updateDebugJson();
        };

        renderActionsLayout();
    }

    function read(container) {
        const fullConfig = {};
        const visibleCards = [...container.querySelectorAll('#column-list .field-card')];
        
        fullConfig.tableId = _currentTableId;
        fullConfig.columns = visibleCards.map(card => {
            const colId = card.dataset.colId;
            const panel = card.querySelector('.col-config-panel');
            const colBase = {
                colId: colId,
                width: panel.querySelector('.col-width-input')?.value || 'auto',
                align: panel.querySelector('.col-align-select')?.value || 'left'
            };

            if (colId === '_actions') {
                colBase.showView = panel.querySelector('.action-btn-view-checkbox')?.checked;
                colBase.showEdit = panel.querySelector('.action-btn-edit-checkbox')?.checked;
                colBase.showDelete = panel.querySelector('.action-btn-delete-checkbox')?.checked;
            } else {
                colBase.title = panel.querySelector('.col-title-input')?.value || null;
                colBase.locked = panel.querySelector('.is-locked-checkbox')?.checked || false;
                colBase.required = panel.querySelector('.is-required-checkbox')?.checked || false;
                colBase.ignoreConditionalFormatting = panel.querySelector('.ignore-conditional-formatting-checkbox')?.checked || false;
                colBase.ignoreHeaderStyle = panel.querySelector('.ignore-header-style-checkbox')?.checked || false;
                colBase.ignoreCellStyle = panel.querySelector('.ignore-cell-style-checkbox')?.checked || false;
                colBase.wrapText = panel.querySelector('.wrap-text-checkbox')?.checked !== false;
                colBase.maxTextRows = parseInt(panel.querySelector('.max-text-rows-input')?.value, 10) || null;
                colBase.bottomCalc = panel.querySelector('.col-calc-select')?.value || null;
                colBase.formatter = panel.querySelector('.col-formatter-select')?.value || null;

                if (colBase.formatter === 'progress' || colBase.formatter === 'progressRing') {
                    const preset = panel.querySelector('.progress-preset')?.value;
                    if (preset) {
                        colBase.formatterParams = { progressBarPreset: preset };
                    } else {
                        colBase.formatterParams = {
                            progressType: panel.querySelector('.progress-type')?.value || 'linear',
                            labelPosition: panel.querySelector('.progress-label-pos')?.value || 'middle',
                            showInternalBar: panel.querySelector('.progress-show-internal')?.checked || false,
                            internalBarColId: panel.querySelector('.progress-internal-col')?.value || '',
                            min: parseFloat(panel.querySelector('.progress-min')?.value ?? 0),
                            max: parseFloat(panel.querySelector('.progress-max')?.value ?? 100),
                            mainColor: panel.querySelector('.progress-color')?.value || '#4caf50',
                            bgColor: panel.querySelector('.progress-bgcolor')?.value || '#e0e0e0',
                            borderRadius: parseInt(panel.querySelector('.progress-radius')?.value ?? 4, 10),
                            colorMode: panel.querySelector('.progress-mode')?.value || 'solid',
                            striped: panel.querySelector('.progress-striped')?.checked || false,
                            animated: panel.querySelector('.progress-animated')?.checked || false
                        };
                    }
                } else if (colBase.formatter === 'money') {
                    colBase.formatterParams = {
                        symbol: panel.querySelector('.money-symbol')?.value || 'R$',
                        decimal: panel.querySelector('.money-decimal')?.value || ',',
                        thousand: panel.querySelector('.money-thousand')?.value || '.'
                    };
                } else if (colBase.formatter === 'image') {
                    colBase.formatterParams = {
                        imageSize: parseInt(panel.querySelector('.image-size')?.value ?? 50, 10),
                        objectFit: panel.querySelector('.image-fit')?.value || 'cover',
                        borderRadius: panel.querySelector('.image-radius')?.value || '4px'
                    };
                } else if (colBase.formatter === 'sparkline') {
                    colBase.formatterParams = {
                        mainColor: panel.querySelector('.sparkline-color')?.value || '#10b981'
                    };
                }
            }

            return colBase;
        });

        const refListFieldConfig = {};
        visibleCards.forEach(card => {
            const colId = card.dataset.colId;
            const reflistPanel = card.querySelector('.reflist-config-panel');
            if (reflistPanel) {
                const cols = [];
                reflistPanel.querySelectorAll('.reflist-config-table tbody tr').forEach(tr => {
                    if (tr.querySelector('.ref-col-show-checkbox')?.checked) {
                        cols.push(tr.dataset.refColId);
                    }
                });

                refListFieldConfig[colId] = {
                    _refListConfig: {
                        displayAs: reflistPanel.querySelector('.reflist-display-as')?.value || 'none',
                        collapsible: reflistPanel.querySelector('.reflist-collapsible-checkbox')?.checked || false,
                        zebra: reflistPanel.querySelector('.reflist-zebra-checkbox')?.checked || false,
                        cardConfigId: reflistPanel.querySelector('.reflist-card-config-id')?.value || '',
                        showAddButton: reflistPanel.querySelector('.reflist-show-add-checkbox')?.checked || false,
                        addRecordConfigId: reflistPanel.querySelector('.reflist-add-config-id')?.value || '',
                        columns: cols
                    }
                };
            }
        });

        const tableLayoutConfig = {
            themeStyle: container.querySelector('#theme-style-select')?.value || 'glassmorphism',
            density: container.querySelector('#density-select')?.value || 'comfortable',
            gridLines: container.querySelector('#grid-lines-select')?.value || 'horizontal',
            stripedRows: container.querySelector('#striped-rows-checkbox')?.checked ?? true
        };

        const customStyles = {
            fontFamily: container.querySelector('#custom-font-family-select').value || null,
            fontSize: container.querySelector('#custom-font-size-input').value || null,
            lineHeight: parseInt(container.querySelector('#custom-line-height-input').value, 10) || null,
            cellPadding: parseInt(container.querySelector('#custom-cell-padding-input').value, 10) || null,
            headerBgColor: container.querySelector('#custom-header-bg-enabled').checked ? container.querySelector('#custom-header-bg-input').value : null,
            headerTextColor: container.querySelector('#custom-header-text-enabled').checked ? container.querySelector('#custom-header-text-input').value : null,
            rowBgColor: container.querySelector('#custom-row-bg-enabled').checked ? container.querySelector('#custom-row-bg-input').value : null,
            rowAltBgColor: container.querySelector('#custom-row-alt-bg-enabled').checked ? container.querySelector('#custom-row-alt-bg-input').value : null
        };

        return {
            mapping: { tableId: fullConfig.tableId, columns: fullConfig.columns, refListFieldConfig },
            styling: {
                resizableColumns: container.querySelector('#resizable-cols-checkbox').checked,
                headerFilter: container.querySelector('#header-filter-checkbox').checked,
                hideEmptyPlaceholder: container.querySelector('#hide-empty-placeholder-checkbox').checked,
                rowSelection: container.querySelector('#row-selection-checkbox').checked,
                tableLayoutConfig: tableLayoutConfig,
                pagination: {
                    enabled: container.querySelector('#pagination-enabled-select').value,
                    pageSize: parseInt(container.querySelector('#pagination-size-input').value, 10) || 10
                },
                customStyles: customStyles
            },
            actions: {
                editMode: container.querySelector('#edit-mode-checkbox').checked,
                useSaveButton: container.querySelector('#use-save-btn-checkbox').checked,
                drawerId: container.querySelector('#drawer-config-select').value,
                enableAddNewBtn: container.querySelector('#enable-add-btn-checkbox').checked,
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
        } else if (category === 'date') {
            formatterOptionsHtml += `
                <option value="date" ${colConfig?.formatter === 'date' ? 'selected' : ''}>Apenas Data</option>
                <option value="datetime" ${colConfig?.formatter === 'datetime' ? 'selected' : ''}>Data e Hora</option>
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
                        <div class="reflist-column-config" style="display:none; margin-top:8px; max-height:200px; overflow:auto; background:#fff; border:1px solid #ddd; padding:8px; border-radius:4px;"></div>
                    </div>
                `;
            }

            optionsHtml = `
                <div class="col-config-grid">
                    <div class="col-config-section">
                        <div class="config-label-with-help">Regras</div>
                        <label><input type="checkbox" class="is-locked-checkbox" ${colConfig?.locked ? 'checked' : ''}> Travado</label>
                        <label><input type="checkbox" class="is-required-checkbox" ${colConfig?.required ? 'checked' : ''}> Obrigatório</label>
                        <label><input type="checkbox" class="ignore-conditional-formatting-checkbox" ${colConfig?.ignoreConditionalFormatting ? 'checked' : ''}> S/ Format. Condic.</label>
                        <label><input type="checkbox" class="ignore-header-style-checkbox" ${colConfig?.ignoreHeaderStyle ? 'checked' : ''}> S/ Estilo Cabecalho</label>
                        <label><input type="checkbox" class="ignore-cell-style-checkbox" ${colConfig?.ignoreCellStyle ? 'checked' : ''}> S/ Estilo Celula</label>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Visual</div>
                        <label><input type="checkbox" class="wrap-text-checkbox" ${colConfig?.wrapText !== false ? 'checked' : ''}> Quebrar Linha</label>
                        <div>
                            <div class="config-label-with-help">Largura (px)</div>
                            <input type="text" class="col-width-input" value="${colConfig?.width || ''}" placeholder="auto" style="width:100%; padding:4px;">
                        </div>
                        <div style="margin-top:5px;">
                            <div class="config-label-with-help">Título Customizado</div>
                            <input type="text" class="col-title-input" value="${colConfig?.title || ''}" placeholder="${col.label}" style="width:100%; padding:4px;">
                        </div>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Alinhamento</div>
                        <select class="col-align-select" style="width:100%; padding:4px;">
                            <option value="left" ${align === 'left' ? 'selected' : ''}>Esquerda</option>
                            <option value="center" ${align === 'center' ? 'selected' : ''}>Centro</option>
                            <option value="right" ${align === 'right' ? 'selected' : ''}>Direita</option>
                        </select>
                    </div>
                    <div class="col-config-section">
                        <div class="config-label-with-help">Máx. Linhas</div>
                        <input type="number" class="max-text-rows-input" value="${colConfig?.maxTextRows || ''}" min="1" style="width:100%; padding:4px;">
                    </div>
                    <div class="col-config-section full-width">
                        <div class="col-config-grid">
                            <div>
                                <div class="config-label-with-help">Cálculo Rodapé</div>
                                <select class="col-calc-select" style="width:100%; padding:4px;">
                                    <option value="">Nenhum</option>
                                    <option value="sum" ${colConfig?.bottomCalc === 'sum' ? 'selected' : ''}>Soma</option>
                                    <option value="avg" ${colConfig?.bottomCalc === 'avg' ? 'selected' : ''}>Média</option>
                                    <option value="count" ${colConfig?.bottomCalc === 'count' ? 'selected' : ''}>Contagem</option>
                                </select>
                            </div>
                            <div>
                                <div class="config-label-with-help">Formato Especial</div>
                                <select class="col-formatter-select" style="width:100%; padding:4px;">${formatterOptionsHtml}</select>
                            </div>
                        </div>
                        <div class="formatter-params progress-params" style="display: ${(colConfig?.formatter === 'progress' || colConfig?.formatter === 'progressRing') ? 'block' : 'none'}; margin-top: 5px; border: 1px dashed #cbd5e1; padding: 5px; border-radius: 4px;">
                            <div class="form-group" style="margin-bottom: 5px;">
                                <label style="font-size:10px;">Preset Global:</label>
                                <select class="progress-preset" style="width:100%; font-size:10px;">
                                    <option value="">-- Manual --</option>
                                    ${_allConfigs.filter(c => c.componentType === 'Progress Bar').map(c => `<option value="${c.configId}" ${colConfig?.formatterParams?.progressBarPreset === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div class="progress-manual-options" style="display: ${colConfig?.formatterParams?.progressBarPreset ? 'none' : 'grid'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px;">
                                <div style="grid-column: span 1.5;"><label style="font-size:9px;">Tipo</label><select class="progress-type" style="width:100%; font-size:10px;"><option value="linear" ${colConfig?.formatterParams?.progressType === 'linear' ? 'selected' : ''}>Linear</option><option value="circular" ${colConfig?.formatterParams?.progressType === 'circular' ? 'selected' : ''}>Circular</option></select></div>
                                <div class="progress-label-pos-container" style="display: ${colConfig?.formatterParams?.progressType === 'circular' ? 'block' : 'none'}; grid-column: span 1.5;"><label style="font-size:9px;">Pos. Valor</label><select class="progress-label-pos" style="width:100%; font-size:10px;"><option value="middle" ${colConfig?.formatterParams?.labelPosition === 'middle' ? 'selected' : ''}>Centro</option><option value="above" ${colConfig?.formatterParams?.labelPosition === 'above' ? 'selected' : ''}>Acima</option><option value="left" ${colConfig?.formatterParams?.labelPosition === 'left' ? 'selected' : ''}>Esquerda</option><option value="right" ${colConfig?.formatterParams?.labelPosition === 'right' ? 'selected' : ''}>Direita</option></select></div>
                                <div class="progress-internal-container" style="display: ${colConfig?.formatterParams?.progressType === 'circular' ? 'block' : 'none'}; grid-column: span 3; padding: 4px; background: #f1f5f9; border-radius: 4px; margin-top: 5px;"><label style="font-size:9px; cursor: pointer;"><input type="checkbox" class="progress-show-internal" ${colConfig?.formatterParams?.showInternalBar ? 'checked' : ''}> Barra Interna</label><select class="progress-internal-col" style="width: 100%; font-size: 10px; display: ${colConfig?.formatterParams?.showInternalBar ? 'block' : 'none'}; margin-top: 2px;"><option value="">-- Coluna Interna --</option>${_allCols.filter(c => ['Numeric', 'Int', 'Any'].includes(c.type)).map(c => `<option value="${c.colId}" ${colConfig?.formatterParams?.internalBarColId === c.colId ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div>
                                <div><label style="font-size:9px;">Min</label><input type="number" class="progress-min" value="${colConfig?.formatterParams?.min ?? 0}" style="width:100%; font-size:10px;"></div>
                                <div><label style="font-size:9px;">Max</label><input type="number" class="progress-max" value="${colConfig?.formatterParams?.max ?? 100}" style="width:100%; font-size:10px;"></div>
                                <div><label style="font-size:9px;">Cor Barra</label><input type="color" class="progress-color" value="${colConfig?.formatterParams?.mainColor ?? '#4caf50'}" style="width:100%; height:20px; padding:0;"></div>
                                <div><label style="font-size:9px;">Cor Fundo</label><input type="color" class="progress-bgcolor" value="${colConfig?.formatterParams?.bgColor ?? '#e0e0e0'}" style="width:100%; height:20px; padding:0;"></div>
                                <div><label style="font-size:9px;">Raio (px)</label><input type="number" class="progress-radius" value="${colConfig?.formatterParams?.borderRadius ?? 4}" style="width:100%; font-size:10px;"></div>
                                <div><label style="font-size:9px;">Modo Cor</label><select class="progress-mode" style="width:100%; font-size:10px;"><option value="solid" ${colConfig?.formatterParams?.colorMode === 'solid' ? 'selected' : ''}>Sólido</option><option value="dynamic-gradient" ${colConfig?.formatterParams?.colorMode === 'dynamic-gradient' ? 'selected' : ''}>Dinâmico</option></select></div>
                                <div style="display: flex; align-items: center; gap: 4px; margin-top: 10px; grid-column: span 1.5;"><label style="font-size:9px; cursor: pointer; display: flex; align-items: center; gap: 2px;"><input type="checkbox" class="progress-striped" ${colConfig?.formatterParams?.striped ? 'checked' : ''}> Listrado</label></div>
                                <div style="display: flex; align-items: center; gap: 4px; margin-top: 10px; grid-column: span 1.5;"><label style="font-size:9px; cursor: pointer; display: flex; align-items: center; gap: 2px;"><input type="checkbox" class="progress-animated" ${colConfig?.formatterParams?.animated ? 'checked' : ''}> Animado</label></div>
                            </div>
                        </div>
                        <div class="formatter-params money-params" style="display: ${colConfig?.formatter === 'money' ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-top: 5px;">
                            <div><label style="font-size:9px;">Símbolo</label><input type="text" class="money-symbol" value="${colConfig?.formatterParams?.symbol ?? 'R$'}" style="width:100%; font-size:10px;"></div>
                            <div><label style="font-size:9px;">Decimal</label><input type="text" class="money-decimal" value="${colConfig?.formatterParams?.decimal ?? ','}" style="width:100%; font-size:10px;"></div>
                            <div><label style="font-size:9px;">Milhar</label><input type="text" class="money-thousand" value="${colConfig?.formatterParams?.thousand ?? '.'}" style="width:100%; font-size:10px;"></div>
                        </div>
                        <div class="formatter-params image-params" style="display: ${colConfig?.formatter === 'image' ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-top: 5px;">
                            <div><label style="font-size:9px;">Tam (px)</label><input type="number" class="image-size" value="${colConfig?.formatterParams?.imageSize ?? 50}" style="width:100%; font-size:10px;"></div>
                            <div><label style="font-size:9px;">Fit</label><select class="image-fit" style="width:100%; font-size:10px;"><option value="cover" ${colConfig?.formatterParams?.objectFit === 'cover' ? 'selected' : ''}>Cover</option><option value="contain" ${colConfig?.formatterParams?.objectFit === 'contain' ? 'selected' : ''}>Contain</option></select></div>
                            <div><label style="font-size:9px;">Raio</label><input type="text" class="image-radius" value="${colConfig?.formatterParams?.borderRadius ?? '4px'}" style="width:100%; font-size:10px;"></div>
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
            detailContent.innerHTML = '<div style="color:#64748b; font-style:italic; text-align:center; margin-top:50px; font-size:12px;">Selecione um botão</div>';
            return;
        }
        _customButtons.forEach((btn, idx) => {
            const item = document.createElement('div');
            item.style.cssText = `display:flex; align-items:center; padding:8px 10px; border-bottom:1px solid #e2e8f0; cursor:pointer; font-size:11px; justify-content:space-between; ${idx === _activeButtonIdx ? 'background:#e0f2fe; font-weight:bold;' : 'background:#fff;'}`;
            item.innerHTML = `<div style="display:flex; align-items:center; flex:1;">${btn.icon ? `<svg style="width:14px; height:14px; margin-right:6px; fill:currentColor;"><use href="#${btn.icon}"></use></svg>` : ''}<span>${btn.text || 'Botão ' + (idx + 1)}</span></div><button type="button" class="btn-delete" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button>`;
            item.onclick = (e) => { if (!e.target.classList.contains('btn-delete')) { _activeButtonIdx = idx; renderActionsLayout(); } };
            item.querySelector('.btn-delete').onclick = () => { _customButtons.splice(idx, 1); if (_activeButtonIdx === idx) _activeButtonIdx = -1; renderActionsLayout(); updateDebugJson(); };
            listContent.appendChild(item);
        });
        if (_activeButtonIdx >= 0) renderButtonConfigDetail(detailContent, _customButtons[_activeButtonIdx]);
    }

    async function renderButtonConfigDetail(container, btn) {
        const allGristPages = window.currentLens ? (await window.currentLens.listAllTables() || []) : [];
        const allGristColumns = _allCols.map(f => f.colId);
        container.innerHTML = `
            <h4 style="margin-top:0; font-size:13px; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:12px;">Editar Botão</h4>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:2;"><label style="display:block; font-size:11px; font-weight:bold;">Texto</label><input type="text" id="btn-text" value="${btn.text||''}" style="width:100%; padding:4px; font-size:11px;"></div>
                <div style="flex:1;"><label style="display:block; font-size:11px; font-weight:bold;">Cor</label><input type="color" id="btn-color" value="${btn.color||'#2563eb'}" style="width:100%; height:24px; padding:0;"></div>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:1;"><label style="display:block; font-size:11px; font-weight:bold;">Ícone</label><div class="icon-picker-display" style="cursor:pointer; padding:6px; border:1px solid #cbd5e1; display:flex; align-items:center; gap:8px; border-radius:4px; background:#fff; font-size:11px;"><span class="current-icon" style="display:flex;">${btn.icon ? `<svg style="width:16px; height:16px; fill:currentColor;"><use href="#${btn.icon}"></use></svg>` : '...'}</span> <span style="font-weight:bold;">Alterar</span></div></div>
                <div style="flex:1;"><label style="display:block; font-size:11px; font-weight:bold;">Ação</label><select id="btn-action" style="width:100%; padding:4px; font-size:11px;">
                    <option value="navigateToGristPage" ${btn.actionType==='navigateToGristPage'?'selected':''}>Página Grist</option>
                    <option value="openUrlFromColumn" ${btn.actionType==='openUrlFromColumn'?'selected':''}>Abrir URL</option>
                    <option value="updateRecord" ${btn.actionType==='updateRecord'?'selected':''}>Atualizar Campo</option>
                </select></div>
            </div>
            <div id="btn-action-panel"></div>
            <div style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:8px;">
                <label style="font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px;">
                    <input type="checkbox" id="btn-batch-cb" class="act-prop" data-prop="isBatchAction" ${btn.isBatchAction ? 'checked' : ''}> 
                    <strong>Mostrar como Ação em Lote</strong> (para linhas selecionadas)
                </label>
            </div>
        `;
        const actionPanel = container.querySelector('#btn-action-panel');
        
        const bindProperties = () => {
            container.querySelectorAll('.act-prop').forEach(el => {
                el.onchange = (e) => {
                    const prop = e.target.dataset.prop;
                    if (prop) {
                        if (e.target.type === 'checkbox') {
                            btn[prop] = e.target.checked;
                        } else {
                            btn[prop] = e.target.value;
                        }
                        updateDebugJson();
                    }
                };
                el.oninput = (e) => {
                    const prop = e.target.dataset.prop;
                    if (prop && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
                        btn[prop] = e.target.value;
                        updateDebugJson();
                    }
                };
            });
        };

        const updatePanel = () => {
            if (btn.actionType === 'navigateToGristPage') {
                actionPanel.innerHTML = `<div style="margin-bottom:8px;"><label style="display:block; font-size:11px;">Tabela Destino</label><select class="act-prop" data-prop="targetPageId" style="width:100%; padding:4px;">${allGristPages.map(p => `<option value="${p.id}" ${btn.targetPageId===p.id?'selected':''}>${p.name}</option>`).join('')}</select></div>`;
            } else if (btn.actionType === 'updateRecord') {
                actionPanel.innerHTML = `
                    <div style="margin-bottom:8px;">
                        <label style="display:block; font-size:11px;">Coluna a Atualizar</label>
                        <select class="act-prop" data-prop="updateField" style="width:100%; padding:4px;">
                            <option value="">-- Selecione --</option>
                            ${allGristColumns.map(col => `<option value="${col}" ${btn.updateField===col?'selected':''}>${col}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom:8px;">
                        <label style="display:block; font-size:11px;">Novo Valor</label>
                        <input type="text" class="act-prop" data-prop="updateValue" value="${btn.updateValue||''}" style="width:100%; padding:4px; font-size:11px;">
                    </div>
                `;
            } else { actionPanel.innerHTML = ''; }
            bindProperties();
        };
        
        updatePanel();
        container.querySelector('#btn-text').oninput = e => { btn.text = e.target.value; renderActionsLayout(); };
        container.querySelector('#btn-color').onchange = e => { btn.color = e.target.value; updateDebugJson(); };
        container.querySelector('.icon-picker-display').onclick = () => openIconPicker(null, container.querySelector('.current-icon'), btn);
        container.querySelector('#btn-action').onchange = e => { btn.actionType = e.target.value; updatePanel(); updateDebugJson(); };
    }

    function openIconPicker(inputElement, displayElement, buttonConfig) {
        if (_iconPickerPopup && _iconPickerPopup.parentNode) { _iconPickerPopup.parentNode.removeChild(_iconPickerPopup); }
        _iconPickerPopup = document.createElement("div"); _iconPickerPopup.className = 'icon-picker-popup'; 
        _iconPickerPopup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1080; padding: 15px; background: white; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 600px; max-height: 500px; overflow-y: auto; border-radius: 5px;`;
        
        _iconPickerPopup.innerHTML = `
            <style>
                .picker-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; position: sticky; top: 0; background: white; z-index: 1; padding-bottom: 10px; border-bottom: 1px solid #eee; }
                .icon-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; } 
                .icon-option { width: 75px; height: 75px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #eee; border-radius: 4px; cursor: pointer; transition: all 0.2s; color: #000; padding: 5px; overflow: hidden; } 
                .icon-option:hover { background: #e6f7ff; border-color: #1890ff; transform: scale(1.05); } 
                .icon-option svg { width: 24px; height: 24px; flex-shrink: 0; fill: currentColor; stroke: currentColor; stroke-width: 0.5px; } 
                .icon-id-label { font-size: 8px; margin-top: 5px; text-align: center; word-break: break-all; color: #666; max-height: 24px; overflow: hidden; }
                #picker-search { padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; flex-grow: 1; margin-right: 15px; }
            </style>
            <div class="picker-header">
                <h4 style="margin: 0; white-space: nowrap; margin-right: 15px;">Pick Icon</h4>
                <input type="text" id="picker-search" placeholder="Search icons...">
                <div id="picker-count" style="font-size: 11px; font-weight: bold; background: #eee; padding: 2px 8px; border-radius: 10px; white-space: nowrap;">${AVAILABLE_ICONS.length}</div>
            </div>
            <div class="icon-grid">
                ${AVAILABLE_ICONS.map(id => `<div class="icon-option" data-id="${id}" title="${id}"><svg><use href="#${id}"></use></svg><div class="icon-id-label">${id.replace('icon-', '')}</div></div>`).join('')}
            </div>
            <div style="text-align: right; margin-top: 15px;">
                <button id="icon-picker-cancel" type="button" class="btn btn-secondary">Cancel</button>
            </div>`;
        
        _mainContainer.appendChild(_iconPickerPopup);

        const searchInput = _iconPickerPopup.querySelector('#picker-search');
        const countDisplay = _iconPickerPopup.querySelector('#picker-count');
        const options = _iconPickerPopup.querySelectorAll('.icon-option');

        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            let visibleCount = 0;
            options.forEach(opt => {
                const id = opt.dataset.id.toLowerCase();
                if (id.includes(query)) {
                    opt.style.display = 'flex';
                    visibleCount++;
                } else {
                    opt.style.display = 'none';
                }
            });
            countDisplay.innerText = visibleCount;
        });

        options.forEach(iconEl => { 
            iconEl.addEventListener('click', () => { 
                const selectedIcon = iconEl.dataset.id; 
                buttonConfig.icon = selectedIcon; 
                if(inputElement) inputElement.value = selectedIcon; 
                if(displayElement) displayElement.innerHTML = `<svg class="icon" style="width:20px; height:20px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${selectedIcon}"></use></svg>`; 
                _iconPickerPopup.remove(); 
                _iconPickerPopup = null; 
                if (typeof renderActionsLayout === 'function') renderActionsLayout();
                updateDebugJson(); 
            }); 
        });

        _iconPickerPopup.querySelector('#icon-picker-cancel').addEventListener('click', () => { 
            _iconPickerPopup.remove(); 
            _iconPickerPopup = null; 
        });
    }

    function getFieldCategory(type) { if (!type) return 'text'; const t = type.toLowerCase(); if (t === 'bool') return 'bool'; if (['int', 'float', 'numeric'].some(x => t.startsWith(x))) return 'number'; if (t.startsWith('date')) return 'date'; return 'text'; }
    function updateDebugJson() { } // Placeholder

    return { render, read };
})();
window.TableConfigEditor = TableConfigEditor;
