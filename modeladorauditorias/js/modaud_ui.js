// js/modaud_ui.js

/**
 * Cria o elemento HTML para um único card de pergunta.
 * @param {object} pergunta - O objeto da pergunta.
 * @returns {HTMLElement} O elemento do card.
 */
function criarCardElemento(pergunta) {
    const card = document.createElement('div');
    card.className = 'pergunta-card';
    card.dataset.id = pergunta.id; // Crucial para identificar o card
    
    // Adiciona um atributo para o ID_Pai atual, para facilitar o cálculo depois
    card.dataset.idPai = pergunta.ID_Pai || 0;

    card.innerHTML = `
        <div class="handle-drag" title="Arrastar para mover">☰</div>
        <div class="texto-pergunta">${pergunta.Texto_Pergunta || 'Pergunta sem texto'}</div>
        <div class="drop-zone-filho" title="Solte aqui para tornar esta pergunta filha da acima"></div>
    `;
    return card;
}

/**
 * Renderiza a lista de perguntas como uma árvore de cards no DOM.
 * @param {Array<Object>} perguntas - Array de registros da tabela Modelos_Perguntas.
 */
export function renderizarPerguntas(perguntas) {
    const container = document.getElementById('lista-perguntas');
    if (!container) return;
    container.innerHTML = '';

    // Ordena por ordem para garantir a estrutura inicial correta
    const perguntasOrdenadas = [...perguntas].sort((a, b) => a.Ordem - b.Ordem);

    const elementosMap = new Map(); // Mapa de id da pergunta para seu elemento HTML
    const containerPrincipal = document.getElementById('lista-perguntas');

    for (const pergunta of perguntasOrdenadas) {
        const elementoCard = criarCardElemento(pergunta);
        elementosMap.set(pergunta.id, elementoCard);

        const idPai = pergunta.ID_Pai || 0;
        
        if (idPai === 0) {
            // Se for um item raiz, adiciona ao contêiner principal
            containerPrincipal.appendChild(elementoCard);
        } else {
            const elementoPai = elementosMap.get(idPai);
            if (elementoPai) {
                // Se o pai já foi renderizado, anexa o filho
                // A indentação será controlada pelo CSS ou no momento da inserção
                elementoPai.after(elementoCard); // Coloca o filho logo após o pai
            } else {
                // Caso o pai ainda não tenha sido processado (improvável com ordenação)
                containerPrincipal.appendChild(elementoCard);
            }
        }
    }
    
    // Após inserir todos, vamos ajustar a indentação
    ajustarIndentacaoVisual();
}

/**
 * Percorre o DOM e ajusta a margem esquerda dos cards para criar a hierarquia visual.
 */
export function ajustarIndentacaoVisual() {
    const container = document.getElementById('lista-perguntas');
    const todosCards = Array.from(container.getElementsByClassName('pergunta-card'));
    const cardMap = new Map(todosCards.map(c => [c.dataset.id, c]));

    // Reseta todas as indentações
    todosCards.forEach(card => card.style.marginLeft = '0px');
    
    const calcularNivel = (cardId, nivel = 0) => {
        const card = cardMap.get(cardId);
        if (!card) return nivel;

        const idPai = card.dataset.idPai;
        if (idPai && idPai !== '0' && cardMap.has(idPai)) {
            return calcularNivel(idPai, nivel + 1);
        }
        return nivel;
    };

    todosCards.forEach(card => {
        const nivel = calcularNivel(card.dataset.id);
        card.style.marginLeft = `${nivel * 40}px`;
    });
}