
export const TableConfigEditor = (() => {
    let currentSchema = null;
    let currentTableId = null;
    let _mainContainer = null;

    async function render(container, configData, lens, tableId) {
        _mainContainer = container;
        currentTableId = tableId;
        if (!tableId) {
            container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>';
            return;
        }
        currentSchema = await lens.getTableSchema(tableId);
        if (!currentSchema) {
            container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>';
            return;
        }

        const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        const visibleColumns = configData.columns || allCols.map(c => ({ colId: c.colId, width: null, align: 'left' }));
        const visibleColIds = new Set(visibleColumns.map(c => c.colId));

        // Fetch all Drawer type configurations
        const allConfigs = await lens.fetchTableRecords('Grf_config');
        console.log("Table Editor - allConfigs:", allConfigs);
        const drawerConfigs = allConfigs.filter(cfg => cfg.componentType === 'Drawer');
        console.log("Table Editor - drawerConfigs:", drawerConfigs);

        container.innerHTML = `
            <div class="config-section-title">Opções Globais da Tabela</div>
            <div class="form-group">
                <label class="config-toggle">
                    <input type="checkbox" id="striped-table-checkbox" ${configData.stripedTable ? 'checked' : ''}>
                    Tabela Zebrada
                </label>
            </div>
            <div class="form-group">
                <label class="config-toggle">
                    <input type="checkbox" id="enable-column-calcs-checkbox" ${configData.enableColumnCalcs ? 'checked' : ''}>
                    Habilitar Cálculos de Coluna
                </label>
            </div>
            <div class="config-section-title" style="margin-top: 20px;">Modo de Edição</div>
            <div class="form-group">
                <label>
                    <input type="radio" name="editMode" value="excel" ${configData.editMode === 'excel' ? 'checked' : ''}> Excel Style (Edição Inline)
                </label>
                <label>
                    <input type="radio" name="editMode" value="drawer" ${configData.editMode === 'drawer' ? 'checked' : ''}> Drawer Style (Edição por Formulário)
                </label>
            </div>
            <div class="form-group">
                <label for="drawer-id-select">ID do Drawer (para Modo Drawer)</label>
                <select id="drawer-id-select">
                    <option value="">-- Selecione um Drawer --</option>
                    ${drawerConfigs.map(d => `<option value="${d.configId}" ${configData.drawerId === d.configId ? 'selected' : ''}>${d.name || d.configId || '[Drawer Sem ID]'}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="config-toggle">
                    <input type="checkbox" id="enable-add-new-btn-checkbox" ${configData.enableAddNewBtn ? 'checked' : ''}>
                    Habilitar Botão 'Adicionar Novo'
                </label>
            </div>
            <div class="config-section-title" style="margin-top: 20px;">Colunas Visíveis e Ordem</div>
            <p class="editor-instructions">Arraste e solte as colunas para reordenar. Use os botões para selecionar/deselecionar todas.</p>
            <div class="column-bulk-actions">
                <button type="button" id="select-all-cols-btn" class="btn btn-secondary btn-sm">Selecionar Todas</button>
                <button type="button" id="deselect-all-cols-btn" class="btn btn-secondary btn-sm">Deselecionar Todas</button>
            </div>
            <ul id="column-list" class="field-order-list"></ul>
            <div class="config-section-title" style="margin-top: 20px;">Colunas Disponíveis</div>
            <ul id="available-column-list" class="field-order-list"></ul>
        `;

        const columnListEl = container.querySelector('#column-list');
        const availableColumnListEl = container.querySelector('#available-column-list');

        // Render visible columns
        for (const colConfig of visibleColumns) {
            const col = allCols.find(c => c.colId === colConfig.colId);
            if (col) {
                columnListEl.appendChild(createColumnCard(col, colConfig));
            }
        }

        // Render available (hidden) columns
        for (const col of allCols) {
            if (!visibleColIds.has(col.colId)) {
                availableColumnListEl.appendChild(createColumnCard(col, null));
            }
        }

        container.querySelector('#select-all-cols-btn').addEventListener('click', () => {
            const allCards = Array.from(availableColumnListEl.querySelectorAll('.field-card'));
            allCards.forEach(card => {
                columnListEl.appendChild(card);
                card.querySelector('.is-visible-checkbox').checked = true;
            });
        });

        container.querySelector('#deselect-all-cols-btn').addEventListener('click', () => {
            const allCards = Array.from(columnListEl.querySelectorAll('.field-card'));
            allCards.forEach(card => {
                availableColumnListEl.appendChild(card);
                card.querySelector('.is-visible-checkbox').checked = false;
            });
        });

        enableDragAndDrop([columnListEl, availableColumnListEl]);
    }

    function read(container) {
        if (!currentSchema) return {};

        const columnListEl = container.querySelector('#column-list');
        const visibleItems = Array.from(columnListEl.querySelectorAll('.field-card'));

        const config = {
            tableId: currentTableId,
            stripedTable: container.querySelector('#striped-table-checkbox').checked,
            enableColumnCalcs: container.querySelector('#enable-column-calcs-checkbox').checked,
            editMode: container.querySelector('input[name="editMode"]:checked')?.value || 'excel', // Default to excel
            drawerId: container.querySelector('#drawer-id-select').value || null,
            enableAddNewBtn: container.querySelector('#enable-add-new-btn-checkbox').checked,
            columns: visibleItems.map(item => {
                const formatter = item.querySelector('.col-formatter-select').value || null;
                let formatterParams = {};
                if (formatter) {
                    item.querySelectorAll('.col-formatter-params .formatter-param-input').forEach(input => {
                        formatterParams[input.dataset.paramKey] = input.value;
                    });
                    item.querySelectorAll('.col-formatter-params .formatter-param-checkbox').forEach(checkbox => {
                        formatterParams[checkbox.dataset.paramKey] = checkbox.checked;
                    });
                }

                return {
                    colId: item.dataset.colId,
                    width: item.querySelector('.col-width-input').value || null,
                    align: item.querySelector('.col-align-select').value,
                    bottomCalc: item.querySelector('.col-calc-select').value || null,
                    locked: item.querySelector('.is-locked-checkbox').checked,
                    required: item.querySelector('.is-required-checkbox').checked,
                    formatter: formatter,
                    formatterParams: Object.keys(formatterParams).length > 0 ? formatterParams : null,
                    ignoreConditionalFormatting: item.querySelector('.ignore-conditional-formatting-checkbox').checked,
                    ignoreHeaderStyle: item.querySelector('.ignore-header-style-checkbox').checked,
                    ignoreCellStyle: item.querySelector('.ignore-cell-style-checkbox').checked,
                };
            }),
        };

        console.log("Table Editor - reading config:", config);
        return config;
    }

    function createColumnCard(col, colConfig) {
        const card = document.createElement('li');
        card.className = 'field-card';
        card.dataset.colId = col.colId;
        card.draggable = true;

        const isVisible = !!colConfig;
        const width = colConfig?.width || '';
        const align = colConfig?.align || 'left';

        card.innerHTML = `
            <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span>
            <div class="field-card-controls">
                <label class="config-toggle">
                    <input type="checkbox" class="is-visible-checkbox" ${isVisible ? 'checked' : ''}>
                    Visível
                </label>
                <button type="button" class="btn btn-secondary btn-sm toggle-col-config">Opções</button>
            </div>
            <div class="col-config-panel" style="display: none;">
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" class="is-locked-checkbox" ${colConfig?.locked ? 'checked' : ''}>
                        Travado (Não Editável)
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" class="is-required-checkbox" ${colConfig?.required ? 'checked' : ''}>
                        Obrigatório (Apenas Excel Style)
                    </label>
                </div>
                <div class="form-group">
                    <label for="col-width-${col.colId}">Largura</label>
                    <input type="text" id="col-width-${col.colId}" class="col-width-input" value="${width}" placeholder="auto">
                </div>
                <div class="form-group">
                    <label for="col-align-${col.colId}">Alinhamento</label>
                    <select id="col-align-${col.colId}" class="col-align-select">
                        <option value="left" ${align === 'left' ? 'selected' : ''}>Esquerda</option>
                        <option value="center" ${align === 'center' ? 'selected' : ''}>Centro</option>
                        <option value="right" ${align === 'right' ? 'selected' : ''}>Direita</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="col-calc-${col.colId}">Cálculo da Coluna</label>
                    <select id="col-calc-${col.colId}" class="col-calc-select">
                        <option value="">Nenhum</option>
                        <option value="sum" ${colConfig?.bottomCalc === 'sum' ? 'selected' : ''}>Soma</option>
                        <option value="avg" ${colConfig?.bottomCalc === 'avg' ? 'selected' : ''}>Média</option>
                        <option value="min" ${colConfig?.bottomCalc === 'min' ? 'selected' : ''}>Mínimo</option>
                        <option value="max" ${colConfig?.bottomCalc === 'max' ? 'selected' : ''}>Máximo</option>
                        <option value="count" ${colConfig?.bottomCalc === 'count' ? 'selected' : ''}>Contagem</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="col-formatter-${col.colId}">Formato da Célula</label>
                    <select id="col-formatter-${col.colId}" class="col-formatter-select">
                        <option value="">Padrão</option>
                        <option value="money" ${colConfig?.formatter === 'money' ? 'selected' : ''}>Moeda</option>
                        <option value="link" ${colConfig?.formatter === 'link' ? 'selected' : ''}>Link</option>
                        <option value="datetime" ${colConfig?.formatter === 'datetime' ? 'selected' : ''}>Data/Hora</option>
                        <option value="tickCross" ${colConfig?.formatter === 'tickCross' ? 'selected' : ''}>Tick/Cruz</option>
                        <option value="image" ${colConfig?.formatter === 'image' ? 'selected' : ''}>Imagem</option>
                        <option value="progress" ${colConfig?.formatter === 'progress' ? 'selected' : ''}>Progresso</option>
                    </select>
                </div>
                <div id="col-formatter-params-${col.colId}" class="col-formatter-params" style="display: none;">
                    <!-- Dynamic formatter params will be loaded here -->
                </div>
                <div class="config-section-title" style="margin-top: 20px;">Grist Styling Overrides</div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" class="ignore-conditional-formatting-checkbox" ${colConfig?.ignoreConditionalFormatting ? 'checked' : ''}>
                        Ignorar Formatação Condicional
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" class="ignore-header-style-checkbox" ${colConfig?.ignoreHeaderStyle ? 'checked' : ''}>
                        Ignorar Estilo do Cabeçalho
                    </label>
                </div>
                <div class="form-group">
                    <label class="config-toggle">
                        <input type="checkbox" class="ignore-cell-style-checkbox" ${colConfig?.ignoreCellStyle ? 'checked' : ''}>
                        Ignorar Estilo da Célula
                    </label>
                </div>
            </div>
        `;

        const formatterSelect = card.querySelector('.col-formatter-select');
        const formatterParamsContainer = card.querySelector('.col-formatter-params');

        const updateFormatterParamsUI = () => {
            const selectedFormatter = formatterSelect.value;
            formatterParamsContainer.innerHTML = '';
            formatterParamsContainer.style.display = 'none';

            if (selectedFormatter === 'money') {
                formatterParamsContainer.style.display = 'block';
                const symbol = colConfig?.formatterParams?.symbol || '';
                const decimal = colConfig?.formatterParams?.decimal || '.';
                const thousand = colConfig?.formatterParams?.thousand || ',';
                formatterParamsContainer.innerHTML = `
                    <div class="form-group">
                        <label for="money-symbol-${col.colId}">Símbolo</label>
                        <input type="text" id="money-symbol-${col.colId}" class="formatter-param-input" data-param-key="symbol" value="${symbol}">
                    </div>
                    <div class="form-group">
                        <label for="money-decimal-${col.colId}">Separador Decimal</label>
                        <input type="text" id="money-decimal-${col.colId}" class="formatter-param-input" data-param-key="decimal" value="${decimal}">
                    </div>
                    <div class="form-group">
                        <label for="money-thousand-${col.colId}">Separador Milhar</label>
                        <input type="text" id="money-thousand-${col.colId}" class="formatter-param-input" data-param-key="thousand" value="${thousand}">
                    </div>
                `;
            } else if (selectedFormatter === 'progress') {
                formatterParamsContainer.style.display = 'block';
                const min = colConfig?.formatterParams?.min || 0;
                const max = colConfig?.formatterParams?.max || 100;
                const legend = colConfig?.formatterParams?.legend ? 'checked' : '';
                const legendSuffix = colConfig?.formatterParams?.legendSuffix || '';
                formatterParamsContainer.innerHTML = `
                    <div class="form-group">
                        <label for="progress-min-${col.colId}">Mínimo</label>
                        <input type="number" id="progress-min-${col.colId}" class="formatter-param-input" data-param-key="min" value="${min}">
                    </div>
                    <div class="form-group">
                        <label for="progress-max-${col.colId}">Máximo</label>
                        <input type="number" id="progress-max-${col.colId}" class="formatter-param-input" data-param-key="max" value="${max}">
                    </div>
                    <div class="form-group">
                        <label class="config-toggle">
                            <input type="checkbox" id="progress-legend-${col.colId}" class="formatter-param-checkbox" data-param-key="legend" ${legend}>
                            Mostrar Valor Numérico
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="progress-suffix-${col.colId}">Sufixo</label>
                        <input type="text" id="progress-suffix-${col.colId}" class="formatter-param-input" data-param-key="legendSuffix" value="${legendSuffix}">
                    </div>
                `;
            } else if (selectedFormatter === 'datetime') {
                formatterParamsContainer.style.display = 'block';
                const inputFormat = colConfig?.formatterParams?.inputFormat || 'YYYY-MM-DD HH:mm:ss';
                const outputFormat = colConfig?.formatterParams?.outputFormat || 'DD/MM/YYYY HH:mm:ss';
                formatterParamsContainer.innerHTML = `
                    <div class="form-group">
                        <label for="datetime-input-${col.colId}">Formato de Entrada</label>
                        <input type="text" id="datetime-input-${col.colId}" class="formatter-param-input" data-param-key="inputFormat" value="${inputFormat}">
                    </div>
                    <div class="form-group">
                        <label for="datetime-output-${col.colId}">Formato de Saída</label>
                        <input type="text" id="datetime-output-${col.col.Id}" class="formatter-param-input" data-param-key="outputFormat" value="${outputFormat}">
                    </div>
                `;
            }
        };

        formatterSelect.addEventListener('change', updateFormatterParamsUI);
        updateFormatterParamsUI(); // Initial call to set up params based on current config

        card.querySelector('.is-visible-checkbox').addEventListener('change', (e) => {
            const targetList = e.target.checked ? _mainContainer.querySelector('#column-list') : _mainContainer.querySelector('#available-column-list');
            targetList.appendChild(card);
        });

        card.querySelector('.toggle-col-config').addEventListener('click', (e) => {
            const panel = card.querySelector('.col-config-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        return card;
    }

    function enableDragAndDrop(lists) {
        let draggedItem = null;

        lists.forEach(list => {
            list.addEventListener('dragstart', e => {
                draggedItem = e.target.closest('li');
                if (draggedItem) {
                    setTimeout(() => draggedItem.classList.add('dragging'), 0);
                }
            });

            list.addEventListener('dragend', () => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                }
            });

            list.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(list, e.clientY);
                if (draggedItem && list.contains(draggedItem)) { // Allow reordering within the same list
                     if (afterElement == null) {
                        list.appendChild(draggedItem);
                    } else {
                        list.insertBefore(draggedItem, afterElement);
                    }
                } else if (draggedItem && !list.contains(draggedItem)) { // Allow moving between lists
                    if (afterElement == null) {
                        list.appendChild(draggedItem);
                    } else {
                        list.insertBefore(draggedItem, afterElement);
                    }
                    // Update checkbox state when moving between lists
                    const checkbox = draggedItem.querySelector('.is-visible-checkbox');
                    if (checkbox) {
                        checkbox.checked = list.id === 'column-list';
                    }
                }
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    return { render, read };
})();
window.TableConfigEditor = TableConfigEditor;
