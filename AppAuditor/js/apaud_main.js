// js/apaud_main.js (v10.1 - Gerenciamento Completo - Corrigido)

import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';

// --- Funções Auxiliares para o Novo Fluxo ---
function getFiltrosAtuais() {
    return {
        status: document.getElementById('filtro-status').value,
        auditor: document.getElementById('filtro-auditor').value,
    };
}
function getOrdenacaoAtual() {
    return document.getElementById('ordenacao').value;
}
function atualizarLista() {
    UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos(), getFiltrosAtuais(), getOrdenacaoAtual());
}

// --- Função Principal de Inicialização ---
function main() {
    Auditoria.loadStateFromLocalStorage();
    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (Auditoria.carregarPacoteJSON(e.target.result)) {
                    UI.popularFiltroAuditores(Auditoria.getAuditores());
                    atualizarLista();
                    UI.mostrarTela('tela-selecao');
                }
                fileInput.value = '';
            };
            reader.readAsText(file);
        });
    }
    adicionarListenersDeConteudo();
}

// --- Função Central de Listeners de Eventos ---
function adicionarListenersDeConteudo() {
    // Listeners para os novos filtros
    document.getElementById('filtro-status').addEventListener('change', atualizarLista);
    document.getElementById('filtro-auditor').addEventListener('change', atualizarLista);
    document.getElementById('ordenacao').addEventListener('change', atualizarLista);
    
    // Listener principal para a tela de seleção (Dashboard)
    document.getElementById('lista-planejamentos').addEventListener('click', (event) => {
        const cardClicado = event.target.closest('.planejamento-item');
        if (!cardClicado) return;
        const planejamentoId = cardClicado.dataset.id;
        const areaId = cardClicado.dataset.areaId;
        const target = event.target;
        
        if (target.classList.contains('iniciar-auditoria-btn')) {
            Auditoria.iniciarAuditoriaParaArea(areaId, planejamentoId);
            Auditoria.setCurrentAuditoriaId(planejamentoId); // Define qual auditoria será editada
            const planejamento = Auditoria.getPlanejamentoPorId(planejamentoId);
            UI.renderizarTelaConfirmacao(planejamento, Auditoria.getAuditores());
            UI.mostrarTela('tela-confirmacao');
        } 
        else if (target.classList.contains('btn-continuar')) {
            Auditoria.setCurrentAuditoriaId(planejamentoId); // Define qual auditoria será editada
            UI.atualizarHeaderTitulo();
            UI.renderizarChecklistCompleto();
            UI.atualizarHeaderProgresso();
            UI.mostrarTela('tela-checklist');
        }
        else if (target.classList.contains('btn-reabrir')) {
            Auditoria.reabrirAuditoria(planejamentoId);
            atualizarLista();
        }
        else if (target.classList.contains('btn-exportar-json')) {
            const resultado = Auditoria.gerarJsonDeResultado(planejamentoId);
            if(resultado) {
                const jsonString = JSON.stringify(resultado, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const nomeAuditoria = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria.replace(/[\s/]/g, '_');
                const depto = Auditoria.getPlanejamentoPorId(planejamentoId)?.Departamento_Departamento.replace(/[\s/]/g, '_');
                a.download = `Resultado_${nomeAuditoria}_${depto}.json`;
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
                Auditoria.marcarComoExportado(planejamentoId, 'json');
                atualizarLista();
            }
        }
        else if (target.classList.contains('btn-exportar-pdf')) {
            alert("Funcionalidade de exportar PDF ainda não implementada.");
        }
        else {
            UI.expandirCard(cardClicado);
        }
    });

    // Listener para a tela de confirmação
    document.getElementById('tela-confirmacao').addEventListener('click', (event) => {
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

    // Listener para o cabeçalho do checklist
    document.getElementById('checklist-header').addEventListener('click', (event) => {
        if(event.target.id === 'btn-voltar-principal') {
            atualizarLista();
            UI.mostrarTela('tela-selecao');
        }
    });

    // Listener para o conteúdo do checklist
    const containerChecklist = document.getElementById('checklist-container');
    if (containerChecklist) {
        containerChecklist.addEventListener('click', (event) => {
            if (event.target.id === 'btn-finalizar-auditoria') {
                if(confirm("Tem certeza que deseja finalizar esta auditoria?")) {
                    Auditoria.finalizarAuditoria();
                    atualizarLista();
                    UI.mostrarTela('tela-selecao');
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
        // ... sua lógica de anotação ...
    }
    if (target.closest('.botao-midia')) {
        // ... sua lógica de mídia ...
    }

    // ADICIONE ESTE BLOCO AQUI
    if (target.closest('.botao-ponto-aberto')) {
        const perguntaId = cardPergunta.dataset.itemId;
        const pontoAberto = Auditoria.getPontoEmAberto(perguntaId);
        
        if (pontoAberto) {
            if(confirm(`Pendência: ${pontoAberto.pendencia}\n\nDeseja resolver este Ponto em Aberto?`)) {
                Auditoria.resolverPontoEmAberto(perguntaId);
                UI.renderizarChecklistCompleto();
            }
        } else {
            UI.mostrarModalPontoAberto(perguntaId);
        }
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
	const modalPontoAberto = document.getElementById('modal-ponto-aberto');
if (modalPontoAberto) {
    modalPontoAberto.addEventListener('click', (event) => {
        const target = event.target;
        const textarea = document.getElementById('ponto-aberto-textarea');

        if (target.id === 'btn-salvar-ponto-aberto') {
            const texto = textarea.value.trim();
            const perguntaId = modalPontoAberto.dataset.perguntaId;
            if (texto && perguntaId) {
                Auditoria.salvarPontoEmAberto(perguntaId, texto);
                UI.fecharModalPontoAberto();
                UI.renderizarChecklistCompleto();
            } else {
                alert("Por favor, descreva a pendência.");
                textarea.focus();
            }
        }

        if (target.id === 'btn-cancelar-ponto-aberto' || target.classList.contains('modal-ponto-aberto-overlay')) {
            UI.fecharModalPontoAberto();
        }
    });
}

    // O modal de finalização foi removido deste fluxo, pois a exportação
    // agora é feita na tela de seleção.
}

document.addEventListener("DOMContentLoaded", main);