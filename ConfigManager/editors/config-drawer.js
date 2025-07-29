// ConfigManager/editors/config-drawer.js
import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';

const tableLens = new GristTableLens(grist); // NOVO: Instancia o lens para buscar schemas
let currentSchema = null;
const configJsonTextareaEl = document.getElementById('configJsonTextarea');

// updateJsonFromUI e addEventListeners permanecem os mesmos (sem alterações funcionais)
function updateJsonFromUI() {
    if (!currentSchema) return;
    const container = document.getElementById('specializedUiContainer');
    const drawerConfig = {
        displayMode: container.querySelector('#displayModeSelector').value,
        width: container.querySelector('#drawerWidthSelector').value,
        tabs: [],
        hiddenFields: [],
        lockedFields: [],
        refListColumns: {}
    };
    let currentTab = null;
    container.querySelectorAll('#unifiedFieldList > li').forEach(item => {
        if (item.classList.contains('tab-card')) {
            if (currentTab) drawerConfig.tabs.push(currentTab);
            currentTab = { title: item.querySelector('.tab-card-input').value, fields: [] };
        } else if (item.classList.contains('field-card')) {
            if (!currentTab) currentTab = { title: 'Principal', fields: [] };
            const colId = item.dataset.colId;
            currentTab.fields.push(colId);
            if (item.querySelector('.is-hidden-checkbox').checked) drawerConfig.hiddenFields.push(colId);
            if (item.querySelector('.is-locked-checkbox').checked) drawerConfig.lockedFields.push(colId);
            const refListConfigPanel = item.querySelector('.reflist-config-panel');
            if (refListConfigPanel) {
                const selectedCols = Array.from(refListConfigPanel.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.dataset.refColId);
                if (selectedCols.length > 0) drawerConfig.refListColumns[colId] = selectedCols;
            }
        }
    });
    if (currentTab) drawerConfig.tabs.push(currentTab);
    configJsonTextareaEl.value = JSON.stringify(drawerConfig, null, 2);
}
function addEventListeners(container) {
    container.addEventListener('change', updateJsonFromUI);
    const fieldOrderList = container.querySelector('#unifiedFieldList');
    if (fieldOrderList) fieldOrderList.addEventListener('drop', () => setTimeout(updateJsonFromUI, 0));
}

