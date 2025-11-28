// libraries/grist-field-renderer/renderers/render-reflist.js
// import { CardSystem } from '../../grist-card-system/CardSystem.js'; // REMOVED to break circular dependency
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

// O bloco de estilo dinâmico foi REMOVIDO. Os estilos agora estão em drawer-style.css.

async function handleAdd(options) {
    const { tableId, onUpdate, dataWriter, tableLens, backRefCol, parentRecId, parentTableId, parentRefListColId, parentRecord, fieldConfig } = options;
    if (!parentRecId || typeof parentRecId !== 'number' || parentRecId <= 0) { alert("Ação 'Adicionar' bloqueada."); return; }
    const schema = await tableLens.getTableSchema(tableId);

    const modalOptions = { title: `Adicionar em ${tableId}`, tableId, record: {}, schema, onSave: async () => { } };
    if (backRefCol && parentRecId) { modalOptions.record[backRefCol] = parentRecId; }

    if (fieldConfig && typeof fieldConfig === 'object') {
        modalOptions.hiddenFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].hideInModal);
        modalOptions.lockedFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].lockInModal);
        modalOptions.requiredFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].requireInModal);
    }

    modalOptions.onSave = async (newRecordFromForm) => {
        const finalRecord = { ...newRecordFromForm };
        if (backRefCol && parentRecId) { finalRecord[backRefCol] = parentRecId; }
        const result = await dataWriter.addRecord(tableId, finalRecord);
        if (!result || !Array.isArray(result.retValues) || !result.retValues[0]) { throw new Error("Falha ao criar o registro filho."); }
        const newChildId = result.retValues[0];
        const refListValue = parentRecord[parentRefListColId];
        const existingChildIds = (Array.isArray(refListValue) && refListValue[0] === 'L') ? refListValue.slice(1) : [];
        const updatedChildIds = ['L', ...existingChildIds, newChildId];
        parentRecord[parentRefListColId] = updatedChildIds;
        dataWriter.updateRecord(parentTableId, parentRecId, { [parentRefListColId]: updatedChildIds });
        publish('data-changed', { tableId: parentTableId, recordId: parentRecId, action: 'update' });
        onUpdate();
    };
    openModal(modalOptions);
}

async function handleEdit(tableId, recordId, onUpdate, dataWriter, tableLens, fieldConfig) {
    const schema = await tableLens.getTableSchema(tableId);
    const record = await tableLens.fetchRecordById(tableId, recordId);

    const modalOptions = { title: `Editando Registro ${recordId}`, tableId, record, schema, onSave: async (changes) => { await dataWriter.updateRecord(tableId, recordId, changes); onUpdate(); } };

    if (fieldConfig && typeof fieldConfig === 'object') {
        modalOptions.hiddenFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].hideInModal);
        modalOptions.lockedFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].lockInModal);
        modalOptions.requiredFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].requireInModal);
    }

    openModal(modalOptions);
}

async function handleDelete(tableId, recordId, onUpdate, dataWriter) { if (confirm(`Tem certeza?`)) { await dataWriter.deleteRecords(tableId, [recordId]); onUpdate(); } }

