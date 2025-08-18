// js/apaud_ui.js (v6.0 - Com workflow de arquivos)

import * as Auditoria from './apaud_auditoria.js';

export const estadoUI = {
    secoesExpandidas: new Set()
};

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
        
        if (state.status === 'em_progresso') {
            htmlInterno += `<div class="botoes-acao-card"><button class="btn-primario btn-continuar">Continuar</button><button class="btn-secundario btn-exportar-json">Exportar JSON</button></div>`;
        } else {
            htmlInterno += `<div class="botoes-acao-card"><button class="btn-secundario btn-reabrir">Reabrir</button><button class="btn-primario btn-exportar-json">Exportar JSON</button><button class="btn-pdf btn-exportar-pdf">Exportar PDF</button></div>`;
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
    const progresso = Auditoria.calcularProgresso();
    progressoEl.textContent = `${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)`;
}

export function renderizarChecklistCompleto() {
    const container = document.getElementById('checklist-container');
    container.innerHTML = '';
    const checklist = Auditoria.getChecklistParaAreaAtiva();
    if (!checklist || checklist.length === 0) {
        container.innerHTML = '<h3>Nenhuma pergunta para esta auditoria.</h3>';
        return;
    }
    const itensRaiz = checklist.filter(item => !item.ID_Pai || item.ID_Pai === 0).sort((a, b) => a.Ordem - b.Ordem);
    itensRaiz.forEach(item => renderizarItem(item, container, checklist));
    
    // Adiciona o botão de finalizar no final
    const finalizarDiv = document.createElement('div');
    finalizarDiv.className = 'finalizar-container';
    finalizarDiv.innerHTML = `<button id="btn-finalizar-auditoria">Finalizar Auditoria</button>`;
    container.appendChild(finalizarDiv);
}

function renderizarItem(item, containerPai, checklistCompleto, instanciaInfo = null) {
    if (!Auditoria.avaliarCondicao(item)) return;
    const dadosCompletos = Auditoria.getDadosCompletosPergunta(item.id);
    const { modelo } = dadosCompletos;
    if (modelo.Tipo_Item === 'Secao' || modelo.Tipo_Item === 'secao') {
        if (modelo.Repetivel === 'SIM') {
            const contagemInstancias = Auditoria.getContagemInstancias(modelo.id);
            for (let i = 1; i <= contagemInstancias; i++) {
                renderizarInstanciaSecao(modelo, containerPai, checklistCompleto, i);
            }
            renderizarBotaoAdicionar(modelo, containerPai);
        } else {
            renderizarSecaoNaoRepetivel(modelo, containerPai, checklistCompleto);
        }
    } else if (modelo.Tipo_Item === 'Pergunta') {
        renderizarPergunta(dadosCompletos, containerPai, instanciaInfo);
    }
}

