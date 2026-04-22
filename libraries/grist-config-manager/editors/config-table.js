
export const TableConfigEditor = (() => {
    let currentSchema = null;
    let currentTableId = null;
    let _mainContainer = null;
    let _allConfigs = [];

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

        const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        const visibleColumns = mapping.columns || allCols.map(c => ({ colId: c.colId, width: null, align: 'left' }));
        const visibleColIds = new Set(visibleColumns.map(c => c.colId));

        // Filter and format Drawer configs for the dropdown
        const drawerConfigs = _allConfigs.filter(cfg => (cfg.componentType || '').replace(/\s+/g, '').toLowerCase() === 'drawer');
        const drawerOptionsHtml = drawerConfigs.map(d => {
            const unified = lens.parseConfigRecord(d);
            const tableDisplay = unified.tableId ? ` (${unified.tableId})` : '';
            return `<option value="${d.configId}" ${actions.drawerId === d.configId ? 'selected' : ''}>${d.widgetTitle}${tableDisplay} [${d.configId}]</option>`;
        }).join('');

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
                    <label><input type="radio" name="editMode" value="excel" ${actions.editMode === 'excel' ? 'checked' : ''}> Excel Style (Edição Inline)</label>
                    
                    <div id="excel-options" style="display: ${actions.editMode === 'excel' ? 'block' : 'none'}; margin-left: 25px; border-left: 2px solid #ddd; padding-left: 10px; margin-top: 5px; margin-bottom: 10px;">
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
        container.addEventListener('change', updateDebugJson);
        container.addEventListener('input', updateDebugJson);
        updateDebugJson();
    }

    function read(container) {
        if (!currentSchema) return {};

        const columnListEl = container.querySelector('#column-list');
        const visibleItems = Array.from(columnListEl.querySelectorAll('.field-card'));

        const fullConfig = {
            tableId: currentTableId,
            stripedTable: container.querySelector('#striped-table-checkbox').checked,
            enableColumnCalcs: container.querySelector('#enable-column-calcs-checkbox').checked,
            editMode: container.querySelector('input[name="editMode"]:checked')?.value || 'excel',
            useSaveButton: container.querySelector('#use-save-button-checkbox')?.checked || false,
            drawerId: container.querySelector('#drawer-id-select').value || null,
            enableAddNewBtn: container.querySelector('#enable-add-new-btn-checkbox').checked,
            layout: container.querySelector('#layout-mode-select').value,
            resizableColumns: container.querySelector('#resizable-columns-checkbox').checked,
            headerFilter: container.querySelector('#header-filter-checkbox').checked,
            pagination: {
                enabled: container.querySelector('#pagination-mode-select').value === 'false' ? false : container.querySelector('#pagination-mode-select').value,
                pageSize: parseInt(container.querySelector('#pagination-size-input').value, 10) || 10,
            },
            columns: visibleItems.map(item => {
                const formatter = item.querySelector('.col-formatter-select').value || null;
                return {
                    colId: item.dataset.colId,
                    width: item.querySelector('.col-width-input').value || null,
                    align: item.querySelector('.col-align-select').value,
                    wrapText: item.querySelector('.wrap-text-checkbox').checked,
                    maxTextRows: parseInt(item.querySelector('.max-text-rows-input').value, 10) || null,
                    bottomCalc: item.querySelector('.col-calc-select').value || null,
                    locked: item.querySelector('.is-locked-checkbox').checked,
                    required: item.querySelector('.is-required-checkbox').checked,
                    formatter: formatter,
                    ignoreConditionalFormatting: item.querySelector('.ignore-conditional-formatting-checkbox').checked,
                };
            }),
        };

        return {
            mapping: { tableId: fullConfig.tableId, columns: fullConfig.columns },
            styling: { stripedTable: fullConfig.stripedTable, layout: fullConfig.layout, resizableColumns: fullConfig.resizableColumns, headerFilter: fullConfig.headerFilter, pagination: fullConfig.pagination },
            actions: { enableColumnCalcs: fullConfig.enableColumnCalcs, editMode: fullConfig.editMode, useSaveButton: fullConfig.useSaveButton, drawerId: fullConfig.drawerId, enableAddNewBtn: fullConfig.enableAddNewBtn }
        };
    }

    function createColumnCard(col, colConfig) {
        const card = document.createElement('li');
        card.className = 'field-card';
        card.dataset.colId = col.colId;
        card.draggable = true;

        const isVisible = !!colConfig;
        const align = colConfig?.align || 'left';

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
                
                <div class="col-config-grid">
                    <div class="col-config-section">
                        <div class="config-label-with-help">Regras</div>
                        <label title="Impede a edição deste campo na tabela."><input type="checkbox" class="is-locked-checkbox" ${colConfig?.locked ? 'checked' : ''}> Travado <span class="help-tip">?</span></label>
                        <label title="Exige que o campo seja preenchido no modo de edição inline."><input type="checkbox" class="is-required-checkbox" ${colConfig?.required ? 'checked' : ''}> Obrigatório <span class="help-tip">?</span></label>
                        <label title="Ignora as regras de cores de formatação condicional que vêm do Grist."><input type="checkbox" class="ignore-conditional-formatting-checkbox" ${colConfig?.ignoreConditionalFormatting ? 'checked' : ''}> S/ Format. Condic. <span class="help-tip">?</span></label>
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
                                    <option value="">Padrão</option>
                                    <option value="money" ${colConfig?.formatter === 'money' ? 'selected' : ''}>Moeda</option>
                                    <option value="progress" ${colConfig?.formatter === 'progress' ? 'selected' : ''}>Progresso</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.toggle-col-config').onclick = () => {
            const p = card.querySelector('.col-config-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        };

        card.querySelector('.is-visible-checkbox').onchange = (e) => {
            const targetList = e.target.checked ? _mainContainer.querySelector('#column-list') : _mainContainer.querySelector('#available-column-list');
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
                if (draggedItem) draggedItem.querySelector('.is-visible-checkbox').checked = (list.id === 'column-list');
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

    return { render, read };
})();
window.TableConfigEditor = TableConfigEditor;
