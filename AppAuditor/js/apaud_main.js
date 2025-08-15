// js/apaud_main.js (v8.0 - Gerenciamento de Estado Completo)

import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';

function main() {
    // Tenta carregar uma auditoria em andamento do localStorage
    Auditoria.loadStateFromLocalStorage();

    const loadButton = document.getElementById('load-button');
    if (loadButton) {
        loadButton.addEventListener('click', () => {
            if (Auditoria.carregarPacoteJSON()) {
                // Se carregou o pacote e já há uma auditoria pendente, vai direto para o checklist
                if (Auditoria.getAuditoriaAtiva()) {
                    UI.atualizarHeaderTitulo();
                    UI.renderizarChecklistCompleto();
                    UI.atualizarHeaderProgresso();
                    UI.mostrarTela('tela-checklist');
                } else {
                    // Senão, mostra a lista de planejamentos para escolher uma
                    UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                    UI.mostrarTela('tela-selecao');
                }
            }
        });
    }
    adicionarListenersDeConteudo();
}

function adicionarListenersDeConteudo() {
    // --- TELA DE SELEÇÃO (Listener principal de ações) ---
    const containerPlanejamentos = document.getElementById('lista-planejamentos');
    if (containerPlanejamentos) {
        containerPlanejamentos.addEventListener('click', (event) => {
            const cardClicado = event.target.closest('.planejamento-item');
            if (!cardClicado) return;

            const planejamentoId = cardClicado.dataset.id;
            const areaId = cardClicado.dataset.areaId;
            const target = event.target;

            // AÇÃO: Iniciar uma NOVA auditoria
            if (target.classList.contains('iniciar-auditoria-btn')) {
                // Se já existir uma auditoria salva, pede confirmação antes de apagar
                if (Auditoria.getAuditoriaAtiva()) {
                    if (!confirm("Isso irá descartar a auditoria em andamento. Deseja iniciar uma nova mesmo assim?")) {
                        return;
                    }
                }
                Auditoria.iniciarAuditoriaParaArea(areaId, planejamentoId);
                const planejamento = Auditoria.getPlanejamentoPorId(planejamentoId);
                const todosAuditores = Auditoria.getAuditores();
                UI.renderizarTelaConfirmacao(planejamento, todosAuditores);
                UI.mostrarTela('tela-confirmacao');
            }
            // AÇÃO: CONTINUAR uma auditoria em progresso
            else if (target.classList.contains('btn-continuar')) {
                // O estado já foi carregado do localStorage, então apenas navegamos para a tela de checklist
                UI.atualizarHeaderTitulo();
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
                UI.mostrarTela('tela-checklist');
            }
            // AÇÃO: REABRIR uma auditoria finalizada
            else if (target.classList.contains('btn-reabrir')) {
                Auditoria.reabrirAuditoria();
                // Re-renderiza a lista para que o card mude de 'finalizada' para 'em progresso'
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                // Força a re-expansão do card que o usuário acabou de clicar
                const novoCard = document.querySelector(`.planejamento-item[data-id='${planejamentoId}']`);
                if(novoCard) {
                     const detalhes = Auditoria.getDetalhesDoPlanejamento(planejamentoId);
                     UI.expandirCard(novoCard, detalhes);
                }
            }
            // AÇÃO: EXPORTAR PDF (placeholder)
            else if (target.classList.contains('btn-exportar-pdf')) {
                alert("Funcionalidade de exportar PDF ainda não implementada.");
            }
            // AÇÃO: Expandir o card para ver detalhes/ações
            else {
                const detalhes = Auditoria.getDetalhesDoPlanejamento(planejamentoId);
                UI.expandirCard(cardClicado, detalhes);
            }
        });
    }

    // --- TELA DE CONFIRMAÇÃO ---
    const telaConfirmacao = document.getElementById('tela-confirmacao');
    if (telaConfirmacao) {
        telaConfirmacao.addEventListener('click', (event) => {
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
            if (event.target.id === 'btn-voltar-selecao') {
                UI.mostrarTela('tela-selecao');
            }
        });
    }

    // --- TELA DE CHECKLIST ---
    const checklistHeader = document.getElementById('checklist-header');
    if (checklistHeader) {
        checklistHeader.addEventListener('click', (event) => {
            if (event.target.id === 'btn-voltar-principal') {
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                UI.mostrarTela('tela-selecao');
            }
        });
    }

    const containerChecklist = document.getElementById('checklist-container');
    if (containerChecklist) {
        containerChecklist.addEventListener('click', (event) => {
            if (event.target.id === 'btn-finalizar-auditoria') {
                if (confirm("Tem certeza que deseja finalizar esta auditoria?")) {
                    const resultado = Auditoria.finalizarAuditoria();
                    if (resultado) {
                        UI.mostrarModalFinalizar(resultado);
                    }
                }
                return;
            }
            
            const target = event.target;
            let precisaAtualizarGeral = false;
            const cardPergunta = target.closest('.pergunta-card');
            const cabecalhoInstancia = target.closest('.secao-instancia-header');
            const cabecalhoSecaoNormal = target.closest('.secao-nao-repetivel .secao-header');
            const botaoAdicionar = target.closest('.secao-adicionar-card');
            const botaoRemover = target.closest('.botao-remover-secao');

            if (botaoRemover) {
                event.stopPropagation();
                if (confirm("Tem certeza?")) {
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
                if (cabecalhoInstancia) {
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
                    document.getElementById('media-input').dataset.perguntaId = cardPergunta.dataset.itemId;
                    document.getElementById('media-input').click();
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

        document.getElementById('media-input').addEventListener('change', (event) => {
            const perguntaId = event.target.dataset.perguntaId;
            const files = event.target.files;
            if (perguntaId && files.length > 0) {
                Auditoria.anexarMidia(perguntaId, files);
                UI.renderizarChecklistCompleto();
            }
            event.target.value = '';
        });
    }

    // --- MODAL DE FINALIZAÇÃO ---
    const modalFinalizar = document.getElementById('modal-finalizar');
    if (modalFinalizar) {
        modalFinalizar.addEventListener('click', (event) => {
            if (event.target.classList.contains('fechar-modal-finalizar')) {
                modalFinalizar.style.display = 'none';
                // Após fechar o modal, atualiza a lista para mostrar o novo status "Finalizada"
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                UI.mostrarTela('tela-selecao');
            }
            if (event.target.id === 'btn-copiar-resultado') {
                const textarea = document.getElementById('resultado-json-output');
                textarea.select();
                document.execCommand('copy');
                event.target.textContent = 'Copiado!';
                setTimeout(() => {
                    event.target.textContent = 'Copiar JSON';
                }, 2000);
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", main);