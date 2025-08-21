// js/modaud_main.js

import * as Grist from './modaud_grist.js';
import * as UI from './modaud_ui.js';

let perguntasOriginais = [];
let temAlteracoes = false;
const btnSalvar = document.getElementById('btn-salvar-alteracoes');

async function inicializar() {
    await Grist.conectar();
    
    perguntasOriginais = await Grist.getRecords('Modelos_Perguntas');
    
    UI.renderizarPerguntas(perguntasOriginais);
    
    configurarSortable();
}

function configurarSortable() {
    const container = document.getElementById('lista-perguntas');
    
    new Sortable(container, {
        group: 'perguntas',
        animation: 150,
        handle: '.handle-drag',
        onEnd: (evt) => {
            console.log('Item movido!', evt);
            marcarAlteracoes();
            calcularEAtualizarEstrutura();
        }
    });
}

function marcarAlteracoes() {
    if (!temAlteracoes) {
        temAlteracoes = true;
        btnSalvar.disabled = false;
        console.log("Alterações detectadas. Botão Salvar ativado.");
    }
}

function calcularEAtualizarEstrutura() {
    console.log("Calculando nova estrutura a partir do DOM...");
    const container = document.getElementById('lista-perguntas');
    const todosCards = Array.from(container.getElementsByClassName('pergunta-card'));
    
    // Lógica para detectar se um card foi solto na "drop-zone" de outro
    // Esta parte é mais complexa e virá a seguir. Por enquanto, focamos na ordem.
    
    // A nova ordem é simplesmente a ordem dos cards no DOM
    const updates = todosCards.map((card, index) => {
        const id = parseInt(card.dataset.id, 10);
        const novaOrdem = (index + 1) * 10; // Multiplicamos por 10 para dar espaço para inserções futuras
        
        // Temporariamente, vamos manter o ID_Pai, a hierarquia virá depois
        const idPai = parseInt(card.dataset.idPai, 10);
        
        return {
            id: id,
            fields: {
                Ordem: novaOrdem,
                // ID_Pai: novoIdPai // A ser implementado
            }
        };
    });

    console.log("Atualizações a serem salvas:", updates);
    
    // Atualiza a indentação visual após cada movimento
    UI.ajustarIndentacaoVisual();

    // Armazena as atualizações para serem salvas quando o botão for clicado
    btnSalvar.dataset.updates = JSON.stringify(updates);
}

btnSalvar.addEventListener('click', async () => {
    const updatesJSON = btnSalvar.dataset.updates;
    if (updatesJSON) {
        const updates = JSON.parse(updatesJSON);
        await Grist.updateRecords('Modelos_Perguntas', updates);
        
        // Resetar estado
        btnSalvar.disabled = true;
        temAlteracoes = false;
        delete btnSalvar.dataset.updates;
        
        // Recarregar os dados do Grist para ter o estado mais recente
        perguntasOriginais = await Grist.getRecords('Modelos_Perguntas');
        UI.renderizarPerguntas(perguntasOriginais);
    }
});

// Inicia o aplicativo
inicializar();