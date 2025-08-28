// js/apaud_main.js (v12.0 - Handshake e SAF)

import * as ReportGenerator from './reportGenerator.js';
import { env } from './environment.js';
import * as Auditoria from './apaud_auditoria.js';
import * as UI from './apaud_ui.js';


/**
 * Função que aguarda o sinal 'android-ready' do Kotlin para confirmar
 * que a ponte window.Android está pronta. Tem um tempo limite para segurança.
 */
function esperarPonteAndroid(timeoutMs = 2000) {
    return new Promise((resolve) => {
        // Se a ponte NÃO existe (Grist/Browser), resolvemos imediatamente.
        if (typeof window.Android === 'undefined') {
            console.log("Ambiente não-Android detectado. Continuando a inicialização.");
            return resolve(true);
        }

        // Se a ponte existe, aguardamos o sinal 'android-ready' do Kotlin.
        console.log("Ambiente Android detectado. Aguardando o sinal 'android-ready'...");
        const timer = setTimeout(() => {
            console.warn("Tempo limite esperando pelo sinal 'android-ready'. Continuando de qualquer forma.");
            resolve(true); // Continua mesmo em caso de timeout
        }, timeoutMs);

        document.addEventListener('android-ready', () => {
            clearTimeout(timer);
            console.log("Sinal 'android-ready' recebido do Kotlin.");
            resolve(true);
        }, { once: true });
    });
}

/**
 * Ponto de entrada principal do aplicativo.
 * Espera o DOM e a ponte Android estarem prontos antes de iniciar a UI.
 */
async function inicializarApp() {
    console.log("DOM carregado. Aguardando a ponte Android...");
    await esperarPonteAndroid();

    console.log("Ponte pronta. Inicializando o gerenciador e a UI.");
    Auditoria.inicializarGerenciador();
    configurarListenersGlobais();
    exibirTelaSelecaoPacotes(); // Agora é seguro renderizar a UI
	const statusDiv = document.getElementById('status-carregamento');
    if (statusDiv) {
        const envDisplay = document.createElement('p');
        envDisplay.className = 'environment-display';
        envDisplay.textContent = `Ambiente: ${env.name}`;
        statusDiv.appendChild(envDisplay);
    }
}

// O listener que inicia tudo.
document.addEventListener('DOMContentLoaded', inicializarApp);


// --- Funções de Navegação e Renderização Principal (sem alteração) ---
function exibirTelaSelecaoPacotes() {
    const pacotes = Auditoria.getListaDePacotes();
    UI.renderizarTelaSelecaoPacotes(pacotes, selecionarEIniciarPacote);
    UI.mostrarTela('tela-selecao-pacote');
}

function selecionarEIniciarPacote(idPacote) {
    const sucesso = Auditoria.definirPacoteAtivo(idPacote);
    if (sucesso) {
        UI.popularFiltroAuditores(Auditoria.getAuditores());
        document.getElementById('titulo-auditoria').textContent = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria;
        atualizarListaDashboard();
        UI.mostrarTela('tela-dashboard-auditoria');
    }
}

// --- Gerenciamento de Eventos (sem alteração, exceto pela remoção do listener de teste) ---
function configurarListenersGlobais() {
    const fileInput = document.getElementById('json-file-input');
    fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    let fileContent = '';
    UI.mostrarStatusCarregamento('Processando arquivo...', 'info');

    try {
        // A lógica de descompactação agora é universal e roda no JS
        if (file.name.endsWith('.zip')) {
            console.log("Arquivo ZIP detectado. Descompactando com JSZip...");
            const jszip = new JSZip(); // JSZip está globalmente disponível
            const zip = await jszip.loadAsync(file);
            
            const jsonFileInZip = Object.values(zip.files).find(f => !f.dir && f.name.endsWith('.json'));

            if (jsonFileInZip) {
                fileContent = await jsonFileInZip.async('string');
            } else {
                throw new Error("Nenhum arquivo .json encontrado dentro do ZIP.");
            }
        } else { // Assume que é .json
            fileContent = await file.text();
        }

        // O resto do fluxo é o mesmo, chamando o "cérebro"
        const novoId = Auditoria.adicionarNovoPacote(fileContent);
        if (novoId) {
            exibirTelaSelecaoPacotes();
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar o arquivo:", error);
        UI.mostrarStatusCarregamento(`Falha: ${error.message}`, 'erro');
    } finally {
        event.target.value = ''; // Limpa o input
    }
});

    document.getElementById('btn-voltar-para-selecao-pacotes').addEventListener('click', exibirTelaSelecaoPacotes);
	document.getElementById('modo-compacto-checkbox').addEventListener('change', (event) => {
    // Quando o checkbox mudar, simplesmente re-renderiza o checklist.
    // A função de renderização em apaud_ui.js lerá o estado do checkbox.
    UI.renderizarChecklistCompleto();
});

    adicionarListenersDeConteudo();
}


