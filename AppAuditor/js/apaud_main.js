// js/apaud_main.js (v9.0 - Workflow com Arquivos)

import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';

function main() {
    Auditoria.loadStateFromLocalStorage();

    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const textoJSON = e.target.result;
                if (Auditoria.carregarPacoteJSON(textoJSON)) {
                    const auditoriaSalva = Auditoria.getAuditoriaAtiva();
                    if (auditoriaSalva) {
                        if (confirm("Você tem uma auditoria em andamento. Deseja continuar? \n\n(Clique em 'Cancelar' para carregar a nova auditoria deste arquivo, descartando a anterior).")) {
                            UI.atualizarHeaderTitulo();
                            UI.renderizarChecklistCompleto();
                            UI.atualizarHeaderProgresso();
                            UI.mostrarTela('tela-checklist');
                        } else {
                            localStorage.removeItem('auditoriaAtivaState');
                            window.location.reload(); // Recarrega a página para limpar tudo
                        }
                    } else {
                        UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                        UI.mostrarTela('tela-selecao');
                    }
                }
                fileInput.value = ''; 
            };
            reader.readAsText(file);
        });
    }
    adicionarListenersDeConteudo();
}

function adicionarListenersDeConteudo() {
    const containerPlanejamentos = document.getElementById('lista-planejamentos');
    if (containerPlanejamentos) {
        containerPlanejamentos.addEventListener('click', (event) => {
            const cardClicado = event.target.closest('.planejamento-item');
            if (!cardClicado) return;
            const planejamentoId = cardClicado.dataset.id;
            const areaId = cardClicado.dataset.areaId;
            const target = event.target;
            if (target.classList.contains('iniciar-auditoria-btn')) {
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
            } else if (target.classList.contains('btn-continuar')) {
                UI.atualizarHeaderTitulo();
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
                UI.mostrarTela('tela-checklist');
            } else if (target.classList.contains('btn-reabrir')) {
                Auditoria.reabrirAuditoria();
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                const novoCard = document.querySelector(`.planejamento-item[data-id='${planejamentoId}']`);
                if (novoCard) {
                    const detalhes = Auditoria.getDetalhesDoPlanejamento(planejamentoId);
                    UI.expandirCard(novoCard, detalhes);
                }
            } else if (target.classList.contains('btn-exportar-pdf')) {
                alert("Funcionalidade de exportar PDF ainda não implementada.");
            } else {
                const detalhes = Auditoria.getDetalhesDoPlanejamento(planejamentoId);
                UI.expandirCard(cardClicado, detalhes);
            }
        });
    }

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

    const modalFinalizar = document.getElementById('modal-finalizar');
    if (modalFinalizar) {
        let resultadoGlobal = null;
        window.setResultadoFinal = (resultado) => {
            resultadoGlobal = resultado;
        };
        modalFinalizar.addEventListener('click', (event) => {
            if (event.target.classList.contains('fechar-modal-finalizar')) {
                modalFinalizar.style.display = 'none';
                UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos());
                UI.mostrarTela('tela-selecao');
            }
            if (event.target.id === 'btn-baixar-resultado') {
                if (resultadoGlobal) {
                    const jsonString = JSON.stringify(resultadoGlobal, null, 2);
                    const blob = new Blob([jsonString], {
                        type: 'application/json'
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const nomeAuditoria = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria.replace(/[\s/]/g, '_');
                    const nomeDepto = Auditoria.getDepartamentoAtivoNome().replace(/[\s/]/g, '_');
                    a.download = `Resultado_${nomeAuditoria}_${nomeDepto}.json`;
                    a.href = url;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    event.target.textContent = 'Baixado!';
                    setTimeout(() => {
                        event.target.textContent = 'Baixar Arquivo de Resultado (.json)';
                    }, 2000);
                }
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", main);