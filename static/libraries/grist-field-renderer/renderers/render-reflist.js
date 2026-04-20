// static/libraries/grist-field-renderer/renderers/render-reflist.js
// render-reflist.js - VERSÃO 3.1 (ULTRA-ROBUSTA: CORREÇÃO DE ANINHAMENTO)
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
    modalOptions.onSave = async (newRecordFromForm) => {
        const finalRecord = { ...newRecordFromForm };
        if (backRefCol && parentRecId) { finalRecord[backRefCol] = parentRecId; }
        const result = await dataWriter.addRecord(tableId, finalRecord);
        const newChildId = result.retValues[0];
        const refListValue = parentRecord[parentRefListColId];
        const existingChildIds = (Array.isArray(refListValue) && refListValue[0] === 'L') ? refListValue.slice(1) : [];
        const updatedChildIds = ['L', ...existingChildIds, newChildId];
        await dataWriter.updateRecord(parentTableId, parentRecId, { [parentRefListColId]: updatedChildIds });
        publish('data-changed', { tableId: parentTableId, recordId: parentRecId, action: 'update' });
        onUpdate();
    };
    openModal(modalOptions);
}

async function handleEdit(tableId, recordId, onUpdate, dataWriter, tableLens, fieldConfig) {
    const schema = await tableLens.getTableSchema(tableId);
    const record = await tableLens.fetchRecordById(tableId, recordId);
    const modalOptions = { title: `Editando ${recordId}`, tableId, record, schema, tableLens, onSave: async (changes) => { await dataWriter.updateRecord(tableId, recordId, changes); onUpdate(); } };
    openModal(modalOptions);
}

async function handleDelete(tableId, recordId, onUpdate, dataWriter) { if (confirm(`Excluir registro?`)) { await dataWriter.deleteRecords(tableId, [recordId]); onUpdate(); } }