// --- Funções Auxiliares do Dashboard (sem alteração) ---
// --- Funções Auxiliares do Dashboard ---
function getFiltrosAtuais() {
    return {
        status: document.getElementById('filtro-status').value,
        auditor: document.getElementById('filtro-auditor').value,
    };
}
function getOrdenacaoAtual() {
    return document.getElementById('ordenacao').value;
}
function atualizarListaDashboard() {
    // Esta é a linha que faltava, que de fato renderiza a lista!
    UI.renderizarListaDePlanejamentos(Auditoria.getPlanejamentos(), getFiltrosAtuais(), getOrdenacaoAtual());
}


// --- Função Central de Listeners de Conteúdo (praticamente inalterada) ---
function adicionarListenersDeConteudo() {
    // Listeners para os filtros do dashboard interno
    document.getElementById('filtro-status').addEventListener('change', atualizarListaDashboard);
    document.getElementById('filtro-auditor').addEventListener('change', atualizarListaDashboard);
    document.getElementById('ordenacao').addEventListener('change', atualizarListaDashboard);
    
    // Listener principal para o Dashboard de Auditorias (antiga 'tela-selecao')
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
            atualizarListaDashboard(); // <--- MUDANÇA AQUI
        }
        else if (target.classList.contains('btn-exportar-json')) {
			 Auditoria.setCurrentAuditoriaId(planejamentoId);
    const resultado = Auditoria.gerarJsonDeResultado(planejamentoId);
    if (!resultado) return;

    // Prepara os nomes dos arquivos
    const nomeAuditoria = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria.replace(/[\s/]/g, '_');
    const depto = Auditoria.getPlanejamentoPorId(planejamentoId)?.Departamento_Departamento.replace(/[\s/]/g, '_');
    const nomeArquivoJson = `Resultado_${nomeAuditoria}_${depto}.json`;
    const nomeArquivoZip = `Resultado_${nomeAuditoria}_${depto}.zip`;

    // Converte o resultado para uma string JSON
    const jsonString = JSON.stringify(resultado, null, 2);

    // --- LÓGICA DE DETECÇÃO DE AMBIENTE ---
    if (env.isAndroid) {
        // No Android, chamamos a ponte nativa para compartilhar
        console.log("Ambiente Android detectado. Solicitando compartilhamento nativo...");
        // O `window.Android.shareFile` é uma nova função que criaremos no Kotlin.
        // Ela receberá o nome do arquivo e o conteúdo em Base64.
        const jsonBase64 = btoa(unescape(encodeURIComponent(jsonString)));
        window.Android.shareFile(nomeArquivoJson, jsonBase64, 'application/json');
    
    } else {
        // No Browser/Grist, criamos um ZIP para download
        console.log("Ambiente Browser/Grist detectado. Gerando ZIP para download...");
        const zip = new JSZip();
        zip.file(nomeArquivoJson, jsonString); // Adiciona o JSON ao ZIP

        zip.generateAsync({ type: "blob", compression: "DEFLATE" })
            .then(function (content) {
                // Usa a biblioteca FileSaver.js (ver passo 2) para um download robusto
                saveAs(content, nomeArquivoZip); 
            });
    }
    
    // Marca como exportado, independentemente do ambiente
    Auditoria.marcarComoExportado(planejamentoId, 'json');
    atualizarListaDashboard();
}
        else if (target.classList.contains('btn-exportar-pdf')) {
    // --- ADICIONE ESTA LINHA CRUCIAL ---
    Auditoria.setCurrentAuditoriaId(planejamentoId);
    
    const pdfBlob = ReportGenerator.gerarPDF(planejamentoId);
    if (!pdfBlob) return;

    // Prepara os nomes dos arquivos
    const nomeAuditoria = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria.replace(/[\s/]/g, '_');
    const depto = Auditoria.getPlanejamentoPorId(planejamentoId)?.Departamento_Departamento.replace(/[\s/]/g, '_');
    const nomeArquivoPdf = `Relatorio_${nomeAuditoria}_${depto}.pdf`;

    if (env.isAndroid) {
        // No Android, usamos a ponte para compartilhar
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob); 
        reader.onloadend = function() {
            const base64data = reader.result;
            // Remove o prefixo "data:application/pdf;base64,"
            const base64Content = base64data.substr(base64data.indexOf(',') + 1);
            window.Android.shareFile(nomeArquivoPdf, base64Content, 'application/pdf');
        }
    } else {
        // No Browser/Grist, usamos o FileSaver para download
        saveAs(pdfBlob, nomeArquivoPdf);
    }

    Auditoria.marcarComoExportado(planejamentoId, 'pdf');
    atualizarListaDashboard();
}
		        else if (target.closest('.btn-resetar-auditoria')) {
            // O target pode ser o SVG, então buscamos o botão pai
            const botaoReset = target.closest('.btn-resetar-auditoria');
            const idParaResetar = cardClicado.dataset.id; // Já temos o cardClicado do início do listener
            
            const confirmacao = prompt("Para confirmar a exclusão do progresso desta auditoria, digite 'deletar':");
            if (confirmacao === 'deletar') {
                if (Auditoria.resetarAuditoria(idParaResetar)) {
                    alert("Progresso da auditoria resetado com sucesso!");
                    atualizarListaDashboard(); // Essencial para atualizar a UI
                } else {
                    alert("Erro ao tentar resetar a auditoria.");
                }
            }
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
            UI.mostrarTela('tela-dashboard-auditoria');
        }
    });

    // Listener para o cabeçalho do checklist
    document.getElementById('checklist-header').addEventListener('click', (event) => {
        const target = event.target;
        if(target.id === 'btn-voltar-principal') {
            atualizarListaDashboard();
            UI.mostrarTela('tela-dashboard-auditoria');
        } 
        else if (target.id === 'header-titulo') {
            // Lógica para expandir/recolher o título
            target.classList.toggle('titulo-expandido');
        }
    });

    // Listener para o conteúdo do checklist
    const containerChecklist = document.getElementById('checklist-container');
    if (containerChecklist) {
        containerChecklist.addEventListener('click', (event) => {
            const target = event.target;
            const cardPergunta = target.closest('.pergunta-card');

            // --- Ações que finalizam a auditoria ---
            if (target.id === 'btn-finalizar-auditoria') {
                if(confirm("Tem certeza que deseja finalizar esta auditoria?")) {
                    Auditoria.finalizarAuditoria();
                    atualizarListaDashboard();
                    UI.mostrarTela('tela-dashboard-auditoria');;
                }
                return; // Encerra a execução aqui
            }

            // --- Ações que alteram a estrutura (seções) e precisam de re-renderização ---
            const botaoAdicionar = target.closest('.secao-adicionar-card');
            if (botaoAdicionar) {
                Auditoria.adicionarInstanciaSecao(botaoAdicionar.dataset.secaoId);
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
                return;
            }

            const botaoRemover = target.closest('.botao-remover-secao');
            if (botaoRemover) {
                event.stopPropagation();
                if (confirm("Tem certeza?")) {
                    Auditoria.removerInstanciaSecao(botaoRemover.dataset.secaoId, botaoRemover.dataset.instanciaNumero);
                    UI.renderizarChecklistCompleto();
                    UI.atualizarHeaderProgresso();
                }
                return;
            }
            
            // --- Ação de responder com botão ---
            if (target.matches('.botao-resposta')) {
    const isModoCompacto = document.getElementById('modo-compacto-checkbox').checked;
    const perguntaId = target.dataset.perguntaId;

    // Se o botão não tem um 'data-valor', significa que é o botão 'Selecionar Resposta'
    // ou um botão de resposta já selecionada no modo compacto.
    if (isModoCompacto && !target.dataset.valor || target.classList.contains('selecionado')) {
        // Lógica para expandir: re-renderiza apenas este card em modo normal
        UI.expandirRespostasParaCard(target.closest('.pergunta-card'));
        return;
    }

    // Lógica de salvamento normal
    Auditoria.salvarResposta(perguntaId, target.dataset.valor);
    UI.renderizarChecklistCompleto(); // Re-renderiza tudo para voltar ao modo compacto
    UI.atualizarHeaderProgresso();
    return;
}

            // --- Ações dentro de um card de pergunta (anotação, mídia, etc.) ---
            if (cardPergunta) {
                const perguntaId = cardPergunta.dataset.itemId;

                if (target.closest('.botao-anotacao')) {
                    const textoAtual = Auditoria.getAnotacao(perguntaId);
                    UI.expandirAnotacaoParaFullscreen(textoAtual, (novoTexto) => {
                        Auditoria.salvarAnotacao(perguntaId, novoTexto);
                        UI.renderizarChecklistCompleto(); 
                    });
                }
                else if (target.closest('.botao-midia')) {
    UI.mostrarModalGerenciarMidia(perguntaId);
}
                else if (target.closest('.botao-ponto-aberto')) {
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

            // --- Ação de expandir/recolher seções ---
            const cabecalhoInstancia = target.closest('.secao-instancia-header');
            const cabecalhoSecaoNormal = target.closest('.secao-nao-repetivel .secao-header');
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
        });

        containerChecklist.addEventListener('input', (event) => {
            if (event.target.matches('.resposta-texto')) {
                const textarea = event.target;
                
                // Lógica de auto-expansão
                textarea.style.height = 'auto'; // Reseta a altura
                textarea.style.height = (textarea.scrollHeight) + 'px'; // Ajusta para o conteúdo

                // Salva a resposta no cérebro
                Auditoria.salvarResposta(textarea.dataset.perguntaId, textarea.value);
                
                // Atualiza o progresso (pois agora uma resposta de texto foi digitada)
                UI.atualizarHeaderProgresso();
            }
        });
        containerChecklist.addEventListener('change', (event) => {
            if (event.target.matches('.resposta-dropdown')) {
                console.log('Dropdown alterado! Acionando recálculo e re-renderização.'); // LOG DE DIAGNÓSTICO
                
                const perguntaId = event.target.dataset.perguntaId;
                const valorId = event.target.value;
                Auditoria.salvarResposta(perguntaId, valorId);
                
                // Força o redesenho completo, que por sua vez acionará o cálculo
                UI.renderizarChecklistCompleto();
                UI.atualizarHeaderProgresso();
            }
        });
        
document.getElementById('media-input').addEventListener('change', async (event) => {
    const perguntaId = event.target.dataset.perguntaId;
    const files = event.target.files;
    if (perguntaId && files.length > 0) {
        await Auditoria.anexarMidia(perguntaId, files); // MUDANÇA AQUI
        UI.mostrarModalGerenciarMidia(perguntaId); // Abre o modal para ver o resultado
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

const modalMidia = document.getElementById('modal-gerenciar-midia');
if (modalMidia) {
    modalMidia.addEventListener('click', (event) => {
        const perguntaId = modalMidia.dataset.perguntaId;
        if (!perguntaId) return;

        // Fechar modal
        if (event.target.id === 'fechar-modal-midia' || event.target.classList.contains('modal-finalizar-overlay')) {
            UI.fecharModalGerenciarMidia();
            UI.renderizarChecklistCompleto(); // Atualiza o contador no card
        }

        // Remover uma mídia
        const botaoRemover = event.target.closest('.btn-remover-midia');
        if (botaoRemover) {
            const nomeArquivo = botaoRemover.dataset.nomeArquivo;
            if (confirm(`Tem certeza que deseja remover o anexo "${nomeArquivo}"?`)) {
                Auditoria.removerMidia(perguntaId, nomeArquivo);
                // Re-renderiza o conteúdo do modal sem fechá-lo
                UI.mostrarModalGerenciarMidia(perguntaId);
            }
        }
    });

    // Listener para o input de adicionar nova mídia
document.getElementById('adicionar-nova-midia-input').addEventListener('change', async (event) => { // MUDANÇA AQUI
    const perguntaId = modalMidia.dataset.perguntaId;
    const files = event.target.files;
    if (perguntaId && files.length > 0) {
        await Auditoria.anexarMidia(perguntaId, files); // MUDANÇA AQUI
        UI.mostrarModalGerenciarMidia(perguntaId);
    }
});
}

    // O modal de finalização foi removido deste fluxo, pois a exportação
    // agora é feita na tela de seleção.
}

