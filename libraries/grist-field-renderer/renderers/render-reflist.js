// libraries/grist-field-renderer/renderers/render-reflist.js
import { openModal } from '../../grist-modal-component/modal-component.js';
import { GristDataWriter } from '../../grist-data-writer.js';
import { renderField } from '../grist-field-renderer.js';
import { publish } from '../../grist-event-bus/grist-event-bus.js';

// O bloco de estilo dinâmico foi REMOVIDO. Os estilos agora estão em drawer-style.css.

async function handleAdd(options) {
    const { tableId, onUpdate, dataWriter, tableLens, backRefCol, parentRecId, parentTableId, parentRefListColId, parentRecord, fieldConfig } = options;
    if (!parentRecId || typeof parentRecId !== 'number' || parentRecId <= 0) { alert("Ação 'Adicionar' bloqueada."); return; }
    const schema = await tableLens.getTableSchema(tableId);
    
    const modalOptions = { title: `Adicionar em ${tableId}`, tableId, record: {}, schema, onSave: async () => {} };
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
    const { container, record, colSchema, tableLens, isLocked, fieldConfig, ruleIdToColIdMap, refListConfig } = options;
    const dataWriter = new GristDataWriter(grist);
    const iconPath = '../libraries/icons/icons.svg';
    container.innerHTML = '';
    if (isLocked) container.closest('.drawer-field')?.classList.add('is-locked-style');
    
    const referencedTableId = colSchema.type.split(':')[1];
    let sortColumn = 'manualSort', sortDirection = 'asc';
    
    const closeAllMenus = () => { document.querySelectorAll('.reflist-action-menu-dropdown.is-open').forEach(d => d.classList.remove('is-open')); };

    const renderContent = async () => {
        container.innerHTML = '<p>Carregando...</p>';
        let relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        relatedRecords.sort((a, b) => { const vA = a[sortColumn], vB = b[sortColumn]; if (vA < vB) return sortDirection === 'asc' ? -1 : 1; if (vA > vB) return sortDirection === 'asc' ? 1 : -1; return 0; });

        // Apply maxRows limit from refListConfig
        if (refListConfig && refListConfig.maxRows > 0) {
            relatedRecords = relatedRecords.slice(0, refListConfig.maxRows);
        }

        const relatedSchema = await tableLens.getTableSchema(referencedTableId);
        const ruleMap = ruleIdToColIdMap || new Map();
        
        container.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'grf-reflist-header';
        header.innerHTML = `
            <span class="item-count">(${relatedRecords.length} itens)</span>
            ${options.isEditing ? `
            <button class="add-btn" ${isLocked ? 'disabled title="Este campo est\u00e1 travado."' : ''}>
                <svg class="icon"><use href="${iconPath}#icon-add"></use></svg>
                Adicionar
            </button>
            ` : ''}
        `;
        container.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'grf-reflist-table-container';
        const table = document.createElement('table');
        table.className = 'grf-reflist-table';
        if (fieldConfig?._options?.zebra) { table.classList.add('is-zebra-striped'); }
        
        const thead = table.createTHead().insertRow();
        const allPossibleCols = Object.values(relatedSchema).filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        let columnsToDisplay;

        // Apply column filter from refListConfig, with fallback to fieldConfig
        if (refListConfig && refListConfig.columns && refListConfig.columns.length > 0) {
            const visibleColIds = new Set(refListConfig.columns);
            columnsToDisplay = allPossibleCols.filter(col => visibleColIds.has(col.colId));
        } else if (fieldConfig && typeof fieldConfig === 'object') {
            columnsToDisplay = allPossibleCols.filter(col => fieldConfig[col.colId]?.showInTable === true);
        } else {
            columnsToDisplay = allPossibleCols;
        }

        const thActions = document.createElement('th'); thActions.textContent = 'Ações'; thead.appendChild(thActions);
        columnsToDisplay.forEach(c => {
            const th = document.createElement('th'); th.textContent = c.label || c.colId;
            th.style.cursor = 'pointer';
            th.onclick = () => { sortColumn = c.colId; sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc'; renderContent(); };
            thead.appendChild(th);
        });
        
        const tbody = table.createTBody();
        for (const relRec of relatedRecords) {
            const tr = tbody.insertRow();
            const actionsCell = tr.insertCell();
            actionsCell.className = 'actions-cell';
            const menuBtn = document.createElement('button');
            menuBtn.className = 'reflist-action-menu-btn';
            menuBtn.disabled = isLocked;
            // Ícone de 3 pontos verticais
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
                renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleMap });
            }
        }
        tableContainer.appendChild(table);
        container.appendChild(tableContainer);

        const primaryTableId = record.gristHelper_tableId;
        const backReferenceColumn = Object.values(relatedSchema).find(col => col?.type === `Ref:${primaryTableId}`);
        const backReferenceColId = backReferenceColumn ? backReferenceColumn.colId : null;

        header.querySelector('.add-btn').onclick = () => handleAdd({ tableId: referencedTableId, onUpdate: renderContent, dataWriter, tableLens, backRefCol: backReferenceColId, parentRecId: record.id, parentTableId: primaryTableId, parentRefListColId: colSchema.colId, parentRecord: record, fieldConfig });
        tbody.querySelectorAll('tr').forEach((tr, index) => {
            const rec = relatedRecords[index];
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
    };

    document.addEventListener('click', closeAllMenus);
    container.addEventListener('remove', () => document.removeEventListener('click', closeAllMenus));

    await renderContent();
}