export async function renderRefList(options) {
    const { container, record, colSchema, tableLens, isLocked, ruleIdToColIdMap } = options;
    const fieldConfig = options.fieldConfig || options.fieldStyle || {};
    
    // --- LÓGICA DE EXTRAÇÃO ULTRA-ROBUSTA (RESOLVE ANINHAMENTO) ---
    let rawRefConfig = fieldConfig._refListConfig || fieldConfig.refListConfig?._refListConfig || fieldConfig.refListConfig || {};
    let optionsNode = fieldConfig._options || fieldConfig.refListConfig?._options || {};

    const zebraEnabled = optionsNode.zebra || rawRefConfig.zebra || false;
    const isCollapsible = rawRefConfig.collapsible || false;
    const displayMode = rawRefConfig.displayAs || 'table';

    console.group(`%c [RefList Renderer 3.1 STATIC] ${colSchema.colId} `, 'background: #700; color: #fff; font-weight: bold;');
    console.log("JSON Bruto recebido:", fieldConfig);
    console.log("Config Extraída (Normalizada):", { displayMode, zebraEnabled, isCollapsible });
    console.groupEnd();

    let isCollapsed = container.dataset.collapsed === 'true' || (container.dataset.collapsed === undefined && isCollapsible);
    
    const dataWriter = (tableLens && tableLens.docApi) ? new GristDataWriter(tableLens.docApi) : new GristDataWriter(window.grist);
    const referencedTableId = colSchema.type.split(':')[1];

    const renderContent = async () => {
        container.innerHTML = '';
        if (isLocked) container.closest('.drawer-field')?.classList.add('is-locked-style');

        // --- MODO RETRÁTIL (HEADER) ---
        if (isCollapsible) {
            const header = document.createElement('div');
            header.className = 'grf-reflist-header collapsible-header';
            header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-weight: 700; color: #1e293b; box-shadow: 0 1px 2px rgba(0,0,0,0.05);`;
            
            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = `<span style="display:inline-block; width: 20px; transition: transform 0.2s; transform: ${isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'}">▶️</span> ${colSchema.label || 'Sub-Tabela'}`;
            header.appendChild(titleSpan);

            header.onclick = (e) => { 
                e.stopPropagation(); 
                isCollapsed = !isCollapsed; 
                container.dataset.collapsed = isCollapsed;
                renderContent(); 
            };
            container.appendChild(header);

            if (isCollapsed) {
                const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
                const countBadge = document.createElement('span');
                countBadge.textContent = `${relatedRecords.length} itens`;
                countBadge.style.cssText = `background: #f1f5f9; padding: 2px 10px; border-radius: 12px; font-size: 0.75em; border: 1px solid #cbd5e1;`;
                header.appendChild(countBadge);
                return;
            }
        }

        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        const relatedSchema = await tableLens.getTableSchema(referencedTableId);

        let columnsToDisplay = Object.values(relatedSchema).filter(c => c && !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        
        const configColumns = rawRefConfig.columns || [];
        if (Array.isArray(configColumns) && configColumns.length > 0) {
             if (typeof configColumns[0] === 'object') {
                 columnsToDisplay = configColumns.filter(c => c.visible).map(c => relatedSchema[c.colId]).filter(Boolean);
             } else {
                 columnsToDisplay = columnsToDisplay.filter(c => configColumns.includes(c.colId));
             }
        } else {
            const source = fieldConfig.refListConfig || fieldConfig;
            const configured = columnsToDisplay.filter(c => source[c.colId]?.showInTable === true);
            if (configured.length > 0) columnsToDisplay = configured;
        }

        if (options.isEditing && displayMode !== 'cards') {
            const addBtn = document.createElement('button');
            addBtn.innerHTML = "➕ Adicionar Registro";
            addBtn.className = "btn btn-sm btn-primary";
            addBtn.style.cssText = "margin-bottom: 12px; font-weight: 600; border-radius: 6px; padding: 4px 12px;";
            addBtn.onclick = () => handleAdd({ tableId: referencedTableId, onUpdate: renderContent, dataWriter, tableLens, parentRecId: record.id, parentTableId: record.gristHelper_tableId, parentRefListColId: colSchema.colId, parentRecord: record, fieldConfig });
            container.appendChild(addBtn);
        }

        if (displayMode === 'tabulator' && window.Tabulator) {
            const tabDiv = document.createElement('div');
            tabDiv.style.borderRadius = "8px";
            tabDiv.style.overflow = "hidden";
            tabDiv.style.border = "1px solid #e2e8f0";
            container.appendChild(tabDiv);
            new Tabulator(tabDiv, {
                data: relatedRecords,
                layout: "fitColumns",
                maxHeight: "400px",
                columns: [
                    { title: "Ações", width: 60, headerSort: false, hozAlign:"center", formatter: () => "⋮", cellClick: (e, cell) => handleEdit(referencedTableId, cell.getRow().getData().id, renderContent, dataWriter, tableLens, fieldConfig) },
                    ...columnsToDisplay.map(c => ({
                        title: c.label, field: c.colId,
                        formatter: (cell) => {
                            const d = document.createElement('div');
                            d.style.padding = "4px 0";
                            renderField({ container: d, colSchema: c, record: cell.getRow().getData(), tableLens, ruleIdToColIdMap: ruleIdToColIdMap, fieldConfig, isChild: true });
                            return d;
                        }
                    }))
                ]
            });
        } 
        else if (displayMode === 'cards') {
            const { CardSystem } = await import('../../grist-card-system/CardSystem.js');
            const cardConfig = await tableLens.fetchConfig(rawRefConfig.cardConfigId);
            const cardWrap = document.createElement('div');
            container.appendChild(cardWrap);
            if (CardSystem) CardSystem.renderCards(cardWrap, relatedRecords, { ...cardConfig, isRefList: true }, relatedSchema, tableLens);
        }
        else {
            const wrap = document.createElement('div');
            wrap.className = 'grf-reflist-table-container';
            const table = document.createElement('table');
            table.className = 'grf-reflist-table';
            if (zebraEnabled) table.classList.add('is-zebra-striped');

            const thead = table.createTHead().insertRow();
            const actTh = thead.insertCell(); actTh.textContent = "Ações"; actTh.style.fontWeight = "bold";
            columnsToDisplay.forEach(c => { const th = thead.insertCell(); th.textContent = c.label; th.style.fontWeight = "bold"; });

            const tbody = table.createTBody();
            relatedRecords.forEach(relRec => {
                const tr = tbody.insertRow();
                const actCell = tr.insertCell();
                actCell.innerHTML = "⋮";
                actCell.style.cursor = "pointer";
                actCell.style.textAlign = "center";
                actCell.onclick = () => handleEdit(referencedTableId, relRec.id, renderContent, dataWriter, tableLens, fieldConfig);
                
                columnsToDisplay.forEach(c => {
                    const td = tr.insertCell();
                    renderField({ container: td, colSchema: c, record: relRec, tableLens, ruleIdToColIdMap: ruleIdToColIdMap, fieldConfig, isChild: true });
                });
            });
            wrap.appendChild(table);
            container.appendChild(wrap);
        }
    };
    await renderContent();
}
