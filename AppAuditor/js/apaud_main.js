// js/apaud_main.js (v6.0 - Com fluxo de confirmação)

import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';

function main() {
    console.log("DOM carregado. Iniciando script principal (main.js)...");
    const loadButton = document.getElementById('load-button');
    if (loadButton) {
        loadButton.addEventListener('click', () => {
            if (Auditoria.carregarPacoteJSON()) {
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                UI.mostrarTela('tela-selecao');
            }
        });
    }
    adicionarListenersDeConteudo();
}

function adicionarListenersDeConteudo() {
    // --- TELA DE SELEÇÃO ---
    const containerPlanejamentos = document.getElementById('lista-planejamentos');
    if (containerPlanejamentos) {
        containerPlanejamentos.addEventListener('click', (event) => {
            const cardClicado = event.target.closest('.planejamento-item');
            if (!cardClicado) return;

            // Se clicou no botão "Iniciar Auditoria"
            if (event.target.classList.contains('iniciar-auditoria-btn')) {
                const areaId = cardClicado.dataset.areaId;
                const planejamentoId = cardClicado.dataset.id;

                // Prepara os dados para a tela de confirmação
                Auditoria.iniciarAuditoriaParaArea(areaId, planejamentoId);
                const planejamento = Auditoria.getPlanejamentoPorId(planejamentoId);
                const todosAuditores = Auditoria.getAuditores();

                // Renderiza e mostra a tela de confirmação
                UI.renderizarTelaConfirmacao(planejamento, todosAuditores);
                UI.mostrarTela('tela-confirmacao');

            } else { // Se clicou no card para expandir
                const idDoPai = cardClicado.dataset.id;
                const detalhes = Auditoria.getDetalhesDoPlanejamento(idDoPai);
                UI.expandirCard(cardClicado, detalhes);
            }
        });
    }

    // --- TELA DE CONFIRMAÇÃO ---
    const telaConfirmacao = document.getElementById('tela-confirmacao');
    if(telaConfirmacao) {
        telaConfirmacao.addEventListener('click', (event) => {
            // Se clicou em "Confirmar e Iniciar"
            if (event.target.id === 'btn-confirmar-iniciar') {
                const detalhes = {
                    data: document.getElementById('data-auditoria').value,
                    liderId: document.getElementById('auditor-lider-select').value,
                    acompId: document.getElementById('auditor-acomp-select').value
                };
                Auditoria.salvarDetalhesExecucao(detalhes);

                UI.atualizarHeaderTitulo();
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
                UI.mostrarTela('tela-checklist');
            }

            // Se clicou em "Voltar"
            if (event.target.id === 'btn-voltar-selecao') {
                UI.mostrarTela('tela-selecao');
            }
        });
    }


    // --- TELA DE CHECKLIST (código existente, sem alterações) ---
    const containerChecklist = document.getElementById('checklist-container');
    const mediaInput = document.getElementById('media-input');
    if (containerChecklist) {
        containerChecklist.addEventListener('click', (event) => {
            const target = event.target;
            let precisaAtualizarGeral = false;
            const cardPergunta = target.closest('.pergunta-card');
            const cabecalhoInstancia = target.closest('.secao-instancia-header');
            const cabecalhoSecaoNormal = target.closest('.secao-nao-repetivel .secao-header');
            const botaoAdicionar = target.closest('.secao-adicionar-card');
            const botaoRemover = target.closest('.botao-remover-secao');
            if (botaoRemover) {
                event.stopPropagation();
                if (confirm("Tem certeza que deseja remover esta seção?")) {
                    Auditoria.removerInstanciaSecao(botaoRemover.dataset.secaoId, botaoRemover.dataset.instanciaNumero);
                    precisaAtualizarGeral = true;
                }
            }
            if (target.matches('.botao-resposta')) {
                Auditoria.salvarResposta(target.dataset.perguntaId, target.dataset.valor);
                precisaAtualizarGeral = true;
            }
            if (botaoAdicionar) {
                Auditoria.adicionarInstanciaSecao(botaoAdicionar.dataset.secaoId);
                precisaAtualizarGeral = true;
            }
            const cabecalhoClicado = cabecalhoInstancia || cabecalhoSecaoNormal;
            if (cabecalhoClicado && !target.closest('.botao-remover-secao')) {
                const corpo = cabecalhoClicado.nextElementSibling;
                const icone = cabecalhoClicado.querySelector('.icone-toggle');
                corpo.classList.toggle('expandido');
                icone.classList.toggle('expandido');
                if(cabecalhoInstancia) {
                    const idUnico = cabecalhoClicado.dataset.idUnico;
                    if (UI.estadoUI.secoesExpandidas.has(idUnico)) {
                        UI.estadoUI.secoesExpandidas.delete(idUnico);
                    } else {
                        UI.estadoUI.secoesExpandidas.add(idUnico);
                    }
                }
            }
            if (cardPergunta) {
                if (target.closest('.botao-anotacao')) {
                    const perguntaId = cardPergunta.dataset.itemId;
                    const textoAtual = Auditoria.getAnotacao(perguntaId);
                    UI.expandirAnotacaoParaFullscreen(textoAtual, (novoTexto) => {
                        Auditoria.salvarAnotacao(perguntaId, novoTexto);
                        UI.renderizarChecklistCompleto();
                    });
                }
                if (target.closest('.botao-midia')) {
                    mediaInput.dataset.perguntaId = cardPergunta.dataset.itemId;
                    mediaInput.click();
                }
            }
            if (precisaAtualizarGeral) {
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
            }
        });
        containerChecklist.addEventListener('input', (event) => {
            if (event.target.matches('.resposta-texto')) {
                Auditoria.salvarResposta(event.target.dataset.perguntaId, event.target.value);
                UI.atualizarHeaderProgresso();
            }
        });
        mediaInput.addEventListener('change', (event) => {
            const perguntaId = event.target.dataset.perguntaId;
            const files = event.target.files;
            if (perguntaId && files.length > 0) {
                Auditoria.anexarMidia(perguntaId, files);
                UI.renderizarChecklistCompleto();
            }
            event.target.value = '';
        });
    }
}

document.addEventListener("DOMContentLoaded", main);