// MUDANÇA: render agora é async para poder usar await
export async function render(container, configData, tableSchema) {
    currentSchema = tableSchema; // A assinatura volta ao original, recebendo apenas o schema da tabela principal.
    if (!currentSchema) {
        container.innerHTML = '<p>Selecione uma tabela acima para começar a configurar os campos.</p>';
        return;
    }
    
    const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
    configData.tabs = configData.tabs || [{ title: 'Principal', fields: configData.fieldOrder || allCols.map(c => c.colId) }];
    configData.hiddenFields = configData.hiddenFields || [];
    configData.lockedFields = configData.lockedFields || [];
    configData.refListColumns = configData.refListColumns || {};
	configData.displayMode = configData.displayMode || 'drawer';

    let html = `
        <div class="drawer-config-section">
            <label for="displayModeSelector">Modo de Exibição:</label>
            <select id="displayModeSelector">
                <option value="drawer" ${configData.displayMode === 'drawer' ? 'selected' : ''}>Painel Lateral (Drawer)</option>
                <option value="modal" ${configData.displayMode === 'modal' ? 'selected' : ''}>Janela Flutuante (Modal)</option>
            </select>
        </div>
        <div class="drawer-config-section">
            <label for="drawerWidthSelector">Largura:</label>
            <select id="drawerWidthSelector">
                ${['25%', '40%', '50%', '60%', '75%'].map(w => `<option value="${w}" ${configData.width === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
        </div>
        <div class="drawer-config-section">
            <button type="button" id="addTabBtn" class="btn btn-primary add-tab-btn">📑 + Adicionar Aba</button>
            <ul id="unifiedFieldList" class="field-order-list"></ul>
        </div>
    `;
    container.innerHTML = html;

    const unifiedListEl = container.querySelector('#unifiedFieldList');
    const usedFields = new Set();

    // MUDANÇA: Usando for...of para permitir await dentro do loop
    for (const tab of configData.tabs) {
        unifiedListEl.appendChild(createTabCard(tab.title));
        for (const fieldId of tab.fields) {
            const col = allCols.find(c => c.colId === fieldId);
            if (col) {
                const card = await createFieldCard(col, configData); // Espera a criação do card
                unifiedListEl.appendChild(card);
                usedFields.add(fieldId);
            }
        }
    }

    // MUDANÇA: Usando for...of para permitir await dentro do loop
    for (const col of allCols) {
        if (!usedFields.has(col.colId)) {
            const card = await createFieldCard(col, configData);
            unifiedListEl.appendChild(card);
        }
    }
    
    document.getElementById('addTabBtn').addEventListener('click', () => {
        unifiedListEl.prepend(createTabCard('Nova Aba'));
        updateJsonFromUI();
    });

    enableDragAndDrop(unifiedListEl);
    addEventListeners(container);
    updateJsonFromUI();
}

export function read(container) {
    updateJsonFromUI();
    return JSON.parse(configJsonTextareaEl.value || '{}');
}

// MUDANÇA: createFieldCard agora é async e busca o schema sob demanda
async function createFieldCard(col, configData) {
    const isHidden = configData.hiddenFields.includes(col.colId);
    const isLocked = configData.lockedFields.includes(col.colId);
    const card = document.createElement('li');
    card.className = 'field-card';
    card.dataset.colId = col.colId;
    card.draggable = true;

    let refListConfigHtml = '';
    if (col.type.startsWith('RefList:')) {
        const referencedTableId = col.type.split(':')[1];
        // LÓGICA CORRIGIDA: Busca o schema específico quando necessário
        const referencedSchema = await tableLens.getTableSchema(referencedTableId);
        
        let columnCheckboxes = `<p class="error-text">Schema da tabela '${referencedTableId}' não encontrado.</p>`;
        if (referencedSchema) {
            const configuredCols = configData.refListColumns[col.colId] || [];
            columnCheckboxes = Object.values(referencedSchema)
                .filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos')
                .map(refCol => `
                    <label class="reflist-config-item">
                        <input type="checkbox" data-ref-col-id="${refCol.colId}" ${configuredCols.includes(refCol.colId) ? 'checked' : ''}>
                        ${refCol.label}
                    </label>
                `).join('');
        }
        
        refListConfigHtml = `
            <div class="field-card-extra-actions">
                <button type="button" class="btn btn-secondary btn-sm toggle-reflist-config">Configurar Colunas</button>
            </div>
            <div class="reflist-config-panel" style="display: none;">
                <h5>Colunas a Exibir de ${referencedTableId}</h5>
                <div class="reflist-config-list">${columnCheckboxes}</div>
            </div>
        `;
    }

    card.innerHTML = `
        <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span>
        <div class="field-card-controls">
            <label><input type="checkbox" class="is-hidden-checkbox" ${isHidden ? 'checked' : ''}> Oculto</label>
            <label><input type="checkbox" class="is-locked-checkbox" ${isLocked ? 'checked' : ''}> Travado</label>
        </div>
        ${refListConfigHtml}
    `;

    const toggleBtn = card.querySelector('.toggle-reflist-config');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const panel = card.querySelector('.reflist-config-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    return card;
}

// O resto do arquivo (createTabCard, enableDragAndDrop, etc.) permanece inalterado.
function createTabCard(title) { const card = document.createElement('li'); card.className = 'tab-card'; card.draggable = true; card.innerHTML = ` <span class="tab-card-icon">📑</span> <input type="text" class="tab-card-input" value="${title}"> <button type="button" class="delete-tab-btn" title="Deletar Aba">🗑️</button> `; card.querySelector('.delete-tab-btn').addEventListener('click', (e) => { e.preventDefault(); const tabTitle = card.querySelector('.tab-card-input').value; if (confirm(`Tem certeza que deseja deletar a aba "${tabTitle}"?`)) { const fieldsToMove = []; let nextSibling = card.nextElementSibling; while (nextSibling && nextSibling.classList.contains('field-card')) { fieldsToMove.push(nextSibling); nextSibling = nextSibling.nextElementSibling; } let insertionPoint = null; let previousSibling = card.previousElementSibling; while (previousSibling) { if (previousSibling.classList.contains('tab-card')) { insertionPoint = previousSibling; break; } previousSibling = previousSibling.previousElementSibling; } for (let i = fieldsToMove.length - 1; i >= 0; i--) { const field = fieldsToMove[i]; if (insertionPoint) { insertionPoint.insertAdjacentElement('afterend', field); } else { card.parentElement.prepend(field); } } card.remove(); updateJsonFromUI(); } }); return card; }
function enableDragAndDrop(listElement) { if (!listElement) return; let draggedItem = null; listElement.addEventListener('dragstart', e => { draggedItem = e.target.closest('li'); setTimeout(() => draggedItem.classList.add('dragging'), 0); }); listElement.addEventListener('dragend', () => { if (draggedItem) draggedItem.classList.remove('dragging'); }); listElement.addEventListener('dragover', e => { e.preventDefault(); const afterElement = getDragAfterElement(listElement, e.clientY); if (afterElement == null) { listElement.appendChild(draggedItem); } else { listElement.insertBefore(draggedItem, afterElement); } }); }
function getDragAfterElement(container, y) { const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging), .tab-card:not(.dragging)')]; return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; }