export async function renderRefList(options) {
    console.log('renderRefList options:', options);
    let currentPage = 1;
    const { container, record, colSchema, tableLens, isLocked, fieldConfig, ruleIdToColIdMap, refListConfig } = options;
    let isCollapsed = container.dataset.collapsed === 'true' || (container.dataset.collapsed === undefined && options.refListConfig?.collapsible);
    container.dataset.collapsed = isCollapsed;
    const dataWriter = new GristDataWriter(grist);
    const iconPath = '../libraries/icons/icons.svg';
    container.innerHTML = '';
    if (isLocked) container.closest('.drawer-field')?.classList.add('is-locked-style');

    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort', sortDirection = 'asc';

    const closeAllMenus = () => { document.querySelectorAll('.reflist-action-menu-dropdown.is-open').forEach(d => d.classList.remove('is-open')); };

    const renderContent = async () => {
        console.log("--- DEBUG: renderRefList ---");
        console.log("Rendering RefList for field:", colSchema.colId);
        console.log("Received fieldConfig:", JSON.parse(JSON.stringify(fieldConfig || {})));
        console.log("Received refListConfig:", JSON.parse(JSON.stringify(refListConfig || {})));
        // Collapsed state rendering
        if (refListConfig?.collapsible && isCollapsed) {
            container.innerHTML = '';
            const expandButton = document.createElement('div');
            expandButton.className = 'reflist-expand-button';
            expandButton.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px; background-color: #f0f0f0; border: 1px solid #ccc;
                border-radius: 4px; cursor: pointer;
            `;
            expandButton.innerHTML = `
                <span style="font-size: 16px;">▶️</span>
                <span style="font-size: 16px;">RefList Collapsed</span>
            `;
            expandButton.onclick = (e) => {
                e.stopPropagation();
                isCollapsed = false;
                renderContent();
            };
            container.appendChild(expandButton);
            // Do NOT return here. Continue to fetch records but only display if expanded.
        }

        // Expanded state rendering
        if (!isCollapsed) {
            container.innerHTML = '<p>Carregando...</p>';
        }
        const relatedSchema = await tableLens.getTableSchema(referencedTableId);
        const ruleMap = ruleIdToColIdMap || new Map();

        // Handle new and old column formats
        let columnsToDisplay;
        const allPossibleCols = Object.values(relatedSchema).filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');

        if (refListConfig && Array.isArray(refListConfig.columns) && refListConfig.columns.length > 0 && typeof refListConfig.columns[0] === 'object') {
            // New format: array of objects
            const sortConfig = refListConfig.columns.find(c => c.sort && c.sort !== 'none');
            if (sortConfig) {
                sortColumn = sortConfig.colId;
                sortDirection = sortConfig.sort;
            }

            columnsToDisplay = refListConfig.columns
                .filter(c => c.visible)
                .map(c => relatedSchema[c.colId])
                .filter(Boolean); // Filter out undefined columns
        } else {
            // Old format or no config: array of strings or undefined
            if (refListConfig && refListConfig.columns && refListConfig.columns.length > 0) {
                const visibleColIds = new Set(refListConfig.columns);
                columnsToDisplay = allPossibleCols.filter(col => visibleColIds.has(col.colId));
            } else if (fieldConfig && typeof fieldConfig === 'object') {
                columnsToDisplay = allPossibleCols.filter(col => fieldConfig[col.colId]?.showInTable === true);
            } else {
                columnsToDisplay = allPossibleCols;
            }
        }

        let relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        relatedRecords.sort((a, b) => { const vA = a[sortColumn], vB = b[sortColumn]; if (vA < vB) return sortDirection === 'asc' ? -1 : 1; if (vA > vB) return sortDirection === 'asc' ? 1 : -1; return 0; });

        const totalRecords = relatedRecords.length;
        let recordsToRender = relatedRecords;

        if (refListConfig && refListConfig.paginate && refListConfig.pageSize > 0) {
            const pageSize = refListConfig.pageSize;
            const totalPages = Math.ceil(totalRecords / pageSize);
            currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
            const startIndex = (currentPage - 1) * pageSize;
            recordsToRender = relatedRecords.slice(startIndex, startIndex + pageSize);
        } else if (refListConfig && refListConfig.maxRows > 0) {
            recordsToRender = relatedRecords.slice(0, refListConfig.maxRows);
        }

        if (isCollapsed) {
            // If collapsed, just update the count in the expand button
            const expandButton = container.querySelector('.reflist-expand-button');
            if (expandButton) {
                expandButton.innerHTML = `
                    <span style="font-size: 16px;">▶️</span>
                    <span style="font-size: 16px;">RefList Collapsed (${totalRecords} itens)</span>
                `;
            }
            return; // Now return after fetching but before detailed rendering
        }

        container.innerHTML = ''; // Clear the 'Carregando...' or collapsed button
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        container.appendChild(header);

        // Expanded Header (acts as collapse button)
        if (refListConfig && refListConfig.collapsible) {
            header.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                padding: 4px 8px; background-color: #f0f0f0; border: 1px solid #ccc;
                border-radius: 4px; cursor: pointer; margin-bottom: 5px;
            `;
            header.innerHTML = `
                <span style="font-size: 16px;">🔽</span>
                <span style="font-size: 16px;">🔽</span>
            `;
            header.onclick = (e) => {
                e.stopPropagation();
                isCollapsed = true;
                renderContent();
            };
        }

        if (options.isEditing) {
            const addButton = document.createElement('button');
            addButton.className = 'add-btn';
            addButton.style.marginBottom = '5px';
            if (isLocked) {
                addButton.disabled = true;
                addButton.title = 'Este campo está travado.';
            }
            addButton.innerHTML = `<svg class="icon"><use href="${iconPath}#icon-add"></use></svg> Adicionar`;

            if (refListConfig && refListConfig.collapsible) {
                header.insertAdjacentElement('afterend', addButton);
            } else {
                const actionsDiv = document.createElement('div');
                actionsDiv.style.textAlign = 'right';
                actionsDiv.appendChild(addButton);
                header.appendChild(actionsDiv);
            }
        }

        if (refListConfig?.displayAs === 'cards') {
            const cardConfigId = refListConfig.cardConfigId;
            if (!cardConfigId) {
                container.innerHTML = '<p>Error: No Card Config ID specified.</p>';
                return;
            }

            const cardConfig = await tableLens.fetchConfig(cardConfigId);
            if (!cardConfig) {
                container.innerHTML = `<p>Error: Card Config with ID '${cardConfigId}' not found.</p>`;
                return;
            }

            const cardsContainer = document.createElement('div');
            container.appendChild(cardsContainer);

            // Dynamic import to break circular dependency
            const { CardSystem } = await import('../../grist-card-system/CardSystem.js');
            CardSystem.renderCards(cardsContainer, recordsToRender, { ...cardConfig, isRefList: true }, relatedSchema, tableLens);

        } else if (refListConfig?.displayAs === 'tabulator') {
            const tabulatorConfigId = refListConfig.tabulatorConfigId;
            if (!tabulatorConfigId) {
                container.innerHTML = '<p>Error: No Tabulator Config ID specified.</p>';
                return;
            }

            const tabulatorConfig = await tableLens.fetchConfig(tabulatorConfigId);
            if (!tabulatorConfig) {
                container.innerHTML = `<p>Error: Tabulator Config with ID '${tabulatorConfigId}' not found.</p>`;
                return;
            }

            const gristCellFormatter = (cell, formatterParams, onRendered) => {
                const colId = cell.getField();
                const record = cell.getRow().getData();
                const colSchema = relatedSchema[colId];
                const colConfig = formatterParams.colConfig;

                if (!colSchema) { return String(cell.getValue() ?? ''); }

                const tempContainer = document.createElement('div');
                tempContainer.style.cssText = 'width: 100%;';

                if (colConfig) {
                    if (colConfig.wrapText !== false) {
                        tempContainer.style.whiteSpace = 'normal';
                        if (colConfig.maxTextRows > 0) {
                            const lineHeight = 1.4; // em
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

                onRendered(async () => {
                    await renderField({
                        container: tempContainer,
                        colSchema: colSchema,
                        record: record,
                        isEditing: false,
                        tableLens: tableLens,
                        ruleIdToColIdMap: ruleMap,
                        fieldConfig: fieldConfig,
                    });
                    cell.getRow().normalizeHeight();
                });

                return tempContainer;
            };

            const columns = (tabulatorConfig.columns || []).map(colConfig => {
                const gristCol = relatedSchema[colConfig.colId];
                if (!gristCol) return null;

                return {
                    title: gristCol.label || gristCol.colId,
                    field: gristCol.colId,
                    hozAlign: colConfig.align || 'left',
                    headerFilter: false,
                    width: colConfig.width || undefined,
                    formatter: gristCellFormatter,
                    formatterParams: {
                        colConfig: colConfig,
                    },
                    tooltip: true,
                };
            }).filter(col => col !== null);

            const tabulatorContainer = document.createElement('div');
            tabulatorContainer.className = 'reflist-tabulator-container';
            tabulatorContainer.style.maxHeight = '300px';
            tabulatorContainer.style.overflowY = 'auto';

            const style = document.createElement('style');
            style.textContent = `
                .reflist-tabulator-container .tabulator-placeholder {
                    padding: 4px !important;
                }
            `;
            container.appendChild(style);
            container.appendChild(tabulatorContainer);

            new Tabulator(tabulatorContainer, {
                minHeight: 0, // Do not reserve height for empty table
                data: recordsToRender,
                columns: columns,
                layout: tabulatorConfig.layout || "fitColumns",
                pagination: tabulatorConfig.pagination?.enabled || false,
                paginationSize: tabulatorConfig.pagination?.pageSize || 10,
                paginationSizeSelector: false,
                paginationButtonCount: 3,
                placeholder: "<div style='text-align:center; color:#777;'>No records found</div>", // Removed padding
                renderComplete: function () {
                    setTimeout(() => {
                        this.redraw(true);
                    }, 0);
                },
            });

        } else {
            const tableContainer = document.createElement('div');
            tableContainer.className = 'grf-reflist-table-container';
            const table = document.createElement('table');
            table.className = 'grf-reflist-table';
            if (fieldConfig?._options?.zebra || refListConfig?.zebra) { table.classList.add('is-zebra-striped'); }

            const style = document.createElement('style');
            style.textContent = `
                .grf-reflist-table th.asc::after { content: ' ▲'; color: green; }
                .grf-reflist-table th.desc::after { content: ' ▼'; color: red; }
            `;
            container.appendChild(style);

            const thead = table.createTHead().insertRow();
            const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thead.appendChild(thActions);
            columnsToDisplay.forEach(c => {
                const th = document.createElement('th');
                th.textContent = c.label || c.colId;
                th.style.cursor = 'pointer';

                if (c.colId === sortColumn) {
                    th.classList.add(sortDirection);
                }

                th.onclick = () => {
                    const currentSortCol = refListConfig.columns.find(col => col.colId === c.colId);
                    if (currentSortCol) {
                        const currentSort = currentSortCol.sort || 'none';
                        let nextSort = 'asc';
                        if (currentSort === 'asc') nextSort = 'desc';
                        if (currentSort === 'desc') nextSort = 'none';

                        refListConfig.columns.forEach(col => col.sort = 'none');
                        currentSortCol.sort = nextSort;
                    }
                    renderContent();
                };
                thead.appendChild(th);
            });

            const tbody = table.createTBody();
            for (const relRec of recordsToRender) {
                const tr = tbody.insertRow();
                const actionsCell = tr.insertCell();
                actionsCell.className = 'actions-cell';
                const menuBtn = document.createElement('button');
                menuBtn.className = 'reflist-action-menu-btn';
                menuBtn.disabled = isLocked;
                menuBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

                const dropdown = document.createElement('div');
                dropdown.className = 'reflist-action-menu-dropdown';
                dropdown.innerHTML = `
                    <div class="reflist-action-menu-item" data-action="edit">
                        <svg class="icon"><use href="${iconPath}#icon-edit"></use></svg>
                        <span>Editar</span>
                    </div>
                    <div class="reflist-action-menu-item" data-action="delete">
                        <svg class="icon"><use href="${iconPath}#icon-delete"></use></svg>
                        <span>Deletar</span>
                    </div>
                `;
                actionsCell.appendChild(menuBtn);
                actionsCell.appendChild(dropdown);
                for (const c of columnsToDisplay) {
                    const td = tr.insertCell();
                    renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleMap, fieldConfig: fieldConfig, isChild: true });
                }
            }
            tableContainer.appendChild(table);
            container.appendChild(tableContainer);

            tbody.querySelectorAll('tr').forEach((tr, index) => {
                const rec = recordsToRender[index];
                const menuBtn = tr.querySelector('.reflist-action-menu-btn');
                const dropdown = tr.querySelector('.reflist-action-menu-dropdown');
                menuBtn.addEventListener('click', e => { e.stopPropagation(); const isOpen = dropdown.classList.contains('is-open'); closeAllMenus(); if (!isOpen) dropdown.classList.add('is-open'); });
                dropdown.addEventListener('click', e => {
                    e.stopPropagation();
                    const action = e.target.closest('.reflist-action-menu-item')?.dataset.action;
                    if (action === 'edit') handleEdit(referencedTableId, rec.id, renderContent, dataWriter, tableLens, fieldConfig);
                    else if (action === 'delete') handleDelete(referencedTableId, rec.id, renderContent, dataWriter);
                    closeAllMenus();
                });
            });
        }

        if (refListConfig && refListConfig.paginate && totalRecords > refListConfig.pageSize) {
            const footer = document.createElement('div');
            footer.className = 'grf-reflist-footer';
            const pageSize = refListConfig.pageSize;
            const totalPages = Math.ceil(totalRecords / pageSize);
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.className = 'btn-reflist-nav';
            prevBtn.disabled = currentPage === 1;
            prevBtn.onclick = (e) => { e.stopPropagation(); if (currentPage > 1) { currentPage--; renderContent(); } };
            const pageInfo = document.createElement('span');
            pageInfo.className = 'reflist-page-info';
            pageInfo.textContent = `${currentPage}/${totalPages}`;
            pageInfo.style.margin = '0 10px';
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.className = 'btn-reflist-nav';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.onclick = (e) => { e.stopPropagation(); if (currentPage < totalPages) { currentPage++; renderContent(); } };
            footer.appendChild(prevBtn);
            footer.appendChild(pageInfo);
            footer.appendChild(nextBtn);
            container.appendChild(footer);
        }

        const primaryTableId = record.gristHelper_tableId;
        const backReferenceColumn = Object.values(relatedSchema).find(col => col?.type === `Ref:${primaryTableId}`);
        const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;
        const finalAddButton = container.querySelector('.add-btn');
        if (finalAddButton) {
            finalAddButton.onclick = () => handleAdd({ tableId: referencedTableId, onUpdate: renderContent, dataWriter, tableLens, backRefCol: backReferenceColId, parentRecId: record.id, parentTableId: primaryTableId, parentRefListColId: colSchema.colId, parentRecord: record, fieldConfig });
        }
    };

    document.addEventListener('click', closeAllMenus);
    container.addEventListener('remove', () => document.removeEventListener('click', closeAllMenus));

    await renderContent();
}