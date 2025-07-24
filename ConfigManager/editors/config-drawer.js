// ConfigManager/editors/config-drawer.js

let currentSchema = null;
let currentAllSchemas = null; // Armazena o schema de todas as tabelas
const configJsonTextareaEl = document.getElementById('configJsonTextarea');

function updateJsonFromUI() {
    if (!currentSchema) return;
    console.log("Sincronizando UI (com Abas) -> JSON...");

    const container = document.getElementById('specializedUiContainer');
    const drawerConfig = {
        displayMode: container.querySelector('#displayModeSelector').value,
        width: container.querySelector('#drawerWidthSelector').value,
        tabs: [],
        hiddenFields: [],
        lockedFields: [],
        refListColumns: {} // Novo: objeto para armazenar a config das colunas de RefLists
    };

    let currentTab = null;

    container.querySelectorAll('#unifiedFieldList > li').forEach(item => {
        if (item.classList.contains('tab-card')) {
            if (currentTab) {
                drawerConfig.tabs.push(currentTab);
            }
            currentTab = {
                title: item.querySelector('.tab-card-input').value,
                fields: []
            };
        } else if (item.classList.contains('field-card')) {
            if (!currentTab) {
                currentTab = { title: 'Principal', fields: [] };
            }
            const colId = item.dataset.colId;
            currentTab.fields.push(colId);

            if (item.querySelector('.is-hidden-checkbox').checked) {
                drawerConfig.hiddenFields.push(colId);
            }
            if (item.querySelector('.is-locked-checkbox').checked) {
                drawerConfig.lockedFields.push(colId);
            }

            // NOVO: Coleta a configuração das colunas da RefList
            const refListConfigPanel = item.querySelector('.reflist-config-panel');
            if (refListConfigPanel) {
                const selectedCols = Array.from(refListConfigPanel.querySelectorAll('input[type="checkbox"]:checked'))
                                          .map(cb => cb.dataset.refColId);
                if (selectedCols.length > 0) {
                    drawerConfig.refListColumns[colId] = selectedCols;
                }
            }
        }
    });

    if (currentTab) {
        drawerConfig.tabs.push(currentTab);
    }
    
    configJsonTextareaEl.value = JSON.stringify(drawerConfig, null, 2);
}

function addEventListeners(container) {
    container.addEventListener('change', updateJsonFromUI);
    const fieldOrderList = container.querySelector('#unifiedFieldList');
    if (fieldOrderList) {
        fieldOrderList.addEventListener('drop', () => setTimeout(updateJsonFromUI, 0));
    }
}

// Assinatura alterada para receber o schema de todas as tabelas
export function render(container, configData, tableSchema, allTablesSchema) {
    currentSchema = tableSchema;
    currentAllSchemas = allTablesSchema; // Armazena o schema completo
    if (!currentSchema) {
        container.innerHTML = '<p>Selecione uma tabela acima para começar a configurar os campos.</p>';
        return;
    }
    
    const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
    configData.tabs = configData.tabs || [{ title: 'Principal', fields: configData.fieldOrder || allCols.map(c => c.colId) }];
    configData.hiddenFields = configData.hiddenFields || [];
    configData.lockedFields = configData.lockedFields || [];
    configData.refListColumns = configData.refListColumns || {}; // Inicializa o novo objeto
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
            <button id="addTabBtn" class="btn btn-primary add-tab-btn">📑 + Adicionar Aba</button>
            <ul id="unifiedFieldList" class="field-order-list"></ul>
        </div>
    `;
    container.innerHTML = html;

    const unifiedListEl = container.querySelector('#unifiedFieldList');
    const usedFields = new Set();

    configData.tabs.forEach(tab => {
        unifiedListEl.appendChild(createTabCard(tab.title));
        tab.fields.forEach(fieldId => {
            const col = allCols.find(c => c.colId === fieldId);
            if (col) {
                // Passa o schema de todas as tabelas para o criador do card
                unifiedListEl.appendChild(createFieldCard(col, configData, currentAllSchemas));
                usedFields.add(fieldId);
            }
        });
    });

    allCols.forEach(col => {
        if (!usedFields.has(col.colId)) {
            unifiedListEl.appendChild(createFieldCard(col, configData, currentAllSchemas));
        }
    });
    
    document.getElementById('addTabBtn').addEventListener('click', () => {
        const newTabCard = createTabCard('Nova Aba');
        unifiedListEl.prepend(newTabCard);
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

// --- Funções Criadoras de Elementos ---

// Assinatura alterada para receber o schema de todas as tabelas
function createFieldCard(col, configData, allTablesSchema) {
    const isHidden = configData.hiddenFields.includes(col.colId);
    const isLocked = configData.lockedFields.includes(col.colId);
    const card = document.createElement('li');
    card.className = 'field-card';
    card.dataset.colId = col.colId;
    card.draggable = true;

    // NOVO: Lógica para campos RefList
    let refListConfigHtml = '';
    if (col.type.startsWith('RefList:')) {
        const referencedTableId = col.type.split(':')[1];
        const referencedSchema = allTablesSchema ? allTablesSchema[referencedTableId]?.columns : null;
        
        let columnCheckboxes = '<p>Schema da tabela referenciada não encontrado.</p>';
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
                <button class="btn btn-secondary btn-sm toggle-reflist-config">Configurar Colunas</button>
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

    // NOVO: Adiciona o event listener para o botão de toggle
    const toggleBtn = card.querySelector('.toggle-reflist-config');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const panel = card.querySelector('.reflist-config-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    return card;
}


function createTabCard(title) {
    const card = document.createElement('li');
    card.className = 'tab-card';
    card.draggable = true;
    
    card.innerHTML = `
        <span class="tab-card-icon">📑</span>
        <input type="text" class="tab-card-input" value="${title}">
        <button class="delete-tab-btn" title="Deletar Aba">🗑️</button>
    `;
    
    card.querySelector('.delete-tab-btn').addEventListener('click', () => {
        const tabTitle = card.querySelector('.tab-card-input').value;
        if (confirm(`Tem certeza que deseja deletar a aba "${tabTitle}"?`)) {
            const fieldsToMove = [];
            let nextSibling = card.nextElementSibling;
            while (nextSibling && nextSibling.classList.contains('field-card')) {
                fieldsToMove.push(nextSibling);
                nextSibling = nextSibling.nextElementSibling;
            }

            let insertionPoint = null;
            let previousSibling = card.previousElementSibling;
            while (previousSibling) {
                if (previousSibling.classList.contains('tab-card')) {
                    insertionPoint = previousSibling;
                    break;
                }
                previousSibling = previousSibling.previousElementSibling;
            }

            for (let i = fieldsToMove.length - 1; i >= 0; i--) {
                const field = fieldsToMove[i];
                if (insertionPoint) {
                    insertionPoint.insertAdjacentElement('afterend', field);
                } else {
                    card.parentElement.prepend(field);
                }
            }

            card.remove();
            updateJsonFromUI();
        }
    });

    return card;
}

// --- Funções de Drag and Drop (sem alterações) ---

function enableDragAndDrop(listElement) {
    if (!listElement) return;
    let draggedItem = null;
    listElement.addEventListener('dragstart', e => {
        draggedItem = e.target.closest('li');
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    });
    listElement.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
    });
    listElement.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(draggedItem);
        } else {
            listElement.insertBefore(draggedItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.field-card:not(.dragging), .tab-card:not(.dragging)')];
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