function renderizarPergunta(dadosCompletos, containerPai, instanciaInfo) {
    const { modelo, opcoes } = dadosCompletos;
    const perguntaCard = document.createElement('div');
    perguntaCard.className = 'pergunta-card';
    const idUnico = instanciaInfo ? `${modelo.id}-${instanciaInfo.numero}` : String(modelo.id);
    perguntaCard.dataset.itemId = idUnico;

    const pontoAberto = Auditoria.getPontoEmAberto(idUnico);
    if (pontoAberto) {
        perguntaCard.classList.add('ponto-em-aberto-card');
    }

    const anotacaoSalva = Auditoria.getAnotacao(idUnico);
    const temAnotacao = anotacaoSalva.trim() !== '';
    const classeAnotacao = temAnotacao ? 'com-conteudo' : '';
    const contadorAnotacaoHTML = temAnotacao ? `(${anotacaoSalva.split('\n').length} l)` : '';

    const midiasAnexadas = Auditoria.getMidias(idUnico);
    const temMidia = midiasAnexadas.length > 0;
    const classeMidia = temMidia ? 'com-conteudo' : '';
    const contadorMidiaHTML = temMidia ? `(${midiasAnexadas.length})` : '';

    const iconeAnotacao = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/></svg> Anotações <span class="contador-conteudo">${contadorAnotacaoHTML}</span>`;
    const iconeMidia = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-3.69l-2.76-2.76a.75.75 0 00-1.06 0l-2.22 2.22a.75.75 0 000 1.06l-2.22-2.22a.75.75 0 00-1.06 0l-2.22 2.22a.75.75 0 000 1.06l-1.47-1.47a.75.75 0 00-1.06 0L2.5 11.06zM6.25 7a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/></svg> Mídia <span class="contador-conteudo">${contadorMidiaHTML}</span>`;
    const iconePontoAberto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd" /></svg> Ponto Aberto`;
    
    const tooltipPendencia = pontoAberto ? `title="Pendência: ${pontoAberto.pendencia}"` : 'title="Marcar como Ponto em Aberto"';
    
    let respostasHTML = '';
    if (opcoes.length > 0) {
        respostasHTML = opcoes.map(opt => {
            const isSelecionado = Auditoria.getResposta(idUnico) === opt.Texto_Opcao;
            const estilo = isSelecionado ? `style="background-color:${opt.Fundo}; color:${opt.Fonte}; border-color:${opt.Fundo};"` : '';
            return `<button class="botao-resposta ${isSelecionado ? 'selecionado' : ''}" data-pergunta-id="${idUnico}" data-valor="${opt.Texto_Opcao}" ${estilo}>${opt.Texto_Opcao}</button>`;
        }).join('');
    } else if (modelo.Tipo_Resposta_Utilizado) {
        const valorSalvo = Auditoria.getResposta(idUnico) || '';
        respostasHTML = `<textarea class="resposta-texto" data-pergunta-id="${idUnico}" placeholder="Digite sua observação...">${valorSalvo}</textarea>`;
    }

    perguntaCard.innerHTML = `
        <p class="texto-pergunta">${modelo.Texto_Pergunta}</p>
        <div class="respostas-container">${respostasHTML}</div>
        <div class="acoes-container">
            <button class="botao-acao botao-anotacao ${classeAnotacao}">${iconeAnotacao}</button>
            <button class="botao-acao botao-midia ${classeMidia}">${iconeMidia}</button>
            <button class="botao-acao botao-ponto-aberto ${pontoAberto ? 'com-conteudo' : ''}" ${tooltipPendencia}>${iconePontoAberto}</button>
        </div>`;
    containerPai.appendChild(perguntaCard);
}

function renderizarSecaoNaoRepetivel(modeloSecao, containerPai, checklistCompleto) {
    const secaoCard = document.createElement('div');
    secaoCard.className = 'secao-nao-repetivel';
    const idUnicoSecao = `secao-${modeloSecao.id}`;
    const iconeToggle = `<svg class="icone-toggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
    const deveExpandir = true;
    secaoCard.innerHTML = `<div class="secao-header" data-id-unico="${idUnicoSecao}"><div class="titulo-container">${iconeToggle} <h4>${modeloSecao.Texto_Pergunta}</h4></div></div><div class="secao-body ${deveExpandir ? 'expandido' : ''}"></div>`;
    containerPai.appendChild(secaoCard);
    if (deveExpandir) {
        secaoCard.querySelector('.icone-toggle').classList.add('expandido');
    }
    const corpo = secaoCard.querySelector('.secao-body');
    const filhos = checklistCompleto.filter(filho => filho.ID_Pai == modeloSecao.id).sort((a,b) => a.Ordem - b.Ordem);
    filhos.forEach(filho => renderizarItem(filho, corpo, checklistCompleto));
}

function renderizarBotaoAdicionar(modeloSecao, containerPai) {
    const cardAdicionar = document.createElement('div');
    cardAdicionar.className = 'secao-adicionar-card';
    cardAdicionar.dataset.secaoId = modeloSecao.id;
    cardAdicionar.innerHTML = `<div class="icone-add"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div><h4>${modeloSecao.Texto_Pergunta}</h4>`;
    containerPai.appendChild(cardAdicionar);
}

function renderizarInstanciaSecao(modeloSecao, containerPai, checklistCompleto, numeroInstancia) {
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
    instanciaCard.innerHTML = `<div class="secao-header secao-instancia-header" data-id-unico="${idUnicoSecao}"><div class="titulo-container"><span class="icone-toggle-container">${iconeToggle}</span><h4>${modeloSecao.Texto_Pergunta} ${numeroInstancia}</h4></div><button class="botao-remover-secao" data-secao-id="${modeloSecao.id}" data-instancia-numero="${numeroInstancia}">${iconeLixeira}</button></div><div class="secao-instancia-body ${deveExpandir ? 'expandido' : ''}"></div>`;
    if (deveExpandir) {
        instanciaCard.querySelector('.icone-toggle').classList.add('expandido');
    }
    containerPai.appendChild(instanciaCard);
    const corpo = instanciaCard.querySelector('.secao-instancia-body');
    const filhos = checklistCompleto.filter(filho => filho.ID_Pai == modeloSecao.id).sort((a,b) => a.Ordem - b.Ordem);
    filhos.forEach(filho => renderizarItem(filho, corpo, checklistCompleto, { numero: numeroInstancia }));
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