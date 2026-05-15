// libraries/grist-table-renderer/TableRenderer.js
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

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

        const tableId = config.tableId;
        const schema = await tableLens.getTableSchema(tableId);
        const useSaveButton = config.useSaveButton || config.actions?.useSaveButton || false;
        
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
            } else if (colConfig && colConfig.formatter === 'progress') {
                fieldOptions.progressBar = true;
                fieldOptions.widgetOptions = colConfig.formatterParams;
                tempContainer.style.display = 'flex';
                tempContainer.style.alignItems = 'center';
                tempContainer.style.height = '100%';
            } else if (colConfig && colConfig.formatter === 'image') {
                fieldOptions.widget = 'image';
                fieldOptions.widgetOptions = colConfig.formatterParams;
                tempContainer.style.display = 'flex';
                const alignMap = { 'left': 'flex-start', 'right': 'flex-end', 'center': 'center' };
                tempContainer.style.justifyContent = alignMap[colConfig.align] || 'center';
            }
 else if (colConfig && colConfig.formatter === 'money') {
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
                        useGristStyle: !colConfig?.ignoreConditionalFormatting
                    },
                    fieldOptions: fieldOptions
                });
            });

            return tempContainer;
        };

        const columns = (config.columns || []).map(colConfig => {
            if (colConfig.colId === '_actions') {
                return {
                    title: colConfig.ignoreHeaderStyle ? "Ações" : "⚙️ Ações",
                    field: "_actions",
                    headerSort: false,
                    width: parseInt(colConfig.width, 10) || 80,
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
                                        await tableLens.deleteRecord(tableId, record.id);
                                        cell.getRow().delete();
                                    } catch (err) {
                                        alert("Erro ao excluir: " + err.message);
                                    }
                                }
                            };
                            div.appendChild(btn);
                        }
                        
                        return div;
                    }
                };
            }

            const gristCol = schema[colConfig.colId];
            if (!gristCol) return null;

            let formatter = gristCellFormatter;

            if (gristCol.type.startsWith('RefList:')) {
                const refListFieldConfig = config.mapping?.refListFieldConfig || config.refListFieldConfig || {};
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

            const isEditable = config.editMode === 'excel' && !colConfig.locked;
            
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
                headerFilter: config.headerFilter !== false,
                width: colConfig.width || undefined,
                bottomCalc: config.enableColumnCalcs ? (colConfig.bottomCalc || undefined) : undefined,
                editable: isEditable,
                editor: editor,
                editorParams: editorParams,
                validator: (config.editMode === 'excel' && colConfig.required) ? 'required' : undefined,
                formatter: formatter,
                formatterParams: { ...(colConfig.formatterParams || {}), colConfig: colConfig },
                tooltip: true,
            };
        }).filter(col => col !== null);

        tabulatorTable = new Tabulator(container, {
            height: "100%",
            data: records,
            layout: config.layout || "fitColumns",
            responsiveLayout: config.responsiveLayout || false,
            resizableColumns: config.resizableColumns !== false,
            columns: columns,
            columnCalcs: config.enableColumnCalcs ? "bottom" : false,
            pagination: (config.pagination?.enabled && config.pagination.enabled !== 'false') ? config.pagination.enabled : false,
            paginationSize: config.pagination?.pageSize || 10,
            paginationSizeSelector: config.pagination?.enabled ? [5, 10, 20, 50, 100] : false,
            movableColumns: true,
            resizableRows: true,
            initialSort: config.defaultSort?.column ? [{ column: config.defaultSort.column, dir: config.defaultSort.direction }] : [],
            
            cellEdited: async (cell) => {
                const field = cell.getField();
                const value = cell.getValue();
                const rowId = cell.getRow().getData().id;

                if (useSaveButton) {
                    // MODO LOTE: Apenas guarda a mudança e marca a célula
                    if (!pendingChanges[rowId]) pendingChanges[rowId] = {};
                    pendingChanges[rowId][field] = value;
                    cell.getElement().style.background = "#fef9c3";
                    cell.getElement().style.fontWeight = "bold";
                    updateActionBar();
                } else {
                    // MODO DIRETO: Salva na hora
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

        // Apply stripes
        const stripedEnabled = config.stripedTable || (config.styling && config.styling.stripedTable);
        if (stripedEnabled) container.classList.add('custom-striped-enabled');
        else container.classList.remove('custom-striped-enabled');

        // Row click delegation
        if (onRowClick) {
            container.addEventListener('click', (e) => {
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
