// js/apaud_main.js (v4.2 - Todos os Listeners Corrigidos)

import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';

// Função principal que roda quando o HTML está pronto
function main() {
    console.log("DOM carregado. Iniciando script principal (main.js)...");

    // --- Passo 1: Encontrar os elementos principais do DOM ---
    const loadButton = document.getElementById('load-button');
    
    // --- Passo 2: Verificação de Segurança ---
    if (!loadButton) {
        console.error("ERRO FATAL: O botão 'load-button' não foi encontrado no HTML.");
        return; // Interrompe a execução
    }
    console.log("Elemento 'load-button' encontrado com sucesso.");

    // --- Passo 3: Adicionar os Event Listeners ---

    // Listener para o botão de carregar o JSON
    loadButton.addEventListener('click', () => {
        console.log("Botão 'Carregar Auditoria' clicado.");
        if (Auditoria.carregarPacoteJSON()) {
            UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
            UI.mostrarTela('tela-selecao');
        }
    });

    // Chama a função que adiciona os listeners para os conteúdos dinâmicos
    adicionarListenersDeConteudo();

    console.log("Todos os event listeners foram registrados.");
}


// Função que centraliza os listeners para elementos que são criados dinamicamente
function adicionarListenersDeConteudo() {
    // Listener para a tela de seleção de auditoria
    const containerPlanejamentos = document.getElementById('lista-planejamentos');
    if (containerPlanejamentos) {
        containerPlanejamentos.addEventListener('click', (event) => {
            const cardClicado = event.target.closest('.planejamento-item');
            if (!cardClicado) return; // Se clicou fora de um card, não faz nada

            // Se o clique foi no botão "Iniciar Auditoria"
            if (event.target.classList.contains('iniciar-auditoria-btn')) {
                const areaId = cardClicado.dataset.areaId;
                if (Auditoria.iniciarAuditoriaParaArea(areaId)) {
                    UI.renderizarChecklistCompleto();
                    UI.atualizarHeaderProgresso();
                    UI.mostrarTela('tela-checklist');
                }
            } else {
                // Se o clique foi em qualquer outra parte do card, expande/retrai
                const idDoPai = cardClicado.dataset.id;
                const detalhes = Auditoria.getDetalhesDoPlanejamento(idDoPai);
                UI.expandirCard(cardClicado, detalhes);
            }
        });
    }

    // Listener para a tela do checklist (engloba cliques e inputs)
    const containerChecklist = document.getElementById('checklist-container');
    if (containerChecklist) {
        // --- Listener para CLIQUES (Botões) ---
containerChecklist.addEventListener('click', (event) => {
    const target = event.target;
    let precisaAtualizarUI = false; // Flag para controlar a re-renderização completa

    const card = target.closest('.pergunta-card');
    if (!card) return; // Se não clicou dentro de um card de pergunta, ignora

    // --- Lógica para os diferentes botões ---

    // Botão de Resposta (múltipla escolha)
    if (target.matches('.botao-resposta')) {
        const perguntaId = target.dataset.perguntaId;
        const valor = target.dataset.valor;
        Auditoria.salvarResposta(perguntaId, valor);
        precisaAtualizarUI = true;
    }

    // Botão de Repetir Seção (+)
    const botaoRepetir = target.closest('.botao-repetir-secao');
    if (botaoRepetir) {
        const secaoId = botaoRepetir.dataset.secaoId;
        Auditoria.adicionarInstanciaSecao(secaoId);
        precisaAtualizarUI = true;
    }
    
    // Botão de Anotações
    if (target.matches('.botao-anotacao')) {
        UI.alternarAreaAnotacao(card);
    }

    // Botão de Mídia
    if (target.matches('.botao-midia')) {
        alert('Funcionalidade "Mídia" a ser implementada.\n\nAqui abriria a câmera ou a galeria de arquivos.');
    }

    // --- Atualização da UI ---
    if (precisaAtualizarUI) {
        UI.renderizarChecklistCompleto();
        UI.atualizarHeaderProgresso();
    }
});

        // --- Listener para INPUT (Campos de Texto) ---
        containerChecklist.addEventListener('input', (event) => {
            const target = event.target;
            
            // Campo de Texto de Resposta
            if (target.matches('.resposta-texto')) {
                const perguntaId = target.dataset.perguntaId;
                const valor = target.value;
                Auditoria.salvarResposta(perguntaId, valor);
                UI.atualizarHeaderProgresso();
            }
        });
    }
}

// --- Gatilho de Inicialização ---
document.addEventListener("DOMContentLoaded", main);