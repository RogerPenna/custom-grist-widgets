// js/modaud_ui.js

/**
 * Renderiza os cards das perguntas no DOM, respeitando a hierarquia.
 * @param {HTMLElement} container - O elemento container onde os cards serão inseridos.
 * @param {Array<Object>} records - O array completo de registros de perguntas.
 */
export function renderizarPerguntas(container, records) {
    container.innerHTML = ''; // Limpa o conteúdo antigo

    if (!records || records.length === 0) {
        container.innerHTML = '<p>Nenhuma pergunta encontrada neste modelo.</p>';
        return;
    }
    
    // 1. Mapear registros por ID e preparar a estrutura de árvore
    const recordsMap = new Map(records.map(r => [r.id, {...r, children: []}]));
    const rootRecords = [];

    for (const record of recordsMap.values()) {
        const parentId = record.ID_Pai; // ID_Pai pode ser 0 ou null/undefined
        if (parentId && recordsMap.has(parentId)) {
            recordsMap.get(parentId).children.push(record);
        } else {
            rootRecords.push(record);
        }
    }
    
    // 2. Ordenar os nós em cada nível
    const sortFn = (a, b) => (a.Ordem || 0) - (b.Ordem || 0);
    rootRecords.sort(sortFn);
    for (const record of recordsMap.values()) {
        if (record.children.length > 1) {
            record.children.sort(sortFn);
        }
    }
    
    // 3. Função recursiva para criar os elementos no DOM
    function criarHierarquiaDOM(items, parentElement) {
        for (const item of items) {
            // Cria o card principal
            const card = document.createElement('div');
            card.className = 'pergunta-card';
            card.dataset.id = item.id;
            
            card.innerHTML = `
                <span class="drag-handle">::</span>
                <span class="pergunta-texto">${item.Texto_Pergunta || '(Pergunta sem texto)'}</span>
            `;
            parentElement.appendChild(card);
            
            // Se o item tem filhos, cria um sub-container para eles
            if (item.children.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'sub-perguntas-container sortable-list';
                subContainer.dataset.parentId = item.id; // Identifica o pai deste container
                parentElement.appendChild(subContainer);
                // Chama a função recursivamente para os filhos
                criarHierarquiaDOM(item.children, subContainer);
            }
        }
    }
    
    // Inicia a renderização a partir dos itens raiz no container principal
    criarHierarquiaDOM(rootRecords, container);
}