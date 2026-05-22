// libraries/grist-table-renderer/TableRenderer.js
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

export const TableRenderer = (() => {

    let tabulatorTable = null;

    /**
     * Renders a Tabulator table inside the container using the provided data and configuration.
     */
    async function renderTable(options) {
        const {
            container,
            records,
            config,
            tableLens,
            onRowClick,
            onAddRecord
        } = options;

        // Tripartite configuration structure support
        const mapping = config.mapping || config || {};
        const styling = config.styling || config || {};
        const actions = config.actions || config || {};

        const tableId = mapping.tableId || config.tableId;
        const schema = await tableLens.getTableSchema(tableId);
        const useSaveButton = actions.useSaveButton || false;
        const customButtons = actions.customButtons || [];
        
        let pendingChanges = {}; // Objeto para rastrear mudanças { rowId: { field: value } }

        // --- UI DO BOTÃO SALVAR ---
        let actionBar = null;
        function updateActionBar() {
            if (!useSaveButton) return;
            const hasChanges = Object.keys(pendingChanges).length > 0;
            
            if (hasChanges && !actionBar) {
                actionBar = document.createElement('div');
                actionBar.className = 'table-action-bar';
                actionBar.style.cssText = "position:sticky; top:0; background:#fff; border-bottom:2px solid #3b82f6; padding:10px; display:flex; justify-content:center; gap:15px; z-index:100; box-shadow:0 2px 5px rgba(0,0,0,0.1);";
                actionBar.innerHTML = `
                    <span style="font-weight:700; color:#1e293b; display:flex; align-items:center;">Alterações Pendentes</span>
                    <button id="batch-save-btn" style="padding:6px 16px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:700;">SALVAR TUDO</button>
                    <button id="batch-cancel-btn" style="padding:6px 16px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:700;">DESCARTAR</button>
                `;
                container.prepend(actionBar);

                actionBar.querySelector('#batch-save-btn').onclick = async () => {
                    actionBar.innerHTML = 'Salvando...';
                    try {
                        for (const rowId in pendingChanges) {
                            await tableLens.updateRecord(tableId, rowId, pendingChanges[rowId]);
                        }
                        pendingChanges = {};
                        updateActionBar();
                        // Re-renderiza para limpar cores de "dirty"
                        renderTable(options); 
                    } catch (e) {
                        alert("Erro ao salvar: " + e.message);
                        updateActionBar();
                    }
                };

                actionBar.querySelector('#batch-cancel-btn').onclick = () => {
                    if (confirm("Descartar todas as alterações não salvas?")) {
                        pendingChanges = {};
                        renderTable(options);
                    }
                };
            } else if (!hasChanges && actionBar) {
                actionBar.remove();
                actionBar = null;
            }
        }

        // Custom Tabulator formatter for Grist-specific cell rendering
        const gristCellFormatter = (cell, formatterParams, onRendered) => {
            const colId = cell.getField();
            const row = cell.getRow();
            const record = row.getData();
            const colSchema = schema[colId];
            const colConfig = formatterParams.colConfig;

            if (!colSchema) return String(cell.getValue() ?? '');

            const cellValue = cell.getValue();

            // --- Bool Formatter: Switch ---
            if (colConfig && colConfig.formatter === 'switch') {
                const switchLabel = document.createElement('label');
                switchLabel.className = 'grf-switch';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = !!cellValue;
                
                switchLabel.onclick = (e) => e.stopPropagation();
                
                checkbox.onchange = async (e) => {
                    e.stopPropagation();
                    const val = checkbox.checked;
                    try {
                        await tableLens.updateRecord(tableId, record.id, { [colId]: val });
                    } catch (err) {
                        checkbox.checked = !val;
                        alert("Erro ao salvar: " + err.message);
                    }
                };
                
                const slider = document.createElement('span');
                slider.className = 'grf-slider';
                switchLabel.appendChild(checkbox);
                switchLabel.appendChild(slider);
                return switchLabel;
            }
            
            // --- Bool Formatter: yesno ---
            if (colConfig && colConfig.formatter === 'yesno') {
                const span = document.createElement('span');
                span.className = 'grf-yesno-text';
                span.innerText = cellValue ? 'Sim' : 'Não';
                return span;
            }
            
            // --- Bool Formatter: dot ---
            if (colConfig && colConfig.formatter === 'dot') {
                const badge = document.createElement('span');
                badge.className = `status-dot-badge ${cellValue ? 'active' : 'inactive'}`;
                
                const indicator = document.createElement('span');
                indicator.className = 'status-dot-indicator';
                
                badge.appendChild(indicator);
                badge.appendChild(document.createTextNode(cellValue ? 'Sim' : 'Não'));
                return badge;
            }
            
            // --- Text Formatter: badge ---
            if (colConfig && colConfig.formatter === 'badge') {
                if (cellValue === null || cellValue === undefined || cellValue === '') return '';
                
                function getHslColor(text) {
                    let hash = 0;
                    const str = String(text || '');
                    for (let i = 0; i < str.length; i++) {
                        hash = str.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const h = Math.abs(hash) % 360;
                    return {
                        bg: `hsl(${h}, 70%, 92%)`,
                        text: `hsl(${h}, 80%, 25%)`,
                        border: `hsl(${h}, 70%, 82%)`
                    };
                }
                
                const items = Array.isArray(cellValue) ? cellValue.filter(x => x !== 'L') : [cellValue];
                const badgeContainer = document.createElement('div');
                badgeContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; align-items:center;';
                items.forEach(item => {
                    const colors = getHslColor(item);
                    const span = document.createElement('span');
                    span.className = 'grf-badge-pill';
                    span.style.backgroundColor = colors.bg;
                    span.style.color = colors.text;
                    span.style.border = `1px solid ${colors.border}`;
                    span.innerText = String(item);
                    badgeContainer.appendChild(span);
                });
                return badgeContainer;
            }
            
            // --- Text Formatter: avatar ---
            if (colConfig && colConfig.formatter === 'avatar') {
                if (cellValue === null || cellValue === undefined || cellValue === '') return '';
                const nameStr = String(cellValue).trim();
                const parts = nameStr.split(/\s+/);
                let initials = '';
                if (parts.length > 0 && parts[0]) {
                    initials += parts[0][0].toUpperCase();
                    if (parts.length > 1 && parts[parts.length - 1]) {
                        initials += parts[parts.length - 1][0].toUpperCase();
                    }
                }
                if (!initials) initials = '?';
                
                function getHslColor(text) {
                    let hash = 0;
                    const str = String(text || '');
                    for (let i = 0; i < str.length; i++) {
                        hash = str.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const h = Math.abs(hash) % 360;
                    return `hsl(${h}, 60%, 40%)`;
                }
                
                const avatar = document.createElement('div');
                avatar.className = 'grf-avatar-circle';
                avatar.style.backgroundColor = getHslColor(nameStr);
                avatar.style.color = '#ffffff';
                avatar.innerText = initials;
                avatar.title = nameStr;
                return avatar;
            }
            
            // --- Number Formatter: sparkline ---
            if (colConfig && colConfig.formatter === 'sparkline') {
                const mainColor = colConfig.formatterParams?.mainColor || '#10b981';
                let values = [];
                if (Array.isArray(cellValue)) {
                    values = cellValue.map(Number).filter(n => !isNaN(n));
                } else if (typeof cellValue === 'string') {
                    values = cellValue.split(/[\s,;]+/).map(Number).filter(n => !isNaN(n));
                } else if (typeof cellValue === 'number') {
                    values = [cellValue];
                }
                
                if (values.length <= 1) {
                    const span = document.createElement('span');
                    span.className = 'sparkline-placeholder';
                    span.style.color = '#94a3b8';
                    span.innerText = cellValue ?? '';
                    return span;
                }
                
                const width = 100;
                const height = 24;
                const padding = 2;
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                
                const points = values.map((val, idx) => {
                    const x = padding + (idx / (values.length - 1)) * (width - 2 * padding);
                    const y = (height - padding) - ((val - min) / range) * (height - 2 * padding);
                    return `${x},${y}`;
                });
                
                const pathData = `M ${points.join(' L ')}`;
                
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                svg.setAttribute('preserveAspectRatio', 'none');
                svg.style.cssText = 'overflow: visible; display: block; max-width: 120px;';
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', mainColor);
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                
                svg.appendChild(path);
                
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const gradId = `spark-grad-${Math.random().toString(36).substr(2, 9)}`;
                const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                linearGradient.setAttribute('id', gradId);
                linearGradient.setAttribute('x1', '0');
                linearGradient.setAttribute('y1', '0');
                linearGradient.setAttribute('x2', '0');
                linearGradient.setAttribute('y2', '1');
                
                const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop1.setAttribute('offset', '0%');
                stop1.setAttribute('stop-color', mainColor);
                stop1.setAttribute('stop-opacity', '0.25');
                
                const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop2.setAttribute('offset', '100%');
                stop2.setAttribute('stop-color', mainColor);
                stop2.setAttribute('stop-opacity', '0');
                
                linearGradient.appendChild(stop1);
                linearGradient.appendChild(stop2);
                defs.appendChild(linearGradient);
                svg.appendChild(defs);
                
                const areaPathData = `${pathData} L ${points[points.length - 1].split(',')[0]},${height} L ${points[0].split(',')[0]},${height} Z`;
                const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                areaPath.setAttribute('d', areaPathData);
                areaPath.setAttribute('fill', `url(#${gradId})`);
                svg.insertBefore(areaPath, path);
                
                const wrapper = document.createElement('div');
                wrapper.className = 'grf-sparkline-wrapper';
                wrapper.appendChild(svg);
                return wrapper;
            }

            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'width: 100%;';
            
            // --- LOGICA DE DIRTY STATE (CELULA MODIFICADA) ---
            if (useSaveButton && pendingChanges[record.id] && pendingChanges[record.id].hasOwnProperty(colId)) {
                cell.getElement().style.background = "#fef9c3"; // Amarelo suave
                cell.getElement().style.fontWeight = "bold";
            }

            // ... (resto dos estilos do formatter original)
            if (colConfig) {
                if (colConfig.wrapText !== false) {
                    tempContainer.style.whiteSpace = 'normal';
                    if (colConfig.maxTextRows > 0) {
                        const lineHeight = 1.4;
                        tempContainer.style.lineHeight = `${lineHeight}em`;
                        tempContainer.style.maxHeight = `${colConfig.maxTextRows * lineHeight}em`;
                        tempContainer.style.overflow = 'hidden';
                        tempContainer.style.display = '-webkit-box';
                        tempContainer.style.webkitLineClamp = colConfig.maxTextRows;
                        tempContainer.style.webkitBoxOrient = 'vertical';
                    }
                } else {
                    tempContainer.style.whiteSpace = 'nowrap';
                    tempContainer.style.overflow = 'hidden';
                    tempContainer.style.textOverflow = 'ellipsis';
                }
            }

            const fieldOptions = {};
            if (colConfig && colConfig.formatter === 'color') {
                fieldOptions.colorPicker = true;
                tempContainer.style.display = 'flex';
                tempContainer.style.alignItems = 'center';
            } else if (colConfig && (colConfig.formatter === 'progress' || colConfig.formatter === 'progressRing')) {
                fieldOptions.progressBar = true;
                const formatterParams = { ...(colConfig.formatterParams || {}) };
                if (colConfig.formatter === 'progressRing') {
                    formatterParams.progressType = 'circular';
                }
                fieldOptions.widgetOptions = formatterParams;
                tempContainer.style.display = 'flex';
                tempContainer.style.alignItems = 'center';
                tempContainer.style.height = '100%';
            } else if (colConfig && colConfig.formatter === 'image') {
                fieldOptions.widget = 'image';
                fieldOptions.widgetOptions = colConfig.formatterParams;
                tempContainer.style.display = 'flex';
                const alignMap = { 'left': 'flex-start', 'right': 'flex-end', 'center': 'center' };
                tempContainer.style.justifyContent = alignMap[colConfig.align] || 'center';
            } else if (colConfig && colConfig.formatter === 'money') {
                fieldOptions.widget = 'money';
                fieldOptions.widgetOptions = colConfig.formatterParams;
            } else if (colConfig && colConfig.formatter === 'dynamicui') {
                fieldOptions.widget = 'dynamicui';
            }

            onRendered(async () => {
                await renderField({
                    container: tempContainer,
                    colSchema: colSchema,
                    record: record,
                    isEditing: false,
                    tableLens: tableLens,
                    styling: {
                        ignoreCellStyle: colConfig?.ignoreCellStyle
                    },
                    fieldStyle: {
                        useGristStyle: !colConfig?.ignoreConditionalFormatting,
                        widgetOptions: colConfig?.formatterParams
                    },
                    fieldOptions: colConfig?.formatterParams,
                    receivedConfigs: config.receivedConfigs
                });
            });

            return tempContainer;
        };

        const columns = (mapping.columns || config.columns || []).map(colConfig => {
            if (colConfig.colId === '_actions') {
                return {
                    title: colConfig.ignoreHeaderStyle ? "Ações" : "⚙️ Ações",
                    field: "_actions",
                    headerSort: false,
                    width: parseInt(colConfig.width, 10) || (80 + customButtons.length * 25),
                    hozAlign: colConfig.align || "center",
                    headerFilter: false,
                    formatter: (cell) => {
                        const div = document.createElement('div');
                        div.style.cssText = 'display:flex; gap:6px; justify-content:center; align-items:center; height:100%;';
                        
                        const record = cell.getData();

                        if (colConfig.showView !== false) {
                            const btn = document.createElement('button');
                            btn.innerHTML = '👁️';
                            btn.title = 'Visualizar';
                            btn.style.cssText = 'border:none; background:none; cursor:pointer; padding:2px; font-size:14px;';
                            btn.onclick = (e) => { e.stopPropagation(); onRowClick(record, 'view'); };
                            div.appendChild(btn);
                        }

                        if (colConfig.showEdit !== false) {
                            const btn = document.createElement('button');
                            btn.innerHTML = '✏️';
                            btn.title = 'Editar';
                            btn.style.cssText = 'border:none; background:none; cursor:pointer; padding:2px; font-size:14px;';
                            btn.onclick = (e) => { e.stopPropagation(); onRowClick(record, 'edit'); };
                            div.appendChild(btn);
                        }

                        if (colConfig.showDelete) {
                            const btn = document.createElement('button');
                            btn.innerHTML = '🗑️';
                            btn.title = 'Excluir';
                            btn.style.cssText = 'border:none; background:none; cursor:pointer; padding:2px; font-size:14px; color:#ef4444;';
                            btn.onclick = async (e) => {
                                e.stopPropagation();
                                if (confirm("Tem certeza que deseja excluir este registro?")) {
                                    try {
                                        await tableLens.deleteRecords(tableId, [record.id]);
                                        cell.getRow().delete();
                                    } catch (err) {
                                        alert("Erro ao excluir: " + err.message);
                                    }
                                }
                            };
                            div.appendChild(btn);
                        }

                        // Custom action buttons from config
                        customButtons.forEach(btnConfig => {
                            const btn = document.createElement('button');
                            btn.className = 'grf-custom-action-btn';
                            btn.title = btnConfig.text || '';
                            btn.style.cssText = `border:none; background:none; cursor:pointer; padding:2px; display:inline-flex; align-items:center; justify-content:center; color:${btnConfig.color || '#3b82f6'};`;
                            
                            // If an icon is selected, render it using SVG referencing the ID in AVAILABLE_ICONS (e.g. icon-link)
                            if (btnConfig.icon) {
                                btn.innerHTML = `<svg style="width:16px; height:16px; fill:currentColor;"><use href="#${btnConfig.icon}"></use></svg>`;
                            } else {
                                btn.innerText = btnConfig.text || 'Btn';
                            }
                            
                            btn.onclick = (e) => {
                                e.stopPropagation();
                                if (btnConfig.actionType === 'moveRecord') return;
                                
                                if (btnConfig.actionType === 'triggerWidget') {
                                    const configIdToPublish = btnConfig.targetConfigId || config.configId;
                                    if (!configIdToPublish) return;
                                    let rowIdsToPublish = [];
                                    let filterValueToPublish = record.id;
                                    
                                    if (btnConfig.sourceRefListColumn) {
                                        const refListValue = record[btnConfig.sourceRefListColumn];
                                        if (Array.isArray(refListValue) && refListValue[0] === 'L') {
                                            rowIdsToPublish = refListValue.slice(1);
                                            filterValueToPublish = rowIdsToPublish;
                                        }
                                    }
                                    
                                    publish('grf-trigger-widget', {
                                        configId: configIdToPublish,
                                        sourceRecord: record,
                                        rowIds: rowIdsToPublish,
                                        filterValue: filterValueToPublish,
                                        componentType: btnConfig.targetComponentType,
                                        filterTargetColumn: btnConfig.filterTargetColumn,
                                        disableFiltering: btnConfig.disableFiltering
                                    });
                                } else {
                                    publish('grf-navigation-action-triggered', {
                                        config: btnConfig,
                                        sourceRecord: record,
                                        tableId: tableId
                                    });
                                }
                            };
                            div.appendChild(btn);
                        });
                        
                        return div;
                    }
                };
            }

            const gristCol = schema[colConfig.colId];
            if (!gristCol) return null;

            let formatter = gristCellFormatter;

            if (gristCol.type.startsWith('RefList:')) {
                const refListFieldConfig = mapping.refListFieldConfig || config.refListFieldConfig || {};
                const refConfig = (refListFieldConfig[colConfig.colId]?._refListConfig) || {};
                
                if (refConfig.displayAs && refConfig.displayAs !== 'none') {
                    formatter = (cell) => {
                        const cellValue = cell.getValue();
                        if (!Array.isArray(cellValue) || cellValue.length <= 1) return '[0 itens]';
                        
                        const button = document.createElement('button');
                        button.className = 'grist-reflist-button';
                        button.style.cssText = 'background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer; font-weight:700; color:#475569;';
                        button.innerText = `📦 ${cellValue.length - 1} itens`;
                        
                        button.onclick = (e) => {
                            e.stopPropagation();
                            const row = cell.getRow();
                            const record = row.getData();
                            if (row.getElement().classList.contains('row-expanded')) {
                                row.getElement().classList.remove('row-expanded');
                                const detail = row.getElement().querySelector('.row-detail-container');
                                if (detail) detail.remove();
                            } else {
                                row.getElement().classList.add('row-expanded');
                                const detail = document.createElement('div');
                                detail.className = 'row-detail-container';
                                detail.style.cssText = 'padding:15px; background:#fff; border-top:1px solid #e2e8f0; border-bottom:2px solid #3b82f6; width:100%; box-sizing:border-box;';
                                
                                const innerContainer = document.createElement('div');
                                detail.appendChild(innerContainer);
                                row.getElement().appendChild(detail);
                                
                                renderField({
                                    container: innerContainer,
                                    colSchema: gristCol,
                                    record: record,
                                    isEditing: false,
                                    tableLens: tableLens,
                                    fieldConfig: refListFieldConfig[colConfig.colId] || {}
                                });
                            }
                        };
                        return button;
                    };
                } else {
                    formatter = (cell) => {
                        const cellValue = cell.getValue();
                        if (!Array.isArray(cellValue) || cellValue.length <= 1) return '';
                        return `[${cellValue.length - 1} itens]`;
                    };
                }
            }

            const isEditable = actions.editMode === 'excel' && !colConfig.locked;
            
            // --- MAPEAMENTO DE EDITORES POR TIPO ---
            let editor = undefined;
            let editorParams = {};

            if (isEditable) {
                const type = gristCol.type;
                if (type === 'Choice') {
                    editor = "list";
                    editorParams = {
                        values: gristCol.widgetOptions?.choices || [],
                        autocomplete: true,
                        allowEmpty: true,
                        listOnEmpty: true
                    };
                } else if (type === 'Bool') {
                    editor = "tickCross";
                } else if (type === 'Numeric' || type === 'Int') {
                    editor = "number";
                } else if (type === 'Date') {
                    editor = "date";
                } else if (type.startsWith('RefList') || type.startsWith('Ref:')) {
                    editor = false; 
                } else {
                    editor = "input";
                }
            }

            return {
                title: gristCol.label || gristCol.colId,
                field: gristCol.colId,
                hozAlign: colConfig.align || 'left',
                headerFilter: styling.headerFilter !== false,
                width: colConfig.width || undefined,
                bottomCalc: actions.enableColumnCalcs ? (colConfig.bottomCalc || undefined) : undefined,
                editable: isEditable,
                editor: editor,
                editorParams: editorParams,
                validator: (actions.editMode === 'excel' && colConfig.required) ? 'required' : undefined,
                formatter: formatter,
                formatterParams: { ...(colConfig.formatterParams || {}), colConfig: colConfig },
                tooltip: true,
                cssClass: colConfig.wrapText ? "wrap-text-cell" : "nowrap-text-cell",
                visible: colConfig.formatter !== 'hidden'
            };
        }).filter(col => col !== null);

        // Clear and rebuild layout container
        container.innerHTML = '';
        const widgetWrapper = document.createElement('div');
        widgetWrapper.className = 'grist-table-widget-container';
        
        // Apply styling settings
        const tableLayoutConfig = styling.tableLayoutConfig || {};
        const theme = tableLayoutConfig.themeStyle || 'glassmorphism';
        widgetWrapper.classList.add(`theme-${theme}`);
        
        const grid = tableLayoutConfig.gridLines || 'horizontal';
        widgetWrapper.classList.add(`grid-${grid}`);
        
        const density = tableLayoutConfig.density || 'comfortable';
        widgetWrapper.classList.add(`density-${density}`);
        
        const header = tableLayoutConfig.headerStyle || 'minimal';
        widgetWrapper.classList.add(`header-${header}`);
        
        const hover = tableLayoutConfig.hoverEffect || 'row-highlight';
        if (hover !== 'none') {
            widgetWrapper.classList.add(`hover-${hover}`);
        }
        
        const striped = tableLayoutConfig.stripedRows !== false;
        if (striped) {
            widgetWrapper.classList.add('striped-rows-enabled');
        }

        // Add top bar containing Group bar & Add New Button
        const topBar = document.createElement('div');
        topBar.className = 'table-top-header-bar';
        topBar.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; width: 100%;';
        
        const groupBar = document.createElement('div');
        groupBar.id = 'table-group-bar';
        groupBar.className = 'table-group-bar';
        groupBar.style.cssText = 'flex-grow: 1; margin-bottom: 0;';
        groupBar.innerHTML = `<span class="group-bar-placeholder">Arraste um cabeçalho de coluna aqui para agrupar</span>`;
        topBar.appendChild(groupBar);
        
        if (actions.enableAddNewBtn) {
            const addBtn = document.createElement('button');
            addBtn.className = 'grf-add-new-btn';
            addBtn.id = 'grf-add-new-btn';
            addBtn.innerText = '+ Adicionar Novo';
            addBtn.onclick = () => {
                if (onAddRecord) onAddRecord();
            };
            topBar.appendChild(addBtn);
        }
        
        widgetWrapper.appendChild(topBar);
        
        const tableEl = document.createElement('div');
        tableEl.className = 'tabulator-table-element';
        tableEl.style.cssText = 'height: calc(100% - 56px); width: 100%;';
        widgetWrapper.appendChild(tableEl);
        
        container.appendChild(widgetWrapper);

        // Group bar drag-and-drop mechanics
        let draggedField = null;
        widgetWrapper.addEventListener('dragstart', (e) => {
            const colEl = e.target.closest('.tabulator-col');
            if (colEl) {
                draggedField = colEl.getAttribute('tabulator-field');
                if (draggedField) {
                    e.dataTransfer.setData('text/plain', draggedField);
                    e.dataTransfer.effectAllowed = 'move';
                }
            }
        });

        groupBar.addEventListener('dragover', (e) => {
            e.preventDefault();
            groupBar.classList.add('drag-hover');
        });

        groupBar.addEventListener('dragleave', () => {
            groupBar.classList.remove('drag-hover');
        });

        groupBar.addEventListener('drop', (e) => {
            e.preventDefault();
            groupBar.classList.remove('drag-hover');
            const field = e.dataTransfer.getData('text/plain') || draggedField;
            if (field && field !== '_actions') {
                tabulatorTable.setGroupBy(field);
                updateGroupBar(field);
            }
        });

        function updateGroupBar(field) {
            if (!field) {
                groupBar.innerHTML = `<span class="group-bar-placeholder">Arraste um cabeçalho de coluna aqui para agrupar</span>`;
                return;
            }
            const colSchema = schema[field];
            const label = colSchema?.label || field;
            groupBar.innerHTML = `
                <div class="group-badge-container">
                    <span class="group-bar-label">Agrupado por:</span>
                    <span class="group-badge">
                        ${label}
                        <button type="button" class="group-badge-remove" title="Limpar agrupamento">✕</button>
                    </span>
                </div>
            `;
            groupBar.querySelector('.group-badge-remove').onclick = () => {
                tabulatorTable.setGroupBy(false);
                updateGroupBar(null);
            };
        }

        // Pagination parameters
        const paginationConfig = styling.pagination || config.pagination || {};
        const paginationEnabled = (paginationConfig.enabled !== false && paginationConfig.enabled !== 'false') ? (paginationConfig.enabled || "local") : false;
        const paginationSize = parseInt(paginationConfig.pageSize, 10) || 10;
        const paginationSizeSelector = paginationEnabled ? [5, 10, 20, 50, 100] : false;

        tabulatorTable = new Tabulator(tableEl, {
            height: "100%",
            data: records,
            layout: styling.layout || "fitColumns",
            responsiveLayout: styling.responsiveLayout || false,
            resizableColumns: styling.resizableColumns !== false,
            columns: columns,
            columnCalcs: actions.enableColumnCalcs ? "bottom" : false,
            pagination: paginationEnabled,
            paginationSize: paginationSize,
            paginationSizeSelector: paginationSizeSelector,
            movableColumns: true,
            resizableRows: true,
            initialSort: (styling.defaultSort?.column || config.defaultSort?.column) ? [{ column: styling.defaultSort?.column || config.defaultSort.column, dir: styling.defaultSort?.direction || config.defaultSort.direction }] : [],
            
            cellEdited: async (cell) => {
                const field = cell.getField();
                const value = cell.getValue();
                const rowId = cell.getRow().getData().id;

                if (useSaveButton) {
                    if (!pendingChanges[rowId]) pendingChanges[rowId] = {};
                    pendingChanges[rowId][field] = value;
                    cell.getElement().style.background = "#fef9c3";
                    cell.getElement().style.fontWeight = "bold";
                    updateActionBar();
                } else {
                    try {
                        await tableLens.updateRecord(tableId, rowId, { [field]: value });
                    } catch (e) {
                        console.error("[TableRenderer] Erro ao salvar edição inline:", e);
                        cell.restoreOldValue();
                        alert("Erro ao salvar: " + e.message);
                    }
                }
            }
        });

        // Set headers draggable after table is built
        tabulatorTable.on("tableBuilt", () => {
            widgetWrapper.querySelectorAll('.tabulator-col').forEach(colEl => {
                colEl.setAttribute('draggable', 'true');
            });
        });

        // Apply stripes backward compatibility class
        if (striped) tableEl.classList.add('custom-striped-enabled');
        else tableEl.classList.remove('custom-striped-enabled');

        // Row click delegation
        if (onRowClick) {
            tableEl.addEventListener('click', (e) => {
                const rowElement = e.target.closest('.tabulator-row');
                if (rowElement) {
                    const row = tabulatorTable.getRow(rowElement);
                    if (row) onRowClick(row.getData());
                }
            });
        }

        return tabulatorTable;
    }

    return { renderTable };

})();
