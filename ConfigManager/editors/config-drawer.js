// ConfigManager/editors/config-drawer.js

let currentSchema = null;
const configJsonTextareaEl = document.getElementById('configJsonTextarea');

function updateJsonFromUI() {
    if (!currentSchema) return;
    console.log("Sincronizando UI (com Abas) -> JSON...");

    const container = document.getElementById('specializedUiContainer');
    const drawerConfig = {
        width: container.querySelector('#drawerWidthSelector').value,
        tabs: [],
        hiddenFields: [],
        lockedFields: []
    };

    let currentTab = null;

    container.querySelectorAll('#unifiedFieldList > li').forEach(item => {
        if (item.classList.contains('tab-card')) {
            // Se já tínhamos uma aba sendo construída, salva ela
            if (currentTab) {
                drawerConfig.tabs.push(currentTab);
            }
            // Inicia uma nova aba
            currentTab = {
                title: item.querySelector('.tab-card-input').value,
                fields: []
            };
        } else if (item.classList.contains('field-card')) {
            // Se encontrarmos um campo antes de uma aba, cria uma aba padrão
            if (!currentTab) {
                currentTab = { title: 'Principal', fields: [] };
            }
            const colId = item.dataset.colId;
            currentTab.fields.push(colId);

            // Coleta os estados de hidden/locked
            if (item.querySelector('.is-hidden-checkbox').checked) {
                drawerConfig.hiddenFields.push(colId);
            }
            if (item.querySelector('.is-locked-checkbox').checked) {
                drawerConfig.lockedFields.push(colId);
            }
        }
    });

    // Garante que a última aba seja salva
    if (currentTab) {
        drawerConfig.tabs.push(currentTab);
    }
    
    configJsonTextareaEl.value = JSON.stringify(drawerConfig, null, 2);
}

function addEventListeners(container) {
    container.addEventListener('change', updateJsonFromUI); // Para selects, checkboxes e inputs de texto da aba
    const fieldOrderList = container.querySelector('#unifiedFieldList');
    if (fieldOrderList) {
        fieldOrderList.addEventListener('drop', () => setTimeout(updateJsonFromUI, 0));
    }
}

export function render(container, configData, tableSchema) {
    currentSchema = tableSchema;
    if (!currentSchema) {
        container.innerHTML = '<p>Selecione uma tabela acima para começar a configurar os campos.</p>';
        return;
    }
    
    const allCols = Object.values(currentSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
    // Normaliza os dados de entrada
    configData.tabs = configData.tabs || [{ title: 'Principal', fields: configData.fieldOrder || allCols.map(c => c.colId) }];
    configData.hiddenFields = configData.hiddenFields || [];
    configData.lockedFields = configData.lockedFields || [];

    let html = `
        <div class="drawer-config-section">
            <label for="drawerWidthSelector">Largura do Drawer:</label>
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

    // Renderiza abas e campos existentes
    configData.tabs.forEach(tab => {
        unifiedListEl.appendChild(createTabCard(tab.title));
        tab.fields.forEach(fieldId => {
            const col = allCols.find(c => c.colId === fieldId);
            if (col) {
                unifiedListEl.appendChild(createFieldCard(col, configData));
                usedFields.add(fieldId);
            }
        });
    });

    // Renderiza campos novos que não estão em nenhuma aba
    allCols.forEach(col => {
        if (!usedFields.has(col.colId)) {
            unifiedListEl.appendChild(createFieldCard(col, configData));
        }
    });
    
    // Adiciona o listener para o novo botão
    document.getElementById('addTabBtn').addEventListener('click', () => {
        const newTabCard = createTabCard('Nova Aba');
        unifiedListEl.prepend(newTabCard); // Adiciona no topo por padrão
        updateJsonFromUI();
    });

    enableDragAndDrop(unifiedListEl);
    addEventListeners(container);
    // Sincroniza uma vez no carregamento
    updateJsonFromUI();
}

export function read(container) {
    // A fonte da verdade agora é o que `updateJsonFromUI` escreve no textarea.
    // Esta função apenas precisa garantir que a última versão seja construída e retornada.
    updateJsonFromUI();
    return JSON.parse(configJsonTextareaEl.value || '{}');
}

// --- Funções Criadoras de Elementos ---

function createFieldCard(col, configData) {
    const isHidden = configData.hiddenFields.includes(col.colId);
    const isLocked = configData.lockedFields.includes(col.colId);
    const card = document.createElement('li');
    card.className = 'field-card';
    card.dataset.colId = col.colId;
    card.draggable = true;
    card.innerHTML = `
        <span class="field-card-label">${col.label}</span>
        <div class="field-card-controls">
            <label><input type="checkbox" class="is-hidden-checkbox" ${isHidden ? 'checked' : ''}> Oculto</label>
            <label><input type="checkbox" class="is-locked-checkbox" ${isLocked ? 'checked' : ''}> Travado</label>
        </div>
    `;
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
            
            // --- INÍCIO DA NOVA LÓGICA DE DELEÇÃO ---

            // 1. Coleta todos os campos que pertencem a esta aba
            const fieldsToMove = [];
            let nextSibling = card.nextElementSibling;
            while (nextSibling && nextSibling.classList.contains('field-card')) {
                fieldsToMove.push(nextSibling);
                nextSibling = nextSibling.nextElementSibling;
            }

            // 2. Encontra o ponto de inserção (a aba anterior ou o início da lista)
            let insertionPoint = null;
            let previousSibling = card.previousElementSibling;
            while (previousSibling) {
                if (previousSibling.classList.contains('tab-card')) {
                    insertionPoint = previousSibling;
                    break;
                }
                previousSibling = previousSibling.previousElementSibling;
            }

            // 3. Move os campos para a nova posição
            // Nós iteramos ao contrário para manter a ordem original ao inserir
            for (let i = fieldsToMove.length - 1; i >= 0; i--) {
                const field = fieldsToMove[i];
                if (insertionPoint) {
                    // Insere após o card da aba anterior
                    insertionPoint.insertAdjacentElement('afterend', field);
                } else {
                    // Se não há aba anterior, move para o topo da lista
                    card.parentElement.prepend(field);
                }
            }

            // 4. Remove o card da aba
            card.remove();
            updateJsonFromUI(); // Atualiza o JSON
            // --- FIM DA NOVA LÓGICA DE DELEÇÃO ---
        }
    });

    return card;
}

// --- Funções de Drag and Drop ---

function enableDragAndDrop(listElement) {
    if (!listElement) return;
    let draggedItem = null;
    listElement.addEventListener('dragstart', e => {
        draggedItem = e.target.closest('li'); // Garante que pegamos o <li>
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