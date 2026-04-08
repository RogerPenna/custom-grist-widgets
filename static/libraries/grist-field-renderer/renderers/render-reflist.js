// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

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

    const modalOptions = { 
        title: `Editando Registro ${recordId}`, 
        tableId, record, schema, 
        tableLens, 
        onSave: async (changes) => { await dataWriter.updateRecord(tableId, recordId, changes); onUpdate(); } 
    };

    if (fieldConfig && typeof fieldConfig === 'object') {
        modalOptions.hiddenFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].hideInModal);
        modalOptions.lockedFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].lockInModal);
        modalOptions.requiredFields = Object.keys(fieldConfig).filter(key => fieldConfig[key].requireInModal);
    }

    openModal(modalOptions);
}

async function handleDelete(tableId, recordId, onUpdate, dataWriter) { if (confirm(`Tem certeza?`)) { await dataWriter.deleteRecords(tableId, [recordId]); onUpdate(); } }

export async function renderRefList(options) {
    let currentPage = 1;
    const { container, record, colSchema, tableLens, isLocked, ruleIdToColIdMap } = options;
    const fieldConfig = options.fieldConfig || options.fieldStyle || {};
    const refListConfig = options.refListConfig || fieldConfig.refListConfig;

    let isCollapsed = container.dataset.collapsed === 'true' || (container.dataset.collapsed === undefined && refListConfig?.collapsible);
    container.dataset.collapsed = isCollapsed;
    
    const dataWriter = (tableLens && tableLens.docApi) ? new GristDataWriter(tableLens.docApi) : new GristDataWriter(window.grist);
    const iconPath = '../libraries/icons/icons.svg';
    container.innerHTML = '';
    if (isLocked) container.closest('.drawer-field')?.classList.add('is-locked-style');

    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort', sortDirection = 'asc';

    const closeAllMenus = () => { document.querySelectorAll('.reflist-action-menu-dropdown.is-open').forEach(d => d.classList.remove('is-open')); };

    const renderContent = async () => {
        console.log("--- [renderRefList DEBUG] START ---", { field: colSchema.colId, table: record?.gristHelper_tableId });
        
        if (refListConfig?.collapsible && isCollapsed) {
            container.innerHTML = '';
            const expandButton = document.createElement('div');
            expandButton.className = 'reflist-expand-button';
            expandButton.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;`;
            expandButton.innerHTML = `<span style="font-size: 16px;">▶️</span><span style="font-size: 16px;">RefList Collapsed</span>`;
            expandButton.onclick = (e) => { e.stopPropagation(); isCollapsed = false; renderContent(); };
            container.appendChild(expandButton);
        }

        if (!isCollapsed) { container.innerHTML = '<p>Carregando...</p>'; }
        
        const relatedSchema = await tableLens.getTableSchema(referencedTableId);
        const ruleMap = ruleIdToColIdMap || new Map();

        // [RESTORED] Lógica de resolução de colunas
        let columnsToDisplay;
        const allPossibleCols = Object.values(relatedSchema).filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');

        if (refListConfig && Array.isArray(refListConfig.columns) && refListConfig.columns.length > 0 && typeof refListConfig.columns[0] === 'object') {
            const sortConfig = refListConfig.columns.find(c => c.sort && c.sort !== 'none');
            if (sortConfig) { sortColumn = sortConfig.colId; sortDirection = sortConfig.sort; }
            columnsToDisplay = refListConfig.columns.filter(c => c.visible).map(c => relatedSchema[c.colId]).filter(Boolean);
        } else {
            if (refListConfig && refListConfig.columns && refListConfig.columns.length > 0) {
                const visibleColIds = new Set(refListConfig.columns);
                columnsToDisplay = allPossibleCols.filter(col => visibleColIds.has(col.colId));
            } else if (fieldConfig && typeof fieldConfig === 'object') {
                columnsToDisplay = allPossibleCols.filter(col => fieldConfig[col.colId]?.showInTable === true);
            }
            
            // [NEW] Fallback: If no columns are selected, show all (except technical)
            if (!columnsToDisplay || columnsToDisplay.length === 0) {
                console.log("[renderRefList] No columns configured for table, using fallback (all columns).");
                columnsToDisplay = allPossibleCols;
            }
        }

        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        console.log(`[renderRefList DEBUG] Records for ${colSchema.colId}:`, relatedRecords?.length || 0);

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
            const expandButton = container.querySelector('.reflist-expand-button');
            if (expandButton) { expandButton.innerHTML = `<span style="font-size: 16px;">▶️</span><span style="font-size: 16px;">RefList Collapsed (${totalRecords} itens)</span>`; }
            return;
        }

        container.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        container.appendChild(header);

        if (refListConfig && refListConfig.collapsible) {
            header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-bottom: 5px;`;
            header.innerHTML = `<span style="font-size: 16px;">🔽</span><span style="font-size: 16px;">🔽</span>`;
            header.onclick = (e) => { e.stopPropagation(); isCollapsed = true; renderContent(); };
        }

        if (options.isEditing && refListConfig?.displayAs !== 'cards') {
            const addButton = document.createElement('button');
            addButton.className = 'add-btn';
            addButton.style.marginBottom = '5px';
            if (isLocked) { addButton.disabled = true; addButton.title = 'Este campo está travado.'; }
            addButton.innerHTML = `<svg class="icon"><use href="${iconPath}#icon-add"></use></svg> Adicionar`;
            if (refListConfig && refListConfig.collapsible) { header.insertAdjacentElement('afterend', addButton); } 
            else { const actionsDiv = document.createElement('div'); actionsDiv.style.textAlign = 'right'; actionsDiv.appendChild(addButton); header.appendChild(actionsDiv); }
        }

        if (refListConfig?.displayAs === 'cards') {
            const cardConfigId = refListConfig.cardConfigId;
            if (!cardConfigId) { container.innerHTML = '<p>Error: No Card Config ID specified.</p>'; return; }
            const cardConfig = await tableLens.fetchConfig(cardConfigId);
            if (!cardConfig) { container.innerHTML = `<p>Error: Card Config with ID '${cardConfigId}' not found.</p>`; return; }
            const showAddTop = (fieldConfig?.showAddButton !== undefined) ? fieldConfig.showAddButton : (cardConfig.showAddButtonTop || cardConfig.actions?.showAddButtonTop);
            if (showAddTop || options.isEditing) {
                const addBtn = document.createElement('button');
                addBtn.className = 'grf-global-add-btn pos-inline';
                addBtn.title = "Adicionar Novo Registro";
                addBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="currentColor"/></svg>`;
                addBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const primaryTableId = record.gristHelper_tableId;
                    const backReferenceColumn = Object.values(relatedSchema).find(col => col?.type === `Ref:${primaryTableId}`);
                    const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;
                    if (window.GristDrawer) {
                        let addConfig = cardConfig;
                        const specificConfigId = fieldConfig?.addRecordConfigId || cardConfig.addRecordConfigId || cardConfig.actions?.addRecordConfigId;
                        if (specificConfigId) { const rec = await tableLens.findRecord('Grf_config', { configId: specificConfigId }); if (rec) addConfig = JSON.parse(rec.configJson); }
                        const initialData = {}; if (backReferenceColId) initialData[backReferenceColId] = record.id;
                        window.GristDrawer.open(referencedTableId, 'new', { ...addConfig, tableLens: tableLens, initialData: initialData });
                    } else {
                        handleAdd({ tableId: referencedTableId, onUpdate: renderContent, dataWriter, tableLens, backRefCol: backReferenceColId, parentRecId: record.id, parentTableId: primaryTableId, parentRefListColId: colSchema.colId, parentRecord: record, fieldConfig });
                    }
                };
                container.appendChild(addBtn);
            }
            const cardsContainer = document.createElement('div');
            container.appendChild(cardsContainer);
            const { CardSystem } = await import('../../grist-card-system/CardSystem.js');
            CardSystem.renderCards(cardsContainer, recordsToRender, { ...cardConfig, isRefList: true }, relatedSchema, tableLens);
        } else {
            const tableContainer = document.createElement('div');
            tableContainer.className = 'grf-reflist-table-container';
            const table = document.createElement('table');
            table.className = 'grf-reflist-table';
            if (fieldConfig?._options?.zebra || refListConfig?.zebra) { table.classList.add('is-zebra-striped'); }
            const style = document.createElement('style');
            style.textContent = `.grf-reflist-table th.asc::after { content: ' ▲'; color: green; } .grf-reflist-table th.desc::after { content: ' ▼'; color: red; }`;
            container.appendChild(style);
            const thead = table.createTHead().insertRow();
            const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thActions.style.textAlign = 'left'; thead.appendChild(thActions);
            columnsToDisplay.forEach(c => {
                const th = document.createElement('th');
                th.textContent = c.label || c.colId;
                th.style.cursor = 'pointer';
                if (c.colId === sortColumn) { th.classList.add(sortDirection); }
                th.onclick = () => {
                    if (refListConfig && Array.isArray(refListConfig.columns)) {
                        const currentSortCol = refListConfig.columns.find(col => col.colId === c.colId);
                        if (currentSortCol) {
                            const currentSort = currentSortCol.sort || 'none';
                            let nextSort = (currentSort === 'asc') ? 'desc' : (currentSort === 'desc' ? 'none' : 'asc');
                            refListConfig.columns.forEach(col => col.sort = 'none');
                            currentSortCol.sort = nextSort;
                        }
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
                actionsCell.style.textAlign = 'left';
                actionsCell.style.width = '40px';
                const menuBtn = document.createElement('button');
                menuBtn.className = 'reflist-action-menu-btn';
                menuBtn.disabled = isLocked;
                menuBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
                const dropdown = document.createElement('div');
                dropdown.className = 'reflist-action-menu-dropdown';
                dropdown.innerHTML = `<div class="reflist-action-menu-item" data-action="edit"><svg class="icon"><use href="${iconPath}#icon-edit"></use></svg><span>Editar</span></div><div class="reflist-action-menu-item" data-action="delete"><svg class="icon"><use href="${iconPath}#icon-delete"></use></svg><span>Deletar</span></div>`;
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
