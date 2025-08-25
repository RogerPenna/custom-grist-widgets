// js/modaud_ui.js

/**
 * Renderiza os cards das perguntas no DOM, respeitando a hierarquia.
 * @param {HTMLElement} container - O elemento container onde os cards serão inseridos.
 * @param {Array<Object>} records - O array completo de registros de perguntas.
 */
export function renderizarPerguntas(container, records) {
    container.innerHTML = ''; // Limpa o conteúdo antigo

    if (!records || records.length === 0) {
        container.innerHTML = '<p>Nenhuma pergunta encontrada para este contexto.</p>';
        return;
    }
    
    const recordsMap = new Map(records.map(r => [r.id, {...r, children: []}]));
    const rootRecords = [];

    for (const record of recordsMap.values()) {
        const parentId = record.ID_Pai;
        if (parentId && recordsMap.has(parentId)) {
            recordsMap.get(parentId).children.push(record);
        } else {
            rootRecords.push(record);
        }
    }
    
    const sortFn = (a, b) => (a.Ordem || 0) - (b.Ordem || 0);
    rootRecords.sort(sortFn);
    for (const record of recordsMap.values()) {
        if (record.children.length > 1) {
            record.children.sort(sortFn);
        }
    }
    
    /**
     * Função recursiva para criar os elementos no DOM.
     * @param {Array} items - Os itens a serem renderizados neste nível.
     * @param {HTMLElement} parentDomElement - O elemento do DOM onde os novos itens serão anexados.
     */
    function criarHierarquiaDOM(items, parentDomElement) {
        for (const item of items) {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'card-wrapper';
            
            const card = document.createElement('div');
            card.className = 'pergunta-card';
            card.dataset.id = item.id;
            card.innerHTML = `
                <span class="drag-handle">::</span>
                <span class="pergunta-texto">${item.Texto_Pergunta || '(Pergunta sem texto)'}</span>
                <span class="item-tipo">${item.Tipo_Item || ''}</span>
                <button class="add-child-btn" title="Adicionar sub-item">+</button>
                <button class="edit-btn" title="Editar detalhes">⚙️</button>
            `;
            cardWrapper.appendChild(card);
            
            const subContainer = document.createElement('div');
            subContainer.className = 'sub-perguntas-container sortable-list';
            if (item.children.length === 0) {
                subContainer.classList.add('empty');
            }
            subContainer.dataset.parentId = item.id;
            cardWrapper.appendChild(subContainer);
    
            parentDomElement.appendChild(cardWrapper);
            
            if (item.children.length > 0) {
                criarHierarquiaDOM(item.children, subContainer);
            }
        }
        
        // CORREÇÃO: Adiciona o botão "+" de irmão ao final do container pai correto.
        // A variável 'parentDomElement' está sempre definida dentro desta função.
        parentDomElement.insertAdjacentHTML('beforeend', '<button class="add-sibling-btn" title="Adicionar item neste nível">+</button>');
    }
    
    // Inicia a renderização a partir dos itens raiz no container principal
    criarHierarquiaDOM(rootRecords, container);
}