// js/apaud_ui.js (v6.0 - Com workflow de arquivos)
import * as Auditoria from './apaud_auditoria.js';




export const estadoUI = {
    secoesExpandidas: new Set()
};

export function renderizarTelaSelecaoPacotes(pacotes, onPacoteSelecionado) {
    const container = document.getElementById('lista-pacotes-container');
    container.innerHTML = ''; // Limpa a lista antiga

    if (pacotes.length === 0) {
        container.innerHTML = '<p class="aviso-lista-vazia">Nenhum pacote de auditoria carregado. Use o botão abaixo para carregar um novo.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'lista-pacotes';
    pacotes.forEach(pacote => {
        const li = document.createElement('li');
        li.textContent = pacote.nome;
        li.dataset.pacoteId = pacote.id;
        li.className = 'item-pacote';
        li.addEventListener('click', () => onPacoteSelecionado(pacote.id));
        ul.appendChild(li);
    });
    container.appendChild(ul);
}

export function mostrarTela(idDaTela) {
    document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('ativa'));
    const telaAtiva = document.getElementById(idDaTela);
    if (telaAtiva) telaAtiva.classList.add('ativa');
}

export function mostrarStatusCarregamento(mensagem, tipo = 'info') {
    const statusDiv = document.getElementById('status-carregamento');
    if (!statusDiv) return;
    statusDiv.textContent = mensagem;
    statusDiv.style.color = (tipo === 'sucesso') ? 'green' : (tipo === 'erro') ? 'red' : 'black';
}

export function popularFiltroAuditores(auditores) {
    const select = document.getElementById('filtro-auditor');
    if (!select) return;
    // Garante que não duplique as opções se chamado novamente
    select.innerHTML = '<option value="todos">Todos</option>'; 
    auditores.forEach(auditor => {
        select.innerHTML += `<option value="${auditor.id}">${auditor.NomeAuditorRef}</option>`;
    });
}

