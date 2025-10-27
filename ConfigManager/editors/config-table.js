
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

        container.innerHTML = `
            <div class="config-section-title">Colunas Visíveis e Ordem</div>
            <p class="editor-instructions">Arraste e solte as colunas para reordenar. Desmarque para ocultar.</p>
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
                columnListEl.appendChild(createColumnCard(col, true));
            }
        }

        // Render available (hidden) columns
        for (const col of allCols) {
            if (!visibleColIds.has(col.colId)) {
                availableColumnListEl.appendChild(createColumnCard(col, false));
            }
        }

        enableDragAndDrop([columnListEl, availableColumnListEl]);
    }

    function read(container) {
        if (!currentSchema) return {};

        const columnListEl = container.querySelector('#column-list');
        const visibleItems = Array.from(columnListEl.querySelectorAll('.field-card'));

        const config = {
            tableId: currentTableId,
            columns: visibleItems.map(item => ({
                colId: item.dataset.colId,
                // Placeholder for future settings
                width: null,
                align: 'left',
            })),
        };

        return config;
    }

    function createColumnCard(col, isVisible) {
        const card = document.createElement('li');
        card.className = 'field-card';
        card.dataset.colId = col.colId;
        card.draggable = true;

        card.innerHTML = `
            <span class="field-card-label">${col.label} <span class="field-card-type">(${col.type})</span></span>
            <div class="field-card-controls">
                <label class="config-toggle">
                    <input type="checkbox" class="is-visible-checkbox" ${isVisible ? 'checked' : ''}>
                    Visível
                </label>
            </div>
        `;

        card.querySelector('.is-visible-checkbox').addEventListener('change', (e) => {
            const targetList = e.target.checked ? _mainContainer.querySelector('#column-list') : _mainContainer.querySelector('#available-column-list');
            targetList.appendChild(card);
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