export function renderizarListaDePlanejamentos(planejamentos, filtros, ordenacao) {
    const container = document.getElementById('lista-planejamentos');
    container.innerHTML = '';
    
    let planejamentosFiltrados = planejamentos.filter(p => {
        const state = Auditoria.getAuditoriaState(p.id);
        const status = state ? state.status : 'a_iniciar';
        if (filtros.status !== 'todos' && status !== filtros.status) return false;
        const auditorLiderReal = state && state.auditorLiderId ? state.auditorLiderId : p.Auditor_Lider;
        const auditorAcompReal = state && state.auditorAcompanhanteId ? state.auditorAcompanhanteId : p.Auditor_Acompanhante;
        if (filtros.auditor !== 'todos' && auditorLiderReal != filtros.auditor && auditorAcompReal != filtros.auditor) {
            return false;
        }
        return true;
    });
    
    planejamentosFiltrados.sort((a, b) => {
        if (ordenacao === 'departamento') return a.Departamento_Departamento.localeCompare(b.Departamento_Departamento);
        if (ordenacao === 'status') {
            const statusA = (Auditoria.getAuditoriaState(a.id) || {status: 'a_iniciar'}).status;
            const statusB = (Auditoria.getAuditoriaState(b.id) || {status: 'a_iniciar'}).status;
            return statusA.localeCompare(statusB);
        }
        return (a.Data || 0) - (b.Data || 0);
    });

    if (planejamentosFiltrados.length === 0) {
        container.innerHTML = '<p class="aviso-sem-resultados">Nenhum item corresponde aos filtros selecionados.</p>';
        return;
    }

    planejamentosFiltrados.forEach(item => {
        const div = document.createElement('div');
        div.className = 'planejamento-item';
        const state = Auditoria.getAuditoriaState(item.id);
        if (state) {
            if (state.status === 'em_progresso') div.classList.add('em-progresso');
            else if (state.status === 'finalizada') div.classList.add('finalizada');
        }

        const pontosAbertosCount = Auditoria.getPontosEmAbertoCount(item.id);
        let indicadorPontoAbertoHTML = '';
        if (pontosAbertosCount > 0) {
            const iconeBandeira = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd" /></svg>`;
            indicadorPontoAbertoHTML = `<span class="info-status-extra">${iconeBandeira} ${pontosAbertosCount}</span>`;
        }

        div.dataset.id = item.id;
        div.dataset.areaId = item.Departamento;
        const totalPerguntas = Auditoria.contarPerguntasParaArea(item.Departamento);
        const dataFormatada = item.Data ? new Date(item.Data * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/D';
        
        div.innerHTML = `
            <h4>${item.Departamento_Departamento || 'Área'} ${indicadorPontoAbertoHTML}</h4>
            <p>Data Planejada: ${dataFormatada}</p>
            <p class="info-perguntas"><strong>${totalPerguntas}</strong> perguntas.</p> 
            <div class="card-detalhes"></div>`;
        container.appendChild(div);
    });
}

export function expandirCard(cardElement) {
    const detalheAtual = cardElement.querySelector('.card-detalhes');
    const isExpandido = detalheAtual.classList.contains('expandido');
    document.querySelectorAll('.card-detalhes.expandido').forEach(d => {
        d.innerHTML = ''; d.classList.remove('expandido'); d.closest('.planejamento-item').classList.remove('selecionado');
    });
    if (isExpandido) return;
    cardElement.classList.add('selecionado');
    detalheAtual.classList.add('expandido');
    
    const planejamentoId = cardElement.dataset.id;
    const state = Auditoria.getAuditoriaState(planejamentoId);
    let htmlInterno = '';

    if (state) {
        const progresso = Auditoria.calcularProgresso(planejamentoId);
        const ncs = Auditoria.contarNaoConformidades(planejamentoId);
        const pontosAbertos = Auditoria.getPontosEmAbertoCount(planejamentoId);
        const statusJson = state.jsonExportado ? `<span class="exportado">✔ JSON</span>` : `<span>JSON</span>`;
        const statusPdf = state.pdfExportado ? `<span class="exportado">✔ PDF</span>` : `<span>PDF</span>`;

        htmlInterno = `
            <div class="resumo-progresso">
                <p><strong>Progresso:</strong> ${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)</p>
                <p><span class="nc-normal">${ncs.nc}</span> NC, <span class="nc-maior">${ncs.ncMaior}</span> NC Maiores</p>
                <p><strong>${pontosAbertos}</strong> Pontos em Aberto</p>
            </div>`;
        
        let botoesResetHTML = '';
        // Condição de segurança: só mostra o botão de reset se algo já foi exportado
        if (state.jsonExportado || state.pdfExportado) {
            const iconeLixeira = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.576l.84-10.518.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>`;
            botoesResetHTML = `<button class="botao-remover-secao btn-resetar-auditoria" title="Resetar progresso da auditoria">${iconeLixeira}</button>`;
        }

        if (state.status === 'em_progresso') {
            htmlInterno += `<div class="botoes-acao-card">
                                <button class="btn-primario btn-continuar">Continuar</button>
                                <button class="btn-secundario btn-exportar-json">Exportar JSON</button>
                                ${botoesResetHTML}
                            </div>`;
        } else { // 'finalizada'
            htmlInterno += `<div class="botoes-acao-card">
                                <button class="btn-secundario btn-reabrir">Reabrir</button>
                                <button class="btn-primario btn-exportar-json">Exportar JSON</button>
                                <button class="btn-pdf btn-exportar-pdf">Exportar PDF</button>
                                ${botoesResetHTML}
                            </div>`;
        }
        htmlInterno += `<div class="export-status">Exportado: ${statusJson} | ${statusPdf}</div>`;
    } else {
        const detalhes = Auditoria.getDetalhesDoPlanejamento(planejamentoId);
        htmlInterno = `
            <p><strong>Responsável:</strong> ${detalhes.responsavel}</p>
            <p><strong>Líder Planejado:</strong> ${detalhes.auditorLider}</p>
            <p><strong>Acompanhante Planejado:</strong> ${detalhes.auditorAcompanhante}</p>
            <button class="iniciar-auditoria-btn btn-primario">Iniciar Nova Auditoria</button>
        `;
    }
    detalheAtual.innerHTML = htmlInterno;
}

export function renderizarTelaConfirmacao(planejamento, todosAuditores) {
    document.getElementById('confirmacao-departamento').textContent = planejamento.Departamento_Departamento;
    const dataInput = document.getElementById('data-auditoria');
    const dataPlanejada = planejamento.Data ? new Date(planejamento.Data * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    dataInput.value = dataPlanejada;
    const liderSelect = document.getElementById('auditor-lider-select');
    const acompSelect = document.getElementById('auditor-acomp-select');
    liderSelect.innerHTML = '<option value="0">Nenhum</option>';
    acompSelect.innerHTML = '<option value="0">Nenhum</option>';
    todosAuditores.forEach(auditor => {
        const optionHTML = `<option value="${auditor.id}">${auditor.NomeAuditorRef}</option>`;
        liderSelect.innerHTML += optionHTML;
        acompSelect.innerHTML += optionHTML;
    });
    liderSelect.value = planejamento.Auditor_Lider || "0";
    acompSelect.value = planejamento.Auditor_Acompanhante || "0";
}

export function atualizarHeaderTitulo() {
    const tituloEl = document.getElementById('header-titulo');
    if (!tituloEl) return;
    const infoAuditoria = Auditoria.getInfoAuditoriaPrincipal();
    const nomeDepartamento = Auditoria.getDepartamentoAtivoNome();
    tituloEl.textContent = `Auditoria: ${infoAuditoria.Nome_Auditoria}, ${nomeDepartamento}`;
}

export function atualizarHeaderProgresso() {
    const progressoEl = document.getElementById('header-progresso');
    if (!progressoEl) return;
    
    // Pega o ID da auditoria ativa de forma segura através do novo getter
    const idDaAuditoriaAtiva = Auditoria.getCurrentAuditoriaId();
    if (!idDaAuditoriaAtiva) {
        progressoEl.textContent = '0 / 0 (0%)';
        return;
    }

    const progresso = Auditoria.calcularProgresso(idDaAuditoriaAtiva);
    progressoEl.textContent = `${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)`;
}

export function renderizarChecklistCompleto() {
    const container = document.getElementById('checklist-container');
    if (!container) return;
    container.innerHTML = ''; // Limpa a tela
    
    const checklistDaArea = Auditoria.getChecklistParaAreaAtiva();
    if (!checklistDaArea || checklistDaArea.length === 0) {
        container.innerHTML = '<h3>Nenhuma pergunta para esta auditoria.</h3>';
        return;
    }

    // 1. Pega TODOS os modelos de pergunta para construir a árvore completa
    const todosOsModelos = Auditoria.getTodosOsModelosDePerguntas();
    const mapaDeItens = new Map(todosOsModelos.map(item => [item.id, { ...item, children: [] }]));

    // 2. Constrói a árvore aninhando os filhos em seus pais
    const itensRaizGeral = [];
    for (const item of mapaDeItens.values()) {
        if (item.ID_Pai && mapaDeItens.has(item.ID_Pai)) {
            mapaDeItens.get(item.ID_Pai).children.push(item);
        } else {
            itensRaizGeral.push(item);
        }
    }

    // 3. Filtra a árvore para manter apenas os itens que pertencem à área atual
    const idsRelevantesDaArea = new Set(checklistDaArea.map(item => item.id));
    const arvoreFiltrada = filtrarArvorePorRelevancia(itensRaizGeral, idsRelevantesDaArea);

    // 4. Ordena a árvore filtrada em todos os níveis
    ordenarArvore(arvoreFiltrada);

    // 5. Inicia a renderização recursiva
    arvoreFiltrada.forEach(item => renderizarItemRecursivo(item, container));

    // 6. Adiciona o botão de finalizar no final
    const finalizarDiv = document.createElement('div');
    finalizarDiv.className = 'finalizar-container';
    finalizarDiv.innerHTML = `<button id="btn-finalizar-auditoria">Finalizar Auditoria</button>`;
    container.appendChild(finalizarDiv);

    ajustarAlturaTextareas();
}

/**
 * Função recursiva principal que decide qual tipo de item renderizar.
 * @param {object} item - O nó da árvore a ser renderizado.
 * @param {HTMLElement} containerPai - O elemento DOM onde o item será inserido.
 */
function renderizarItemRecursivo(item, containerPai, instanciaInfo = null) {
    if (!Auditoria.avaliarCondicao(item, instanciaInfo)) {
        return; // Pula a renderização se a condição de visibilidade não for atendida
    }

    const { modelo } = Auditoria.getDadosCompletosPergunta(item.id);

    if (modelo.Tipo_Item === 'Secao' || modelo.Tipo_Item === 'secao') {
        if (modelo.Repetivel === 'SIM') {
            const contagemInstancias = Auditoria.getContagemInstancias(modelo.id);
            for (let i = 1; i <= contagemInstancias; i++) {
                renderizarInstanciaSecao(modelo, containerPai, item.children, i);
            }
            renderizarBotaoAdicionar(modelo, containerPai);
        } else {
            renderizarSecaoNaoRepetivel(modelo, containerPai, item.children);
        }
    } else if (modelo.Tipo_Item === 'Pergunta' || modelo.Tipo_Item === 'resultado_calculado') {
        renderizarPergunta(Auditoria.getDadosCompletosPergunta(item.id), containerPai, instanciaInfo);
    }
}


// --- FUNÇÕES AUXILIARES PARA PREPARAR A ÁRVORE ---

/**
 * Filtra uma árvore de nós, mantendo apenas os nós que estão na lista de IDs relevantes
 * ou que são pais de nós relevantes.
 */
function filtrarArvorePorRelevancia(nodes, idsRelevantes) {
    return nodes.map(node => {
        if (node.children && node.children.length > 0) {
            node.children = filtrarArvorePorRelevancia(node.children, idsRelevantes);
        }
        if (idsRelevantes.has(node.id) || (node.children && node.children.length > 0)) {
            return node;
        }
        return null;
    }).filter(Boolean);
}

/**
 * Ordena recursivamente uma árvore de nós com base na coluna 'Ordem'.
 */
function ordenarArvore(nodes) {
    nodes.sort((a, b) => a.Ordem - b.Ordem);
    nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
            ordenarArvore(node.children);
        }
    });
}

function ajustarAlturaTextareas() {
    const textareas = document.querySelectorAll('.resposta-texto');
    textareas.forEach(textarea => {
        // Define uma altura mínima baseada no 'rows' para garantir que comece pequeno
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
        textarea.style.minHeight = (textarea.rows * lineHeight) + 'px';
        
        // Ajusta a altura com base no conteúdo existente (ou falta dele)
        textarea.style.height = 'auto'; // Reseta a altura para o cálculo
        textarea.style.height = textarea.scrollHeight + 'px';
    });
}


// CÓDIGO COMPLETO E FINAL PARA A FUNÇÃO renderizarPergunta

function renderizarPergunta(dadosCompletos, containerPai, instanciaInfo) {
    const { modelo, grupo, opcoes } = dadosCompletos;
    const perguntaCard = document.createElement('div');
    perguntaCard.className = 'pergunta-card';
    const idUnico = instanciaInfo ? `${modelo.id}-${instanciaInfo.numero}` : String(modelo.id);

    // Se a pergunta for um resultado calculado, renderiza o badge e encerra.
    if (modelo.Tipo_Item === 'resultado_calculado') {
        perguntaCard.classList.add('resultado-calculado-card');
        const resultadoNumerico = Auditoria.executarCalculo(modelo.Formula, instanciaInfo);
        Auditoria.salvarResposta(idUnico, resultadoNumerico);
        
        let displayHTML = '<div class="resultado-placeholder">Aguardando preenchimento...</div>';
        if (resultadoNumerico !== null && resultadoNumerico !== undefined) {
            if (modelo.FAIXA_CALCULADA) { 
                const faixa = Auditoria.getDescricaoDaFaixa(modelo.FAIXA_CALCULADA, resultadoNumerico);
                if (faixa) {
                    displayHTML = `<div class="resultado-badge" style="background-color: ${faixa.Cor_Fundo}; color: ${faixa.Cor_Texto};">${faixa.Descricao_Saida}<span class="resultado-valor-numerico">(${resultadoNumerico})</span></div>`;
                } else {
                    displayHTML = `<div class="resultado-badge">${resultadoNumerico}</div>`;
                }
            } else {
                displayHTML = `<div class="resultado-badge">${resultadoNumerico}</div>`;
            }
        }

        perguntaCard.innerHTML = `
            <p class="texto-pergunta">${modelo.Texto_Pergunta}</p>
            <div class="resultado-container">${displayHTML}</div>`;
        
        containerPai.appendChild(perguntaCard);
        return; // Encerra a função aqui para perguntas calculadas
    }
    
    // Continua para perguntas normais
    perguntaCard.dataset.itemId = idUnico;

    const pontoAberto = Auditoria.getPontoEmAberto(idUnico);
    if (pontoAberto) {
        perguntaCard.classList.add('ponto-em-aberto-card');
    }

    // --- LÓGICA DE RENDERIZAÇÃO DAS RESPOSTAS (INCLUINDO MODO COMPACTO) ---
    const isModoCompacto = document.getElementById('modo-compacto-checkbox')?.checked || false;
    const valorSalvo = Auditoria.getResposta(idUnico);
    const tipoApresentacao = grupo?.Tipo_Apresentacao || 'botoes';
    let respostasHTML = '';

    if (isModoCompacto && tipoApresentacao === 'botoes') {
        const opcaoSelecionada = opcoes.find(opt => String(opt.id) === String(valorSalvo));
        if (opcaoSelecionada) {
            respostasHTML = `<button class="botao-resposta selecionado" data-pergunta-id="${idUnico}" data-valor="${opcaoSelecionada.id}" style="background-color:${opcaoSelecionada.Fundo}; color:${opcaoSelecionada.Fonte}; border-color:${opcaoSelecionada.Fundo};">${opcaoSelecionada.Texto_Opcao}</button>`;
        } else {
            respostasHTML = `<button class="botao-resposta" data-pergunta-id="${idUnico}">Selecionar Resposta...</button>`;
        }
    } else {
        // Renderização normal (não compacta ou para tipos diferentes de 'botoes')
        switch (tipoApresentacao) {
            case 'dropdown':
                const optionsHTML = opcoes.map(opt => `<option value="${opt.id}" ${String(valorSalvo) === String(opt.id) ? 'selected' : ''}>${opt.Texto_Opcao}</option>`).join('');
                respostasHTML = `<select class="resposta-dropdown" data-pergunta-id="${idUnico}"><option value="">Selecione...</option>${optionsHTML}</select>`;
                break;
            case 'textolivre':
                respostasHTML = `<textarea class="resposta-texto" data-pergunta-id="${idUnico}" placeholder="Digite sua observação..." rows="2">${valorSalvo || ''}</textarea>`;
                break;
            case 'botoes':
            default:
                respostasHTML = opcoes.map(opt => `<button class="botao-resposta ${String(valorSalvo) === String(opt.id) ? 'selecionado' : ''}" data-pergunta-id="${idUnico}" data-valor="${opt.id}" style="${String(valorSalvo) === String(opt.id) ? `background-color:${opt.Fundo}; color:${opt.Fonte}; border-color:${opt.Fundo};` : ''}">${opt.Texto_Opcao}</button>`).join('');
                break;
        }
    }

    // --- LÓGICA DE RENDERIZAÇÃO DA ANOTAÇÃO (COMO NO iAUDITOR) ---
    const anotacaoSalva = Auditoria.getAnotacao(idUnico);
    const temAnotacao = anotacaoSalva.trim() !== '';
    const classeAnotacao = temAnotacao ? 'com-conteudo' : '';
    
    // O contêiner da anotação é sempre criado, mas seu conteúdo muda.
    // O CSS controlará a borda e o padding apenas quando houver conteúdo.
    let anotacaoDisplayHTML = temAnotacao 
        ? `<div class="anotacao-display">${anotacaoSalva}</div>`
        : ''; // Se não há anotação, o div interno não é criado.

    const anotacaoContainerHTML = `<div class="anotacao-container">${anotacaoDisplayHTML}</div>`;


    // --- LÓGICA PARA OS BOTÕES DE AÇÃO ---
    const midiasAnexadas = Auditoria.getMidias(idUnico);
    const temMidia = midiasAnexadas.length > 0;
    const classeMidia = temMidia ? 'com-conteudo' : '';
    const contadorMidiaHTML = temMidia ? `(${midiasAnexadas.length})` : '';

    const iconeAnotacao = '<svg>...</svg>'; // (seu svg aqui)
    const iconeMidia = '<svg>...</svg>'; // (seu svg aqui)
    const iconePontoAberto = '<svg>...</svg>'; // (seu svg aqui)

    // --- MONTAGEM FINAL DO HTML DO CARD ---
    perguntaCard.innerHTML = `
        <p class="texto-pergunta">${modelo.Texto_Pergunta}</p>
        <div class="respostas-container">${respostasHTML}</div>
        
        ${anotacaoContainerHTML}
        
        <div class="acoes-container">
            <div class="acao-item"><button class="botao-acao botao-anotacao ${classeAnotacao}" title="Anotações">${iconeAnotacao} ${temAnotacao ? 'Editar' : 'Adicionar'} anotação</button></div>
            <div class="acao-item"><button class="botao-acao botao-midia ${classeMidia}" title="Mídias">${iconeMidia} Mídia <span class="contador-conteudo">${contadorMidiaHTML}</span></button></div>
            <div class="acao-item"><button class="botao-acao botao-ponto-aberto ${pontoAberto ? 'com-conteudo' : ''}" title="${pontoAberto ? `Pendência: ${pontoAberto.pendencia}` : 'Marcar como Ponto em Aberto'}">${iconePontoAberto} Ação</button></div>
        </div>`;
    
    containerPai.appendChild(perguntaCard);

    // Adiciona o listener de evento para o contêiner de anotação, se ele existir
    const anotacaoContainer = perguntaCard.querySelector('.anotacao-container');
    if (anotacaoContainer) {
        anotacaoContainer.addEventListener('click', () => {
            UI.expandirAnotacaoParaFullscreen(Auditoria.getAnotacao(idUnico), (novoTexto) => {
                Auditoria.salvarAnotacao(idUnico, novoTexto);
                UI.renderizarChecklistCompleto(); 
            });
        });
    }
}

function renderizarSecaoNaoRepetivel(modeloSecao, containerPai, filhos) { // <-- Garante que 'filhos' é recebido
    const secaoCard = document.createElement('div');
    secaoCard.className = 'secao-nao-repetivel';
    const idUnicoSecao = `secao-${modeloSecao.id}`;
    const iconeToggle = `<svg class="icone-toggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
    
    // As seções normais começam expandidas por padrão
    const deveExpandir = true; 
    
    // A classe do corpo da seção agora é 'secao-body' para ser compatível com o novo CSS de grid
    secaoCard.innerHTML = `
        <div class="secao-header" data-id-unico="${idUnicoSecao}">
            <div class="titulo-container">${iconeToggle} <h4>${modeloSecao.Texto_Pergunta}</h4></div>
        </div>
        <div class="secao-body ${deveExpandir ? 'expandido' : ''}">
            <div class="secao-body-content"></div>
        </div>`;

    containerPai.appendChild(secaoCard);

    if (deveExpandir) {
        secaoCard.querySelector('.icone-toggle').classList.add('expandido');
    }
    
    // Seleciona o contêiner interno para os filhos
    const corpo = secaoCard.querySelector('.secao-body-content');
    
    // A linha que buscava 'filhos' foi removida.
    // Agora, simplesmente percorremos a lista de 'filhos' que foi passada como parâmetro.
    filhos.forEach(filho => renderizarItemRecursivo(filho, corpo));
}
function renderizarBotaoAdicionar(modeloSecao, containerPai) {
    const cardAdicionar = document.createElement('div');
    cardAdicionar.className = 'secao-adicionar-card';
    cardAdicionar.dataset.secaoId = modeloSecao.id;
    cardAdicionar.innerHTML = `<div class="icone-add"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div><h4>${modeloSecao.Texto_Pergunta}</h4>`;
    containerPai.appendChild(cardAdicionar);
}

function renderizarInstanciaSecao(modeloSecao, containerPai, filhos, numeroInstancia) {
    const instanciaCard = document.createElement('div');
    instanciaCard.className = 'secao-instancia-card';
    instanciaCard.dataset.secaoModeloId = modeloSecao.id;
    const idUnicoSecao = `${modeloSecao.id}-${numeroInstancia}`;
    const iconeToggle = `<svg class="icone-toggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
    const iconeLixeira = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.576l.84-10.518.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>`;
    
    const recemAdicionada = Auditoria.verificarUltimaInstanciaAdicionada(modeloSecao.id, numeroInstancia);
    if (recemAdicionada) {
        estadoUI.secoesExpandidas.add(idUnicoSecao);
    }
    const deveExpandir = estadoUI.secoesExpandidas.has(idUnicoSecao);
    
    // A classe do corpo da instância agora é 'secao-body' para ser compatível com o novo CSS de grid
    instanciaCard.innerHTML = `<div class="secao-header secao-instancia-header" data-id-unico="${idUnicoSecao}"><div class="titulo-container"><span class="icone-toggle-container">${iconeToggle}</span><h4>${modeloSecao.Texto_Pergunta} ${numeroInstancia}</h4></div><button class="botao-remover-secao" data-secao-id="${modeloSecao.id}" data-instancia-numero="${numeroInstancia}">${iconeLixeira}</button></div><div class="secao-body ${deveExpandir ? 'expandido' : ''}"><div class="secao-body-content"></div></div>`;
    
    if (deveExpandir) {
        instanciaCard.querySelector('.icone-toggle').classList.add('expandido');
    }
    
    containerPai.appendChild(instanciaCard);
    
    // IMPORTANTE: Selecionamos um contêiner interno para os filhos.
    // Isso é necessário por causa do novo layout de grid para a animação.
    const corpo = instanciaCard.querySelector('.secao-body-content');
    
    // A linha 'const filhos = checklistCompleto.filter(...)' foi REMOVIDA.
    console.log(`Renderizando filhos da instância "${modeloSecao.Texto_Pergunta} #${numeroInstancia}":`, filhos);
    
    // O forEach agora está completo e chama a função correta.
    filhos.forEach(filho => {
        renderizarPergunta(Auditoria.getDadosCompletosPergunta(filho.id), corpo, { numero: numeroInstancia }); 
    });
}

export function expandirAnotacaoParaFullscreen(textoAtual, callbackSalvar) {
    if (document.querySelector('.modal-anotacao-fullscreen')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-anotacao-fullscreen';
    modal.innerHTML = `<div class="modal-header"><h3>Anotações</h3><button id="modal-anotacao-cancelar" class="botao-modal-cancelar">&times;</button></div><textarea placeholder="Digite suas anotações...">${textoAtual}</textarea><div class="anotacao-botoes-modal"><button id="modal-anotacao-salvar" class="botao-modal-salvar">Salvar e Fechar</button></div>`;
    document.body.appendChild(modal);
    const textarea = modal.querySelector('textarea');
    textarea.focus();
    const fecharESalvar = () => {
        callbackSalvar(textarea.value);
        if (modal.parentElement) {
            document.body.removeChild(modal);
        }
    };
    const fecharSemSalvar = () => {
        if (modal.parentElement) {
            document.body.removeChild(modal);
        }
    };
    document.getElementById('modal-anotacao-salvar').addEventListener('click', fecharESalvar);
    document.getElementById('modal-anotacao-cancelar').addEventListener('click', fecharSemSalvar);
}

export function mostrarModalFinalizar(resultadoJSON) {
    const modal = document.getElementById('modal-finalizar');
    // <-- MUDANÇA CRÍTICA AQUI
    // Passamos o objeto para o escopo global para o main.js pegar.
    if (window.setResultadoFinal) {
        window.setResultadoFinal(resultadoJSON);
    }
    modal.style.display = 'flex';
}
export function mostrarModalPontoAberto(perguntaId) {
    const modal = document.getElementById('modal-ponto-aberto');
    modal.dataset.perguntaId = perguntaId;
    document.getElementById('ponto-aberto-textarea').value = '';
    modal.style.display = 'flex';
    document.getElementById('ponto-aberto-textarea').focus();
}

export function fecharModalPontoAberto() {
    const modal = document.getElementById('modal-ponto-aberto');
    modal.style.display = 'none';
    delete modal.dataset.perguntaId;
}

export function mostrarModalGerenciarMidia(perguntaId) {
    const modal = document.getElementById('modal-gerenciar-midia');
    const container = document.getElementById('lista-midias-container');
    const textoPerguntaEl = document.getElementById('modal-midia-pergunta-texto');
    const inputAdicionar = document.getElementById('adicionar-nova-midia-input');
    
    modal.dataset.perguntaId = perguntaId;
    inputAdicionar.value = ''; 

    const dadosPergunta = Auditoria.getDadosCompletosPergunta(perguntaId.split('-')[0]);
    textoPerguntaEl.textContent = `Anexos para: "${dadosPergunta.modelo.Texto_Pergunta}"`;

    const midias = Auditoria.getMidias(perguntaId);
    container.innerHTML = '';
    if (midias.length === 0) {
        container.innerHTML = '<p>Nenhuma mídia anexada.</p>';
    } else {
        const iconeLixeira = `<svg ... (código do ícone de lixeira) ... </svg>`; // O código do ícone já está no seu arquivo, pode manter
        const iconeArquivoGenerico = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="midia-generica-icona"><path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.343a1 1 0 00-.293-.707l-4.636-4.636A1 1 0 0011.657 2H4zm3.293 2.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L10 6.414V11a1 1 0 11-2 0V6.414L6.293 8.707a1 1 0 01-1.414-1.414l3-3z" clip-rule="evenodd" /></svg>`;

        const listaUL = document.createElement('ul');
        listaUL.className = 'lista-anexos';
        midias.forEach(midia => {
            const itemLI = document.createElement('li');
            let midiaPreviewHTML = '';

            if (midia.dataUrl) { // Se for imagem, mostra a miniatura
                midiaPreviewHTML = `<img src="${midia.dataUrl}" class="midia-thumbnail" alt="miniatura">`;
            } else { // Senão, mostra um ícone genérico
                midiaPreviewHTML = iconeArquivoGenerico;
            }

            itemLI.innerHTML = `
                <div class="midia-preview-container">${midiaPreviewHTML}</div>
                <span class="midia-nome-arquivo">${midia.name}</span>
                <button class="botao-remover-secao btn-remover-midia" data-nome-arquivo="${midia.name}" title="Remover anexo">${iconeLixeira}</button>
            `;
            listaUL.appendChild(itemLI);
        });
        container.appendChild(listaUL);
    }

    modal.style.display = 'flex';
}

export function fecharModalGerenciarMidia() {
    const modal = document.getElementById('modal-gerenciar-midia');
    modal.style.display = 'none';
    delete modal.dataset.perguntaId;
}

export function expandirRespostasParaCard(cardElemento) {
    if (!cardElemento) return;
    const idUnico = cardElemento.dataset.itemId;
    const dadosCompletos = Auditoria.getDadosCompletosPergunta(idUnico.split('-')[0]);
    const { grupo, opcoes } = dadosCompletos;
    
    // Gera o HTML de todos os botões de resposta
    const valorSalvo = Auditoria.getResposta(idUnico);
    const respostasHTML = opcoes.map(opt => `<button class="botao-resposta ${String(valorSalvo) === String(opt.id) ? 'selecionado' : ''}" data-pergunta-id="${idUnico}" data-valor="${opt.id}" style="${String(valorSalvo) === String(opt.id) ? `background-color:${opt.Fundo}; color:${opt.Fonte}; border-color:${opt.Fundo};` : ''}">${opt.Texto_Opcao}</button>`).join('');

    // Substitui o conteúdo do contêiner de respostas
    const containerRespostas = cardElemento.querySelector('.respostas-container');
    if (containerRespostas) {
        containerRespostas.innerHTML = respostasHTML;
    }
}

export async function renderizarConteudoAjuda() {
    const container = document.getElementById('conteudo-ajuda');
    if (!container) return;

    if (container.dataset.loaded === 'true') {
        console.log("Conteúdo da ajuda já processado.");
        return;
    }

    console.log("Iniciando a tentativa de carregamento dinâmico do módulo de ajuda...");

    try {
        // Tenta importar o módulo dinamicamente. O caminho é o ponto de falha.
        // O await aqui é crucial.
        const ajudaModulo = await import('../help/ajuda.js');

        // Se a linha acima funcionou, o módulo foi encontrado e carregado.
        console.log("SUCESSO: O módulo 'ajuda.js' foi importado com sucesso.", ajudaModulo);

        if (ajudaModulo.ajudaHTML) {
            console.log("A variável 'ajudaHTML' foi encontrada dentro do módulo.");
            container.innerHTML = ajudaModulo.ajudaHTML;
            container.dataset.loaded = 'true'; // Marca como carregado
        } else {
            throw new Error("O módulo 'ajuda.js' foi carregado, mas não exporta 'ajudaHTML'.");
        }

    } catch (error) {
        // Se a importação falhou, o 'catch' será executado.
        console.error("ERRO CRÍTICO AO IMPORTAR O MÓDULO DE AJUDA:", error);

        // Exibe o erro diretamente na tela para fácil visualização.
        container.innerHTML = `
            <div style="color: red; font-family: monospace; padding: 10px; border: 1px solid red; background-color: #ffeeee;">
                <p><strong>Falha ao carregar o módulo de ajuda.</strong></p>
                <p><strong>Caminho testado:</strong> <code>../help/ajuda.js</code></p>
                <p><strong>Erro:</strong> ${error.message}</p>
                <p>Verifique o console (F12) para o stack trace completo.</p>
            </div>
        `;
    }
}